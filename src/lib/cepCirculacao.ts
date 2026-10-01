/** O portal só revela "CEP circulação" para usos não particulares (log do robô
 * 01/10/2026). Particular, vazio ou o padrão não usam o campo. */
export function usoExigeCepCirculacao(tipoUso: string | null | undefined): boolean {
  const t = (tipoUso ?? "").trim().toLowerCase();
  return t !== "" && t !== "particular";
}
