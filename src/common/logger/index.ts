interface LoggerConfig {
    level: string;
    enabled: boolean;
}

const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
type LogLevel = (typeof validLogLevels)[number];

interface LogMeta {
    [key: string]: any;
}

interface CustomLogger {
    trace: (msgOrObj: string | LogMeta, msg?: string) => void;
    debug: (msgOrObj: string | LogMeta, msg?: string) => void;
    info: (msgOrObj: string | LogMeta, msg?: string) => void;
    warn: (msgOrObj: string | LogMeta, msg?: string) => void;
    error: (msgOrObj: string | LogMeta, msg?: string) => void;
    fatal: (msgOrObj: string | LogMeta, msg?: string) => void;
    level: string;
    enabled: boolean;
    name: string;
}

function getValidLogLevel(level: string | undefined): LogLevel {
    if (!level) return 'info';

    const normalizedLevel = level.toLowerCase() as LogLevel;
    return validLogLevels.includes(normalizedLevel) ? normalizedLevel : 'info';
}

const defaultConfig: LoggerConfig = {
    level: getValidLogLevel(process.env.LOG_LEVEL),
    enabled: process.env.NODE_ENV !== 'test',
};

const logLevelValues: Record<LogLevel, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
};

const colors = {
    reset: '\x1b[0m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};

const levelColors: Record<LogLevel, string> = {
    trace: colors.gray,
    debug: colors.cyan,
    info: colors.green,
    warn: colors.yellow,
    error: colors.red,
    fatal: colors.magenta,
};

function formatMessage(
    level: LogLevel,
    name: string,
    msgOrObj: string | LogMeta,
    msg?: string
): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const levelColor = process.env.NODE_ENV === 'development' ? levelColors[level] : '';
    const resetColor = process.env.NODE_ENV === 'development' ? colors.reset : '';

    if (typeof msgOrObj === 'string') {
        return `${levelColor}${levelStr}${resetColor} [${timestamp}] (${name}): ${msgOrObj}`;
    }

    const metadata = { ...msgOrObj };
    let output = `${levelColor}${levelStr}${resetColor} [${timestamp}] (${name})`;

    if (msg) {
        output += `: ${msg}`;
    }

    if (Object.keys(metadata).length > 0) {
        if (metadata.err || metadata.error) {
            const error = metadata.err || metadata.error;
            if (error instanceof Error) {
                metadata.errorMessage = error.message;
                metadata.stack = error.stack;
                delete metadata.err;
                delete metadata.error;
            }
        }

        output += ` ${JSON.stringify(metadata)}`;
    }

    return output;
}

export function createLogger(
    name: string,
    config: Partial<LoggerConfig> = {}
): CustomLogger {
    const actualConfig = { ...defaultConfig, ...config };

    actualConfig.level = getValidLogLevel(actualConfig.level);

    const logger: CustomLogger = {
        name,
        level: actualConfig.level,
        enabled: actualConfig.enabled,

        trace: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.trace) return;
            console.log(formatMessage('trace', name, msgOrObj, msg));
        },

        debug: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.debug) return;
            console.log(formatMessage('debug', name, msgOrObj, msg));
        },

        info: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.info) return;
            console.log(formatMessage('info', name, msgOrObj, msg));
        },

        warn: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.warn) return;
            console.warn(formatMessage('warn', name, msgOrObj, msg));
        },

        error: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.error) return;
            console.error(formatMessage('error', name, msgOrObj, msg));
        },

        fatal: (msgOrObj: string | LogMeta, msg?: string) => {
            if (!actualConfig.enabled || logLevelValues[actualConfig.level as LogLevel] > logLevelValues.fatal) return;
            console.error(formatMessage('fatal', name, msgOrObj, msg));
        }
    };

    return logger;
}

export const logger = createLogger('app');
export const httpLogger = createLogger('http');
export const storageLogger = createLogger('storage');
export const dbLogger = createLogger('database');

export default logger; 