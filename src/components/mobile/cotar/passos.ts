import { CAMPOS_OBRIGATORIOS_CALCULO } from "@/components/venda/novo-lead/calculoGate";
import type { Form } from "@/components/venda/novo-lead/types";

export const PASSOS = ["Segurado", "Veículo", "Uso", "Coberturas", "Revisar"] as const;

/** Etapa equivalente do wizard desktop, gravada em `step_atual` (retomada no desktop). */
export const STEP_DESKTOP = [0, 2, 3, 4, 5] as const;

export type Up = <K extends keyof Form>(k: K, v: Form[K]) => void;

/** Campos do gate de cálculo (calculoGate.ts) que cada passo precisa ter preenchidos para avançar. */
export const CAMPOS_POR_PASSO: (keyof Form)[][] = [
  ["cpf", "nome", "sexo", "estadoCivil", "celular", "cep"],
  ["placa"],
  ["kmMensal", "cepPernoite"],
  [],
  [],
];

/** Campos vazios do passo (rótulos do gate). Zod cuida do formato; isto cobre a omissão. */
export function faltantesDoPasso(passo: number, f: Form): string[] {
  const campos = CAMPOS_POR_PASSO[passo] ?? [];
  return CAMPOS_OBRIGATORIOS_CALCULO.filter(
    (c) => campos.includes(c.campo) && !String(f[c.campo] ?? "").trim(),
  ).map((c) => c.label);
}
