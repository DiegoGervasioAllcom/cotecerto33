import { describe, expect, it } from "vitest";
import { estadoCalculoMobile } from "@/lib/cotacao-estado-mobile";
import { calcularProgresso } from "@/lib/calculo-progresso";
import { montarMensagemWhatsappComResumo, linkWhatsapp } from "@/lib/cotacao-envio";
import type { DocDados } from "@/lib/print";

const dados = {
  cotacaoNumero: "COT-1",
  segurado: { nome: "Ana" },
  seguradoras: [
    { id: "1", seguradora: "Porto", precoLabel: "R$ 1.000,00", opcoes: [] },
    { id: "2", seguradora: "Sem preço", precoLabel: null, opcoes: [] },
  ],
} as unknown as DocDados;

describe("estadoCalculoMobile", () => {
  const prog = (etapa: string, seq: number) =>
    calcularProgresso(
      { cotacao_id: "x", etapa, seq, erro: null, iniciado_em: "", atualizado_em: "" },
      "x",
      0,
    );
  it("usa o progresso real", () => {
    expect(estadoCalculoMobile(prog("lendo_resultados", 8), "rascunho", false)).toBe("calculando");
    expect(estadoCalculoMobile(prog("concluido", 9), "rascunho", false)).toBe("pronta");
    expect(estadoCalculoMobile(prog("erro", 3), "rascunho", false)).toBe("erro");
  });
  it("faz fallback por status", () => {
    expect(estadoCalculoMobile(undefined, "rascunho", false)).toBe("aguardando");
    expect(estadoCalculoMobile(undefined, "calculada", true)).toBe("pronta");
    expect(estadoCalculoMobile(undefined, "erro_quiver", false)).toBe("erro");
    // enviada ao robô, sem progresso nem prêmios ainda: aguardando (não "nenhum prêmio")
    expect(estadoCalculoMobile(undefined, "enviada_quiver", false)).toBe("aguardando");
    expect(estadoCalculoMobile(undefined, "enviada_quiver", true)).toBe("pronta");
  });
});

describe("mensagem WhatsApp", () => {
  it("lista prêmios sem comissão e ignora ofertas sem preço", () => {
    const m = montarMensagemWhatsappComResumo(dados);
    expect(m).toContain("Olá, Ana!");
    expect(m).toContain("• Porto: R$ 1.000,00");
    expect(m).not.toContain("Sem preço");
    expect(m.toLowerCase()).not.toContain("comiss");
  });
  it("gera link wa.me", () => {
    expect(linkWhatsapp("(11) 98888-7777", "oi")).toBe("https://wa.me/5511988887777?text=oi");
  });
});
