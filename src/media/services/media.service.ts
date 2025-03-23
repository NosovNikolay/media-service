import { randomUUID } from 'node:crypto';
import { config } from '../../common/config/env';
import { logger } from '../../common/logger';
import { Repository } from '../../database/interfaces/repository.interface';
import { mongoMediaRepository } from '../../database/repositories/mongodb/media.repository';
import { StorageProvider, StorageFileMetadata } from '../../storage/interfaces/storage.interface';
import { s3StorageProvider } from '../../storage/providers/s3/s3-storage.provider';
import {
    ValidationError,
    StorageError,
    NotFoundError,
} from '../../common/errors/application-error';
import { UploadRequestDto, UploadResponseDto, FileMetadataDto, PaginatedResultDto } from '../dto/upload.dto';
import { StorageMapper } from '../mappers/storage.mapper';
import { MediaMapper } from '../mappers/media.mapper';
import { MediaEntity } from '../../database/interfaces/entity.interface';
import { MediaStatusEnum, MimeTypes, MediaFilter } from '../../common/types/media.types';

export class MediaService {
    private allowedMimeTypes: string[];
    private maxFileSize: number;
    private storageProvider: StorageProvider;
    private mediaRepository: Repository<MediaEntity>;

    constructor(
        storageProvider = s3StorageProvider,
        mediaRepository = mongoMediaRepository
    ) {
        this.storageProvider = storageProvider;
        this.mediaRepository = mediaRepository;

        this.allowedMimeTypes = config.upload.allowedMimeTypes;
        this.maxFileSize = config.upload.maxFileSize;

        logger.info('MediaService initialized');
    }

    private validateUploadRequest(request: UploadRequestDto): void {
        if (!this.allowedMimeTypes.includes(request.mimeType)) {
            throw new ValidationError(`Invalid mime type: ${request.mimeType}`);
        }

        if (request.size > this.maxFileSize) {
            throw new ValidationError(`File size exceeds maximum allowed size: ${this.maxFileSize} bytes`);
        }
    }

    public async initiateUpload(request: UploadRequestDto): Promise<UploadResponseDto> {
        this.validateUploadRequest(request);

        const fileId = randomUUID();

        const storageMetadata = StorageMapper.toStorageMetadata(request, fileId);

        const mediaEntity = MediaMapper.toMediaEntity(request, fileId);

        await this.mediaRepository.save(mediaEntity);

        try {
            // Generate presigned URL
            const uploadResponse = await this.storageProvider.getUploadUrl(storageMetadata);
            return StorageMapper.toUploadResponseDto(uploadResponse);
        } catch (error) {
            logger.error({ err: error }, 'Failed to generate upload URL');

            if (error instanceof Error) {
                throw new StorageError(
                    'Failed to initiate upload',
                    { originalName: request.fileName },
                    error
                );
            }

            throw new StorageError(
                'Failed to initiate upload',
                { originalName: request.fileName }
            );
        }
    }

    public async completeUpload(uploadId: string): Promise<FileMetadataDto> {
        const originalEntity = await this.mediaRepository.findById(uploadId);

        if (!originalEntity) {
            throw new NotFoundError(`Upload ${uploadId} not found in database`);
        }

        try {
            const exists = await this.storageProvider.verifyUpload(uploadId);
            if (!exists) {
                throw new NotFoundError(`Upload ${uploadId} not found in storage`);
            }
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error({ err: error, uploadId }, 'Failed to verify upload');
            throw new StorageError(
                'Failed to verify upload',
                { uploadId },
                error instanceof Error ? error : undefined
            );
        }

        let storageMetadata;
        try {
            storageMetadata = await this.storageProvider.getMetadata(uploadId);
        } catch (error) {
            logger.error({ err: error, uploadId }, 'Failed to get file metadata');
            throw new StorageError(
                'Failed to get file metadata',
                { uploadId },
                error instanceof Error ? error : undefined
            );
        }

        this.validateUploadedFile(originalEntity, storageMetadata);
        const mediaEntity = MediaMapper.toMediaEntityFromStorage(storageMetadata);
        mediaEntity.originalName = originalEntity.originalName;
        mediaEntity.status = MediaStatusEnum.UPLOADED;
        await this.mediaRepository.save(mediaEntity);
        let isContentValid = false;

        try {
            isContentValid = await this.storageProvider.validateFileContent(uploadId, originalEntity.mimeType);
        } catch (error) {
            logger.error({ err: error, uploadId }, 'Failed to validate file content');
        }

        if (isContentValid) {
            mediaEntity.status = MediaStatusEnum.VALIDATED;
            logger.info({ fileId: uploadId }, 'File validated successfully');
        } else {
            mediaEntity.status = MediaStatusEnum.INVALID;
            logger.warn({ fileId: uploadId }, 'File content validation failed');
        }

        await this.mediaRepository.save(mediaEntity);

        let downloadUrl: string | undefined;
        if (mediaEntity.status === MediaStatusEnum.VALIDATED) {
            try {
                downloadUrl = await this.storageProvider.getDownloadUrl(uploadId);
            } catch (error) {
                logger.error({ err: error, uploadId }, 'Failed to generate download URL');
            }
        }

        return StorageMapper.toFileMetadataDto(mediaEntity, downloadUrl);
    }

