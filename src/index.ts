import { startServer } from './server';
import { config } from './common/config/env';
import { logger } from './common/logger';

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught exception');
    process.exit(1);
});

async function bootstrap(): Promise<void> {
    try {
        logger.info(`Starting Media Service in ${config.nodeEnv} mode`);

        await startServer();
        logger.info('Media Service started successfully');
    } catch (error) {
        logger.error({ err: error }, 'Failed to start application');
        process.exit(1);
    }
}

bootstrap(); 