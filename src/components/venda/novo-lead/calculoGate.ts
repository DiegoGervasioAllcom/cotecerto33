import type { Form } from "./types";

// R.9 (revisão form vs robô Quiver, 2026-08): o gate reflete os campos que
// o robô Playwright exige de fato — ele identifica o veículo pela placa via
// FIPE do portal da seguradora, não usa marca/modelo/anoModelo (que
// continuam sendo coletados na tela, só não bloqueiam mais o cálculo).
export const CAMPOS_OBRIGATORIOS_CALCULO: { campo: keyof Form; label: string }[] = [
  { campo: "cpf", label: "CPF" },
  { campo: "nome", label: "Nome completo" },
  { campo: "sexo", label: "Sexo" },
  { campo: "estadoCivil", label: "Estado civil" },
  { campo: "placa", label: "Placa" },
  { campo: "email", label: "E-mail" },
  { campo: "cep", label: "CEP" },
  { campo: "celular", label: "Telefone celular" },
  { campo: "cepPernoite", label: "CEP de pernoite" },
  { campo: "kmMensal", label: "Km mensal" },
];

/** Rótulos dos campos que faltam para liberar o Calcular. O portal não usa
 * "CEP circulação" (invisível em todos os usos), então nunca é exigido. */
export function camposFaltantesCalculo(f: Pick<Form, "seguradorasSel"> & Partial<Form>): string[] {
  const full = f as Form;
  const faltantes = CAMPOS_OBRIGATORIOS_CALCULO.filter((c) => !full[c.campo]).map((c) => c.label);
  if ((f.seguradorasSel?.length ?? 0) === 0) faltantes.push("Seguradoras selecionadas");
  return faltantes;
}
