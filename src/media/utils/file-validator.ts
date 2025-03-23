import { logger } from '../../common/logger';

interface FileSignature {
    mimeType: string;
    signature: number[];
    offset?: number;
}

const FILE_SIGNATURES: FileSignature[] = [
    // Images
    { mimeType: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF] },
    { mimeType: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { mimeType: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] },
    { mimeType: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF

    // PDF
    { mimeType: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF

    // Documents
    { mimeType: 'application/msword', signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // DOC
    { mimeType: 'application/vnd.openxmlformats-officedocument', signature: [0x50, 0x4B, 0x03, 0x04] }, // DOCX/XLSX/PPTX (ZIP-based)

    // Audio/Video
    { mimeType: 'audio/mpeg', signature: [0x49, 0x44, 0x33] }, // MP3 with ID3
    { mimeType: 'video/mp4', signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], offset: 4 }, // MP4

    // Archives
    { mimeType: 'application/zip', signature: [0x50, 0x4B, 0x03, 0x04] }, // ZIP
    { mimeType: 'application/x-rar-compressed', signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] }, // RAR
];

export function validateFileContent(buffer: Buffer, claimedMimeType: string): boolean {
    if (!buffer || buffer.length < 8) {
        logger.warn('File buffer is too small for content validation');
        return false;
    }

    const expectedSignatures = FILE_SIGNATURES.filter(sig =>
        claimedMimeType.startsWith(sig.mimeType)
    );

    if (expectedSignatures.length === 0) {
        logger.debug(`No known signatures for mime type: ${claimedMimeType}`);

        return true;
    }

    for (const { signature, offset = 0 } of expectedSignatures) {
        let matches = true;

        if (buffer.length < offset + signature.length) {
            continue;
        }

        for (let i = 0; i < signature.length; i++) {
            if (buffer[offset + i] !== signature[i]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return true;
        }
    }

    logger.warn({
        claimedMimeType,
        expectedSignatures: expectedSignatures.map(s => s.signature)
    }, 'File content does not match claimed MIME type');

    return false;
}


export function detectMimeType(buffer: Buffer): string | undefined {
    if (!buffer || buffer.length < 8) {
        return undefined;
    }

    for (const { mimeType, signature, offset = 0 } of FILE_SIGNATURES) {
        let matches = true;

        if (buffer.length < offset + signature.length) {
            continue;
        }

        for (let i = 0; i < signature.length; i++) {
            if (buffer[offset + i] !== signature[i]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return mimeType;
        }
    }

    return undefined;
} 