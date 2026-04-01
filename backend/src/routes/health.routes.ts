import { Router } from "express";

import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      status: "ok",
      service: "backend",
      database: "up",
      timestamp: new Date().toISOString(),
    });
  } catch {
    response.status(503).json({
      status: "degraded",
      service: "backend",
      database: "down",
      timestamp: new Date().toISOString(),
    });
  }
});
