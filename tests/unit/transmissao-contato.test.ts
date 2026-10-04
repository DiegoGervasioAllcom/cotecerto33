import { describe, expect, it } from "vitest";
import { resolverContatoTransmissao } from "@/lib/transmissao-contato";

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
