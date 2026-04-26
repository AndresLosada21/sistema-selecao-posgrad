CREATE TABLE "SessaoRefresh" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "invalidadoEm" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "SessaoRefresh_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessaoRefresh_tokenHash_key" ON "SessaoRefresh"("tokenHash");
CREATE INDEX "SessaoRefresh_usuarioId_expiraEm_idx" ON "SessaoRefresh"("usuarioId", "expiraEm");
CREATE INDEX "SessaoRefresh_invalidadoEm_expiraEm_idx" ON "SessaoRefresh"("invalidadoEm", "expiraEm");

ALTER TABLE "SessaoRefresh" ADD CONSTRAINT "SessaoRefresh_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
