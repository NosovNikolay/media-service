export type MediaStatus = 'pending' | 'uploaded' | 'validated' | 'invalid' | 'failed';

export const MediaStatusEnum = {
    PENDING: 'pending' as MediaStatus,
    UPLOADED: 'uploaded' as MediaStatus,
    VALIDATED: 'validated' as MediaStatus,
    INVALID: 'invalid' as MediaStatus,
    FAILED: 'failed' as MediaStatus
};

export interface MediaFilter {
    status?: MediaStatus;
    mimeType?: string;
    fileName?: string;
    startDate?: Date;
    endDate?: Date;
    minSize?: number;
    maxSize?: number;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export const MimeTypes = {
    OCTET_STREAM: 'application/octet-stream',

    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    WEBP: 'image/webp',
    SVG: 'image/svg+xml',

    PDF: 'application/pdf',
    DOC: 'application/msword',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    XLS: 'application/vnd.ms-excel',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    MP3: 'audio/mpeg',
    WAV: 'audio/wav',

    MP4: 'video/mp4',
    WEBM: 'video/webm',

    ZIP: 'application/zip',
    RAR: 'application/x-rar-compressed'
}; 