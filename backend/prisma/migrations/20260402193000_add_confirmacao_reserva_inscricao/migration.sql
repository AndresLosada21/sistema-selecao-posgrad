CREATE TYPE "StatusConfirmacaoReserva" AS ENUM ('NAO_SE_APLICA', 'PENDENTE', 'CONFIRMADA', 'NAO_CONFIRMADA', 'AUSENTE');

ALTER TABLE "Inscricao"
ADD COLUMN "confirmacaoAcoesAfirmativas" "StatusConfirmacaoReserva" NOT NULL DEFAULT 'NAO_SE_APLICA',
ADD COLUMN "confirmacaoPcd" "StatusConfirmacaoReserva" NOT NULL DEFAULT 'NAO_SE_APLICA';

UPDATE "Inscricao"
SET
  "confirmacaoAcoesAfirmativas" = CASE
    WHEN "modalidadeConcorrencia" = 'ACOES_AFIRMATIVAS' THEN 'PENDENTE'::"StatusConfirmacaoReserva"
    ELSE 'NAO_SE_APLICA'::"StatusConfirmacaoReserva"
  END,
  "confirmacaoPcd" = CASE
    WHEN "modalidadeConcorrencia" = 'PCD' THEN 'PENDENTE'::"StatusConfirmacaoReserva"
    ELSE 'NAO_SE_APLICA'::"StatusConfirmacaoReserva"
  END;
