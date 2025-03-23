export class ApplicationError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly errorCode: string;
    public readonly context?: Record<string, unknown>;
    public readonly cause?: Error;

    constructor(
        message: string,
        statusCode = 500,
        isOperational = true,
        errorCode = 'INTERNAL_ERROR',
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errorCode = errorCode;
        this.context = context;
        this.cause = cause;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 400, true, 'VALIDATION_ERROR', context, cause);
    }
}

export class NotFoundError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 404, true, 'NOT_FOUND', context, cause);
    }
}

export class StorageError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error,
        isRetryable = false
    ) {
        super(
            message,
            500,
            true,
            isRetryable ? 'STORAGE_ERROR_RETRYABLE' : 'STORAGE_ERROR',
            context,
            cause
        );
    }
}

export class DatabaseError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error,
        isRetryable = false
    ) {
        super(
            message,
            500,
            true,
            isRetryable ? 'DATABASE_ERROR_RETRYABLE' : 'DATABASE_ERROR',
            context,
            cause
        );
    }
}

export class MethodNotAllowedError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 405, true, 'METHOD_NOT_ALLOWED', context, cause);
    }
}

export class BadRequestError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 400, true, 'BAD_REQUEST', context, cause);
    }
}

export class ConflictError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 409, true, 'CONFLICT', context, cause);
    }
}

export class InternalServerError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        cause?: Error
    ) {
        super(message, 500, true, 'INTERNAL_ERROR', context, cause);
    }
} 