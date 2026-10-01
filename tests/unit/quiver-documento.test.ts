import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  credenciaisConferem,
  mensagemErroRecaptura,
  parsePayloadDocumento,
  safeEqual,
  storagePathProposta,
  validarPdf,
} from "@/lib/quiver-documento";

const COT = "11111111-1111-4111-8111-111111111111";

function pdf(tamanho = 2048, cabecalho = "%PDF-1.7\n") {
  const b = Buffer.alloc(tamanho, 0x61);
  b.write(cabecalho, 0, "latin1");
  return b;
}
function payload(b: Buffer, over: Record<string, unknown> = {}) {
  return {
    cotacaoId: COT,
    tipo: "proposta_pdf",
    nome: "proposta.pdf",
    sha256: createHash("sha256").update(b).digest("hex"),
    tamanho: b.length,
    pdfBase64: b.toString("base64"),
    ...over,
  };
}

describe("parsePayloadDocumento", () => {
  it("aceita pdf e erro; rejeita texto livre, campos extras e uuid ruim", () => {
    expect(parsePayloadDocumento(payload(pdf())).ok).toBe(true);
    const e = parsePayloadDocumento({ cotacaoId: COT, erro: "timeout" });
    expect(e.ok && e.payload.kind).toBe("erro");
    expect(parsePayloadDocumento({ cotacaoId: COT, erro: "deu ruim no cliente João" }).ok).toBe(
      false,
    );
    expect(parsePayloadDocumento({ cotacaoId: COT, erro: "timeout", x: 1 }).ok).toBe(false);
    expect(parsePayloadDocumento(payload(pdf(), { cotacaoId: "abc" })).ok).toBe(false);
    expect(parsePayloadDocumento(payload(pdf(), { tipo: "outro" })).ok).toBe(false);
    expect(parsePayloadDocumento(payload(pdf(), { tamanho: 10 })).ok).toBe(false);
    expect(parsePayloadDocumento(payload(pdf(), { sha256: "zz" })).ok).toBe(false);
  });
});

describe("validarPdf", () => {
  it("aceita PDF íntegro (sha em maiúsculas também)", () => {
    const b = pdf();
    const p = parsePayloadDocumento(
      payload(b, { sha256: createHash("sha256").update(b).digest("hex").toUpperCase() }),
    );
    if (!p.ok || p.payload.kind !== "pdf") throw new Error("payload");
    expect(validarPdf(p.payload.data).ok).toBe(true);
  });
  it("recusa base64 inválido", () => {
    const b = pdf();
    expect(validarPdf({ ...payload(b), pdfBase64: "não é base64!!" } as never)).toEqual({
      ok: false,
      codigo: "base64_invalido",
    });
  });
  it("recusa sem magic bytes", () => {
    const b = pdf(2048, "<html>xx");
    expect(validarPdf(payload(b) as never)).toEqual({ ok: false, codigo: "nao_e_pdf" });
  });
  it("recusa tamanho declarado diferente e fora da faixa", () => {
    const b = pdf();
    expect(validarPdf(payload(b, { tamanho: b.length + 1 }) as never)).toEqual({
      ok: false,
      codigo: "tamanho_invalido",
    });
    const pequeno = pdf(512);
    expect(validarPdf(payload(pequeno) as never)).toEqual({
      ok: false,
      codigo: "tamanho_invalido",
    });
    const grande = pdf(10 * 1024 * 1024 + 1);
    expect(validarPdf(payload(grande) as never)).toEqual({ ok: false, codigo: "tamanho_invalido" });
  });
  it("aceita exatamente 1 KB e 10 MB", () => {
    expect(validarPdf(payload(pdf(1024)) as never).ok).toBe(true);
    expect(validarPdf(payload(pdf(10 * 1024 * 1024)) as never).ok).toBe(true);
  });
  it("recusa sha256 divergente", () => {
    const b = pdf();
    expect(validarPdf(payload(b, { sha256: "0".repeat(64) }) as never)).toEqual({
      ok: false,
      codigo: "sha256_divergente",
    });
  });
});

describe("credenciais", () => {
  const exp = { key: "k", secret: "s" };
  it("confere só com os dois corretos", () => {
    expect(credenciaisConferem({ key: "k", secret: "s" }, exp)).toBe(true);
    expect(credenciaisConferem({ key: "k", secret: "x" }, exp)).toBe(false);
    expect(credenciaisConferem({ key: "x", secret: "s" }, exp)).toBe(false);
    expect(credenciaisConferem({ key: null, secret: null }, exp)).toBe(false);
    expect(credenciaisConferem({ key: "", secret: "" }, { key: "", secret: "" })).toBe(true);
  });
  it("safeEqual lida com tamanhos diferentes", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
  });
});

describe("mapeamento e caminho", () => {
  it("mapeia hints e 42501 sem vazar detalhes", () => {
    expect(mensagemErroRecaptura({ hint: "muito_cedo" })).toMatch(/5 minutos/);
    expect(mensagemErroRecaptura({ hint: "nao_transmitida" })).toMatch(/não foi transmitida/);
    expect(mensagemErroRecaptura({ hint: "ja_capturado" })).toMatch(/já está disponível/);
    expect(mensagemErroRecaptura({ hint: "sem_transmissao" })).toMatch(/transmissão/);
    expect(mensagemErroRecaptura({ code: "42501" })).toMatch(/permissão/);
    expect(mensagemErroRecaptura({ code: "XX000", hint: "sql secreto" })).toMatch(
      /Não foi possível/,
    );
    expect(mensagemErroRecaptura(null)).toMatch(/Não foi possível/);
  });
  it("caminho do Storage", () => {
    expect(storagePathProposta("e", "p")).toBe("e/p/proposta.pdf");
  });
});
