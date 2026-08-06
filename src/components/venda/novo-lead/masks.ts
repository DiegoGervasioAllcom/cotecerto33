// Máscaras específicas do fluxo Lead Manual.
// onlyDigits/maskCpfCnpj/maskTelefone/maskCep genéricos vêm de "@/lib/masks".
import {
  onlyDigits,
  normalizePlaca,
  maskTelefone as maskTelefoneCentral,
  maskCep as maskCepCentral,
} from "@/lib/masks";

export function maskCel(raw: string) {
  return maskTelefoneCentral(raw);
}

export function maskFixo(raw: string) {
  const d = onlyDigits(raw).slice(0, 10);
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
}

export function maskCep(raw: string) {
  return maskCepCentral(raw);
}

export function maskPlaca(raw: string) {
  // Mercosul: AAA0A00 | Antigo: AAA0000 (sem pontuação para a Quiver).
  return normalizePlaca(raw);
}

export function maskAno(raw: string) {
  return onlyDigits(raw).slice(0, 4);
}

export function maskBRL(raw: string) {
  const d = onlyDigits(raw);
  if (!d) return "";
  const n = parseInt(d, 10);
  return (
    "R$ " + Math.floor(n / 100).toLocaleString("pt-BR") + "," + String(n % 100).padStart(2, "0")
  );
}

export function maskKm(raw: string) {
  const d = onlyDigits(raw);
  return d ? Number(d).toLocaleString("pt-BR") + " km" : "";
}
