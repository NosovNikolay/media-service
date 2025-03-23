import { MongoClient, Collection, Db, Document } from 'mongodb';
import { config } from '../../../common/config/env';
import { logger } from '../../../common/logger';
import { DatabaseError } from '../../../common/errors/application-error';

class DatabaseService {
    private client: MongoClient;
    private db: Db | null = null;
    private isConnected = false;

    constructor() {
        this.client = new MongoClient(config.mongodb.uri);
    }

    public async testConnection(): Promise<void> {
        try {
            logger.info('Testing MongoDB connection...');
            const testClient = new MongoClient(config.mongodb.uri);
            await testClient.connect();
            await testClient.db(config.mongodb.dbName).command({ ping: 1 });
            logger.info('MongoDB connection test successful');
            await testClient.close();
        } catch (error) {
            logger.error({ err: error }, 'MongoDB connection test failed');
            throw new DatabaseError(
                'Failed to connect to MongoDB',
                { operation: 'testConnection' },
                error as Error
            );
        }
    }

    public async connect(): Promise<void> {
        if (!this.isConnected) {
            try {
                await this.client.connect();
                this.db = this.client.db(config.mongodb.dbName);
                this.isConnected = true;
                logger.info('Connected to MongoDB');
            } catch (error) {
                logger.error({ err: error }, 'Failed to connect to MongoDB');
                throw new DatabaseError(
                    'Failed to connect to MongoDB',
                    { operation: 'connect' },
                    error as Error
                );
            }
        }
    }

    public async getCollection<T extends Document>(collectionName: string): Promise<Collection<T>> {
        if (!this.isConnected) {
            await this.connect();
        }

        if (!this.db) {
            throw new DatabaseError('MongoDB database not initialized', { collectionName });
        }

        return this.db.collection<T>(collectionName);
    }

    public async close(): Promise<void> {
        if (this.isConnected) {
            await this.client.close();
            this.isConnected = false;
            this.db = null;
            logger.info('Closed MongoDB connection');
        }
    }
}

export const databaseService = new DatabaseService();
export default databaseService; 