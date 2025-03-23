import path from 'node:path';
import fs from 'node:fs';

try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envConfig = envFile
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .reduce<Record<string, string>>((acc, line) => {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    value = value.replace(/^['"]|['"]$/g, '');
                    acc[key] = value;
                }
                return acc;
            }, {});

        Object.assign(process.env, envConfig);
    } else {
        console.warn('No .env file found. Using existing environment variables.');
    }
} catch (error: unknown) {
    console.error(`Error loading .env file: ${error instanceof Error ? error.message : String(error)}`);
}

type ValidationResult<T> = {
    isValid: boolean;
    value?: T;
    errors?: string[];
};

interface ValidationRule {
    validate: (val: any) => boolean;
    default?: any;
    required?: boolean;
    errorMessage?: string;
    transform?: (val: any) => any;
}

interface EnvVars {
    NODE_ENV: string;
    PORT: number;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    S3_BUCKET_NAME: string;
    S3_PREFIX: string;
    MAX_FILE_SIZE: number;
    UPLOAD_URL_EXPIRY: number;
    ALLOWED_MIME_TYPES: string[];
    MONGODB_URI: string;
    MONGODB_DB_NAME: string;
    LOG_LEVEL: string;
}

function validateEnv<T>(
    env: Record<string, any>,
    schema: Record<string, ValidationRule>
): ValidationResult<T> {
    const result: Record<string, any> = {};
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
        let value = env[key];

        if (rules.required && (value === undefined || value === '')) {
            errors.push(rules.errorMessage || `${key} is required`);
            continue;
        }

        if (value === undefined && rules.default !== undefined) {
            value = rules.default;
        }

        if (value === undefined) {
            continue;
        }

        if (!rules.validate(value)) {
            errors.push(rules.errorMessage || `${key} is invalid`);
            continue;
        }

        if (rules.transform) {
            value = rules.transform(value);
        }

        result[key] = value;
    }

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    return { isValid: true, value: result as T };
}

function troubleshootEnvVar(name: string) {
    const value = process.env[name];
    console.log(`Troubleshooting ${name}:`);
    console.log(`  - Value: "${value}"`);
    console.log(`  - Type: ${typeof value}`);
    console.log(`  - isNaN: ${isNaN(Number(value))}`);

    if (value) {
        console.log(`  - First char code: ${value.charCodeAt(0)}`);
        console.log(`  - Last char code: ${value.charCodeAt(value.length - 1)}`);
    }

    const hexDump = Array.from(String(value || ''))
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(' ');
    console.log(`  - Hex dump: ${hexDump}`);
}

const envValidation = validateEnv<EnvVars>(process.env, {
    NODE_ENV: {
        validate: (val) => ['development', 'production', 'test'].includes(String(val)),
        default: 'development',
        transform: (val) => String(val),
        errorMessage: "NODE_ENV must be one of: 'development', 'production', 'test'"
    },
    PORT: {
        validate: (val) => !isNaN(Number(val)),
        default: 3000,
        transform: (val) => Number(val),
        errorMessage: "PORT must be a valid number"
    },
    AWS_REGION: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "AWS_REGION is required"
    },
    AWS_ACCESS_KEY_ID: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "AWS_ACCESS_KEY_ID is required"
    },
    AWS_SECRET_ACCESS_KEY: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "AWS_SECRET_ACCESS_KEY is required"
    },
    S3_BUCKET_NAME: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "S3_BUCKET_NAME is required"
    },
    S3_PREFIX: {
        validate: (val) => true,
        transform: (val) => String(val || ''),
        default: ''
    },
    MAX_FILE_SIZE: {
        validate: (val) => true,
        default: 104857600, // 100MB
        transform: (val) => {
            const parsed = Number(val);
            return isNaN(parsed) ? 104857600 : parsed;
        },
        errorMessage: "MAX_FILE_SIZE must be a valid number"
    },
    UPLOAD_URL_EXPIRY: {
        validate: (val) => true,
        default: 900,
        transform: (val) => {
            const parsed = Number(val);
            return isNaN(parsed) ? 900 : parsed;
        },
        errorMessage: "UPLOAD_URL_EXPIRY must be a valid number"
    },
    ALLOWED_MIME_TYPES: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val).split(',').map((type) => type.trim()),
        errorMessage: "ALLOWED_MIME_TYPES is required (comma-separated list)"
    },
    MONGODB_URI: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "MONGODB_URI is required"
    },
    MONGODB_DB_NAME: {
        validate: (val) => !!val,
        required: true,
        transform: (val) => String(val),
        errorMessage: "MONGODB_DB_NAME is required"
    },
    LOG_LEVEL: {
        validate: (val) => true,
        default: 'info',
        transform: (val) => {
            const logLevel = String(val || '').toLowerCase();
            return ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(logLevel)
                ? logLevel
                : 'info';
        },
        errorMessage: "LOG_LEVEL must be one of: 'trace', 'debug', 'info', 'warn', 'error', 'fatal'"
    },
});

if (!envValidation.isValid) {
    console.error('Environment validation failed:');
    envValidation.errors!.forEach(error => {
        console.error(`- ${error}`);
    });

    console.error('\nTroubleshooting problem variables:');
    troubleshootEnvVar('MAX_FILE_SIZE');
    troubleshootEnvVar('UPLOAD_URL_EXPIRY');
    troubleshootEnvVar('LOG_LEVEL');

    console.error('\nCurrent environment values:');
    Object.keys(process.env)
        .filter(key => !key.includes('SECRET') && !key.includes('KEY'))
        .forEach(key => {
            console.error(`- ${key}: ${process.env[key]}`);
        });

    try {
        const sampleEnvPath = path.resolve(process.cwd(), '.env.sample');
        const sampleEnvContent = `
# Server
NODE_ENV=development
PORT=3000

# AWS
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=your-bucket-name
S3_PREFIX=

# Upload
MAX_FILE_SIZE=104857600
UPLOAD_URL_EXPIRY=900
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=media-service

# Logging
LOG_LEVEL=info
`;
        fs.writeFileSync(sampleEnvPath, sampleEnvContent.trim());
        console.error(`\nCreated sample .env file at: ${sampleEnvPath}`);
        console.error('Please use this file as a reference to set up your environment.');
    } catch (error) {
        console.error('Failed to create sample .env file:', error);
    }

    process.exit(1);
}

const envVars = envValidation.value!;

export const config = {
    nodeEnv: envVars.NODE_ENV,
    port: envVars.PORT,
    aws: {
        region: envVars.AWS_REGION,
        accessKeyId: envVars.AWS_ACCESS_KEY_ID,
        secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
        s3Bucket: envVars.S3_BUCKET_NAME,
        s3Prefix: envVars.S3_PREFIX || '',
    },
    upload: {
        maxFileSize: envVars.MAX_FILE_SIZE,
        urlExpiry: envVars.UPLOAD_URL_EXPIRY,
        allowedMimeTypes: envVars.ALLOWED_MIME_TYPES,
    },
    mongodb: {
        uri: envVars.MONGODB_URI,
        dbName: envVars.MONGODB_DB_NAME,
    },
    logger: {
        level: envVars.LOG_LEVEL,
    },
};

export default config; 