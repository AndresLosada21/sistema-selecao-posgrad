import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be set with at least 16 characters"),
  UPLOADS_DIR: z.string().min(1).default("storage/uploads"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_SWAGGER_UI: z.coerce.boolean().optional(),
  AUTH_CACHE_TTL_MS: z.coerce.number().int().min(0).max(300_000).default(30_000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  ENABLE_SWAGGER_UI: parsedEnv.ENABLE_SWAGGER_UI ?? parsedEnv.NODE_ENV !== "production",
};
