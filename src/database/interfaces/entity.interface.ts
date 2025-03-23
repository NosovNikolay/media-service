import { MediaStatus } from '../../common/types/media.types';

export interface BaseEntity {
    id: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MediaEntity extends BaseEntity {
    originalName: string;
    mimeType: string;
    size: number;
    status: MediaStatus;
    key: string;
    bucket: string;
    uploadedAt?: Date;
} 