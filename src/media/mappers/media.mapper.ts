import { MediaEntity } from '../../database/interfaces/entity.interface';
import { StorageFileMetadata } from '../../storage/interfaces/storage.interface';
import { UploadRequestDto, FileMetadataDto } from '../dto/upload.dto';
import { MediaStatusEnum } from '../../common/types/media.types';

export class MediaMapper {
    public static toMediaEntity(dto: UploadRequestDto, id: string): MediaEntity {
        return {
            id,
            originalName: dto.fileName,
            mimeType: dto.mimeType,
            size: dto.size,
            status: MediaStatusEnum.PENDING,
            key: '',
            bucket: '',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    public static toMediaEntityFromStorage(metadata: StorageFileMetadata): MediaEntity {
        return {
            id: metadata.id,
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            size: metadata.size,
            status: metadata.status,
            key: metadata.key,
            bucket: metadata.bucket,
            uploadedAt: metadata.uploadedAt,
            updatedAt: new Date()
        };
    }

    public static toFileMetadataDto(entity: MediaEntity): FileMetadataDto {
        return {
            id: entity.id,
            originalName: entity.originalName,
            mimeType: entity.mimeType,
            size: entity.size,
            status: entity.status,
            uploadedAt: entity.uploadedAt
        };
    }

    public static toUploadRequestDto(entity: MediaEntity): UploadRequestDto {
        return {
            fileName: entity.originalName,
            mimeType: entity.mimeType,
            size: entity.size
        };
    }
} 