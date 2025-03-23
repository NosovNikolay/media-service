import { StorageFileMetadata, StorageUploadResponse } from '../../storage/interfaces/storage.interface';
import { UploadRequestDto, UploadResponseDto, FileMetadataDto } from '../dto/upload.dto';

export class StorageMapper {

    public static toStorageMetadata(dto: UploadRequestDto, id?: string): StorageFileMetadata {
        return {
            id: id || '',
            originalName: dto.fileName,
            mimeType: dto.mimeType,
            size: dto.size,
            key: '', // Will be set by storage provider
            bucket: '', // Will be set by storage provider
            status: 'pending'
        };
    }

    public static toUploadResponseDto(response: StorageUploadResponse): UploadResponseDto {
        return {
            uploadId: response.uploadId,
            url: response.url,
            expires: response.expires
        };
    }

    public static toFileMetadataDto(metadata: StorageFileMetadata, url?: string): FileMetadataDto {
        return {
            id: metadata.id,
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            size: metadata.size,
            status: metadata.status,
            uploadedAt: metadata.uploadedAt,
            url
        };
    }
} 