import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return error;
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  if (levelWeight[level] < levelWeight[env.LOG_LEVEL]) return;

  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context })}\n`);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext & { error?: unknown }) => write("error", message, context?.error ? { ...context, error: normalizeError(context.error) } : context),
};

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const requestId = request.headers["x-request-id"]?.toString() || randomUUID();
  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  const startedAt = Date.now();
  response.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      userId: request.auth?.userId,
    });
  });

  next();
}
