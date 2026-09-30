// Campos do ajuste por seguradora (V12.3.7) compartilhados entre o modal da
// engrenagem (Cálculo) e o bloco "Personalizar por seguradora" (Coberturas).
import {
  FRANQUIA_OPCOES,
  FRANQUIA_SEGUNDA_OPCOES,
  NIVEL_COBERTURA_OPCOES,
} from "@/components/venda/novo-lead/enumsCoberturas";
import type { AjusteSeguradoraEntrada } from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import type { AjusteGuardado } from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";

/** Coberturas globais do Passo 5 (valor inicial dos selects). */
export type CoberturaGlobal = {
  franquia1: string;
  franquia2: string;
  vidros: string;
  carroReserva: string;
};

export type Campo = keyof AjusteSeguradoraEntrada;

export const CAMPOS_AJUSTE: { k: Campo; label: string; opcoes: readonly string[] }[] = [
  { k: "franquia1", label: "1ª opção de franquia", opcoes: FRANQUIA_OPCOES },
  { k: "franquia2", label: "2ª opção de franquia", opcoes: FRANQUIA_SEGUNDA_OPCOES },
  { k: "vidros", label: "Vidros, faróis e retrovisores", opcoes: NIVEL_COBERTURA_OPCOES },
  { k: "carroReserva", label: "Carro reserva", opcoes: NIVEL_COBERTURA_OPCOES },
];

export const validoOuVazio = (v: string, opcoes: readonly string[]) =>
  opcoes.includes(v) ? v : "";

/** Valor exibido de cada campo: o ajuste guardado, senão o global do Passo 5. */
export function valoresIniciais(
  global: CoberturaGlobal,
  guardado?: AjusteGuardado,
): Record<Campo, string> {
  return Object.fromEntries(
    CAMPOS_AJUSTE.map((c) => [c.k, validoOuVazio(guardado?.[c.k] ?? global[c.k], c.opcoes)]),
  ) as Record<Campo, string>;
}

/**
 * Só vira ajuste o que difere do Passo 5 (ou já estava ajustado): o resto
 * segue valendo o global e não sobrescreve nada no envio.
 */
export function entradaDoAjuste(
  valores: Record<Campo, string>,
  global: CoberturaGlobal,
  guardado?: AjusteGuardado,
): AjusteSeguradoraEntrada {
  return Object.fromEntries(
    CAMPOS_AJUSTE.map((c) => {
      const v = valores[c.k];
      const igualGlobal = v === global[c.k] && !guardado?.[c.k];
      return [c.k, v === "" || igualGlobal ? null : v];
    }),
  ) as AjusteSeguradoraEntrada;
}
