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

describe("payload Quiver - veículo.zeroKm", () => {
  it("envia zeroKm='Não' quando o toggle não foi marcado (zero_km ausente/false)", () => {
    const payload = montarPayloadQuiver(cotacaoComVeiculo({ placa: "ABC1D23" }));

    expect(payload.veiculo.zeroKm).toBe("Não");
  });

  it("envia zeroKm='Sim' quando o toggle foi marcado", () => {
    const payload = montarPayloadQuiver(cotacaoComVeiculo({ placa: "ABC1D23", zero_km: true }));

    expect(payload.veiculo.zeroKm).toBe("Sim");
  });
});
