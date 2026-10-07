import { describe, expect, it } from "vitest";
import {
  montarComplementosPayload,
  resolverComplementoTransmissao,
  resolverContatoTransmissao,
} from "@/lib/transmissao-contato";

describe("resolverContatoTransmissao", () => {
  it("usa o digitado e marca gravação quando difere do cadastro", () => {
    const r = resolverContatoTransmissao(
      { email: "novo@x.com", numero: "10" },
      { email: "velho@x.com", numero: "5" },
    );
    expect(r).toEqual({
      ok: true,
      contato: { email: "novo@x.com", numero: "10", gravarEmail: true, gravarNumero: true },
    });
  });
  it("cai no cadastro quando nada foi digitado e não regrava", () => {
    const r = resolverContatoTransmissao({}, { email: "a@b.com", numero: "7" });
    expect(r).toEqual({
      ok: true,
      contato: { email: "a@b.com", numero: "7", gravarEmail: false, gravarNumero: false },
    });
  });
  it("erro quando falta e-mail", () => {
    const r = resolverContatoTransmissao({ numero: "1" }, {});
    expect(r.ok).toBe(false);
  });
  it("erro quando falta número", () => {
    const r = resolverContatoTransmissao({ email: "a@b.com" }, { numero: " " });
    expect(r.ok).toBe(false);
  });
  it("erro quando e-mail inválido", () => {
    const r = resolverContatoTransmissao({ email: "xx", numero: "1" }, {});
    expect(r).toEqual({ ok: false, erro: "E-mail do segurado inválido." });
  });
});

describe("complemento do endereço na transmissão", () => {
  it("número com 11 caracteres é recusado", () => {
    const r = resolverContatoTransmissao({ email: "a@b.com", numero: "12345678901" }, {});
    expect(r.ok).toBe(false);
  });
  it("usa o digitado, cai no cadastro e omite vazio", () => {
    expect(resolverComplementoTransmissao("AP 1", "X")).toEqual({
      ok: true,
      complemento: "AP 1",
      gravar: true,
    });
    expect(resolverComplementoTransmissao("", "BL F")).toEqual({
      ok: true,
      complemento: "BL F",
      gravar: false,
    });
    expect(resolverComplementoTransmissao(" ", null)).toEqual({
      ok: true,
      complemento: undefined,
      gravar: false,
    });
    expect(resolverComplementoTransmissao("x".repeat(31), null).ok).toBe(false);
  });
  it("payload: correspondência só quando difere; vazios omitidos", () => {
    expect(montarComplementosPayload("AP 1", true, { complemento: "C" })).toEqual({
      complementoEndereco: "AP 1",
    });
    expect(montarComplementosPayload("AP 1", false, { complemento: "C" })).toEqual({
      complementoEndereco: "AP 1",
      complementoCorrespondencia: "C",
    });
    expect(montarComplementosPayload(undefined, false, { complemento: " " })).toEqual({});
  });
});

describe("montarComplementosPayload — limites no servidor", () => {
  it("recusa complemento residencial com mais de 30 caracteres", () => {
    expect(() => montarComplementosPayload("x".repeat(31), true, undefined)).toThrow(/máx\. 30/);
  });
  it("recusa complemento e número da correspondência acima do limite (só quando é outro endereço)", () => {
    const base = {
      cep: "01001000",
      logradouro: "Rua A",
      numero: "1",
      bairro: "B",
      cidade: "C",
      uf: "SP",
    };
    expect(() =>
      montarComplementosPayload(undefined, false, { ...base, complemento: "x".repeat(31) }),
    ).toThrow(/máx\. 30/);
    expect(() =>
      montarComplementosPayload(undefined, false, { ...base, numero: "12345678901" }),
    ).toThrow(/máx\. 10/);
    // endereço de correspondência igual ao residencial: não valida nem envia
    expect(
      montarComplementosPayload(undefined, true, {
        ...base,
        numero: "12345678901",
        complemento: "x".repeat(40),
      }),
    ).toEqual({});
  });
});
