// Autenticação dos webhooks da Quiver (segredo compartilhado em x-client-key /
// x-client-secret). Comparação em tempo constante, para a resposta não vazar,
// pelo tempo, quantos caracteres da credencial batem.
import { createHash, timingSafeEqual } from "node:crypto";

/** Comparação em tempo constante (hash dos dois lados normaliza o tamanho). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function credenciaisConferem(
  got: { key: string | null; secret: string | null },
  expected: { key: string; secret: string },
): boolean {
  // Sem curto-circuito: sempre compara os dois.
  const k = safeEqual(got.key ?? "", expected.key);
  const s = safeEqual(got.secret ?? "", expected.secret);
  return k && s && got.key !== null && got.secret !== null;
}

/** Lê x-client-key / x-client-secret do request e confere com o esperado. */
export function requestAutenticado(
  request: Request,
  expected: { key: string; secret: string },
): boolean {
  return credenciaisConferem(
    {
      key: request.headers.get("x-client-key"),
      secret: request.headers.get("x-client-secret"),
    },
    expected,
  );
}
