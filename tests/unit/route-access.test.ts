import { describe, expect, it } from "vitest";
import {
  podeAcessarCentral,
  podeAcessarGestaoGeral,
  podeEditarConfiguracoes,
} from "@/lib/route-access";

describe("podeAcessarCentral", () => {
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "permite o perfil interno %s",
    (role) => expect(podeAcessarCentral(role, false)).toBe(true),
  );

  it("permite Franquia Full e bloqueia Franquia Individual", () => {
    expect(podeAcessarCentral("franqueado", true)).toBe(true);
    expect(podeAcessarCentral("franqueado", false)).toBe(false);
  });

  it.each(["master", "vendedor"] as const)("bloqueia o perfil externo %s", (role) => {
    expect(podeAcessarCentral(role, false)).toBe(false);
  });
});

describe("podeAcessarGestaoGeral", () => {
  it("permite Matriz e Coordenador Comercial", () => {
    expect(podeAcessarGestaoGeral("matriz")).toBe(true);
    expect(podeAcessarGestaoGeral("coordenador")).toBe(true);
  });

  it.each(["supervisor", "interno", "master", "franqueado", "vendedor"] as const)(
    "nao amplia a gestao geral para %s",
    (role) => expect(podeAcessarGestaoGeral(role)).toBe(false),
  );
});

describe("podeEditarConfiguracoes", () => {
  it("mantem escrita para a Matriz", () => {
    expect(podeEditarConfiguracoes("matriz")).toBe(true);
  });

  it.each(["coordenador", "supervisor", "interno", "master", "franqueado", "vendedor"] as const)(
    "mantem %s em consulta sem escrita",
    (role) => expect(podeEditarConfiguracoes(role)).toBe(false),
  );
});
