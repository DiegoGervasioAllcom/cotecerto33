export type RecoveryCallback =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "tokenHash"; tokenHash: string }
  | { kind: "invalid" };

type ResetPasswordAuth = {
  resetPasswordForEmail: (
    email: string,
    options: { redirectTo: string },
  ) => Promise<{ error: unknown | null }>;
};

type SignOutAuth = {
  signOut: (options?: { scope?: "local" }) => Promise<{ error: unknown | null }>;
};

export function parseRecoveryCallback(url: URL): RecoveryCallback {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const type = url.searchParams.get("type") ?? hash.get("type");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken && type === "recovery") {
    return { kind: "tokens", accessToken, refreshToken };
  }
  if (accessToken || refreshToken) return { kind: "invalid" };

  const code = url.searchParams.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash && type === "recovery") return { kind: "tokenHash", tokenHash };

  return { kind: "invalid" };
}

export function isPasswordRecoveryEvent(event: string, hasSession: boolean): boolean {
  return event === "PASSWORD_RECOVERY" && hasSession;
}

export async function requestPasswordRecovery(
  auth: ResetPasswordAuth,
  email: string,
  redirectTo: string,
): Promise<boolean> {
  try {
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo });
    return !error;
  } catch {
    return false;
  }
}

export async function clearSessionAfterPasswordChange(auth: SignOutAuth): Promise<boolean> {
  try {
    const globalResult = await auth.signOut();
    if (!globalResult.error) return true;
    const localResult = await auth.signOut({ scope: "local" });
    return !localResult.error;
  } catch {
    try {
      const localResult = await auth.signOut({ scope: "local" });
      return !localResult.error;
    } catch {
      return false;
    }
  }
}
