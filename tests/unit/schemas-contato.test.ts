import { describe, it, expect } from "vitest";
import { contatoMatrizSchema } from "@/lib/schemas/contato.schema";

const valido = {
  nome: "Fulano de Tal",
  email: "fulano@email.com",
  tema: "Comercial" as const,
  mensagem: "Quero saber mais sobre a franquia.",
};

describe("contatoMatrizSchema", () => {
  it("aceita dados válidos", () => {
    expect(contatoMatrizSchema.safeParse(valido).success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(contatoMatrizSchema.safeParse({ ...valido, nome: "" }).success).toBe(false);
  });

  it("rejeita email inválido", () => {
    expect(contatoMatrizSchema.safeParse({ ...valido, email: "invalido" }).success).toBe(false);
  });

  it("rejeita tema fora da lista, com mensagem amigável", () => {
    const r = contatoMatrizSchema.safeParse({ ...valido, tema: "xxx" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Selecione um tema.");
  });

  it("rejeita mensagem vazia", () => {
    expect(contatoMatrizSchema.safeParse({ ...valido, mensagem: "" }).success).toBe(false);
  });

  it("rejeita mensagem maior que 2000 caracteres", () => {
    expect(contatoMatrizSchema.safeParse({ ...valido, mensagem: "a".repeat(2001) }).success).toBe(
      false,
    );
  });
});
