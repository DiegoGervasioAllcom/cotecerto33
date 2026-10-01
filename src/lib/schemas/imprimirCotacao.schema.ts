import { z } from "zod";

/**
 * Formulário "Configurar impressão" do modal `ImprimirCotacaoModal`
 * (Frente 3 V12 · 7a). Espelha `printCfg()` do protótipo V12, sem os campos
 * de envio; `comComissao` liga o documento interno (fatia B).
 */
/** Máximo de seguradoras no mesmo documento impresso. */
export const IMPRIMIR_COTACAO_MAX_SEGURADORAS = 3;

export const imprimirCotacaoConfigSchema = z.object({
  modelo: z.enum(["supper", "cia"]),
  tipo: z.enum(["resumida", "detalhada"]),
  seguradorasSelecionadas: z
    .array(z.string().min(1))
    .min(1, "Escolha ao menos uma seguradora")
    .max(
      IMPRIMIR_COTACAO_MAX_SEGURADORAS,
      `Escolha no máximo ${IMPRIMIR_COTACAO_MAX_SEGURADORAS} seguradoras`,
    ),
  parcelas: z.array(z.number().int().min(1).max(12)).min(1, "Escolha ao menos uma parcela"),
  economia: z.boolean(),
  colunado: z.boolean(),
  /** Documento interno com o % da corretora — nunca vai a cliente. */
  comComissao: z.boolean(),
});

export type ImprimirCotacaoConfig = z.infer<typeof imprimirCotacaoConfigSchema>;

export const IMPRIMIR_COTACAO_PARCELAS_PADRAO = Array.from({ length: 12 }, (_, i) => i + 1);
