export function buildUniqueCandidate() {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nomeCompleto: `Candidato E2E ${seed}`,
    email: `candidato-e2e-${seed}@example.com`,
    senha: `SenhaSegura!${seed}`,
    telefone: `9299${seed.slice(-7)}`,
    cpf: seed.slice(-11).padStart(11, "0"),
  };
}
