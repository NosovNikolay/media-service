import { MediaStatus } from '../../common/types/media.types';

export interface UploadRequestDto {
    fileName: string;
    mimeType: string;
    size: number;
}

export interface UploadResponseDto {
    uploadId: string;
    url: string;
    expires: number;
}

export interface UploadCompleteRequestDto {
    uploadId: string;
}

export interface FileMetadataDto {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status: MediaStatus;
    uploadedAt?: Date;
    url?: string;
}

export interface PaginatedResultDto<T> {
    items: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        limit: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
} 