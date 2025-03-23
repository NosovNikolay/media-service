import http, { Server, IncomingMessage, ServerResponse } from 'http';
import { config } from '../common/config/env';
import { logger } from '../common/logger';
import { router } from './router';
import { registerRoutes } from './routes';
import { requestLogger } from './middleware/request-logger';
import { databaseService } from '../database/services/mongodb/database.service';

type Middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => Promise<void>
) => Promise<void>;

async function applyMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    middlewares: Middleware[]
): Promise<void> {
    const executeMiddleware = async (index: number): Promise<void> => {
        if (index < middlewares.length) {
            await middlewares[index](req, res, () => executeMiddleware(index + 1));
        }
    };

    await executeMiddleware(0);
}

export async function startServer(): Promise<Server> {
    await Promise.race([
        databaseService.testConnection(),
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('MongoDB connection timeout - could not connect to database within 5 seconds'));
            }, 5000);
        })
    ]);

    registerRoutes();

    const middlewares: Middleware[] = [
        requestLogger,
    ];

    const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
        try {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

            await applyMiddleware(req, res, middlewares);

            router.handle(req, res);
        } catch (error) {
            logger.error({ err: error }, 'Uncaught error in server');

            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                success: false,
                error: {
                    message: 'Internal server error'
                }
            }));
        }
    });

    server.listen(config.port, () => {
        logger.info(`Server listening on port ${config.port}`);
    });

    return server;
}

export default { startServer }; 