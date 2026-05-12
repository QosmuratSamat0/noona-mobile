package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioClient struct {
	client *minio.Client
}

func NewMinioClient(endpoint, accessKey, secretKey string, useSSL bool) (*MinioClient, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize minio client: %w", err)
	}

	return &MinioClient{client: client}, nil
}

func (mc *MinioClient) EnsureBucket(ctx context.Context, bucketName string) error {
	exists, err := mc.client.BucketExists(ctx, bucketName)
	if err != nil {
		return fmt.Errorf("failed to check if bucket %s exists: %w", bucketName, err)
	}
	if !exists {
		err = mc.client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			errResp := minio.ToErrorResponse(err)
			if errResp.Code != "BucketAlreadyOwnedByYou" && errResp.Code != "BucketAlreadyExists" {
				return fmt.Errorf("failed to create bucket %s: %w", bucketName, err)
			}
		}
	}
	return nil
}

func (mc *MinioClient) Upload(ctx context.Context, bucket, key string, reader io.Reader, objectSize int64, contentType string) error {
	opts := minio.PutObjectOptions{
		ContentType: contentType,
	}

	_, err := mc.client.PutObject(ctx, bucket, key, reader, objectSize, opts)
	if err != nil {
		return fmt.Errorf("failed to upload object %s to bucket %s: %w", key, bucket, err)
	}

	return nil
}

func (mc *MinioClient) GetPresignedURL(ctx context.Context, bucket, key string, expires time.Duration) (string, error) {
	reqParams := make(url.Values)
	
	presignedURL, err := mc.client.PresignedGetObject(ctx, bucket, key, expires, reqParams)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned url for %s/%s: %w", bucket, key, err)
	}
	
	return presignedURL.String(), nil
}

func (mc *MinioClient) Client() *minio.Client {
	return mc.client
}
