import { describe, expect, it } from "vitest";
import { deriveFranchiseScope } from "@/lib/group-scope";

describe("deriveFranchiseScope", () => {
  it("fica pendente sincronamente na transição de perfil nulo para franquia Full", () => {
    expect(deriveFranchiseScope({ role: null, modeloId: undefined, resolvedModel: null })).toEqual({
      loading: false,
      isFranqFull: false,
      isFranqIndividual: false,
    });

    expect(
      deriveFranchiseScope({ role: "franqueado", modeloId: "modelo-full", resolvedModel: null }),
    ).toEqual({ loading: true, isFranqFull: false, isFranqIndividual: false });

    expect(
      deriveFranchiseScope({
        role: "franqueado",
        modeloId: "modelo-full",
        resolvedModel: { modeloId: "modelo-full", isFull: true },
      }),
    ).toEqual({ loading: false, isFranqFull: true, isFranqIndividual: false });
  });

  it("fica pendente até resolver franquia Individual", () => {
    expect(
      deriveFranchiseScope({
        role: "franqueado",
        modeloId: "modelo-individual",
        resolvedModel: null,
      }),
    ).toEqual({ loading: true, isFranqFull: false, isFranqIndividual: false });

    expect(
      deriveFranchiseScope({
        role: "franqueado",
        modeloId: "modelo-individual",
        resolvedModel: { modeloId: "modelo-individual", isFull: false },
      }),
    ).toEqual({ loading: false, isFranqFull: false, isFranqIndividual: true });
  });

  it("invalida sincronamente o resultado ao trocar de modelo", () => {
    expect(
      deriveFranchiseScope({
        role: "franqueado",
        modeloId: "modelo-novo",
        resolvedModel: { modeloId: "modelo-antigo", isFull: true },
      }),
    ).toEqual({ loading: true, isFranqFull: false, isFranqIndividual: false });
  });

  it.each(["master", "vendedor", "matriz", "supervisor"] as const)(
    "não cria pendência nem herda Full para %s",
    (role) => {
      expect(
        deriveFranchiseScope({
          role,
          modeloId: "modelo-full",
          resolvedModel: { modeloId: "modelo-full", isFull: true },
        }),
      ).toEqual({ loading: false, isFranqFull: false, isFranqIndividual: false });
    },
  );
});
