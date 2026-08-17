import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Setter = ReturnType<typeof vi.fn>;
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const harness = vi.hoisted(() => ({
  setters: [] as Setter[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  listener: undefined as AuthListener | undefined,
  cleanup: undefined as (() => void) | undefined,
  authValue: undefined as { refresh: () => Promise<void> } | undefined,
  unsubscribe: vi.fn(),
  signOut: vi.fn(async () => undefined),
  getSession: vi.fn(),
  responses: new Map<string, Array<unknown>>(),
  fromCalls: [] as string[],
}));

vi.mock("react", () => ({
  createContext: () => ({ Provider: ({ children }: { children: unknown }) => children }),
  useCallback: <T>(callback: T) => callback,
  useContext: () => undefined,
  useEffect: (effect: () => void | (() => void)) => {
    harness.cleanup = effect() || undefined;
  },
  useMemo: <T>(factory: () => T) => {
    const value = factory();
    if (value && typeof value === "object" && "refresh" in value) {
      harness.authValue = value as { refresh: () => Promise<void> };
    }
    return value;
  },
  useRef: <T>(initial: T) => {
    const index = harness.refIndex++;
    harness.refs[index] ??= { current: initial };
    return harness.refs[index];
  },
  useState: <T>(_initial: T) => {
    const index = harness.stateIndex++;
    harness.setters[index] ??= vi.fn();
    return [_initial, harness.setters[index]];
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: harness.getSession,
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        harness.listener = listener;
        return { data: { subscription: { unsubscribe: harness.unsubscribe } } };
      }),
      signOut: harness.signOut,
    },
    from: vi.fn((table: string) => {
      harness.fromCalls.push(table);
      const result = harness.responses.get(table)?.shift();
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() =>
          result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
        ),
      };
      return query;
    }),
    rpc: vi.fn(),
  },
}));

import {
  ACCESS_CHECK_ERROR_MESSAGE,
  AuthProvider,
  DISABLED_ACCESS_MESSAGE,
} from "../../src/lib/auth";

const SESSION = (id: string) => ({ user: { id }, access_token: `token-${id}` }) as Session;
const PROFILE = (id: string, status = "aprovada") => ({
  id,
  empresa_id: `empresa-${id}`,
  status,
  desligado_em: null,
});
const ROLE = { role: "vendedor" };
const EMPRESA = { id: "empresa-user-1", nome: "Franquia 1" };

const state = {
  session: () => harness.setters[0],
  profile: () => harness.setters[1],
  empresa: () => harness.setters[2],
  role: () => harness.setters[3],
  loading: () => harness.setters[4],
  error: () => harness.setters[5],
};

function queueContext(
  id: string,
  options: { status?: string; profileError?: Error; empresa?: object } = {},
) {
  harness.responses.set("profiles", [
    options.profileError ?? { data: PROFILE(id, options.status), error: null },
  ]);
  harness.responses.set("user_roles", [{ data: ROLE, error: null }]);
  harness.responses.set("empresas", [
    { data: options.empresa ?? { ...EMPRESA, id: `empresa-${id}` }, error: null },
  ]);
}

function appendContext(id: string, profile: Record<string, unknown> = PROFILE(id)) {
  harness.responses.get("profiles")?.push({ data: profile, error: null });
  harness.responses.get("user_roles")?.push({ data: ROLE, error: null });
  harness.responses
    .get("empresas")
    ?.push({ data: { ...EMPRESA, id: `empresa-${id}` }, error: null });
}

async function emit(event: AuthChangeEvent, session: Session | null) {
  harness.listener?.(event, session);
  await vi.runAllTimersAsync();
}

