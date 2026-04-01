import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { candidatoAreaRouter } from "./modules/candidato/candidato-area.routes.js";
import { classificacaoRouter } from "./modules/classificacao/classificacao.routes.js";
import { editalRouter } from "./modules/edital/edital.routes.js";
import { etapa1Router } from "./modules/etapa1/etapa1.routes.js";
import { etapa2Router } from "./modules/etapa2/etapa2.routes.js";
import { homologacaoRouter } from "./modules/homologacao/homologacao.routes.js";
import { inscricaoRouter } from "./modules/inscricao/inscricao.routes.js";
import { isencaoRouter } from "./modules/isencao/isencao.routes.js";
import { publicacaoRouter } from "./modules/publicacao/publicacao.routes.js";
import { recursoRouter } from "./modules/recurso/recurso.routes.js";
import { healthRouter } from "./routes/health.routes.js";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());

app.use(healthRouter);
app.use(authRouter);
app.use(candidatoAreaRouter);
app.use(classificacaoRouter);
app.use(editalRouter);
app.use(etapa1Router);
app.use(etapa2Router);
app.use(homologacaoRouter);
app.use(isencaoRouter);
app.use(inscricaoRouter);
app.use(publicacaoRouter);
app.use(recursoRouter);
