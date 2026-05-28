// Package stt provides a gRPC client for the Python faster-whisper STT service.
// It implements the audio.STTService interface required by AudioProcessor.
//
// Audio flow (file-based, current architecture):
//
//	MinIO → GetObject (streaming) → gRPC AudioChunk stream → TranscriptResult
//
// The ENCODED format is used: raw file bytes are streamed without decoding on
// the Go side; the Python service decodes with ffmpeg/soundfile.
package stt

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/QosmuratSamat0/Noona-AI/backend/pkg/pb/stt"
)

const (
	// chunkSize is the gRPC message size for streaming audio bytes.
	// 32 KB balances throughput vs. memory per concurrent stream.
	chunkSize          = 32 * 1024
	healthCheckTimeout = 5 * time.Second
)

// GRPCClient implements audio.STTService via the Python gRPC microservice.
type GRPCClient struct {
	client     pb.STTServiceClient
	conn       *grpc.ClientConn
	minio      *minio.Client
	bucketName string
	timeout    time.Duration
}

// NewGRPCClient dials the Python gRPC server and returns a ready-to-use client.
//
//	addr       – host:port of the Python STT service (e.g. "localhost:50051")
//	minioClient – raw minio.Client for streaming the audio object
//	bucketName – MinIO bucket containing audio files (e.g. "voice-input")
func NewGRPCClient(addr string, minioClient *minio.Client, bucketName string, timeout time.Duration) (*GRPCClient, error) {
	normalizedAddr, err := normalizeGRPCAddr(addr)
	if err != nil {
		return nil, err
	}
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}

	conn, err := grpc.NewClient(
		normalizedAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			// Allow receiving large transcripts
			grpc.MaxCallRecvMsgSize(10*1024*1024),
			// Allow sending large audio files (up to 50 MB)
			grpc.MaxCallSendMsgSize(50*1024*1024),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("stt grpc: dial %s: %w", normalizedAddr, err)
	}

	client := pb.NewSTTServiceClient(conn)

	// Non-blocking health check: log a warning if STT service is unreachable at
	// startup, but do NOT fail — the worker will surface errors per-job when the
	// service is actually needed.
	healthCtx, cancel := context.WithTimeout(context.Background(), healthCheckTimeout)
	defer cancel()
	if _, err := client.Health(healthCtx, &pb.HealthRequest{}); err != nil {
		slog.Warn("stt grpc: service not reachable at startup (will retry per-job)",
			"addr", normalizedAddr, "error", err)
	}

	return &GRPCClient{
		client:     client,
		conn:       conn,
		minio:      minioClient,
		bucketName: bucketName,
		timeout:    timeout,
	}, nil
}

func normalizeGRPCAddr(addr string) (string, error) {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return "", fmt.Errorf("stt grpc: empty address")
	}

	if i := strings.Index(addr, "#"); i >= 0 {
		addr = strings.TrimSpace(addr[:i])
	}

	if strings.Contains(addr, "://") {
		parsed, err := url.Parse(addr)
		if err != nil {
			return "", fmt.Errorf("stt grpc: invalid address %q: %w", addr, err)
		}
		host := parsed.Host
		if host == "" {
			return "", fmt.Errorf("stt grpc: invalid address %q", addr)
		}
		if parsed.Port() == "8001" {
			host = net.JoinHostPort(parsed.Hostname(), "50051")
		}
		addr = host
	}

	if _, _, err := net.SplitHostPort(addr); err != nil {
		if strings.Contains(err.Error(), "missing port in address") {
			return net.JoinHostPort(addr, "50051"), nil
		}
		return "", fmt.Errorf("stt grpc: invalid address %q: %w", addr, err)
	}

	return addr, nil
}

// Close releases the underlying gRPC connection.
func (c *GRPCClient) Close() error {
	return c.conn.Close()
}

// Transcribe implements audio.STTService.
// filePath is the MinIO object key (e.g. "audio/uuid.webm").
//
// Steps:
//  1. Open gRPC bidirectional stream
//  2. Stream audio bytes from MinIO in 32 KB chunks (ENCODED format)
//  3. Send end_of_stream sentinel
//  4. Collect TranscriptResult messages; return final text
func (c *GRPCClient) Transcribe(ctx context.Context, filePath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// 1. Open gRPC stream
	stream, err := c.client.TranscribeStream(ctx)
	if err != nil {
		return "", fmt.Errorf("stt grpc: open stream: %w", err)
	}

	var (
		finalText   string
		finalTextMu sync.Mutex
	)
	group, groupCtx := errgroup.WithContext(ctx)

	// 2. Stream MinIO object in chunks (producer goroutine)
	group.Go(func() error {
		return c.streamMinioObject(groupCtx, stream, filePath)
	})

	// 3. Collect results (consumer goroutine)
	group.Go(func() error {
		for {
			result, recvErr := stream.Recv()
			if recvErr == io.EOF {
				return nil
			}
			if recvErr != nil {
				return fmt.Errorf("stt grpc: recv: %w", recvErr)
			}
			slog.Info("stt grpc: partial result",
				"is_final", result.IsFinal,
				"language", result.Language,
				"text_len", len(result.Text),
			)
			if result.IsFinal {
				finalTextMu.Lock()
				finalText = result.Text
				finalTextMu.Unlock()
			}
		}
	})

	if err := group.Wait(); err != nil {
		return "", err
	}
	finalTextMu.Lock()
	finalResult := finalText
	finalTextMu.Unlock()

	slog.Info("stt grpc: transcription complete", "file", filePath, "text_len", len(finalResult))
	return finalResult, nil
}