async function establishSession(id = "user-1", event: AuthChangeEvent = "INITIAL_SESSION") {
  queueContext(id);
  AuthProvider({ children: null });
  await emit(event, SESSION(id));
  for (const setter of harness.setters) setter.mockClear();
  harness.fromCalls.length = 0;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("eventos do AuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.setters.length = 0;
    harness.refs.length = 0;
    harness.stateIndex = 0;
    harness.refIndex = 0;
    harness.listener = undefined;
    harness.cleanup = undefined;
    harness.authValue = undefined;
    harness.responses.clear();
    harness.fromCalls.length = 0;
    harness.signOut.mockClear();
    harness.getSession.mockReset();
    harness.unsubscribe.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it.each(["INITIAL_SESSION", "SIGNED_IN"] as const)(
    "%s carrega sessão e contexto em modo bloqueante",
    async (event) => {
      queueContext("user-1");
      AuthProvider({ children: null });

      await emit(event, SESSION("user-1"));

      expect(state.session()).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: "user-1" } }),
      );
      expect(state.profile()).toHaveBeenLastCalledWith(expect.objectContaining({ id: "user-1" }));
      expect(state.loading()).toHaveBeenCalledWith(true);
      expect(state.loading()).toHaveBeenLastCalledWith(false);
    },
  );

  it.each(["TOKEN_REFRESHED", "USER_UPDATED"] as const)(
    "%s do mesmo usuário preserva contexto visível enquanto revalida",
    async (event) => {
      await establishSession();
      appendContext("user-1", { ...PROFILE("user-1"), nome: "Nome atualizado" });

      await emit(event, SESSION("user-1"));

      expect(state.profile()).not.toHaveBeenCalledWith(null);
      expect(state.empresa()).not.toHaveBeenCalledWith(null);
      expect(state.role()).not.toHaveBeenCalledWith(null);
      expect(state.loading()).not.toHaveBeenCalledWith(true);
      expect(state.profile()).toHaveBeenLastCalledWith(
        expect.objectContaining({ nome: "Nome atualizado" }),
      );
    },
  );

  it("SIGNED_OUT limpa imediatamente e timer anterior não ressuscita a sessão", async () => {
    await establishSession();
    appendContext("user-1");

    harness.listener?.("TOKEN_REFRESHED", SESSION("user-1"));
    harness.listener?.("SIGNED_OUT", null);
    expect(state.session()).toHaveBeenLastCalledWith(null);
    expect(state.profile()).toHaveBeenLastCalledWith(null);

    await vi.runAllTimersAsync();

    expect(state.session()).toHaveBeenCalledTimes(1);
    expect(state.session()).toHaveBeenLastCalledWith(null);
    expect(harness.fromCalls).toEqual([]);
  });

  it("troca de usuário invalida contexto anterior e recarrega em modo bloqueante", async () => {
    await establishSession();
    appendContext("user-2");

    await emit("TOKEN_REFRESHED", SESSION("user-2"));

    expect(state.profile()).toHaveBeenCalledWith(null);
    expect(state.loading()).toHaveBeenCalledWith(true);
    expect(state.profile()).toHaveBeenLastCalledWith(expect.objectContaining({ id: "user-2" }));
  });

  it("falha de rede preserva a sessão mas apresenta erro verificável", async () => {
    queueContext("user-1", { profileError: new Error("rede indisponível") });
    AuthProvider({ children: null });

    await emit("INITIAL_SESSION", SESSION("user-1"));

    expect(state.session()).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: "user-1" } }),
    );
    expect(state.error()).toHaveBeenLastCalledWith(ACCESS_CHECK_ERROR_MESSAGE);
    expect(harness.signOut).not.toHaveBeenCalled();
  });

  it("perfil desligado limpa o contexto e dispara expulsão automática", async () => {
    queueContext("user-1", { status: "suspensa" });
    AuthProvider({ children: null });

    await emit("SIGNED_IN", SESSION("user-1"));

    expect(state.session()).toHaveBeenLastCalledWith(null);
    expect(state.error()).toHaveBeenLastCalledWith(DISABLED_ACCESS_MESSAGE);
    expect(harness.signOut).toHaveBeenCalledTimes(1);
  });

  it("eventos duplicados antes do timer executam somente a revalidação mais recente", async () => {
    await establishSession();
    appendContext("user-1");

    harness.listener?.("TOKEN_REFRESHED", SESSION("user-1"));
    harness.listener?.("TOKEN_REFRESHED", SESSION("user-1"));
    await vi.runAllTimersAsync();

    expect(harness.fromCalls.filter((table) => table === "profiles")).toHaveLength(1);
    expect(state.profile()).not.toHaveBeenCalledWith(null);
  });

  it("refresh manual pendente não restaura sessão depois de SIGNED_OUT", async () => {
    await establishSession();
    const getSession = deferred<{ data: { session: Session | null } }>();
    harness.getSession.mockReturnValueOnce(getSession.promise);

    const refresh = harness.authValue?.refresh();
    await emit("SIGNED_OUT", null);
    getSession.resolve({ data: { session: SESSION("user-1") } });
    await refresh;

    expect(state.session()).toHaveBeenCalledTimes(1);
    expect(state.session()).toHaveBeenLastCalledWith(null);
    expect(harness.fromCalls).toEqual([]);
  });

  it("refresh manual pendente não sobrescreve troca de usuário", async () => {
    await establishSession();
    const getSession = deferred<{ data: { session: Session | null } }>();
    harness.getSession.mockReturnValueOnce(getSession.promise);
    const refresh = harness.authValue?.refresh();
    appendContext("user-2");

    await emit("SIGNED_IN", SESSION("user-2"));
    getSession.resolve({ data: { session: SESSION("user-1") } });
    await refresh;

    expect(state.session()).toHaveBeenLastCalledWith(
      expect.objectContaining({ user: { id: "user-2" } }),
    );
    expect(state.profile()).toHaveBeenLastCalledWith(expect.objectContaining({ id: "user-2" }));
    expect(harness.fromCalls.filter((table) => table === "profiles")).toHaveLength(1);
  });

  it("resolução de loadContext após unmount não chama setters", async () => {
    const profile = deferred<{ data: ReturnType<typeof PROFILE>; error: null }>();
    harness.responses.set("profiles", [profile.promise]);
    harness.responses.set("user_roles", [{ data: ROLE, error: null }]);
    harness.responses.set("empresas", [{ data: EMPRESA, error: null }]);
    AuthProvider({ children: null });

    harness.listener?.("INITIAL_SESSION", SESSION("user-1"));
    vi.runAllTimers();
    await Promise.resolve();
    harness.cleanup?.();
    for (const setter of harness.setters) setter.mockClear();

    profile.resolve({ data: PROFILE("user-1"), error: null });
    await vi.runAllTimersAsync();

    for (const setter of harness.setters) expect(setter).not.toHaveBeenCalled();
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("erro de rede no refresh silencioso mantém contexto e só expõe erro de acesso", async () => {
    await establishSession();
    harness.responses.get("profiles")?.push(new Error("rede indisponível"));
    harness.responses.get("user_roles")?.push({ data: ROLE, error: null });

    await emit("TOKEN_REFRESHED", SESSION("user-1"));

    expect(state.profile()).not.toHaveBeenCalledWith(null);
    expect(state.empresa()).not.toHaveBeenCalledWith(null);
    expect(state.role()).not.toHaveBeenCalledWith(null);
    expect(state.loading()).not.toHaveBeenCalledWith(true);
    expect(state.error()).toHaveBeenLastCalledWith(ACCESS_CHECK_ERROR_MESSAGE);
    expect(harness.signOut).not.toHaveBeenCalled();
  });
});
