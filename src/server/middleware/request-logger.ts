import { IncomingMessage, ServerResponse } from 'node:http';
import { httpLogger as logger } from '../../common/logger';

export async function requestLogger(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => Promise<void>
): Promise<void> {
    const start = Date.now();
    const { method, url, headers } = req;
    const originalEnd = res.end;
    let responseBody: Buffer[] = [];

    res.end = function (
        this: ServerResponse,
        chunk?: any,
        encoding?: string | (() => void),
        callback?: (() => void)
    ): ServerResponse {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = undefined;
        }

        if (chunk) {
            responseBody.push(Buffer.from(chunk));
        }

        const duration = Date.now() - start;
        const contentLength = Number(res.getHeader('content-length')) ||
            (responseBody.length ? Buffer.concat(responseBody).length : 0);

        logger.info({
            request: {
                method,
                url,
                userAgent: headers['user-agent'],
                contentType: headers['content-type'],
            },
            response: {
                statusCode: res.statusCode,
                contentLength,
                duration: `${duration}ms`,
            }
        }, `${method} ${url} ${res.statusCode} - ${duration}ms`);

        return originalEnd.apply(this, [chunk, encoding, callback].filter(Boolean) as any);
    };

    await next();
}

export default requestLogger; 