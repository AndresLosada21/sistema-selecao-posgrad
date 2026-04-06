import { mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { Role } from "@prisma/client";

import { env } from "../../config/env.js";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

function assertSafePathSegment(value: string, field: string) {
  if (!value || value.includes("..") || value.includes("/") || value.includes("\\")) {
    throw new Error(`${field} invalido.`);
  }

  return value;
}

export function assertSafePrivateUploadParams(ownerId: string, filename: string) {
  return {
    ownerId: assertSafePathSegment(ownerId, "ownerId"),
    filename: assertSafePathSegment(filename, "filename"),
  };
}

function sanitizeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function getUploadsRootDir() {
  return path.resolve(process.cwd(), env.UPLOADS_DIR);
}

export async function ensureUploadDirForUser(userId: string) {
  const targetDir = path.join(getUploadsRootDir(), "private", userId);
  await mkdir(targetDir, { recursive: true });
  return targetDir;
}

export function assertUploadFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new Error("Arquivo obrigatorio.");
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new Error("Tipo de arquivo nao suportado. Envie PDF, PNG ou JPEG.");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Arquivo excede o limite de 10 MB.");
  }

  return file;
}

export function buildStoredUploadName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase() || ".bin";
  const base = sanitizeFilenamePart(path.basename(originalName, extension)) || "arquivo";
  return `${randomUUID()}-${base}${extension}`;
}

export function buildPrivateUploadUrl(ownerId: string, filename: string) {
  assertSafePrivateUploadParams(ownerId, filename);
  return `/v1/uploads/private/${ownerId}/${filename}`;
}

export function resolvePrivateUploadPath(ownerId: string, filename: string) {
  assertSafePrivateUploadParams(ownerId, filename);
  return path.join(getUploadsRootDir(), "private", ownerId, filename);
}

export async function statPrivateUpload(ownerId: string, filename: string) {
  return await stat(resolvePrivateUploadPath(ownerId, filename));
}

export function createPrivateUploadReadStream(ownerId: string, filename: string) {
  return createReadStream(resolvePrivateUploadPath(ownerId, filename));
}

export function canReadPrivateUpload(requesterId: string, ownerId: string, perfis: Role[]) {
  return requesterId === ownerId || perfis.includes(Role.ADMIN) || perfis.includes(Role.AVALIADOR);
}

export function getMaxUploadSizeBytes() {
  return MAX_UPLOAD_SIZE_BYTES;
}
