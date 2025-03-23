import { router } from './router';
import { HttpMethod } from './router/interface';
import { mediaController } from '../media/controllers/media.controller';

export function registerRoutes(): void {
    const apiPrefix = '/api/v1';

    router.register(HttpMethod.POST, `${apiPrefix}/media/upload-request`, mediaController.initiateUpload.bind(mediaController));
    router.register(HttpMethod.POST, `${apiPrefix}/media/upload-complete`, mediaController.completeUpload.bind(mediaController));
    router.register(HttpMethod.GET, `${apiPrefix}/media/:id`, mediaController.getFile.bind(mediaController));
    router.register(HttpMethod.PUT, `${apiPrefix}/media/:id`, mediaController.updateFile.bind(mediaController));
    router.register(HttpMethod.DELETE, `${apiPrefix}/media/:id`, mediaController.deleteFile.bind(mediaController));
    router.register(HttpMethod.GET, `${apiPrefix}/media/:id/download`, mediaController.getDownloadUrl.bind(mediaController));
    router.register(HttpMethod.GET, `${apiPrefix}/media`, mediaController.searchFiles.bind(mediaController));

    router.register(HttpMethod.GET, '/health', async (req, res) => {
        try {

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', database: 'connected' }));
        } catch (error) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                status: 'error',
                database: 'disconnected',
                message: (error as Error).message
            }));
        }
    });

    // API documentation
    router.register(HttpMethod.GET, '/', async (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            name: 'Media Service API',
            version: '1.0.0',
            endpoints: [
                { method: 'POST', path: `${apiPrefix}/media/upload-request`, description: 'Request a presigned URL for uploading a file' },
                { method: 'POST', path: `${apiPrefix}/media/upload-complete`, description: 'Complete an upload after the file is uploaded to S3' },
                { method: 'GET', path: `${apiPrefix}/media/:id`, description: 'Get file metadata by ID' },
                { method: 'PUT', path: `${apiPrefix}/media/:id`, description: 'Update an existing file with a new one' },
                { method: 'DELETE', path: `${apiPrefix}/media/:id`, description: 'Delete a file by ID' },
                { method: 'GET', path: `${apiPrefix}/media/:id/download`, description: 'Get a download URL for a file' },
                { method: 'GET', path: `${apiPrefix}/media`, description: 'Search for files using query parameters with page-based pagination (page, limit, sortBy, sortOrder, status, mimeType, fileName, includeUrls)' },
                { method: 'GET', path: '/health', description: 'Health check endpoint' },
            ]
        }));
    });
}

export default registerRoutes;