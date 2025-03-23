import { IncomingMessage, ServerResponse } from 'node:http';
import { parseRequestBody, parseAndValidateBody, sendSuccess, sendError } from '../../common/utils/http';
import { httpLogger as logger } from '../../common/logger';
import { NotFoundError, ValidationError } from '../../common/errors/application-error';
import { mediaService } from '../services/media.service';
import { UploadRequestDto, UploadCompleteRequestDto } from '../dto/upload.dto';
import { RouteParams } from '../../server/router/interface';
import { MediaStatusEnum, MediaFilter } from '../../common/types/media.types';

function validateUploadRequest(body: any): UploadRequestDto {
    if (!body.fileName) {
        throw new ValidationError('File name is required');
    }

    if (!body.mimeType) {
        throw new ValidationError('MIME type is required');
    }

    let size: number;
    if (typeof body.size === 'string') {
        size = parseInt(body.size, 10);
        if (isNaN(size)) {
            throw new ValidationError('File size must be a valid number');
        }
    } else if (typeof body.size === 'number') {
        size = body.size;
    } else {
        throw new ValidationError('File size is required');
    }

    return {
        fileName: body.fileName,
        mimeType: body.mimeType,
        size
    };
}

export class MediaController {
    public async initiateUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await parseAndValidateBody<UploadRequestDto>(req, validateUploadRequest);

            logger.debug({
                fileName: body.fileName,
                mimeType: body.mimeType,
                size: body.size
            }, 'Initiating upload');

            const uploadResponse = await mediaService.initiateUpload(body);

            sendSuccess(res, uploadResponse, 201);
        } catch (error) {
            sendError(res, error);
        }
    }

    public async completeUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await parseRequestBody<UploadCompleteRequestDto>(req);

            if (!body.uploadId) {
                throw new ValidationError('Upload ID is required');
            }

            logger.debug({ uploadId: body.uploadId }, 'Completing upload');

            const metadata = await mediaService.completeUpload(body.uploadId);

            sendSuccess(res, metadata);
        } catch (error) {
            sendError(res, error);
        }
    }

    public async getFile(req: IncomingMessage, res: ServerResponse, params: RouteParams): Promise<void> {
        try {
            const fileId = params.id;

            if (!fileId) {
                throw new ValidationError('File ID is required');
            }

            logger.debug({ fileId }, 'Getting file metadata');

            const metadata = await mediaService.getFileMetadata(fileId);

            sendSuccess(res, metadata);
        } catch (error) {
            sendError(res, error);
        }
    }

    public async deleteFile(req: IncomingMessage, res: ServerResponse, params: RouteParams): Promise<void> {
        try {
            const fileId = params.id;

            if (!fileId) {
                throw new ValidationError('File ID is required');
            }

            logger.debug({ fileId }, 'Deleting file');

            const deleted = await mediaService.deleteFile(fileId);

            if (!deleted) {
                throw new NotFoundError(`File with ID ${fileId} not found`);
            }

            sendSuccess(res, { success: true });
        } catch (error) {
            sendError(res, error);
        }
    }

    public async getDownloadUrl(req: IncomingMessage, res: ServerResponse, params: RouteParams): Promise<void> {
        try {
            const fileId = params.id;

            if (!fileId) {
                throw new ValidationError('File ID is required');
            }

            logger.debug({ fileId }, 'Getting download URL');

            const metadata = await mediaService.getFileMetadata(fileId);

            if (metadata.status === MediaStatusEnum.INVALID) {
                throw new ValidationError('File cannot be downloaded because it failed content validation. The file type does not match what was expected.');
            }

            if (metadata.status === MediaStatusEnum.PENDING) {
                throw new ValidationError('File is not yet uploaded');
            }

            if (!metadata.url) {
                if (metadata.status === MediaStatusEnum.UPLOADED) {
                    throw new ValidationError('File is still being processed. Please try again shortly.');
                } else {
                    throw new ValidationError('File is not available for download');
                }
            }

            res.statusCode = 302;
            res.setHeader('Location', metadata.url);
            res.end();
        } catch (error) {
            sendError(res, error);
        }
    }

    public async searchFiles(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const status = url.searchParams.get('status');
            const mimeType = url.searchParams.get('mimeType');
            const fileName = url.searchParams.get('fileName');
            const startDate = url.searchParams.get('startDate');
            const endDate = url.searchParams.get('endDate');
            const minSize = url.searchParams.get('minSize');
            const maxSize = url.searchParams.get('maxSize');
            const includeUrls = url.searchParams.get('includeUrls') === 'true';

            // Pagination parameters
            const pageStr = url.searchParams.get('page');
            const limitStr = url.searchParams.get('limit');
            const sortBy = url.searchParams.get('sortBy') || 'createdAt';
            const sortOrder = url.searchParams.get('sortOrder');

            const filter: MediaFilter = {};

            if (status) {
                filter.status = status as any;
            }

            if (mimeType) {
                filter.mimeType = mimeType;
            }

            if (fileName) {
                filter.fileName = fileName;
            }

            if (startDate) {
                filter.startDate = new Date(startDate);
            }

            if (endDate) {
                filter.endDate = new Date(endDate);
            }

            if (minSize) {
                filter.minSize = parseInt(minSize, 10);
            }

            if (maxSize) {
                filter.maxSize = parseInt(maxSize, 10);
            }

            if (pageStr) {
                const parsedPage = parseInt(pageStr, 10);
                if (!isNaN(parsedPage) && parsedPage > 0) {
                    filter.page = parsedPage;
                }
            } else {
                filter.page = 1;
            }

            if (limitStr) {
                const parsedLimit = parseInt(limitStr, 10);
                if (!isNaN(parsedLimit) && parsedLimit > 0) {
                    filter.limit = Math.min(parsedLimit, 100);
                }
            } else {
                filter.limit = 20;
            }

            if (sortBy) {
                filter.sortBy = sortBy;
            }

            if (sortOrder && (sortOrder === 'asc' || sortOrder === 'desc')) {
                filter.sortOrder = sortOrder;
            } else {
                filter.sortOrder = 'desc';
            }

            logger.debug({ filter, includeUrls }, 'Searching files');

            const result = await mediaService.searchFiles(filter, includeUrls);

            sendSuccess(res, result);
        } catch (error) {
            sendError(res, error);
        }
    }

    public async updateFile(req: IncomingMessage, res: ServerResponse, params: RouteParams): Promise<void> {
        try {
            const fileId = params.id;

            if (!fileId) {
                throw new ValidationError('File ID is required');
            }

            const body = await parseAndValidateBody<UploadRequestDto>(req, validateUploadRequest);

            logger.debug({
                fileId,
                fileName: body.fileName,
                mimeType: body.mimeType,
                size: body.size
            }, 'Updating file');

            const updateResponse = await mediaService.updateFile(fileId, body);

            sendSuccess(res, updateResponse);
        } catch (error) {
            sendError(res, error);
        }
    }
}

export const mediaController = new MediaController();
export default mediaController; 