import { describe, expect, it } from "vitest";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";

function cotacaoComVeiculo(veiculo: Record<string, unknown>): CotacaoRow {
  return {
    id: "cotacao-teste",
    segurado: {},
    seguro: {},
    veiculo,
    perfil: {},
    coberturas: {},
  };
}

describe("payload Quiver - veículo.zeroKm e subcampos condicionais", () => {
  it("envia zeroKm='Não' e omite dataSaidaConcessionaria/odometro quando zero_km é false", () => {
    const payload = montarPayloadQuiver(
      cotacaoComVeiculo({
        placa: "ABC1D23",
        zero_km: false,
        data_saida_concessionaria: "2026-01-10",
        odometro: "15000",
      }),
    );

    expect(payload.veiculo.zeroKm).toBe("Não");
    expect(payload.veiculo).not.toHaveProperty("dataSaidaConcessionaria");
    expect(payload.veiculo).not.toHaveProperty("odometro");
  });

  it("envia zeroKm='Sim' com dataSaidaConcessionaria (DD/MM/AAAA) e odometro (só dígitos)", () => {
    const payload = montarPayloadQuiver(
      cotacaoComVeiculo({
        placa: "ABC1D23",
        zero_km: true,
        data_saida_concessionaria: "2026-01-10",
        odometro: "15.000",
      }),
    );

    expect(payload.veiculo.zeroKm).toBe("Sim");
    expect(payload.veiculo.dataSaidaConcessionaria).toBe("10/01/2026");
    expect(payload.veiculo.odometro).toBe("15000");
  });
});
