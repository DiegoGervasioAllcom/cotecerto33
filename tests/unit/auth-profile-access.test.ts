import { describe, expect, it, vi } from "vitest";
import {
  classifyContextLoadError,
  DISABLED_DATABASE_ERROR_MESSAGE,
  getProfileAccessDecision,
  getProfileAccessState,
  runSignOutOnce,
} from "../../src/lib/auth";

describe("estado de acesso do perfil", () => {
  it("mantém perfil pendente no fluxo de aprovação", () => {
    expect(getProfileAccessState({ status: "pendente", desligado_em: null })).toBe("pending");
  });

  it("aceita somente perfil aprovado e não desligado", () => {
    expect(getProfileAccessState({ status: "aprovada", desligado_em: null })).toBe("active");
  });

  it.each(["recusada", "suspensa"] as const)("bloqueia status %s", (status) => {
    expect(getProfileAccessState({ status, desligado_em: null })).toBe("disabled");
  });

  it("desligado_em prevalece sobre status aprovado ou pendente", () => {
    const desligado_em = "2026-08-06T12:00:00.000Z";
    expect(getProfileAccessState({ status: "aprovada", desligado_em })).toBe("disabled");
    expect(getProfileAccessState({ status: "pendente", desligado_em })).toBe("disabled");
  });

  it("não libera landing enquanto o perfil ainda não carregou", () => {
    expect(getProfileAccessState(null)).toBe("unknown");
  });

  it("separa falha de consulta de perfil desligado", () => {
    expect(getProfileAccessDecision(null, true)).toBe("error");
    expect(getProfileAccessDecision(null, false)).toBe("unknown");
    expect(getProfileAccessDecision({ status: "suspensa", desligado_em: null }, false)).toBe(
      "disabled",
    );
  });
});

describe("erro ao carregar contexto", () => {
  it("reconhece somente a mensagem explícita do hook como acesso desligado", () => {
    expect(classifyContextLoadError({ message: DISABLED_DATABASE_ERROR_MESSAGE })).toBe("disabled");
    expect(classifyContextLoadError({ message: "Falha de conexão" })).toBe("error");
    expect(
      classifyContextLoadError({ message: `${DISABLED_DATABASE_ERROR_MESSAGE} detalhe` }),
    ).toBe("error");
    expect(classifyContextLoadError(null)).toBeNull();
  });
});

describe("logout automático de perfil desligado", () => {
  it("suprime somente tentativas simultâneas para o mesmo usuário", async () => {
    let concluir: (() => void) | undefined;
    const signOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        }),
    );
    const inFlight = { current: null as string | null };

    const primeira = runSignOutOnce("user-1", inFlight, signOut);
    await expect(runSignOutOnce("user-1", inFlight, signOut)).resolves.toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    concluir?.();
    await expect(primeira).resolves.toBe(true);
  });

  it("libera uma nova tentativa quando signOut falha", async () => {
    const signOut = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(undefined);
    const inFlight = { current: null as string | null };

    await expect(runSignOutOnce("user-1", inFlight, signOut)).rejects.toThrow("rede");
    expect(inFlight.current).toBeNull();
    await expect(runSignOutOnce("user-1", inFlight, signOut)).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
