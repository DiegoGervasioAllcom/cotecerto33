import { describe, expect, it } from "vitest";
import type { FullTeamMember } from "../../src/components/operacao/acessos/full/full-team";
import { fullTeamMemberMatches } from "../../src/components/operacao/acessos/full/full-team-utils";
import { cadastroDiretoIdentidadeSchema } from "../../src/components/operacao/acessos/full/full-direct-schema";

const membro: FullTeamMember = {
  id: "v1",
  nome: "Beatriz Assoni",
  email: "beatriz@example.com",
  cpf: "123.456.789-00",
  equipe: "Campinas",
  produtos: 2,
  comissao: null,
  leadsDia: 10,
  desde: "2026",
  performanceStatus: "ativo",
  personalizado: false,
  desligadoEm: null,
  supervisaoLabel: "Franquia Campinas",
};

describe("fullTeamMemberMatches", () => {
  it("busca por nome, e-mail e documento sem diferenciar maiúsculas", () => {
    expect(fullTeamMemberMatches(membro, "BEATRIZ", "", "")).toBe(true);
    expect(fullTeamMemberMatches(membro, "example.com", "", "")).toBe(true);
    expect(fullTeamMemberMatches(membro, "123.456", "", "")).toBe(true);
  });

  it("combina equipe e ano", () => {
    expect(fullTeamMemberMatches(membro, "", "Campinas", "2026")).toBe(true);
    expect(fullTeamMemberMatches(membro, "", "Sorocaba", "2026")).toBe(false);
    expect(fullTeamMemberMatches(membro, "", "Campinas", "2025")).toBe(false);
  });
});

describe("cadastro direto Full", () => {
  it("exige CPF e celular completos antes da configuração", () => {
    expect(
      cadastroDiretoIdentidadeSchema.safeParse({
        nome: "Beatriz Assoni",
        email: "beatriz@example.com",
        cpf: "123.456.789-00",
        celular: "(11) 99999-0000",
      }).success,
    ).toBe(true);
    expect(
      cadastroDiretoIdentidadeSchema.safeParse({
        nome: "Beatriz Assoni",
        email: "beatriz@example.com",
        cpf: "123",
        celular: "1199",
      }).success,
    ).toBe(false);
  });
});
