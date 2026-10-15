import { describe, expect, it } from "vitest";
import {
  MOTIVO_SIMULACAO,
  RECURSO_SIMULACAO,
  campoSimulacao,
  montarMensagemSimulacao,
  roboSuportaSimulacao,
} from "@/lib/transmissao-simulacao";

describe("campoSimulacao", () => {
  it("só o valor exato '1' liga a simulação", () => {
    expect(campoSimulacao("1")).toEqual({ simulacao: true });
    expect(campoSimulacao(" 1 ")).toEqual({ simulacao: true });
  });
  it.each([undefined, "", "0", "true", "yes", "11", "false"])(
    "valor %j deixa o payload como era",
    (v) => {
      expect(campoSimulacao(v as string | undefined)).toEqual({});
    },
  );
});

describe("montarMensagemSimulacao", () => {
  const base = {
    motivo: MOTIVO_SIMULACAO,
    mensagem: "Simulação: o formulário foi preenchido e nada foi enviado.",
    relatorio: {
      seguradora: "porto",
      produto: "Itaú Auto Compacto",
      formaPagamento: "Débito em Conta",
      franquia: "Sem Franquia",
      camposInformados: ["rg", "email", "cepResidencial"],
      comContaDebito: true,
      comCartao: false,
    },
  };

  it("devolve null quando não é simulação", () => {
    expect(montarMensagemSimulacao({ motivo: "RECUSADA_PELO_PORTAL", mensagem: "x" })).toBeNull();
    expect(montarMensagemSimulacao({ transmitido: true })).toBeNull();
  });

  it("monta o relatório com rótulos, nomes de campos e dados sensíveis só como rótulo", () => {
    const t = montarMensagemSimulacao(base) as string;
    expect(t).toContain("Forma de pagamento: Débito em Conta");
    expect(t).toContain("Franquia: Sem Franquia");
    expect(t).toContain("Campos preenchidos: rg, email, cepResidencial");
    expect(t).toContain("conta de débito");
    expect(t).not.toContain("cartão");
  });

  it("ignora chaves fora da lista e nomes de campo inválidos", () => {
    const t = montarMensagemSimulacao({
      ...base,
      relatorio: {
        ...base.relatorio,
        cpf: "52998224725",
        camposInformados: ["rg", "valor com espaço", "cpf=123", 7],
      },
    }) as string;
    expect(t).not.toContain("52998224725");
    expect(t).toContain("Campos preenchidos: rg ·");
    expect(t).not.toContain("espaço");
    expect(t).not.toContain("cpf=");
  });

  it("oculta sequências longas de dígitos mesmo que venham em campos permitidos", () => {
    const t = montarMensagemSimulacao({
      ...base,
      relatorio: { ...base.relatorio, produto: "Produto 4111111111111111" },
    }) as string;
    expect(t).not.toContain("4111111111111111");
  });

  it("trunca textos longos", () => {
    const t = montarMensagemSimulacao({
      ...base,
      relatorio: { ...base.relatorio, produto: "A".repeat(500) },
    }) as string;
    expect(t.length).toBeLessThan(700);
  });

  it("sem relatório, devolve só a mensagem do robô", () => {
    expect(montarMensagemSimulacao({ motivo: MOTIVO_SIMULACAO, mensagem: "Simulação ok." })).toBe(
      "Simulação ok.",
    );
  });
});

describe("roboSuportaSimulacao", () => {
  it("só confirma quando o /health anuncia o recurso", () => {
    expect(roboSuportaSimulacao({ status: "ok", recursos: [RECURSO_SIMULACAO] })).toBe(true);
    expect(roboSuportaSimulacao({ recursos: ["outro", RECURSO_SIMULACAO] })).toBe(true);
  });

  it.each([
    ["robô antigo (sem recursos)", { status: "ok", uptime: 12 }],
    ["recursos sem o recurso", { recursos: ["outro"] }],
    ["recursos não é lista", { recursos: RECURSO_SIMULACAO }],
    ["null", null],
    ["texto", "ok"],
    ["undefined", undefined],
  ])("NÃO confirma: %s", (_nome, corpo) => {
    expect(roboSuportaSimulacao(corpo)).toBe(false);
  });
});
