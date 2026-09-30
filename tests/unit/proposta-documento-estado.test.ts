import { describe, expect, it } from "vitest";
import { estadoDocumentoProposta, podeTentarDeNovo } from "@/lib/proposta-documento-estado";

const agora = Date.parse("2026-09-30T12:00:00Z");
const minAtras = (m: number) => new Date(agora - m * 60_000).toISOString();

describe("estadoDocumentoProposta", () => {
  it("ok e falhou são terminais", () => {
    expect(estadoDocumentoProposta({ status: "ok", tentado_em: minAtras(99) }, null, agora)).toBe(
      "ok",
    );
    expect(
      estadoDocumentoProposta({ status: "falhou", tentado_em: minAtras(1) }, null, agora),
    ).toBe("indisponivel");
  });
  it("sem linha: conta desde a transmissão", () => {
    expect(estadoDocumentoProposta(null, minAtras(3), agora)).toBe("preparando");
    expect(estadoDocumentoProposta(null, minAtras(10), agora)).toBe("indisponivel");
    expect(estadoDocumentoProposta(null, null, agora)).toBe("preparando");
  });
  it("pendente: conta desde a última tentativa", () => {
    expect(
      estadoDocumentoProposta({ status: "pendente", tentado_em: minAtras(9) }, minAtras(60), agora),
    ).toBe("preparando");
    expect(
      estadoDocumentoProposta({ status: "pendente", tentado_em: minAtras(11) }, minAtras(1), agora),
    ).toBe("indisponivel");
  });
});

describe("podeTentarDeNovo", () => {
  it("dono e Matriz sim; demais não", () => {
    expect(podeTentarDeNovo("u1", "vendedor", "u1")).toBe(true);
    expect(podeTentarDeNovo("u2", "matriz", "u1")).toBe(true);
    expect(podeTentarDeNovo("u2", "master", "u1")).toBe(false);
    expect(podeTentarDeNovo(null, "matriz", "u1")).toBe(false);
    expect(podeTentarDeNovo("u2", "vendedor", null)).toBe(false);
  });
});
