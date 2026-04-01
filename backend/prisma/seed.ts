import {
  CursoNivel,
  Role,
  StatusConta,
  StatusEdital,
  TipoCronogramaEdital,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma.js";

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

async function main() {
  const now = new Date();
  const adminPasswordHash = await bcrypt.hash("Admin1234", 10);

  const admin = await prisma.usuario.upsert({
    where: { email: "admin@ppgee.ufam.edu.br" },
    update: {
      senhaHash: adminPasswordHash,
      statusConta: StatusConta.ATIVA,
    },
    create: {
      nomeCompleto: "Administrador PPGEE",
      email: "admin@ppgee.ufam.edu.br",
      senhaHash: adminPasswordHash,
      statusConta: StatusConta.ATIVA,
      perfis: {
        create: [{ role: Role.ADMIN }],
      },
    },
  });

  const edital = await prisma.edital.upsert({
    where: {
      numero_ano_cursoNivel: {
        numero: "092/2026",
        ano: 2026,
        cursoNivel: CursoNivel.MESTRADO,
      },
    },
    update: {
      titulo: "Processo Seletivo Stricto Sensu 2026/1",
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date("2026-01-02T12:00:00.000Z"),
    },
    create: {
      numero: "092/2026",
      titulo: "Processo Seletivo Stricto Sensu 2026/1",
      descricao: "Edital de referencia para desenvolvimento do modulo de edital.",
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date("2026-01-02T12:00:00.000Z"),
      criadoPorId: admin.id,
    },
  });

  const editalDoutorado = await prisma.edital.upsert({
    where: {
      numero_ano_cursoNivel: {
        numero: "093/2026",
        ano: 2026,
        cursoNivel: CursoNivel.DOUTORADO,
      },
    },
    update: {
      titulo: "Processo Seletivo Doutorado 2026/1",
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date("2026-01-03T12:00:00.000Z"),
    },
    create: {
      numero: "093/2026",
      titulo: "Processo Seletivo Doutorado 2026/1",
      descricao: "Edital de doutorado para validar fluxos paralelos e janela de isencao.",
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.DOUTORADO,
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date("2026-01-03T12:00:00.000Z"),
      criadoPorId: admin.id,
    },
  });

  const cronogramas = [
    {
      tipo: TipoCronogramaEdital.PEDIDO_ISENCAO,
      titulo: "Solicitacao de isencao",
      inicioEm: addDays(now, -12),
      fimEm: addDays(now, -10),
    },
    {
      tipo: TipoCronogramaEdital.RECURSO_HOMOLOGACAO,
      titulo: "Recurso de homologacao",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 5),
    },
    {
      tipo: TipoCronogramaEdital.RECURSO_ETAPA_1,
      titulo: "Recurso da etapa 1",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 5),
    },
    {
      tipo: TipoCronogramaEdital.RECURSO_ETAPA_2,
      titulo: "Recurso da etapa 2",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 5),
    },
    {
      tipo: TipoCronogramaEdital.RECURSO_CLASSIFICACAO,
      titulo: "Recurso da classificacao",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 5),
    },
    {
      tipo: TipoCronogramaEdital.INSCRICAO,
      titulo: "Inscricao online",
      inicioEm: addDays(now, -2),
      fimEm: addDays(now, 7),
    },
    {
      tipo: TipoCronogramaEdital.HOMOLOGACAO_PRELIMINAR,
      titulo: "Homologacao preliminar",
      inicioEm: addDays(now, 10),
      fimEm: addDays(now, 11),
    },
    {
      tipo: TipoCronogramaEdital.ETAPA_1,
      titulo: "Etapa 1 - Redacao",
      inicioEm: addDays(now, 18),
      fimEm: addDays(now, 18),
    },
  ];

  for (const cronograma of cronogramas) {
    const existente = await prisma.cronogramaEdital.findFirst({
      where: {
        editalId: edital.id,
        tipo: cronograma.tipo,
      },
    });

    if (existente) {
      await prisma.cronogramaEdital.update({
        where: { id: existente.id },
        data: {
          titulo: cronograma.titulo,
          inicioEm: cronograma.inicioEm,
          fimEm: cronograma.fimEm,
        },
      });

      continue;
    }

    await prisma.cronogramaEdital.create({
      data: {
        editalId: edital.id,
        ...cronograma,
      },
    });
  }

  const linhas = [
    {
      nome: "Sistemas Inteligentes e Microeletronica",
      vagasAmplaConcorrencia: 10,
      vagasAcoesAfirmativas: 3,
    },
    {
      nome: "Sistemas de Controle e Automacao Modernos",
      vagasAmplaConcorrencia: 20,
      vagasAcoesAfirmativas: 5,
    },
  ];

  for (const linha of linhas) {
    await prisma.linhaPesquisa.upsert({
      where: {
        editalId_nome: {
          editalId: edital.id,
          nome: linha.nome,
        },
      },
      update: {
        vagasAmplaConcorrencia: linha.vagasAmplaConcorrencia,
        vagasAcoesAfirmativas: linha.vagasAcoesAfirmativas,
      },
      create: {
        editalId: edital.id,
        ...linha,
      },
    });
  }

  const cronogramaDoutorado = [
    {
      tipo: TipoCronogramaEdital.PEDIDO_ISENCAO,
      titulo: "Solicitacao de isencao doutorado",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 2),
    },
    {
      tipo: TipoCronogramaEdital.RECURSO_ISENCAO,
      titulo: "Recurso de isencao doutorado",
      inicioEm: addDays(now, -1),
      fimEm: addDays(now, 3),
    },
    {
      tipo: TipoCronogramaEdital.INSCRICAO,
      titulo: "Inscricao online doutorado",
      inicioEm: addDays(now, 3),
      fimEm: addDays(now, 12),
    },
  ];

  for (const cronograma of cronogramaDoutorado) {
    const existente = await prisma.cronogramaEdital.findFirst({
      where: {
        editalId: editalDoutorado.id,
        tipo: cronograma.tipo,
      },
    });

    if (existente) {
      await prisma.cronogramaEdital.update({
        where: { id: existente.id },
        data: {
          titulo: cronograma.titulo,
          inicioEm: cronograma.inicioEm,
          fimEm: cronograma.fimEm,
        },
      });

      continue;
    }

    await prisma.cronogramaEdital.create({
      data: {
        editalId: editalDoutorado.id,
        ...cronograma,
      },
    });
  }

  for (const linha of [
    {
      nome: "Sistemas Inteligentes e Microeletronica",
      vagasAmplaConcorrencia: 6,
      vagasAcoesAfirmativas: 2,
    },
    {
      nome: "Sistemas de Controle e Automacao Modernos",
      vagasAmplaConcorrencia: 8,
      vagasAcoesAfirmativas: 2,
    },
  ]) {
    await prisma.linhaPesquisa.upsert({
      where: {
        editalId_nome: {
          editalId: editalDoutorado.id,
          nome: linha.nome,
        },
      },
      update: {
        vagasAmplaConcorrencia: linha.vagasAmplaConcorrencia,
        vagasAcoesAfirmativas: linha.vagasAcoesAfirmativas,
      },
      create: {
        editalId: editalDoutorado.id,
        ...linha,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
