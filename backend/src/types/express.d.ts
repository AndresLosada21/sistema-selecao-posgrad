import type { Role, StatusConta } from "@prisma/client";

export {};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        userId: string;
        email: string;
        statusConta: StatusConta;
        perfis: Role[];
      };
    }
  }
}
