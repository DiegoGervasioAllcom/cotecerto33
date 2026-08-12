import { describe, expect, test } from "vitest";
import {
  clearSessionAfterPasswordChange,
  isPasswordRecoveryEvent,
  parseRecoveryCallback,
  requestPasswordRecovery,
} from "@/lib/auth-recovery";
import { vi } from "vitest";
import { recuperarSenhaSchema } from "@/lib/schemas/recuperar-senha.schema";

describe("recuperação de senha", () => {
  test("valida e normaliza o e-mail", () => {
    const result = recuperarSenhaSchema.parse({ email: "  pessoa@example.com  " });
    expect(result.email).toBe("pessoa@example.com");
  });

  test.each(["", "email-invalido", `${"a".repeat(245)}@example.com`])(
    "rejeita e-mail inválido: %s",
    (email) => {
      expect(recuperarSenhaSchema.safeParse({ email }).success).toBe(false);
    },
  );

  test("aceita e-mail no limite de 254 caracteres", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;

    expect(email).toHaveLength(254);
    expect(recuperarSenhaSchema.safeParse({ email }).success).toBe(true);
  });

  test("reconhece callbacks PKCE, token hash e tokens implícitos", () => {
    expect(
      parseRecoveryCallback(new URL("https://app.test/auth/redefinir-senha?code=abc")),
    ).toEqual({ kind: "code", code: "abc" });
    expect(
      parseRecoveryCallback(
        new URL("https://app.test/auth/redefinir-senha?token_hash=hash&type=recovery"),
      ),
    ).toEqual({ kind: "tokenHash", tokenHash: "hash" });
    expect(
      parseRecoveryCallback(
        new URL(
          "https://app.test/auth/redefinir-senha#access_token=a&refresh_token=r&type=recovery",
        ),
      ),
    ).toEqual({ kind: "tokens", accessToken: "a", refreshToken: "r" });
  });

  test("rejeita parâmetros que não sejam de recuperação", () => {
    expect(
      parseRecoveryCallback(
        new URL("https://app.test/auth/redefinir-senha#access_token=a&refresh_token=r&type=invite"),
      ),
    ).toEqual({ kind: "invalid" });
  });

  test.each([
    "https://app.test/auth/redefinir-senha",
    "https://app.test/auth/redefinir-senha?token_hash=hash&type=invite",
    "https://app.test/auth/redefinir-senha#access_token=a&type=recovery",
    "https://app.test/auth/redefinir-senha#refresh_token=r&type=recovery",
  ])("não aceita callback incompleto ou de outro fluxo: %s", (url) => {
    expect(parseRecoveryCallback(new URL(url))).toEqual({ kind: "invalid" });
  });

  test("não aceita type=recovery ou code como prova autônoma de uma sessão recovery", () => {
    expect(
      parseRecoveryCallback(new URL("https://app.test/auth/redefinir-senha?type=recovery")),
    ).toEqual({ kind: "invalid" });
    expect(
      parseRecoveryCallback(new URL("https://app.test/auth/redefinir-senha?code=convite")),
    ).toEqual({
      kind: "code",
      code: "convite",
    });
  });

  test("não autoriza código de convite/onboarding que emite apenas SIGNED_IN", () => {
    expect(isPasswordRecoveryEvent("SIGNED_IN", true)).toBe(false);
    expect(isPasswordRecoveryEvent("PASSWORD_RECOVERY", false)).toBe(false);
    expect(isPasswordRecoveryEvent("PASSWORD_RECOVERY", true)).toBe(true);
  });

  test("reporta falha operacional sem anunciar envio", async () => {
    const auth = {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: new Error("rate limit") }),
    };
    await expect(
      requestPasswordRecovery(auth, "pessoa@example.com", "https://app.test/redefinir"),
    ).resolves.toBe(false);
  });

  test("faz limpeza local se o encerramento global falhar", async () => {
    const signOut = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error("rede") })
      .mockResolvedValueOnce({ error: null });
    await expect(clearSessionAfterPasswordChange({ signOut })).resolves.toBe(true);
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  test("não confirma limpeza quando as duas tentativas falham", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("falha") });
    await expect(clearSessionAfterPasswordChange({ signOut })).resolves.toBe(false);
  });
});
