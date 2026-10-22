import { describe, expect, test } from "vitest";
import { credenciaisConferem, requestAutenticado, safeEqual } from "@/lib/webhook-auth";

const exp = { key: "chave-ok", secret: "segredo-ok" };
const req = (h: Record<string, string>) => new Request("http://x/", { method: "POST", headers: h });

describe("safeEqual", () => {
  test("iguais e diferentes, inclusive de tamanhos distintos", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("credenciaisConferem", () => {
  test("exige key e secret corretos", () => {
    expect(credenciaisConferem({ key: "chave-ok", secret: "segredo-ok" }, exp)).toBe(true);
    expect(credenciaisConferem({ key: "chave-ok", secret: "x" }, exp)).toBe(false);
    expect(credenciaisConferem({ key: "x", secret: "segredo-ok" }, exp)).toBe(false);
  });
  test("header ausente nunca autentica, nem com credencial esperada vazia", () => {
    expect(credenciaisConferem({ key: null, secret: null }, exp)).toBe(false);
    expect(credenciaisConferem({ key: null, secret: null }, { key: "", secret: "" })).toBe(false);
  });
});

describe("requestAutenticado", () => {
  test("lê x-client-key e x-client-secret do request", () => {
    expect(
      requestAutenticado(req({ "x-client-key": "chave-ok", "x-client-secret": "segredo-ok" }), exp),
    ).toBe(true);
    expect(requestAutenticado(req({ "x-client-key": "chave-ok" }), exp)).toBe(false);
    expect(requestAutenticado(req({}), exp)).toBe(false);
  });
});
