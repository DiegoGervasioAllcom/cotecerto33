import { describe, expect, it } from "vitest";
import { comissaoEditavel } from "@/lib/seguradora-canonica";
import {
  ajusteSemComissaoNaoAprovada,
  montarPayloadQuiver,
  type CotacaoRow,
} from "@/lib/quiver.functions";
import {
  ajusteSeguradoraSchema,
  COMISSAO_AGRAVO_MIN,
  COMISSAO_MAX,
  COMISSAO_MIN,
  COMISSAO_SEM_APROVACAO_MIN,
  comissaoEhAgravo,
  comissaoExigeAprovacao,
  resumoAjuste,
} from "@/components/venda/novo-lead/ajusteSeguradora.schema";

const base = { franquia1: null, franquia2: null, vidros: null, carroReserva: null };

describe("schema do ajuste: comissão", () => {
  it("aceita 22,5 com vírgula e ponto", () => {
    expect(ajusteSeguradoraSchema.parse({ ...base, comissao: "22,5" }).comissao).toBe(22.5);
    expect(ajusteSeguradoraSchema.parse({ ...base, comissao: "22.5" }).comissao).toBe(22.5);
    expect(ajusteSeguradoraSchema.parse({ ...base, comissao: 20 }).comissao).toBe(20);
  });
  it("só comissão conta como ajuste; vazia sem outro campo falha", () => {
    expect(ajusteSeguradoraSchema.safeParse({ ...base, comissao: "25" }).success).toBe(true);
    expect(ajusteSeguradoraSchema.safeParse({ ...base, comissao: "" }).success).toBe(false);
    const r = ajusteSeguradoraSchema.parse({ ...base, vidros: "Básico", comissao: "" });
    expect(r.comissao).toBeNull();
  });
  it("rejeita fora da faixa e mais de 2 casas", () => {
    for (const v of ["9.99", "30.01", "abc", "22,555"]) {
      const r = ajusteSeguradoraSchema.safeParse({ ...base, vidros: "Básico", comissao: v });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toBe("Comissão entre 10% e 30%.");
    }
  });
  it("resumo inclui comissão", () => {
    expect(resumoAjuste({ comissao: 22.5 })).toBe("comissão 22,5%");
  });
});

describe("payload Quiver: comissaoPercentual", () => {
  const cot: CotacaoRow = {
    id: "c1",
    segurado: {},
    seguro: { seguradoras_sel: ["Porto"] },
    veiculo: {},
    perfil: {},
    coberturas: { franquia_primeira_opcao: "Normal 100%" },
  };
  it("presente quando válida", () => {
    const { cobertura } = montarPayloadQuiver(cot, { comissao_pct: 22.5 });
    expect(cobertura).toMatchObject({ comissaoPercentual: 22.5 });
  });
  it("ausente sem ajuste, nula ou fora da faixa", () => {
    for (const aj of [null, { comissao_pct: null }, { comissao_pct: 9 }, { comissao_pct: 31 }]) {
      const { cobertura } = montarPayloadQuiver(cot, aj);
      expect(cobertura).not.toHaveProperty("comissaoPercentual");
    }
  });
});

describe("comissaoEditavel", () => {
  it("só as seguradoras cujo campo o portal deixa editar", () => {
    for (const n of ["Aliro", "Allianz", "Bradesco", "HDI", "Mapfre", "Suhai", "Tokio", "Yelum"]) {
      expect(comissaoEditavel(n), n).toBe(true);
    }
    for (const n of ["Porto", "Porto Seguro", "Azul", "Itaú", "MSIG", "Desconhecida"]) {
      expect(comissaoEditavel(n), n).toBe(false);
    }
  });
});

describe("limites da comissão (10 a 30)", () => {
  it("constantes", () => {
    expect([COMISSAO_MIN, COMISSAO_SEM_APROVACAO_MIN, COMISSAO_AGRAVO_MIN, COMISSAO_MAX]).toEqual([
      10, 20, 25, 30,
    ]);
  });
  it("aceita 10 e 30; rejeita 9,99 e 30,01", () => {
    for (const v of ["10", "30", "15,5"])
      expect(ajusteSeguradoraSchema.safeParse({ ...base, comissao: v }).success).toBe(true);
    for (const v of ["9,99", "30,01"])
      expect(ajusteSeguradoraSchema.safeParse({ ...base, comissao: v }).success).toBe(false);
  });
  it("rótulos: <20 requer aprovação; 25<x<=30 agravo", () => {
    expect(comissaoExigeAprovacao(19.99)).toBe(true);
    expect(comissaoExigeAprovacao(20)).toBe(false);
    expect(comissaoEhAgravo(25)).toBe(false);
    expect(comissaoEhAgravo(25.01)).toBe(true);
    expect(comissaoEhAgravo(30)).toBe(true);
    expect(comissaoEhAgravo(31)).toBe(false);
  });
});

describe("quiver.functions: comissão <20 só com solicitação aprovada para o valor", () => {
  it("sem aprovação descarta; com aprovação do mesmo valor mantém", () => {
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: 15 }, []).comissao_pct).toBeNull();
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: 15 }, [12]).comissao_pct).toBeNull();
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: 15 }, [12, 15]).comissao_pct).toBe(15);
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: "15.00" }, [15]).comissao_pct).toBe(
      "15.00",
    );
  });
  it(">=20 e nulo passam sem aprovação", () => {
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: 20 }, []).comissao_pct).toBe(20);
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: 28 }, []).comissao_pct).toBe(28);
    expect(ajusteSemComissaoNaoAprovada({ comissao_pct: null }, []).comissao_pct).toBeNull();
  });
  it("payload aceita 10 e 30", () => {
    const cot: CotacaoRow = {
      id: "c1",
      segurado: {},
      seguro: { seguradoras_sel: ["Porto"] },
      veiculo: {},
      perfil: {},
      coberturas: {},
    };
    expect(montarPayloadQuiver(cot, { comissao_pct: 10 }).cobertura).toMatchObject({
      comissaoPercentual: 10,
    });
    expect(montarPayloadQuiver(cot, { comissao_pct: 30 }).cobertura).toMatchObject({
      comissaoPercentual: 30,
    });
  });
});
