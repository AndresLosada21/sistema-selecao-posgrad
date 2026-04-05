import path from "node:path";
import { writeFile } from "node:fs/promises";

import express from "express";
import multer from "multer";

import { forbidden, notFound, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  assertUploadFile,
  buildPrivateUploadUrl,
  buildStoredUploadName,
  canReadPrivateUpload,
  createPrivateUploadReadStream,
  ensureUploadDirForUser,
  getMaxUploadSizeBytes,
  resolvePrivateUploadPath,
  statPrivateUpload,
} from "./upload.service.js";

export const uploadRouter = express.Router();

const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: getMaxUploadSizeBytes() } });

uploadRouter.post("/v1/uploads", requireAuth, uploadMiddleware.single("file"), async (request, response) => {
  if (!request.auth) {
    return response.status(401).json(validationError("Autenticacao obrigatoria.", { formErrors: ["Autenticacao obrigatoria."], fieldErrors: {} }));
  }

  try {
    const file = assertUploadFile(request.file);
    const ownerId = request.auth.userId;
    const targetDir = await ensureUploadDirForUser(ownerId);
    const storedName = buildStoredUploadName(file.originalname);
    const filePath = path.join(targetDir, storedName);

    await writeFile(filePath, file.buffer);

    return response.status(201).json({
      urlArquivo: buildPrivateUploadUrl(ownerId, storedName),
      nomeArquivo: file.originalname,
      mimeType: file.mimetype,
      tamanhoBytes: file.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar upload.";
    return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
  }
});

uploadRouter.get("/v1/uploads/private/:ownerId/:filename", requireAuth, async (request, response) => {
  if (!request.auth) {
    return response.status(401).json(validationError("Autenticacao obrigatoria.", { formErrors: ["Autenticacao obrigatoria."], fieldErrors: {} }));
  }

  const ownerId = Array.isArray(request.params.ownerId) ? request.params.ownerId[0] : request.params.ownerId;
  const filename = Array.isArray(request.params.filename) ? request.params.filename[0] : request.params.filename;

  if (!canReadPrivateUpload(request.auth.userId, ownerId, request.auth.perfis)) {
    return response.status(403).json(forbidden("Perfil sem permissao para acessar este arquivo."));
  }

  try {
    const fileStat = await statPrivateUpload(ownerId, filename);
    const filePath = resolvePrivateUploadPath(ownerId, filename);
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".pdf" ? "application/pdf" : extension === ".png" ? "image/png" : "image/jpeg";

    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", String(fileStat.size));
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return createPrivateUploadReadStream(ownerId, filename).pipe(response);
  } catch {
    return response.status(404).json(notFound("Arquivo nao encontrado."));
  }
});
