/**
 * Logger Utility
 *
 * Structured logging with timestamp and level.
 * Swappable to pino/winston later without changing call sites.
 */

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function formatLogMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(formatLogMessage("INFO", message), ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(formatLogMessage("WARN", message), ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(formatLogMessage("ERROR", message), ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (process.env["NODE_ENV"] !== "production") {
      console.debug(formatLogMessage("DEBUG", message), ...args);
    }
  },
};
