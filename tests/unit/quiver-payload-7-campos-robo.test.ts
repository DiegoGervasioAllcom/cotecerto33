// Cobre os 7 campos novos do robô Quiver (doc/PLANO-INTEGRACAO-7-CAMPOS-ROBO-2026-08.md):
// historicoLeilao, pequenosReparos, vidrosFarosRetrovisores, assistencia24h,
// carroReserva, valorDeterminado (condicional) e jovensCondutores (condicional).
import { describe, expect, it } from "vitest";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";

function cotacao(overrides: Partial<CotacaoRow>): CotacaoRow {
  return {
    id: "cotacao-teste",
    segurado: {},
    seguro: {},
    veiculo: {},
    perfil: {},
    coberturas: {},
    ...overrides,
  };
}

describe("payload Quiver - veiculo.historicoLeilao", () => {
  it("envia o valor de leilao direto (enum 1:1 com o robô)", () => {
    const payload = montarPayloadQuiver(
      cotacao({ veiculo: { leilao: "Leilão de indenização integral" } }),
    );
    expect(payload.veiculo.historicoLeilao).toBe("Leilão de indenização integral");
  });

  it("omite historicoLeilao quando não preenchido", () => {
    const payload = montarPayloadQuiver(cotacao({ veiculo: {} }));
    expect(payload.veiculo).not.toHaveProperty("historicoLeilao");
  });
});

describe("payload Quiver - cobertura.pequenosReparos", () => {
  it("traduz true para 'Contratado'", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: { pequenos_reparos: true } }));
    expect(payload.cobertura.pequenosReparos).toBe("Contratado");
  });

  it("traduz false/ausente para 'Não contratada'", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: { pequenos_reparos: false } }));
    expect(payload.cobertura.pequenosReparos).toBe("Não contratada");

    const payloadAusente = montarPayloadQuiver(cotacao({ coberturas: {} }));
    expect(payloadAusente.cobertura.pequenosReparos).toBe("Não contratada");
  });
});

describe("payload Quiver - cobertura.vidrosFarosRetrovisores", () => {
  it("envia o nível selecionado quando persistido como string", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: { vidros: "Intermediário" } }));
    expect(payload.cobertura.vidrosFarosRetrovisores).toBe("Intermediário");
  });

  it("omite quando não há valor", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: {} }));
    expect(payload.cobertura).not.toHaveProperty("vidrosFarosRetrovisores");
  });
});

describe("payload Quiver - cobertura.assistencia24h", () => {
  it("envia o nível selecionado (4 valores reais do robô)", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: { assist_24: "Superior" } }));
    expect(payload.cobertura.assistencia24h).toBe("Superior");
  });
});

describe("payload Quiver - cobertura.carroReserva", () => {
  it("envia o nível selecionado (sem opção por dias)", () => {
    const payload = montarPayloadQuiver(cotacao({ coberturas: { carro_reserva: "Básico" } }));
    expect(payload.cobertura.carroReserva).toBe("Básico");
  });
});

describe("payload Quiver - cobertura.valorDeterminado", () => {
  it("envia o valor sem prefixo R$ quando modalidade é 'Valor Determinado'", () => {
    const payload = montarPayloadQuiver(
      cotacao({
        coberturas: { modalidade: "Valor Determinado", casco_valor: "R$ 50.000,00" },
      }),
    );
    expect(payload.cobertura.valorDeterminado).toBe("50.000,00");
  });

  it("não envia valorDeterminado quando modalidade é 'Valor de Mercado'", () => {
    const payload = montarPayloadQuiver(
      cotacao({
        coberturas: { modalidade: "Valor de Mercado", casco_valor: "R$ 50.000,00" },
      }),
    );
    expect(payload.cobertura).not.toHaveProperty("valorDeterminado");
  });

  it("não envia valorDeterminado quando não há valor preenchido", () => {
    const payload = montarPayloadQuiver(
      cotacao({ coberturas: { modalidade: "Valor Determinado" } }),
    );
    expect(payload.cobertura).not.toHaveProperty("valorDeterminado");
  });
});

describe("payload Quiver - complementares.jovensCondutores", () => {
  it("monta o array só quando pessoas17a25='Sim' (jovens_18_25=true)", () => {
    const payload = montarPayloadQuiver(
      cotacao({
        perfil: {
          jovens_18_25: true,
          jovens_18_25_detalhes: [
            {
              nome: "Fulano",
              idade: "Entre 18 e 24 anos",
              sexo: "Masculino",
              reside: "Mora e dirige o veículo",
              filhoOuFuncionarioPrincipalCondutor: "Sim",
            },
          ],
        },
      }),
    );

    expect(payload.complementares.pessoas17a25).toBe("Sim");
    expect(payload.complementares.jovensCondutores).toEqual([
      {
        idade: "Entre 18 e 24 anos",
        sexo: "Masculino",
        reside: "Mora e dirige o veículo",
        filhoOuFuncionarioPrincipalCondutor: "Sim",
      },
    ]);
    // "nome" é só identificador interno de UX — não existe no payload do robô.
    const jovem = (payload.complementares.jovensCondutores as Record<string, unknown>[])[0];
    expect(jovem).not.toHaveProperty("nome");
  });

  it("omite jovensCondutores quando pessoas17a25='Não'", () => {
    const payload = montarPayloadQuiver(
      cotacao({
        perfil: {
          jovens_18_25: false,
          jovens_18_25_detalhes: [{ nome: "Fulano", idade: "25 anos" }],
        },
      }),
    );

    expect(payload.complementares.pessoas17a25).toBe("Não");
    expect(payload.complementares).not.toHaveProperty("jovensCondutores");
  });

  it("omite campos opcionais do jovem quando não preenchidos, mantendo idade", () => {
    const payload = montarPayloadQuiver(
      cotacao({
        perfil: {
          jovens_18_25: true,
          jovens_18_25_detalhes: [{ nome: "", idade: "17 anos" }],
        },
      }),
    );

    expect(payload.complementares.jovensCondutores).toEqual([{ idade: "17 anos" }]);
  });
});
