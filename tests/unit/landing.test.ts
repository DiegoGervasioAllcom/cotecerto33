import { describe, expect, it } from "vitest";
import { resolverLanding } from "@/lib/landing";

describe("resolverLanding", () => {
  it("aguarda o perfil ser resolvido depois que a sessão chega", () => {
    expect(resolverLanding({ role: null, isGroupView: false, groupLoading: false })).toBeNull();
  });

  it.each(["matriz", "coordenador", "supervisor", "interno", "master"] as const)(
    "envia %s para a visão de comando",
    (role) => {
      expect(resolverLanding({ role, isGroupView: role === "master", groupLoading: false })).toBe(
        "/comando/visao-geral",
      );
    },
  );

  it("envia Franquia Full para comando e aguarda a modalidade antes de decidir", () => {
    expect(
      resolverLanding({ role: "franqueado", isGroupView: false, groupLoading: true }),
    ).toBeNull();
    expect(resolverLanding({ role: "franqueado", isGroupView: true, groupLoading: false })).toBe(
      "/comando/visao-geral",
    );
  });

  it.each(["vendedor", "franqueado"] as const)("mantém %s de venda em /inicio", (role) => {
    expect(resolverLanding({ role, isGroupView: false, groupLoading: false })).toBe("/inicio");
  });
});
