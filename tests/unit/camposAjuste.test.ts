import { describe, expect, it } from "vitest";
import {
  entradaDoAjuste,
  valoresIniciais,
  type CoberturaGlobal,
} from "@/components/venda/novo-lead/steps/coberturas/camposAjuste";

const global: CoberturaGlobal = {
  franquia1: "Normal 100%",
  franquia2: "Reduzida 50%",
  vidros: "Básico",
  carroReserva: "Básico",
};

describe("entradaDoAjuste", () => {
  it("valores iguais ao global não viram ajuste", () => {
    const v = valoresIniciais(global);
    expect(entradaDoAjuste(v, global)).toEqual({
      franquia1: null,
      franquia2: null,
      vidros: null,
      carroReserva: null,
      comissao: null,
    });
  });

  it("só o campo que difere do global é enviado", () => {
    const v = { ...valoresIniciais(global), franquia1: "Reduzida 25%" };
    expect(entradaDoAjuste(v, global)).toMatchObject({
      franquia1: "Reduzida 25%",
      franquia2: null,
    });
  });

  it("campo já guardado segue enviado mesmo igual ao global", () => {
    const guardado = {
      seguradora: "Porto",
      franquia1: "Normal 100%",
      franquia2: null,
      vidros: null,
      carroReserva: null,
      comissao: null,
      aplicadoEm: null,
    };
    const v = valoresIniciais(global, guardado);
    expect(entradaDoAjuste(v, global, guardado).franquia1).toBe("Normal 100%");
  });
});
