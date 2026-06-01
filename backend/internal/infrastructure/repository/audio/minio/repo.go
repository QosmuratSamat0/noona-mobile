package minio

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type StorageRepo struct {
	client       *minio.Client
	publicClient *minio.Client
	bucketName   string
}

func NewStorageRepo(client *minio.Client, bucketName, publicEndpoint, accessKey, secretKey string, useSSL bool) *StorageRepo {
	publicClient := client
	publicEndpoint = strings.TrimSpace(publicEndpoint)
	if publicEndpoint != "" {
		if client, err := minio.New(publicEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
			Secure: useSSL,
		}); err == nil {
			publicClient = client
		}
	}
	return &StorageRepo{
		client:       client,
		publicClient: publicClient,
		bucketName:   bucketName,
	}
}

func (r *StorageRepo) UploadFile(ctx context.Context, file io.Reader, fileSize int64, contentType, ext string) (string, error) {
	exists, err := r.client.BucketExists(ctx, r.bucketName)
	if err != nil {
		return "", fmt.Errorf("failed to check if bucket exists: %w", err)
	}
	if !exists {
		err = r.client.MakeBucket(ctx, r.bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	objectKey := fmt.Sprintf("voice-input/%s%s", uuid.New().String(), ext)

	opts := minio.PutObjectOptions{
		ContentType: contentType,
	}

	_, err = r.client.PutObject(ctx, r.bucketName, objectKey, file, fileSize, opts)
	if err != nil {
		return "", fmt.Errorf("failed to upload file to minio: %w", err)
	}

	return objectKey, nil
}

func (r *StorageRepo) FileURL(ctx context.Context, filePath string) (string, error) {
	objectName := strings.TrimPrefix(filePath, r.bucketName+"/")
	presignedURL, err := r.publicClient.PresignedGetObject(ctx, r.bucketName, objectName, time.Hour, url.Values{})
	if err != nil {
		return "", fmt.Errorf("failed to create presigned url: %w", err)
	}
	return presignedURL.String(), nil
}

func (r *StorageRepo) DeleteFile(ctx context.Context, filePath string) error {
	objectName := strings.TrimPrefix(filePath, r.bucketName+"/")
	err := r.client.RemoveObject(ctx, r.bucketName, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete file from minio: %w", err)
	}
	return nil
}
