import type { Role } from "@prisma/client";
import { StatusConta } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

type CachedAuthUser = {
  id: string;
  email: string;
  statusConta: StatusConta;
  perfis: Array<{ role: Role }>;
};

const cache = new Map<string, { expiresAt: number; user: CachedAuthUser }>();

export async function getCachedAuthUser(userId: string) {
  const cached = cache.get(userId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) return cached.user;

  cache.delete(userId);

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { perfis: true },
  });

  if (!user) return null;

  cache.set(userId, { expiresAt: now + env.AUTH_CACHE_TTL_MS, user });
  return user;
}

export function invalidateAuthUserCache(userId: string) {
  cache.delete(userId);
}
