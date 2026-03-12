type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  showTimestamp: boolean;
  showLevel: boolean;
  showCaller: boolean;
  colorize: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.cyan,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

class Logger {
  private context: string;
  private config: LogConfig;

  constructor(context: string, config?: Partial<LogConfig>) {
    this.context = context;
    this.config = {
      level: (process.env['LOG_LEVEL'] as LogLevel) || 'info',
      showTimestamp: true,
      showLevel: true,
      showCaller: false,
      colorize: true,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      const timestamp = this.formatTimestamp();
      parts.push(this.config.colorize ? `${COLORS.dim}${timestamp}${COLORS.reset}` : timestamp);
    }

    if (this.config.showLevel) {
      const levelStr = LEVEL_LABELS[level];
      if (this.config.colorize) {
        parts.push(`${LEVEL_COLORS[level]}${levelStr}${COLORS.reset}`);
      } else {
        parts.push(levelStr);
      }
    }

    const contextStr = `[${this.context}]`;
    if (this.config.colorize) {
      parts.push(`${COLORS.bright}${COLORS.blue}${contextStr}${COLORS.reset}`);
    } else {
      parts.push(contextStr);
    }

    parts.push(message);

    return parts.join(' ');
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message);
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

    if (args.length > 0) {
      console[consoleMethod](formattedMessage, ...args);
    } else {
      console[consoleMethod](formattedMessage);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.config);
  }

  timer(label: string): () => void {
    const start = Date.now();
    this.debug(`[${label}] started`);
    return () => {
      const duration = Date.now() - start;
      this.debug(`[${label}] completed in ${duration}ms`);
    };
  }

  group(label: string): void {
    console.group(`[${this.context}] ${label}`);
  }

  groupEnd(): void {
    console.groupEnd();
  }
}

const loggers = new Map<string, Logger>();

export function createLogger(context: string, config?: Partial<LogConfig>): Logger {
  const existingLogger = loggers.get(context);
  if (existingLogger) {
    return existingLogger;
  }
  const logger = new Logger(context, config);
  loggers.set(context, logger);
  return logger;
}

export const defaultLogger = createLogger('App');

export function logRequest(method: string, path: string, statusCode: number, duration: number): void {
  const statusColor = statusCode >= 400 ? COLORS.red : statusCode >= 300 ? COLORS.yellow : COLORS.green;
  const durationStr = duration > 1000 ? `${(duration / 1000).toFixed(2)}s` : `${duration}ms`;
  
  defaultLogger.info(
    `${COLORS.dim}${method.padEnd(6)}${COLORS.reset} ${path} ${statusColor}${statusCode}${COLORS.reset} ${COLORS.dim}${durationStr}${COLORS.reset}`
  );
}

export function logError(error: Error, context?: string): void {
  const logger = context ? createLogger(context) : defaultLogger;
  logger.error(`${error.name}: ${error.message}`);
  if (error.stack) {
    logger.debug('Stack trace:', error.stack);
  }
}

export function logApiCall(
  provider: string,
  model: string,
  promptTokens?: number,
  completionTokens?: number,
  duration?: number
): void {
  const logger = createLogger('AI');
  const parts: string[] = [`${provider}/${model}`];
  
  if (promptTokens !== undefined) {
    parts.push(`in:${promptTokens}`);
  }
  if (completionTokens !== undefined) {
    parts.push(`out:${completionTokens}`);
  }
  if (duration !== undefined) {
    parts.push(`${duration}ms`);
  }
  
  logger.info(`API Call: ${parts.join(' | ')}`);
}

export { Logger };
