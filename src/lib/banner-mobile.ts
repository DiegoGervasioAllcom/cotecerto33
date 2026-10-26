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
