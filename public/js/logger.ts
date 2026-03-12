type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  showTimestamp: boolean;
  showLevel: boolean;
  persistLogs: boolean;
  maxPersistedLogs: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6c757d; font-weight: normal;',
  info: 'color: #0d6efd; font-weight: normal;',
  warn: 'color: #ffc107; font-weight: bold;',
  error: 'color: #dc3545; font-weight: bold;',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

interface PersistedLog {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  args: unknown[];
}

class FrontendLogger {
  private context: string;
  private config: LogConfig;
  private static persistedLogs: PersistedLog[] = [];

  constructor(context: string, config?: Partial<LogConfig>) {
    this.context = context;
    this.config = {
      level: 'debug',
      showTimestamp: true,
      showLevel: true,
      persistLogs: true,
      maxPersistedLogs: 100,
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

  private persistLog(level: LogLevel, message: string, args: unknown[]): void {
    if (!this.config.persistLogs) return;

    const logEntry: PersistedLog = {
      timestamp: this.formatTimestamp(),
      level,
      context: this.context,
      message,
      args,
    };

    FrontendLogger.persistedLogs.push(logEntry);

    if (FrontendLogger.persistedLogs.length > this.config.maxPersistedLogs) {
      FrontendLogger.persistedLogs.shift();
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    this.persistLog(level, message, args);

    const timestamp = this.config.showTimestamp ? `%c${this.formatTimestamp()}%c` : '';
    const levelStr = LEVEL_LABELS[level];
    const contextStr = `[${this.context}]`;

    const styles: string[] = [];
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      styles.push('color: #6c757d;');
      styles.push('color: inherit;');
      parts.push(timestamp);
    }

    if (this.config.showLevel) {
      parts.push(`%c${levelStr}%c`);
      styles.push(LEVEL_STYLES[level]);
      styles.push('color: inherit;');
    }

    parts.push(`%c${contextStr}%c`);
    styles.push('color: #0d6efd; font-weight: bold;');
    styles.push('color: inherit;');

    parts.push(message);

    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

    if (args.length > 0) {
      console[consoleMethod](parts.join(' '), ...styles, ...args);
    } else {
      console[consoleMethod](parts.join(' '), ...styles);
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

  child(subContext: string): FrontendLogger {
    return new FrontendLogger(`${this.context}:${subContext}`, this.config);
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

  table(data: unknown): void {
    console.table(data);
  }

  static getLogs(): PersistedLog[] {
    return [...FrontendLogger.persistedLogs];
  }

  static clearLogs(): void {
    FrontendLogger.persistedLogs = [];
  }

  static exportLogs(): string {
    return FrontendLogger.persistedLogs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase().padEnd(5)} [${log.context}] ${log.message}`)
      .join('\n');
  }

  static downloadLogs(): void {
    const logs = FrontendLogger.exportLogs();
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autocopy-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

const loggers = new Map<string, FrontendLogger>();

export function createLogger(context: string, config?: Partial<LogConfig>): FrontendLogger {
  const existingLogger = loggers.get(context);
  if (existingLogger) {
    return existingLogger;
  }
  const logger = new FrontendLogger(context, config);
  loggers.set(context, logger);
  return logger;
}

export const defaultLogger = createLogger('App');

export function logApiCall(
  endpoint: string,
  method: string,
  duration?: number,
  status?: number
): void {
  const logger = createLogger('API');
  const statusStr = status !== undefined ? ` (${status})` : '';
  const durationStr = duration !== undefined ? ` - ${duration}ms` : '';
  
  if (status !== undefined && status >= 400) {
    logger.error(`${method} ${endpoint}${statusStr}${durationStr}`);
  } else {
    logger.info(`${method} ${endpoint}${statusStr}${durationStr}`);
  }
}

export function logUserAction(action: string, details?: Record<string, unknown>): void {
  const logger = createLogger('User');
  if (details) {
    logger.info(action, details);
  } else {
    logger.info(action);
  }
}

export function logError(error: Error, context?: string): void {
  const logger = context ? createLogger(context) : defaultLogger;
  logger.error(`${error.name}: ${error.message}`);
  if (error.stack) {
    logger.debug('Stack trace:', error.stack);
  }
}

export { FrontendLogger };

declare global {
  interface Window {
    __autocopy_logger__: {
      getLogs: () => PersistedLog[];
      clearLogs: () => void;
      exportLogs: () => string;
      downloadLogs: () => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__autocopy_logger__ = {
    getLogs: FrontendLogger.getLogs,
    clearLogs: FrontendLogger.clearLogs,
    exportLogs: FrontendLogger.exportLogs,
    downloadLogs: FrontendLogger.downloadLogs,
  };
}
