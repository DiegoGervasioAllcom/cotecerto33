import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function loadContext(userId: string): Promise<{
  profile: Profile | null;
  empresa: Empresa | null;
  role: Perfil | null;
}> {
  if (!isSupabaseConfigured) {
    return { profile: null, empresa: null, role: null };
  }

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  let empresa: Empresa | null = null;
  if (profile?.empresa_id) {
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", profile.empresa_id)
      .maybeSingle();
    empresa = (data as Empresa | null) ?? null;
  }

  return {
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

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setProfile(null);
      setEmpresa(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      const ctx = await loadContext(data.session.user.id);
      setProfile(ctx.profile);
      setEmpresa(ctx.empresa);
      setRole(ctx.role);
    } else {
      setProfile(null);
      setEmpresa(null);
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    const sub = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED") {
        setSession(newSession);
        return;
      }
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid lock with the auth callback
        setTimeout(async () => {
          const ctx = await loadContext(newSession.user.id);
          if (!active) return;
          setProfile(ctx.profile);
          setEmpresa(ctx.empresa);
          setRole(ctx.role);
          setLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setEmpresa(null);
        setRole(null);
        setLoading(false);
      }
    });

    refresh();

    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
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
    () => ({ loading, session, profile, empresa, role, signOut, refresh }),
    [loading, session, profile, empresa, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