func (c *GRPCClient) TranscribeReader(ctx context.Context, audio io.Reader, language string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	stream, err := c.client.TranscribeStream(ctx)
	if err != nil {
		return "", fmt.Errorf("stt grpc: open stream: %w", err)
	}

	var (
		finalText   string
		finalTextMu sync.Mutex
	)
	group, groupCtx := errgroup.WithContext(ctx)

	group.Go(func() error {
		buf := make([]byte, chunkSize)
		first := true
		for {
			n, readErr := audio.Read(buf)
			if n > 0 {
				chunk := &pb.AudioChunk{
					Data:   buf[:n],
					Format: pb.AudioFormat_ENCODED,
				}
				if first {
					first = false
					chunk.Language = language
				}
				if err := stream.Send(chunk); err != nil {
					return fmt.Errorf("stt grpc: send chunk: %w", err)
				}
			}
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return fmt.Errorf("stt grpc: read audio: %w", readErr)
			}
			select {
			case <-groupCtx.Done():
				return groupCtx.Err()
			default:
			}
		}
		if err := stream.Send(&pb.AudioChunk{EndOfStream: true}); err != nil {
			return fmt.Errorf("stt grpc: send EOS: %w", err)
		}
		return stream.CloseSend()
	})

	group.Go(func() error {
		for {
			result, recvErr := stream.Recv()
			if recvErr == io.EOF {
				return nil
			}
			if recvErr != nil {
				return fmt.Errorf("stt grpc: recv: %w", recvErr)
			}
			if result.IsFinal {
				finalTextMu.Lock()
				finalText = result.Text
				finalTextMu.Unlock()
			}
		}
	})

	if err := group.Wait(); err != nil {
		return "", err
	}

	finalTextMu.Lock()
	defer finalTextMu.Unlock()
	slog.Info("stt grpc: direct transcription complete", "text_len", len(finalText))
	return finalText, nil
}

// streamMinioObject reads the audio file from MinIO and sends it as gRPC chunks.
func (c *GRPCClient) streamMinioObject(
	ctx context.Context,
	stream pb.STTService_TranscribeStreamClient,
	objectKey string,
) error {
	objectKey = normalizeObjectKey(c.bucketName, objectKey)

	if _, err := c.minio.StatObject(ctx, c.bucketName, objectKey, minio.StatObjectOptions{}); err != nil {
		return fmt.Errorf("stt grpc: minio object %q not found in bucket %q: %w", objectKey, c.bucketName, err)
	}

	obj, err := c.minio.GetObject(ctx, c.bucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return fmt.Errorf("stt grpc: get minio object %q: %w", objectKey, err)
	}
	defer obj.Close()

	buf := make([]byte, chunkSize)
	first := true

	for {
		n, readErr := obj.Read(buf)
		if n > 0 {
			chunk := &pb.AudioChunk{
				Data:   buf[:n],
				Format: pb.AudioFormat_ENCODED,
			}
			// Attach language hint on the first chunk (can be extended later)
			if first {
				first = false
				// Language auto-detected by Python; leave empty for now
			}
			if err := stream.Send(chunk); err != nil {
				return fmt.Errorf("stt grpc: send chunk: %w", err)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("stt grpc: read minio object: %w", readErr)
		}
	}

	// Signal end-of-stream so Python flushes VAD buffer
	if err := stream.Send(&pb.AudioChunk{EndOfStream: true}); err != nil {
		return fmt.Errorf("stt grpc: send EOS: %w", err)
	}
	// Tell gRPC we're done sending; server will still stream results back
	return stream.CloseSend()
}

func normalizeObjectKey(bucketName, objectKey string) string {
	objectKey = strings.TrimSpace(objectKey)
	legacyDoublePrefix := bucketName + "/" + bucketName + "/"
	if strings.HasPrefix(objectKey, legacyDoublePrefix) {
		return strings.TrimPrefix(objectKey, bucketName+"/")
	}
	return objectKey
}
