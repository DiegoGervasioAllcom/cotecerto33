import { describe, expect, it } from "vitest";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";

function cotacaoComPlaca(placa: string): CotacaoRow {
  return {
    id: "cotacao-teste",
    segurado: {},
    seguro: {},
    veiculo: { placa },
    perfil: {},
    coberturas: {},
  };
}

describe("payload Quiver - placa", () => {
  it("remove o hífen de uma placa legada antes do envio", () => {
    const payload = montarPayloadQuiver(cotacaoComPlaca("abc-1d23"));

    expect(payload.veiculo.placa).toBe("ABC1D23");
  });
});