    private validateUploadedFile(original: MediaEntity, uploaded: StorageFileMetadata): void {
        const sizeDifference = Math.abs(original.size - uploaded.size);
        const sizeTolerancePercent = 0.1; // 10% tolerance
        const sizeTolerance = original.size * sizeTolerancePercent;

        if (sizeDifference > sizeTolerance && sizeDifference > 1024) {
            throw new ValidationError(
                `File size mismatch: expected ${original.size}, got ${uploaded.size}`,
                {
                    expectedSize: original.size,
                    actualSize: uploaded.size,
                    uploadId: original.id
                }
            );
        }

        if (uploaded.mimeType &&
            original.mimeType !== uploaded.mimeType &&
            uploaded.mimeType !== MimeTypes.OCTET_STREAM) {

            logger.warn({
                expectedMimeType: original.mimeType,
                actualMimeType: uploaded.mimeType,
                uploadId: original.id
            }, 'File MIME type mismatch');

            // Optionally throw an error for strict validation
            // For now, just log a warning since S3 MIME type detection can be unreliable
        }

        logger.info({
            uploadId: original.id,
            originalName: original.originalName,
            size: uploaded.size,
            mimeType: uploaded.mimeType || original.mimeType
        }, 'Upload validation passed');
    }

    public async getFileMetadata(fileId: string): Promise<FileMetadataDto> {
        const mediaEntity = await this.mediaRepository.findById(fileId);

        if (!mediaEntity) {
            throw new NotFoundError(`File with ID ${fileId} not found`);
        }

        let downloadUrl;

        if (mediaEntity.status === MediaStatusEnum.VALIDATED) {
            try {
                downloadUrl = await this.storageProvider.getDownloadUrl(fileId);
            } catch (error) {
                logger.error({ err: error, fileId }, 'Failed to generate download URL');
            }
        }

        return StorageMapper.toFileMetadataDto(mediaEntity, downloadUrl);
    }

    public async deleteFile(fileId: string): Promise<boolean> {
        let storageDeleted = false;
        try {
            storageDeleted = await this.storageProvider.deleteFile(fileId);
        } catch (error) {
            logger.error({ err: error, fileId }, 'Failed to delete file from storage');
        }

        const dbDeleted = await this.mediaRepository.deleteById(fileId);

        return storageDeleted && dbDeleted;
    }

    public async searchFiles(
        filter: MediaFilter,
        includeUrls = false
    ): Promise<PaginatedResultDto<FileMetadataDto>> {
        const query: Record<string, any> = {};
        const limit = filter.limit || 20;
        const page = filter.page || 1;
        const skip = (page - 1) * limit;
        const sortField = filter.sortBy || 'createdAt';
        const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;

        if (filter.status) {
            query.status = filter.status;
        }

        if (filter.mimeType) {
            query.mimeType = filter.mimeType;
        }

        if (filter.fileName) {
            query.originalName = { $regex: filter.fileName, $options: 'i' };
        }

        if (filter.startDate || filter.endDate) {
            query.createdAt = {} as Record<string, Date>;

            if (filter.startDate) {
                query.createdAt.$gte = filter.startDate;
            }

            if (filter.endDate) {
                query.createdAt.$lte = filter.endDate;
            }
        }

        if (filter.minSize !== undefined || filter.maxSize !== undefined) {
            query.size = {} as Record<string, number>;

            if (filter.minSize !== undefined) {
                query.size.$gte = filter.minSize;
            }

            if (filter.maxSize !== undefined) {
                query.size.$lte = filter.maxSize;
            }
        }

        const totalItems = await this.mediaRepository.count(query);
        const totalPages = Math.ceil(totalItems / limit);

        const options = {
            limit,
            skip,
            sort: { [sortField]: sortDirection } as Record<string, 1 | -1>
        };

        const mediaEntities = await this.mediaRepository.find(query, options);

        const mediaDtos: FileMetadataDto[] = [];
        for (const entity of mediaEntities) {
            const dto = MediaMapper.toFileMetadataDto(entity);

            if (includeUrls && entity.status === MediaStatusEnum.VALIDATED) {
                try {
                    dto.url = await this.storageProvider.getDownloadUrl(entity.id);
                } catch (error) {
                    logger.error({ err: error, fileId: entity.id }, 'Failed to generate download URL');
                }
            }

            mediaDtos.push(dto);
        }

        return {
            items: mediaDtos,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    }

    public async updateFile(fileId: string, request: UploadRequestDto): Promise<UploadResponseDto> {
        this.validateUploadRequest(request);

        const existingFile = await this.mediaRepository.findById(fileId);
        if (!existingFile) {
            throw new NotFoundError(`File with ID ${fileId} not found`);
        }

        try {
            await this.storageProvider.deleteFile(fileId);
        } catch (error) {
            logger.error({ err: error, fileId }, 'Failed to delete existing file from storage');
        }

        const storageMetadata = StorageMapper.toStorageMetadata(request, fileId);
        const mediaEntity = MediaMapper.toMediaEntity(request, fileId);
        mediaEntity.status = MediaStatusEnum.PENDING;

        await this.mediaRepository.save(mediaEntity);

        try {
            // Generate presigned URL for the new file
            const uploadResponse = await this.storageProvider.getUploadUrl(storageMetadata);
            return StorageMapper.toUploadResponseDto(uploadResponse);
        } catch (error) {
            logger.error({ err: error }, 'Failed to generate upload URL for file update');

            if (error instanceof Error) {
                throw new StorageError(
                    'Failed to initiate file update',
                    {
                        fileId,
                        originalName: request.fileName
                    },
                    error
                );
            }

            throw new StorageError(
                'Failed to initiate file update',
                {
                    fileId,
                    originalName: request.fileName
                }
            );
        }
    }
}

export const mediaService = new MediaService();
export default mediaService;