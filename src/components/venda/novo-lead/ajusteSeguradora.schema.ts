// Ajuste de coberturas de UMA seguradora (V12.3.7) — espelha os checks de
// `cotacao_seguradora_ajustes` (migration 20260929060000) e os enums reais de
// `enumsCoberturas.ts`. Campo vazio = "não ajustar" (null no banco).
import { z } from "zod";
import {
  FRANQUIA_OPCOES,
  FRANQUIA_SEGUNDA_OPCOES,
  NIVEL_COBERTURA_OPCOES,
} from "./enumsCoberturas";

const opcional = <T extends readonly [string, ...string[]]>(valores: T) =>
  z.union([z.literal("").transform(() => null), z.enum(valores)]).nullable();

export const COMISSAO_MIN = 10;
export const COMISSAO_MAX = 30;
/** Abaixo disto a comissão exige aprovação do superior imediato ou da Matriz. */
export const COMISSAO_SEM_APROVACAO_MIN = 20;
/** Acima disto (até o MAX) a comissão é rotulada "Agravo" — só rótulo. */
export const COMISSAO_AGRAVO_MIN = 25;
const MSG_COMISSAO = "Comissão entre 10% e 30%.";

export const comissaoExigeAprovacao = (n: number) => n < COMISSAO_SEM_APROVACAO_MIN;
export const comissaoEhAgravo = (n: number) => n > COMISSAO_AGRAVO_MIN && n <= COMISSAO_MAX;

/** Aceita "" (→ null), número ou string com vírgula/ponto; 10 a 30, até 2 casas. */
const comissaoOpcional = z
  .union([z.literal("").transform(() => null), z.string(), z.number()])
  .nullable()
  .transform((v, ctx) => {
    if (v === null) return null;
    const n = typeof v === "number" ? v : Number(v.trim().replace(",", "."));
    const ok =
      Number.isFinite(n) &&
      n >= COMISSAO_MIN &&
      n <= COMISSAO_MAX &&
      Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
    if (!ok) {
      ctx.addIssue({ code: "custom", message: MSG_COMISSAO });
      return z.NEVER;
    }
    return n;
  });

export const ajusteSeguradoraSchema = z
  .object({
    franquia1: opcional(FRANQUIA_OPCOES),
    franquia2: opcional(FRANQUIA_SEGUNDA_OPCOES),
    vidros: opcional(NIVEL_COBERTURA_OPCOES),
    carroReserva: opcional(NIVEL_COBERTURA_OPCOES),
    comissao: comissaoOpcional.optional().transform((v) => v ?? null),
  })
  .refine((a) => Object.values(a).some((v) => v !== null), {
    message: "Altere ao menos um campo para recalcular com ajuste.",
  });

export type AjusteSeguradora = z.infer<typeof ajusteSeguradoraSchema>;
export type AjusteSeguradoraEntrada = z.input<typeof ajusteSeguradoraSchema>;

/** Resumo legível para a confirmação do recálculo e a Análise do envio. */
export function resumoAjuste(a: {
  franquia1?: string | null;
  franquia2?: string | null;
  vidros?: string | null;
  carroReserva?: string | null;
  comissao?: number | null;
}): string {
  return [
    a.franquia1 && `franquia ${a.franquia1}`,
    a.franquia2 && `2ª franquia ${a.franquia2}`,
    a.vidros && `vidros ${a.vidros}`,
    a.carroReserva && `carro reserva ${a.carroReserva}`,
    a.comissao != null && `comissão ${String(a.comissao).replace(".", ",")}%`,
  ]
    .filter(Boolean)
    .join(", ");
}
