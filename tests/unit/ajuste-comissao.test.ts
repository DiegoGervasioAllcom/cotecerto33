import { describe, expect, it } from "vitest";
import { comissaoEditavel } from "@/lib/seguradora-canonica";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";
import {
  ajusteSeguradoraSchema,
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
    for (const v of ["19.99", "25.01", "abc", "22,555"]) {
      const r = ajusteSeguradoraSchema.safeParse({ ...base, vidros: "Básico", comissao: v });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toBe("Comissão entre 20% e 25%.");
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
    for (const aj of [null, { comissao_pct: null }, { comissao_pct: 19 }, { comissao_pct: 26 }]) {
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
