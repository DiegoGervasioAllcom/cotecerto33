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

// ---------- máscaras de documentos / contato ----------
// Format-agnósticas: sempre extraem os dígitos primeiro e re-formatam.
// Idempotentes — aplicar 2x produz o mesmo resultado que aplicar 1x.
// Seguras para dado hoje mascarado (banco) e para dado futuro só-dígitos (pós D3.1).

export function onlyDigits(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D+/g, "");
}

export function maskCpfCnpj(v: string | null | undefined): string {
  const d = onlyDigits(v);
  if (!d) return "";
  if (d.length <= 11) {
    return d
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskTelefone(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCep(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 8);
  if (!d) return "";
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}
