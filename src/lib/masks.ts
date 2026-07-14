// Máscaras compartilhadas R$ / %.
// Padrão único para toda a aplicação garantir formatação e parsing consistentes.

export type Mask = "brl" | "pct" | undefined;

export function maskBRL(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  const reais = Math.floor(n / 100);
  const cent = String(n % 100).padStart(2, "0");
  return "R$ " + reais.toLocaleString("pt-BR") + "," + cent;
}

export function parseBRL(formatted: string): number {
  const s = String(formatted ?? "")
    .replace(/[^\d,]/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function maskPct(raw: string): string {
  let s = String(raw ?? "").replace(/[^\d,]/g, "");
  const parts = s.split(",");
  if (parts.length > 1) s = parts[0] + "," + parts.slice(1).join("").slice(0, 2);
  return s ? s + "%" : "";
}

export function parsePct(formatted: string): number {
  const s = String(formatted ?? "")
    .replace(/[^\d,]/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function applyMask(v: string, m: Mask): string {
  if (m === "brl") return maskBRL(v);
  if (m === "pct") return maskPct(v);
  return v;
}

export function formatBRL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%";
}
