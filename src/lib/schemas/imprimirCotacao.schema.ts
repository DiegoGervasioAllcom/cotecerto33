import { z } from "zod";

/**
 * Formulário "Configurar impressão" do modal `ImprimirCotacaoModal`
 * (Frente 3 V12 · 7a). Espelha `printCfg()` do protótipo V12, sem os campos
 * de comissão/envio (fora de escopo desta fatia — ver `src/lib/print.ts`).
 */
export const imprimirCotacaoConfigSchema = z.object({
  modelo: z.enum(["supper", "cia"]),
  tipo: z.enum(["resumida", "detalhada"]),
  seguradorasSelecionadas: z.array(z.string().min(1)).min(1, "Escolha ao menos uma seguradora"),
  parcelas: z.array(z.number().int().min(1).max(12)).min(1, "Escolha ao menos uma parcela"),
  economia: z.boolean(),
  colunado: z.boolean(),
});

export type ImprimirCotacaoConfig = z.infer<typeof imprimirCotacaoConfigSchema>;

export const IMPRIMIR_COTACAO_PARCELAS_PADRAO = Array.from({ length: 12 }, (_, i) => i + 1);
