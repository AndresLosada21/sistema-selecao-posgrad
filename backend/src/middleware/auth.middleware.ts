import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

type AuthTokenPayload = {
  sub: string;
  email: string;
};

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      message: "Autenticacao obrigatoria.",
    });
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

    request.auth = {
      userId: payload.sub,
      email: payload.email,
    };

    return next();
  } catch {
    return response.status(401).json({
      message: "Token invalido ou expirado.",
    });
  }
}
