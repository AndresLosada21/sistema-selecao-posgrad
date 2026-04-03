import type { Role, StatusConta } from "@prisma/client";

export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        statusConta: StatusConta;
        perfis: Role[];
      };
    }
  }
}
