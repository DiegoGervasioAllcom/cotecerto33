import { describe, it, expect } from "vitest";
import { seguradoraSchema, modeloFranquiaNomeSchema } from "@/lib/schemas/catalogos.schema";

describe("seguradoraSchema", () => {
  it("aceita nome válido e código vazio", () => {
    expect(seguradoraSchema.safeParse({ nome: "Porto Seguro", codigo: "" }).success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(seguradoraSchema.safeParse({ nome: "", codigo: "" }).success).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(seguradoraSchema.safeParse({ nome: "a".repeat(151), codigo: "" }).success).toBe(false);
  });

  it("rejeita código maior que 30", () => {
    expect(
      seguradoraSchema.safeParse({ nome: "Porto Seguro", codigo: "a".repeat(31) }).success,
    ).toBe(false);
  });

  it("aceita código vazio (opcional)", () => {
    expect(seguradoraSchema.safeParse({ nome: "Porto Seguro" }).success).toBe(true);
  });
});

describe("modeloFranquiaNomeSchema", () => {
  it("rejeita nome vazio", () => {
    expect(modeloFranquiaNomeSchema.safeParse("").success).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(modeloFranquiaNomeSchema.safeParse("a".repeat(151)).success).toBe(false);
  });

  it("aceita nome válido", () => {
    expect(modeloFranquiaNomeSchema.safeParse("Franquia Premium").success).toBe(true);
  });
});
