import { IncomingMessage, ServerResponse } from 'node:http';
import { ApplicationError, ValidationError } from '../errors/application-error';
import { httpLogger as logger } from '../logger';

export interface HttpResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
        details?: unknown;
    };
}

export async function parseRequestBody<T>(req: IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        req.on('data', (chunk) => {
            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks).toString();
                const data = body ? JSON.parse(body) : {};
                resolve(data as T);
            } catch (error) {
                logger.error({ err: error }, 'Failed to parse request body');
                reject(new ApplicationError('Invalid request body', 400, true, 'INVALID_REQUEST'));
            }
        });

        req.on('error', (error) => {
            logger.error({ err: error }, 'Error reading request');
            reject(new ApplicationError('Error reading request', 400, true, 'REQUEST_ERROR'));
        });
    });
}

export function sendJsonResponse<T>(
    res: ServerResponse,
    statusCode: number,
    data: HttpResponse<T>
): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}

export function sendSuccess(res: ServerResponse, data: unknown, statusCode = 200): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        success: true,
        data
    }));
}

export function sendError(res: ServerResponse, error: unknown): void {
    const appError = error instanceof ApplicationError
        ? error
        : new ApplicationError(
            error instanceof Error ? error.message : 'An unexpected error occurred',
            500,
            false,
            'INTERNAL_ERROR',
            undefined,
            error instanceof Error ? error : undefined
        );

    logger.error({
        err: error,
        statusCode: appError.statusCode,
        errorCode: appError.errorCode
    }, 'Request error');

    res.statusCode = appError.statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        success: false,
        error: {
            message: appError.message,
            code: appError.errorCode,
            ...(process.env.NODE_ENV !== 'production' && appError.cause
                ? { cause: appError.cause.message }
                : {})
        }
    }));
}

export function setCorsHeaders(res: ServerResponse, req: IncomingMessage): void {
    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : ['*'];

    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const allowedHeaders = [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ];
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    res.setHeader('Access-Control-Max-Age', '3600');
}

export async function parseAndValidateBody<T>(req: IncomingMessage, validator?: (body: any) => T): Promise<T> {
    const rawBody = await parseRequestBody<any>(req);

    if (!rawBody) {
        throw new ValidationError('Request body is required');
    }

    if (validator) {
        return validator(rawBody);
    }

    return rawBody as T;
} 