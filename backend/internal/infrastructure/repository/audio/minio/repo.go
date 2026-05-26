package minio

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

type StorageRepo struct {
	client     *minio.Client
	bucketName string
}

func NewStorageRepo(client *minio.Client, bucketName string) *StorageRepo {
	return &StorageRepo{
		client:     client,
		bucketName: bucketName,
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

func (r *StorageRepo) DeleteFile(ctx context.Context, filePath string) error {
	objectName := strings.TrimPrefix(filePath, r.bucketName+"/")
	err := r.client.RemoveObject(ctx, r.bucketName, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete file from minio: %w", err)
	}
	return nil
}
