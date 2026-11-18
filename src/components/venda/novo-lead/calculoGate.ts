import { DADOS_CAMPOS, PERFIL_CAMPOS, USO_CAMPOS, type Form } from "./types";

// R.9 (revisão form vs robô Quiver, 2026-08): o gate reflete os campos que
// o robô Playwright exige de fato — ele identifica o veículo pela placa via
// FIPE do portal da seguradora, não usa marca/modelo/anoModelo (que
// continuam sendo coletados na tela, só não bloqueiam mais o cálculo).
export const CAMPOS_OBRIGATORIOS_CALCULO: { campo: keyof Form; label: string }[] = [
  { campo: "cpf", label: "CPF" },
  { campo: "nome", label: "Nome completo" },
  { campo: "nasc", label: "Data de nascimento" },
  { campo: "sexo", label: "Sexo" },
  { campo: "estadoCivil", label: "Estado civil" },
  { campo: "placa", label: "Placa" },
  { campo: "cep", label: "CEP" },
  { campo: "celular", label: "Telefone celular" },
  { campo: "cepPernoite", label: "CEP de pernoite" },
  { campo: "kmMensal", label: "Km mensal" },
];

/** Rótulos dos campos que faltam para liberar o Calcular. O portal não usa
 * "CEP circulação" (invisível em todos os usos), então nunca é exigido. */
export function camposFaltantesCalculo(f: Pick<Form, "seguradorasSel"> & Partial<Form>): string[] {
  const full = f as Form;
  // CEP de pernoite precisa estar completo (8 dígitos); parcial conta como não preenchido.
  const faltantes = CAMPOS_OBRIGATORIOS_CALCULO.filter((c) =>
    c.campo === "cepPernoite"
      ? (full.cepPernoite ?? "").replace(/\D/g, "").length !== 8
      : !full[c.campo],
  ).map((c) => c.label);
  // Zero km: o robô exige data de saída e odômetro (só então; sem zeroKm os
  // campos escondidos são ignorados). Não bloqueia etapa, só o Calcular.
  if (full.zeroKmEscolhido === false) faltantes.push("Zero KM");
  // Perfil: cada pergunta precisa ter sido respondida (Selecione → opção).
  if (full.perfilEscolhido) {
    for (const c of PERFIL_CAMPOS) if (!full.perfilEscolhido[c.chave]) faltantes.push(c.label);
  }
  if (full.zeroKm) {
    if (!full.dataSaidaConcessionaria?.trim()) faltantes.push("Data de saída da concessionária");
    if (!full.odometro?.trim()) faltantes.push("Odômetro (km)");
  }
  if (full.dadosEscolhidos) {
    for (const c of DADOS_CAMPOS) if (!full.dadosEscolhidos[c.chave]) faltantes.push(c.label);
  }
  // Uso do veículo: "uso comercial" só existe (e só é exigido) para finalidade Particular.
  if (full.usoEscolhido) {
    for (const c of USO_CAMPOS) {
      if (c.chave === "comercial" && full.tipoUso !== "Particular") continue;
      if (!full.usoEscolhido[c.chave]) faltantes.push(c.label);
    }
  }
  if ((f.seguradorasSel?.length ?? 0) === 0) faltantes.push("Seguradoras selecionadas");
  return faltantes;
}
