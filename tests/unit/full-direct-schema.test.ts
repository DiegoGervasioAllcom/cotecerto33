import { describe, expect, it } from "vitest";
import {
  cadastroDiretoFullSchema,
  cadastroDiretoIdentidadeSchema,
} from "../../src/components/operacao/acessos/full/full-direct-schema";

describe("cadastro direto da Franquia Full — 1 tela, igual ao protótipo", () => {
  it("valida nome, CPF, celular, e-mail e equipe", () => {
    const base = {
      nome: "Vendedora Teste",
      email: "vendedora@teste.local",
      cpf: "123.456.789-01",
      celular: "(11) 99999-0000",
      equipe: "Novas Vendas",
    };
    expect(cadastroDiretoFullSchema.safeParse(base).success).toBe(true);
    expect(cadastroDiretoFullSchema.safeParse({ ...base, email: "invalido" }).success).toBe(false);
    expect(cadastroDiretoFullSchema.safeParse({ ...base, equipe: "Outra" }).success).toBe(false);
  });

  it("rejeita CPF e celular sem máscara completa", () => {
    expect(
      cadastroDiretoIdentidadeSchema.safeParse({
        nome: "Vendedora Teste",
        email: "vendedora@teste.local",
        cpf: "123",
        celular: "999",
      }).success,
    ).toBe(false);
  });
});
