import { describe, expect, test } from "vitest";
import { criarSenhaSchema } from "@/lib/schemas/criar-senha.schema";

describe("criação da senha pelo link de boas-vindas", () => {
  test("aceita senha entre 8 e 72 caracteres com letra e número", () => {
    expect(
      criarSenhaSchema.safeParse({ senha: "Supper123", confirmarSenha: "Supper123" }).success,
    ).toBe(true);
    const limite = `${"a".repeat(71)}1`;
    expect(criarSenhaSchema.safeParse({ senha: limite, confirmarSenha: limite }).success).toBe(
      true,
    );
  });

  test.each([
    ["curta", "Abc1234"],
    ["longa", `${"a".repeat(72)}1`],
    ["sem letra", "12345678"],
    ["sem número", "abcdefgh"],
  ])("rejeita senha %s", (_regra, senha) => {
    expect(criarSenhaSchema.safeParse({ senha, confirmarSenha: senha }).success).toBe(false);
  });

  test("rejeita confirmação diferente", () => {
    const result = criarSenhaSchema.safeParse({
      senha: "Supper123",
      confirmarSenha: "Supper124",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["confirmarSenha"]);
  });
});
