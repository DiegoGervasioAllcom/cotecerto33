import { describe, expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import {
  marcarAjustesAposEnvio,
  montarPayloadQuiver,
  type CotacaoRow,
} from "@/lib/quiver.functions";
import {
  ajusteSeguradoraSchema,
  resumoAjuste,
} from "@/components/venda/novo-lead/ajusteSeguradora.schema";

const cot: CotacaoRow = {
  id: "c1",
  segurado: {},
  seguro: { seguradoras_sel: ["Porto"] },
  veiculo: {},
  perfil: {},
  coberturas: {
    franquia_primeira_opcao: "Normal 100%",
    franquia_segunda_opcao: "Reduzida 50%",
    vidros: "Básico",
    carro_reserva: "Básico",
    assist_24: "Superior",
  },
};

describe("montarPayloadQuiver com ajuste por seguradora (V12.3.7)", () => {
  it("sem ajuste, mantém as coberturas globais", () => {
    const { cobertura } = montarPayloadQuiver(cot);
    expect(cobertura).toMatchObject({
      franquiaPrimeiraOpcao: "Normal 100%",
      franquiaSegundaOpcao: "Reduzida 50%",
      vidrosFarosRetrovisores: "Básico",
      carroReserva: "Básico",
    });
  });

  it("sobrepõe só os campos do ajuste e não altera o resto do payload", () => {
    const base = montarPayloadQuiver(cot);
    const p = montarPayloadQuiver(cot, {
      franquia_primeira_opcao: "Reduzida 25%",
      vidros: "Superior",
    });
    expect(p.cobertura).toMatchObject({
      franquiaPrimeiraOpcao: "Reduzida 25%",
      franquiaSegundaOpcao: "Reduzida 50%",
      vidrosFarosRetrovisores: "Superior",
      carroReserva: "Básico",
      assistencia24h: "Superior",
    });
    expect({ ...p, cobertura: null }).toEqual({ ...base, cobertura: null });
  });

  it("campos nulos não sobrescrevem e enums inválidos de nível não passam", () => {
    const p = montarPayloadQuiver(cot, {
      franquia_primeira_opcao: null,
      franquia_segunda_opcao: null,
      vidros: "Premium",
      carro_reserva: null,
    });
    expect(p.cobertura).toMatchObject({
      franquiaPrimeiraOpcao: "Normal 100%",
      vidrosFarosRetrovisores: "Básico",
      carroReserva: "Básico",
    });
  });

  it("ajusta o carro reserva e a 2ª franquia", () => {
    const p = montarPayloadQuiver(cot, {
      carro_reserva: "Superior",
      franquia_segunda_opcao: "Não",
    });
    expect(p.cobertura).toMatchObject({ carroReserva: "Superior", franquiaSegundaOpcao: "Não" });
  });
});

describe("ajusteSeguradoraSchema", () => {
  it("vazio vira null e aceita os enums reais", () => {
    const r = ajusteSeguradoraSchema.parse({
      franquia1: "Reduzida 25%",
      franquia2: "",
      vidros: "Superior",
      carroReserva: null,
    });
    expect(r).toEqual({
      franquia1: "Reduzida 25%",
      franquia2: null,
      vidros: "Superior",
      carroReserva: null,
    });
  });

  it("recusa valor fora do enum e ajuste totalmente vazio", () => {
    expect(
      ajusteSeguradoraSchema.safeParse({
        franquia1: "Nenhuma",
        franquia2: null,
        vidros: null,
        carroReserva: null,
      }).success,
    ).toBe(false);
    expect(
      ajusteSeguradoraSchema.safeParse({
        franquia1: "",
        franquia2: "",
        vidros: "",
        carroReserva: "",
      }).success,
    ).toBe(false);
    expect(
      ajusteSeguradoraSchema.safeParse({
        franquia1: null,
        franquia2: "Não",
        vidros: null,
        carroReserva: null,
      }).success,
    ).toBe(true);
  });

  it("resumo lista só o que foi ajustado", () => {
    expect(resumoAjuste({ franquia1: "Reduzida 25%", vidros: "Superior" })).toBe(
      "franquia Reduzida 25%, vidros Superior",
    );
  });
});

const cotGolden: CotacaoRow = {
  id: "cot-golden",
  segurado: {
    cpf_cnpj: "529.982.247-25",
    nome: "Maria Teste",
    celular: "(11) 99999-9999",
    email: "m@t.local",
    cep: "01310-100",
    sexo: "Feminino",
    estado_civil: "Casado",
  },
  seguro: { seguradoras_sel: ["Porto", "Mapfre"], tipo: "novo" },
  veiculo: { placa: "abc1d23", zero_km: false, km_mensal: "1000" },
  perfil: { condutor_mesmo: true, cep_pernoite: "01310-100" },
  coberturas: {
    tipo_cobertura: "Pleno",
    modalidade: "Valor de Mercado",
    percentual_ajuste: "100",
    franquia_primeira_opcao: "Normal 100%",
    franquia_segunda_opcao: "Reduzida 50%",
    rcf_dm: "100000",
    rcf_dc: "50000",
    app_morte: "R$ 10.000,00",
    danos_morais: "R$ 5.000,00",
    despesas_extras: "Sim",
    pequenos_reparos: true,
    vidros: "Básico",
    assist_24: "Intermediário",
    carro_reserva: "Básico",
  },
};

// Golden gerado rodando o `montarPayloadQuiver` de HEAD (antes da V12.3.7).
const goldenSemAjuste = {
  id: "cot-golden",
  segurado: {
    cpf: "52998224725",
    nomeSocial: "Maria Teste",
    telefone: "11999999999",
    email: "m@t.local",
    cep: "01310100",
    nome: "Maria Teste",
    sexo: "Feminino",
    estadoCivil: "Casado",
  },
  seguro: { tipo: "Seguro novo", seguradorasDisponiveis: ["porto", "mapfre"] },
  veiculo: {
    placa: "ABC1D23",
    zeroKm: "Não",
    chassiRemarcado: "Não",
    financiado: "Não",
    antifurto: "Não",
    cepPernoite: "01310100",
    cepCirculacao: "01310100",
    kmMes: "1000",
    tipoUso: "Particular",
    usoTrabalho: "Não trabalha",
    usoEstudo: "Não estuda",
    usoComercialDoisOuMaisDias: "Não",
  },
  complementares: {
    tipoGaragem: "Não",
    relacaoSeguradoProprietario: "Sim",
    principalCondutor: "Sim",
    tipoResidencia: "Casa",
    seguroCorretorProximo: "Não",
    pessoas17a25: "Não",
  },
  cobertura: {
    plano: "Pleno",
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    danosMateriaisTerceiros: "100000",
    danosCorporaisTerceiros: "50000",
    appMortePorPassageiro: "10.000,00",
    danosMorais: "5.000,00",
    despesasExtras: "Sim",
    pequenosReparos: "Contratado",
    vidrosFarosRetrovisores: "Básico",
    assistencia24h: "Intermediário",
    carroReserva: "Básico",
  },
};

describe("payload golden", () => {
  it("sem ajuste é idêntico ao formato anterior à V12.3.7", () => {
    expect(montarPayloadQuiver(cotGolden)).toEqual(goldenSemAjuste);
    expect(montarPayloadQuiver(cotGolden, null)).toEqual(goldenSemAjuste);
  });

  it("com ajuste só mudam os campos de cobertura ajustados", () => {
    expect(
      montarPayloadQuiver(cotGolden, {
        franquia_primeira_opcao: "Majorada 150%",
        carro_reserva: "Superior",
      }),
    ).toEqual({
      ...goldenSemAjuste,
      cobertura: {
        ...goldenSemAjuste.cobertura,
        franquiaPrimeiraOpcao: "Majorada 150%",
        carroReserva: "Superior",
      },
    });
  });
});

describe("marcarAjustesAposEnvio", () => {
  afterEach(() => vi.restoreAllMocks());

  it("erro da RPC não propaga (envio já feito) e só loga", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    await expect(marcarAjustesAposEnvio({ rpc }, "c1", "Porto", true)).resolves.toBe(false);
    expect(log).toHaveBeenCalled();
  });

  it("exceção da RPC também não propaga", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValue(new Error("rede"));
    await expect(marcarAjustesAposEnvio({ rpc }, "c1", undefined, false)).resolves.toBe(false);
  });

  it("escolhe a RPC certa por caminho", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await marcarAjustesAposEnvio({ rpc }, "c1", "Porto", true);
    expect(rpc).toHaveBeenLastCalledWith("marcar_ajuste_aplicado", {
      p_cotacao_id: "c1",
      p_seguradora: "Porto",
    });
    await marcarAjustesAposEnvio({ rpc }, "c1", undefined, false);
    expect(rpc).toHaveBeenLastCalledWith("marcar_ajustes_nao_aplicados", { p_cotacao_id: "c1" });
    rpc.mockClear();
    await marcarAjustesAposEnvio({ rpc }, "c1", "Porto", false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
