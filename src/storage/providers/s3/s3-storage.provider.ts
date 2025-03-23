import { randomUUID } from 'node:crypto';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    GetObjectCommandOutput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../../common/config/env';
import { storageLogger as logger } from '../../../common/logger';
import { StorageProvider, StorageFileMetadata, StorageUploadResponse } from '../../interfaces/storage.interface';
import { StorageError } from '../../../common/errors/application-error';
import { validateFileContent, detectMimeType } from '../../../media/utils/file-validator';

export class S3StorageProvider implements StorageProvider {
    private client: S3Client;
    private bucket: string;
    private prefix: string;
    private uploadUrlExpiry: number;

    constructor() {
        this.bucket = config.aws.s3Bucket;
        this.prefix = config.aws.s3Prefix;
        this.uploadUrlExpiry = config.upload.urlExpiry;

        this.client = new S3Client({
            region: config.aws.region,
            credentials: {
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey,
            },
        });

        logger.info(`S3StorageProvider initialized with bucket: ${this.bucket}, prefix: ${this.prefix}`);
    }

    public async getUploadUrl(fileMetadata: StorageFileMetadata): Promise<StorageUploadResponse> {
        try {
            const fileId = fileMetadata.id || randomUUID();
            const key = `${this.prefix}/uploads/${fileId}/${fileMetadata.originalName}`;
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ContentType: fileMetadata.mimeType,
            });
            const url = await getSignedUrl(this.client, command, {
                expiresIn: this.uploadUrlExpiry,
            });

            logger.debug({
                fileId,
                url,
                key,
                expiresIn: this.uploadUrlExpiry
            }, 'Generated presigned URL');

            return {
                uploadId: fileId,
                url,
                expires: Date.now() + this.uploadUrlExpiry * 1000,
            };
        } catch (error) {
            logger.error({
                err: error,
                fileMetadata,
                bucket: this.bucket,
                prefix: this.prefix
            }, 'Failed to generate presigned URL');
            throw new StorageError(
                'Failed to generate upload URL',
                { originalName: fileMetadata.originalName },
                error as Error,
                true
            );
        }
    }

    public async verifyUpload(uploadId: string): Promise<boolean> {
        try {
            await this.getMetadata(uploadId);

            return true;
        } catch (error) {
            if ((error as StorageError).message.includes('not found')) {
                logger.debug(`Upload not found: ${uploadId}`);
                return false;
            }

            throw error;
        }
    }

    public async getMetadata(uploadId: string): Promise<StorageFileMetadata> {
        try {
            const key = `${this.prefix}/uploads/${uploadId}`;
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: key,
                MaxKeys: 1
            });
            const listResponse = await this.client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                throw new StorageError(
                    `Upload ${uploadId} not found in storage`,
                    { uploadId, key }
                );
            }

            const objectKey = listResponse.Contents[0].Key;

            if (!objectKey) {
                throw new StorageError(
                    `Upload ${uploadId} has no valid key`,
                    { uploadId, key }
                );
            }

            const actualFileName = objectKey.split('/').pop() || 'unknown';
            const headCommand = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: objectKey
            });
            const headResponse = await this.client.send(headCommand);

            return {
                id: uploadId,
                originalName: actualFileName,
                mimeType: headResponse.ContentType || 'application/octet-stream',
                size: headResponse.ContentLength || 0,
                key: objectKey,
                bucket: this.bucket,
                uploadedAt: headResponse.LastModified,
                status: 'uploaded',
            };
        } catch (error) {
            logger.error({ err: error }, `Failed to get metadata for upload: ${uploadId}`);
            throw new StorageError(
                'Failed to get file metadata',
                { uploadId },
                error as Error
            );
        }
    }

    public async getDownloadUrl(uploadId: string, expiresInSeconds = 3600): Promise<string> {
        try {
            const metadata = await this.getMetadata(uploadId);

            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: metadata.key,
            });

            const url = await getSignedUrl(this.client, command, {
                expiresIn: expiresInSeconds,
            });

            logger.debug(`Generated download URL for: ${uploadId}`);
            return url;
        } catch (error) {
            logger.error({ err: error }, `Failed to generate download URL: ${uploadId}`);
            throw new StorageError(
                'Failed to generate download URL',
                { uploadId },
                error as Error
            );
        }
    }

    public async deleteFile(uploadId: string): Promise<boolean> {
        try {
            const metadata = await this.getMetadata(uploadId);

            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: metadata.key,
            });

            await this.client.send(command);
            logger.info(`Deleted file from S3: ${uploadId}`);
            return true;
        } catch (error) {
            logger.error({ err: error }, `Failed to delete file: ${uploadId}`);
            throw new StorageError(
                'Failed to delete file',
                { uploadId },
                error as Error
            );
        }
    }

    public async validateFileContent(uploadId: string, expectedMimeType: string): Promise<boolean> {
        try {
            const metadata = await this.getMetadata(uploadId);
            const key = metadata.key;
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Range: 'bytes=0-512' // Just get the first 512 bytes for validation
            });
            const response: GetObjectCommandOutput = await this.client.send(command);

            if (!response.Body) {
                logger.warn({ uploadId, key }, 'Failed to get file content for validation');
                return false;
            }

            const chunks: Uint8Array[] = [];

            for await (const chunk of response.Body as any) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);
            const detectedMimeType = detectMimeType(buffer);
            const isValid = validateFileContent(buffer, expectedMimeType);

            if (detectedMimeType && detectedMimeType !== expectedMimeType) {
                logger.warn(
                    { uploadId, expectedMimeType, detectedMimeType },
                    'MIME type mismatch detected'
                );
            }

            if (isValid) {
                logger.info({ uploadId, mimeType: expectedMimeType }, 'Content validation passed');
            } else {
                logger.warn(
                    { uploadId, expectedMimeType, detectedMimeType, actualFileSize: metadata.size },
                    'Content validation failed - file type does not match signature'
                );
            }

            return isValid;
        } catch (error) {
            logger.error({ err: error, uploadId }, 'Error validating file content');
            return false;
        }
    }
}

export const s3StorageProvider = new S3StorageProvider();
export default s3StorageProvider; 