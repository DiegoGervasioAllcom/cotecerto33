import { describe, expect, it } from "vitest";
import {
  cadastroDiretoFullSchema,
  cadastroDiretoIdentidadeSchema,
} from "../../src/components/operacao/acessos/full/full-direct-schema";

describe("cadastro direto da Franquia Full em duas etapas", () => {
  it("etapa 1 valida nome, CPF, celular e e-mail antes de liberar a configuração", () => {
    expect(
      cadastroDiretoIdentidadeSchema.safeParse({
        nome: "Vendedora Teste",
        email: "vendedora@teste.local",
        cpf: "123.456.789-01",
        celular: "(11) 99999-0000",
      }).success,
    ).toBe(true);
  });

  it("etapa final mantém e-mail e os limites da configuração", () => {
    const base = {
      nome: "Vendedora Teste",
      cpf: "123.456.789-01",
      celular: "(11) 99999-0000",
      email: "vendedora@teste.local",
      leadsDia: 10,
      comissaoVenda: 40,
      comissaoRenovacao: 20,
    };
    expect(cadastroDiretoFullSchema.safeParse(base).success).toBe(true);
    expect(cadastroDiretoFullSchema.safeParse({ ...base, email: "invalido" }).success).toBe(false);
    expect(cadastroDiretoFullSchema.safeParse({ ...base, comissaoVenda: 101 }).success).toBe(false);
  });

  it("etapa 1 rejeita CPF e celular sem máscara completa", () => {
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
