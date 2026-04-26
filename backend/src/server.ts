import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  logger.info("server_started", { port: env.PORT });
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("server_shutdown_started", { signal });

  server.close(async () => {
    await prisma.$disconnect();
    logger.info("server_shutdown_completed", { signal });
    process.exit(0);
  });

  setTimeout(async () => {
    await prisma.$disconnect();
    logger.error("server_shutdown_forced", { signal });
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
