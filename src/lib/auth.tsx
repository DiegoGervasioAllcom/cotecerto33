import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabase,
  type Perfil,
  type Profile,
  type Empresa,
} from "@/integrations/supabase/client";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  empresa: Empresa | null;
  role: Perfil | null;
  accessError: string | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const DISABLED_ACCESS_MESSAGE = "Seu acesso está desativado. Entre em contato com a Matriz.";
export const DISABLED_DATABASE_ERROR_MESSAGE = "Acesso desativado. Entre em contato com a Matriz.";
export const ACCESS_CHECK_ERROR_MESSAGE =
  "Não foi possível validar seu acesso. Verifique sua conexão e tente novamente.";

export type ProfileAccessState = "unknown" | "pending" | "active" | "disabled";

export function getProfileAccessState(
  profile: Pick<Profile, "status" | "desligado_em"> | null,
): ProfileAccessState {
  if (!profile) return "unknown";
  if (profile.desligado_em) return "disabled";
  if (profile.status === "pendente") return "pending";
  return profile.status === "aprovada" ? "active" : "disabled";
}

export function getProfileAccessDecision(
  profile: Pick<Profile, "status" | "desligado_em"> | null,
  loadFailed: boolean,
): ProfileAccessState | "error" {
  return loadFailed ? "error" : getProfileAccessState(profile);
}

export function classifyContextLoadError(
  error: { message?: string } | null | undefined,
): "disabled" | "error" | null {
  if (!error) return null;
  return error.message === DISABLED_DATABASE_ERROR_MESSAGE ? "disabled" : "error";
}

export async function runSignOutOnce(
  userId: string,
  inFlight: { current: string | null },
  signOut: () => Promise<unknown>,
): Promise<boolean> {
  if (inFlight.current === userId) return false;
  inFlight.current = userId;
  try {
    await signOut();
    return true;
  } catch (error) {
    if (inFlight.current === userId) inFlight.current = null;
    throw error;
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined);

type LoadedContext = {
  ok: true;
  profile: Profile | null;
  empresa: Empresa | null;
  role: Perfil | null;
};

type ContextLoadResult = LoadedContext | { ok: false; reason: "disabled" | "error" };

async function loadContext(userId: string): Promise<ContextLoadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: "error" };
  }

  const [profileResult, roleResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const initialError = profileResult.error ?? roleResult.error;
  const initialFailure = classifyContextLoadError(initialError);
  if (initialFailure) return { ok: false, reason: initialFailure };

  const profile = profileResult.data;
  const roleRow = roleResult.data;

  let empresa: Empresa | null = null;
  if (profile?.empresa_id) {
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", profile.empresa_id)
      .maybeSingle();
    const empresaFailure = classifyContextLoadError(error);
    if (empresaFailure) return { ok: false, reason: empresaFailure };
    empresa = (data as Empresa | null) ?? null;
  }

  return {
    ok: true,
    profile: (profile as Profile | null) ?? null,
    empresa,
    role: (roleRow?.role as Perfil | undefined) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [role, setRole] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const requestId = useRef(0);
  const disabledSignOutUser = useRef<string | null>(null);

  const clearContext = useCallback(() => {
    setSession(null);
    setProfile(null);
    setEmpresa(null);
    setRole(null);
  }, []);

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      const currentRequest = ++requestId.current;

      if (!nextSession?.user) {
        clearContext();
        disabledSignOutUser.current = null;
        setLoading(false);
        return;
      }

      setSession(nextSession);
      setProfile(null);
      setEmpresa(null);
      setRole(null);
      setLoading(true);
      setAccessError(null);
      let ctx: ContextLoadResult;
      try {
        ctx = await loadContext(nextSession.user.id);
      } catch (error) {
        const reason =
          error && typeof error === "object" && "message" in error
            ? classifyContextLoadError({ message: String(error.message) })
            : "error";
        ctx = { ok: false, reason: reason ?? "error" };
      }
      if (currentRequest !== requestId.current) return;

      if (!ctx.ok) {
        if (ctx.reason === "disabled") {
          const userId = nextSession.user.id;
          clearContext();
          setAccessError(DISABLED_ACCESS_MESSAGE);
          setLoading(false);
          void runSignOutOnce(userId, disabledSignOutUser, () => supabase.auth.signOut()).catch(
            () => undefined,
          );
          return;
        }
        setAccessError(ACCESS_CHECK_ERROR_MESSAGE);
        setLoading(false);
        return;
      }

      const profileAccess = getProfileAccessDecision(ctx.profile, false);
      if (profileAccess === "disabled") {
        const userId = nextSession.user.id;
        clearContext();
        setAccessError(DISABLED_ACCESS_MESSAGE);
        setLoading(false);
        void runSignOutOnce(userId, disabledSignOutUser, () => supabase.auth.signOut()).catch(
          () => undefined,
        );
        return;
      }

      setProfile(ctx.profile);
      setEmpresa(ctx.empresa);
      setRole(ctx.role);
      setLoading(false);
    },
    [clearContext],
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      clearContext();
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession, clearContext]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    const sub = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      // defer to avoid lock with the auth callback
      setTimeout(() => {
        if (active) void applySession(newSession);
      }, 0);
    });

    refresh();

    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
  }, [applySession, refresh]);

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    setAccessError(null);
    // Marca offline ANTES do signOut (depois perde o token e a RPC falha)
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
      await supabase.rpc("presence_set", { p_status: "offline", p_user_agent: ua });
    } catch {
      /* noop */
    }
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthState>(
    () => ({ loading, session, profile, empresa, role, accessError, signOut, refresh }),
    [loading, session, profile, empresa, role, accessError, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
