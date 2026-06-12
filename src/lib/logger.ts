type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 100;

class Logger {
  private entries: LogEntry[] = [];

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private addEntry(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES);
    }

    if (level === 'error') {
      console.error(`[${entry.timestamp}] ${message}`, context ?? '');
    } else if (level === 'warn') {
      console.warn(`[${entry.timestamp}] ${message}`, context ?? '');
    } else {
      console.log(`[${entry.timestamp}] ${message}`, context ?? '');
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.addEntry('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.addEntry('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.addEntry('error', message, context);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level);
  }

  clear() {
    this.entries = [];
  }
}

export const logger = new Logger();

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(message, { ...context, stack });
}

export function captureMessage(message: string, level: LogLevel = 'info', context?: Record<string, unknown>) {
  logger[level](message, context);
}
