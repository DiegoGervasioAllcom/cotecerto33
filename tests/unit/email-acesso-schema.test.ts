import { describe, expect, test } from "vitest";
import { pendenciaAcessoSchema, recusaAcessoSchema } from "@/lib/schemas/email-acesso.schema";

describe("limites dos motivos de acesso", () => {
  test("pendência aceita de 3 a 1000 caracteres após trim", () => {
    expect(pendenciaAcessoSchema.safeParse("  abc  ").data).toBe("abc");
    expect(pendenciaAcessoSchema.safeParse("ab").success).toBe(false);
    expect(pendenciaAcessoSchema.safeParse("x".repeat(1000)).success).toBe(true);
    expect(pendenciaAcessoSchema.safeParse("x".repeat(1001)).success).toBe(false);
  });

  test("recusa aceita de 3 a 2000 caracteres após trim", () => {
    expect(recusaAcessoSchema.safeParse("abc").success).toBe(true);
    expect(recusaAcessoSchema.safeParse("ab").success).toBe(false);
    expect(recusaAcessoSchema.safeParse("x".repeat(2000)).success).toBe(true);
    expect(recusaAcessoSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });

  test("recusa aceita texto que excede o limite específico da pendência", () => {
    const motivo = "x".repeat(1500);
    expect(pendenciaAcessoSchema.safeParse(motivo).success).toBe(false);
    expect(recusaAcessoSchema.safeParse(motivo).success).toBe(true);
  });
});
