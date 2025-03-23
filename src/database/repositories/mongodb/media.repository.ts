import { Collection, Document } from 'mongodb';
import { dbLogger as logger } from '../../../common/logger';
import { DatabaseError } from '../../../common/errors/application-error';
import { Repository, QueryOptions } from '../../interfaces/repository.interface';
import { MediaEntity } from '../../interfaces/entity.interface';
import { MediaStatus } from '../../../common/types/media.types';
import { databaseService } from '../../services/mongodb/database.service';

interface MediaDocument extends Document {
    _id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status: MediaStatus;
    key: string;
    bucket: string;
    createdAt?: Date;
    updatedAt?: Date;
    uploadedAt?: Date;
}

export class MediaRepository implements Repository<MediaEntity> {
    private collection: Collection<MediaDocument> | null = null;
    private readonly collectionName = 'media';

    constructor() {
        logger.info('MongoMediaRepository initialized');
    }

    private async getCollection(): Promise<Collection<MediaDocument>> {
        if (!this.collection) {
            this.collection = await databaseService.getCollection<MediaDocument>(this.collectionName);
        }
        return this.collection;
    }

    private toDocument(entity: MediaEntity): MediaDocument {
        return {
            _id: entity.id,
            originalName: entity.originalName,
            mimeType: entity.mimeType,
            size: entity.size,
            status: entity.status,
            key: entity.key,
            bucket: entity.bucket,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            uploadedAt: entity.uploadedAt
        };
    }

    private toEntity(doc: MediaDocument): MediaEntity {
        return {
            id: doc._id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            size: doc.size,
            status: doc.status,
            key: doc.key,
            bucket: doc.bucket,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            uploadedAt: doc.uploadedAt
        };
    }

    public async save(entity: MediaEntity): Promise<MediaEntity> {
        try {
            const collection = await this.getCollection();

            const now = new Date();
            if (!entity.createdAt) {
                entity.createdAt = now;
            }
            entity.updatedAt = now;

            const doc = this.toDocument(entity);

            await collection.updateOne(
                { _id: doc._id },
                { $set: doc },
                { upsert: true }
            );

            return entity;
        } catch (error) {
            logger.error({ err: error }, 'Failed to save entity');
            throw new DatabaseError(
                'Failed to save entity',
                { entityId: entity.id },
                error as Error
            );
        }
    }

    public async findById(id: string): Promise<MediaEntity | null> {
        try {
            const collection = await this.getCollection();

            const doc = await collection.findOne({ _id: id });

            if (!doc) {
                return null;
            }

            return this.toEntity(doc);
        } catch (error) {
            logger.error({ err: error }, 'Failed to find entity');
            throw new DatabaseError(
                'Failed to find entity',
                { entityId: id },
                error as Error
            );
        }
    }

    public async deleteById(id: string): Promise<boolean> {
        try {
            const collection = await this.getCollection();

            const result = await collection.deleteOne({ _id: id });

            return result.deletedCount > 0;
        } catch (error) {
            logger.error({ err: error }, 'Failed to delete entity');
            throw new DatabaseError(
                'Failed to delete entity',
                { entityId: id },
                error as Error
            );
        }
    }

    public async find(query: Record<string, unknown>, options?: QueryOptions): Promise<MediaEntity[]> {
        try {
            const collection = await this.getCollection();

            const cursor = collection.find(query as Document);

            if (options?.limit) {
                cursor.limit(options.limit);
            }

            if (options?.skip) {
                cursor.skip(options.skip);
            }

            if (options?.sort) {
                cursor.sort(options.sort as Document);
            }

            const docs = await cursor.toArray();

            return docs.map(doc => this.toEntity(doc));
        } catch (error) {
            logger.error({ err: error }, 'Failed to find entities');
            throw new DatabaseError(
                'Failed to find entities',
                { query },
                error as Error
            );
        }
    }

    public async count(query: Record<string, unknown>): Promise<number> {
        try {
            const collection = await this.getCollection();
            return await collection.countDocuments(query as Document);
        } catch (error) {
            logger.error({ err: error }, 'Failed to count entities');
            throw new DatabaseError(
                'Failed to count entities',
                { query },
                error as Error
            );
        }
    }
}

export const mongoMediaRepository = new MediaRepository();
export default mongoMediaRepository; 