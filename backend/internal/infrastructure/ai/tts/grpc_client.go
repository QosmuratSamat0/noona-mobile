package tts

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/QosmuratSamat0/Noona-AI/backend/pkg/pb/tts"
)

const (
	ttsTimeout = 1 * time.Minute
)

// GRPCClient implements audio.TTSService via Python Piper microservice.
type GRPCClient struct {
	client pb.TTSServiceClient
	conn   *grpc.ClientConn
}

// NewGRPCClient dials the Python gRPC server.
func NewGRPCClient(addr string) (*GRPCClient, error) {
	normalizedAddr, err := normalizeGRPCAddr(addr)
	if err != nil {
		return nil, err
	}

	conn, err := grpc.NewClient(
		normalizedAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("tts grpc: dial %s: %w", normalizedAddr, err)
	}

	return &GRPCClient{
		client: pb.NewTTSServiceClient(conn),
		conn:   conn,
	}, nil
}

func normalizeGRPCAddr(addr string) (string, error) {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return "", fmt.Errorf("tts grpc: empty address")
	}

	if i := strings.Index(addr, "#"); i >= 0 {
		addr = strings.TrimSpace(addr[:i])
	}

	if strings.Contains(addr, "://") {
		parsed, err := url.Parse(addr)
		if err != nil {
			return "", fmt.Errorf("tts grpc: invalid address %q: %w", addr, err)
		}
		host := parsed.Host
		if host == "" {
			return "", fmt.Errorf("tts grpc: invalid address %q", addr)
		}
		if parsed.Port() == "8002" {
			host = net.JoinHostPort(parsed.Hostname(), "50052")
		}
		addr = host
	}

	if _, _, err := net.SplitHostPort(addr); err != nil {
		if strings.Contains(err.Error(), "missing port in address") {
			return net.JoinHostPort(addr, "50052"), nil
		}
		return "", fmt.Errorf("tts grpc: invalid address %q: %w", addr, err)
	}

	return addr, nil
}

// Close releases the underlying gRPC connection.
func (c *GRPCClient) Close() error {
	return c.conn.Close()
}

// GenerateAudio implements audio.TTSService.
// Consumes the entire stream and returns the final presigned URL.
func (c *GRPCClient) GenerateAudio(ctx context.Context, text string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, ttsTimeout)
	defer cancel()

	stream, err := c.client.StreamSpeech(ctx, &pb.SpeechRequest{
		Text: text,
	})
	if err != nil {
		return "", fmt.Errorf("tts grpc: call StreamSpeech: %w", err)
	}

	var fileURL string
	for {
		chunk, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("tts grpc: recv: %w", err)
		}
		if chunk.FileUrl != "" {
			fileURL = chunk.FileUrl
		}
	}

	if fileURL == "" {
		return "", fmt.Errorf("tts grpc: no file url in stream")
	}

	return fileURL, nil
}

// StreamSpeech implements audio.TTSService.
// Returns two channels: one for raw PCM chunks and one for the final MinIO URL.
func (c *GRPCClient) StreamSpeech(ctx context.Context, text string) (<-chan []byte, <-chan string, error) {
	stream, err := c.client.StreamSpeech(ctx, &pb.SpeechRequest{
		Text: text,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("tts grpc: call StreamSpeech: %w", err)
	}

	audioChan := make(chan []byte, 128)
	urlChan := make(chan string, 1)

	go func() {
		defer close(audioChan)
		defer close(urlChan)

		for {
			chunk, err := stream.Recv()
			if err == io.EOF {
				break
			}
			if err != nil {
				slog.Error("tts grpc: stream error", "error", err)
				return
			}

			if len(chunk.Data) > 0 {
				audioChan <- chunk.Data
			}
			if chunk.FileUrl != "" {
				urlChan <- chunk.FileUrl
			}
		}
	}()

	return audioChan, urlChan, nil
}
