// Lógica pura do documento (PDF) da proposta capturado do portal Quiver
// (V12.4.7 fatia 2). Sem I/O: validação do payload do webhook, conferência
// do PDF, autenticação em tempo constante e mapeamento de erros para o front.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const QUIVER_DOCUMENTO_WEBHOOK_PATH = "/api/webhooks/quiver-documento";

export const PDF_MIN_BYTES = 1024;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Códigos curtos aceitos em `erro` (nunca texto livre; casa com erro_codigo varchar(40)). */
export const ERRO_CAPTURA_CODIGOS = [
  "pdf_nao_encontrado",
  "download_falhou",
  "pdf_invalido",
  "tamanho_invalido",
  "portal_indisponivel",
  "timeout",
  "desconhecido",
] as const;
export type ErroCapturaCodigo = (typeof ERRO_CAPTURA_CODIGOS)[number];

const uuid = z.string().uuid();

const payloadPdfSchema = z
  .object({
    cotacaoId: uuid,
    tipo: z.literal("proposta_pdf"),
    nome: z.string().trim().min(1).max(120),
    sha256: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .transform((s) => s.toLowerCase()),
    tamanho: z.number().int().min(PDF_MIN_BYTES).max(PDF_MAX_BYTES),
    // base64 de 10 MB ≈ 14 MB de texto; teto barato antes de decodificar.
    pdfBase64: z.string().min(1).max(14_500_000),
  })
  .strict();

const payloadErroSchema = z
  .object({ cotacaoId: uuid, erro: z.enum(ERRO_CAPTURA_CODIGOS) })
  .strict();

export type PayloadDocumentoPdf = z.infer<typeof payloadPdfSchema>;

export type PayloadDocumento =
  | { kind: "pdf"; data: PayloadDocumentoPdf }
  | { kind: "erro"; cotacaoId: string; erro: ErroCapturaCodigo };

export function parsePayloadDocumento(
  raw: unknown,
): { ok: true; payload: PayloadDocumento } | { ok: false } {
  const pdf = payloadPdfSchema.safeParse(raw);
  if (pdf.success) return { ok: true, payload: { kind: "pdf", data: pdf.data } };
  const erro = payloadErroSchema.safeParse(raw);
  if (erro.success) {
    return {
      ok: true,
      payload: { kind: "erro", cotacaoId: erro.data.cotacaoId, erro: erro.data.erro },
    };
  }
  return { ok: false };
}

export type ValidacaoPdf =
  | { ok: true; bytes: Buffer }
  | {
      ok: false;
      codigo: "base64_invalido" | "nao_e_pdf" | "tamanho_invalido" | "sha256_divergente";
    };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decodifica e confere base64, `%PDF-`, tamanho (1 KB–10 MB, igual ao declarado) e sha256. */
export function validarPdf(
  p: Pick<PayloadDocumentoPdf, "pdfBase64" | "tamanho" | "sha256">,
): ValidacaoPdf {
  if (p.pdfBase64.length % 4 !== 0 || !BASE64_RE.test(p.pdfBase64)) {
    return { ok: false, codigo: "base64_invalido" };
  }
  const bytes = Buffer.from(p.pdfBase64, "base64");
  if (bytes.length < PDF_MIN_BYTES || bytes.length > PDF_MAX_BYTES || bytes.length !== p.tamanho) {
    return { ok: false, codigo: "tamanho_invalido" };
  }
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, codigo: "nao_e_pdf" };
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (!safeEqual(hash, p.sha256.toLowerCase())) {
    return { ok: false, codigo: "sha256_divergente" };
  }
  return { ok: true, bytes };
}

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

export function storagePathProposta(empresaId: string, propostaId: string): string {
  return `${empresaId}/${propostaId}/proposta.pdf`;
}

/** Mapeia erro das RPCs de recaptura para mensagem PT-BR (nunca vaza detalhe do banco). */
export function mensagemErroRecaptura(err: { code?: string; hint?: string | null } | null): string {
  if (err?.code === "42501") return "Você não tem permissão para esta proposta.";
  switch (err?.hint) {
    case "muito_cedo":
      return "Aguarde 5 minutos entre as tentativas.";
    case "nao_transmitida":
      return "Esta proposta ainda não foi transmitida.";
    case "ja_capturado":
      return "O documento já está disponível.";
    case "sem_transmissao":
      return "Não há transmissão concluída para esta proposta.";
    default:
      return "Não foi possível solicitar o documento agora. Tente novamente mais tarde.";
  }
}
