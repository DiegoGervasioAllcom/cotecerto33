import { describe, expect, it } from "vitest";
import {
  erroTelefoneFixo,
  mascararDdd,
  mascararTelefoneFixo,
  telefoneFixoPayload,
} from "@/lib/telefone-fixo";

describe("máscaras do telefone fixo", () => {
  it("formata 8 dígitos como 0000-0000 e ignora o que passa disso", () => {
    expect(mascararTelefoneFixo("3333")).toBe("3333");
    expect(mascararTelefoneFixo("33334444")).toBe("3333-4444");
    expect(mascararTelefoneFixo("333344445555")).toBe("3333-4444");
    expect(mascararTelefoneFixo("(33) 3344-44")).toBe("3333-4444");
  });
  it("o DDD guarda só 2 dígitos", () => {
    expect(mascararDdd("(11)")).toBe("11");
    expect(mascararDdd("011")).toBe("01");
  });
});

describe("erroTelefoneFixo", () => {
  it("os dois vazios são válidos (opcional)", () => {
    expect(erroTelefoneFixo("", "", "residencial")).toBeNull();
    expect(erroTelefoneFixo(undefined, undefined, "comercial")).toBeNull();
  });
  it("aceita DDD + fixo de 8 dígitos (2 a 5), formatado ou não", () => {
    expect(erroTelefoneFixo("11", "3333-4444", "residencial")).toBeNull();
    expect(erroTelefoneFixo("21", "22223333", "comercial")).toBeNull();
    expect(erroTelefoneFixo("11", "55556666", "comercial")).toBeNull();
  });
  it("recusa celular (9 dígitos ou começando em 9) com mensagem que diz isso", () => {
    expect(erroTelefoneFixo("11", "967922075", "residencial")).toMatch(/celular não é aceito/);
    expect(erroTelefoneFixo("11", "9679-2207", "comercial")).toMatch(/celular não é aceito/);
  });
  it("só o DDD ou só o número é erro", () => {
    expect(erroTelefoneFixo("11", "", "residencial")).toMatch(/8 dígitos/);
    expect(erroTelefoneFixo("", "33334444", "residencial")).toMatch(/DDD/);
  });
  it("DDD com tamanho errado e números curtos ou começando em 0/1/6/7/8 são erro", () => {
    expect(erroTelefoneFixo("1", "33334444", "residencial")).toMatch(/DDD/);
    expect(erroTelefoneFixo("11", "3333444", "residencial")).toMatch(/8 dígitos/);
    for (const inicio of ["0", "1", "6", "7", "8"]) {
      expect(erroTelefoneFixo("11", `${inicio}3334444`, "residencial")).not.toBeNull();
    }
  });
  it("a mensagem nunca repete o número digitado", () => {
    const msg = erroTelefoneFixo("11", "967922075", "residencial") ?? "";
    expect(msg).not.toContain("967922075");
    expect(msg).not.toContain("9679");
  });
});

describe("entrada que não é texto (cast de tipo no servidor)", () => {
  it("não lança: valor que não é string conta como vazio", () => {
    expect(
      erroTelefoneFixo(11 as unknown as string, 33334444 as unknown as string, "residencial"),
    ).toBeNull();
    expect(erroTelefoneFixo(null as unknown as string, undefined, "comercial")).toBeNull();
    expect(telefoneFixoPayload({} as unknown as string, [] as unknown as string)).toBeUndefined();
  });
});

describe("telefoneFixoPayload", () => {
  it("devolve só os dígitos quando válido e preenchido", () => {
    expect(telefoneFixoPayload("(11)", "3333-4444")).toEqual({ ddd: "11", numero: "33334444" });
  });
  it("vazio ou inválido não vai no payload", () => {
    expect(telefoneFixoPayload("", "")).toBeUndefined();
    expect(telefoneFixoPayload(undefined, undefined)).toBeUndefined();
    expect(telefoneFixoPayload("11", "967922075")).toBeUndefined();
    expect(telefoneFixoPayload("11", "")).toBeUndefined();
  });
});
