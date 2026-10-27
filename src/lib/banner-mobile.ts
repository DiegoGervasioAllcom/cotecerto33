export const BANNER_MOBILE_KEY = "cc:banner-mobile-dispensado";

type Store = Pick<Storage, "getItem" | "setItem">;

function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function bannerDispensado(s: Store | null = store()): boolean {
  try {
    return s?.getItem(BANNER_MOBILE_KEY) === "1";
  } catch {
    return false;
  }
}

export function dispensarBanner(s: Store | null = store()): void {
  try {
    s?.setItem(BANNER_MOBILE_KEY, "1");
  } catch {
    /* sem storage: dispensa vale só na sessão da tela */
  }
}

/** Viewport estreita ou dispositivo touch sem hover (celular/tablet). */
export function ehDispositivoMobile(mm: (q: string) => { matches: boolean }): boolean {
  return mm("(max-width: 768px)").matches || mm("(pointer: coarse) and (hover: none)").matches;
}

export const VERSAO_PREFERIDA_KEY = "cc:versao-preferida";
export const REDIRECT_SESSAO_KEY = "cc:mobile-redirect-feito";

type StoreFull = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): StoreFull | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function localStore(): StoreFull | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export type PreferenciaVersao = "completa" | null;

export function lerPreferenciaVersao(s: StoreFull | null = localStore()): PreferenciaVersao {
  try {
    return s?.getItem(VERSAO_PREFERIDA_KEY) === "completa" ? "completa" : null;
  } catch {
    return null;
  }
}

/** Grava "completa" (chamar ANTES de navegar para a versão completa). */
export function preferirVersaoCompleta(s: StoreFull | null = localStore()): void {
  try {
    s?.setItem(VERSAO_PREFERIDA_KEY, "completa");
  } catch {
    /* sem storage: a preferência vale só até o próximo carregamento */
  }
}

export function limparPreferenciaVersao(s: StoreFull | null = localStore()): void {
  try {
    s?.removeItem(VERSAO_PREFERIDA_KEY);
  } catch {
    /* sem storage: nada a limpar */
  }
}

export function jaRedirecionouNaSessao(s: StoreFull | null = sessionStore()): boolean {
  try {
    return s?.getItem(REDIRECT_SESSAO_KEY) === "1";
  } catch {
    return false;
  }
}

export function marcarRedirecionouNaSessao(s: StoreFull | null = sessionStore()): void {
  try {
    s?.setItem(REDIRECT_SESSAO_KEY, "1");
  } catch {
    /* sem sessionStorage: pode redirecionar de novo; o pior caso é inofensivo */
  }
}

/**
 * Landings de perfil (ver src/lib/landing.ts) e a raiz. Só nelas o redirect
 * dispara: links diretos de trabalho (/venda/cotacoes/$id, /operacao/...),
 * convite, /auth e /m/* (inclusive a PWA, start_url /m/cotacoes) nunca são
 * interceptados, o que também elimina qualquer loop.
 */
const LANDINGS = new Set(["/", "/inicio", "/comando/visao-geral"]);

export function deveRedirecionar(a: {
  mobile: boolean;
  preferencia: PreferenciaVersao;
  jaRedirecionouNaSessao: boolean;
  pathname: string;
}): boolean {
  if (!a.mobile || a.preferencia === "completa" || a.jaRedirecionouNaSessao) return false;
  return LANDINGS.has(a.pathname);
}
