import { MediaStatus } from '../../common/types/media.types';

export interface StorageProvider {

    getUploadUrl(fileMetadata: StorageFileMetadata): Promise<StorageUploadResponse>;

    verifyUpload(uploadId: string): Promise<boolean>;

    getMetadata(uploadId: string): Promise<StorageFileMetadata>;

    getDownloadUrl(uploadId: string, expiresInSeconds?: number): Promise<string>;

    deleteFile(uploadId: string): Promise<boolean>;

    validateFileContent(uploadId: string, expectedMimeType: string): Promise<boolean>;
}

export interface StorageFileMetadata {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    key: string;
    bucket: string;
    uploadedAt?: Date;
    status: MediaStatus;
}

export interface StorageUploadResponse {
    uploadId: string;
    url: string;
    expires: number;
    fields?: Record<string, string>;
} 