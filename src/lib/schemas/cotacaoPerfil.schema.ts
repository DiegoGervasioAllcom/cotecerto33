// Schema zod da etapa "Perfil" do wizard novo-lead (cotacao_perfil).
// Espelha as constraints reais do banco (D1 tamanho + D3 formato) para avisar
// o usuário ANTES de avançar, sem serem mais restritivos: todo campo é
// opcional e só valida formato/tamanho se estiver preenchido.

import { z } from "zod";
import { onlyDigits } from "@/lib/masks";

function optionalDigitsExact(lengths: number[], message: string) {
  return z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || lengths.includes(onlyDigits(v).length), { message });
}

function optionalMax(max: number, message: string) {
  return z.string().max(max, message).optional();
}

export const perfilSchema = z.object({
  condCpf: optionalDigitsExact([11, 14], "CPF do condutor inválido."),
  condNome: optionalMax(150, "Nome do condutor muito longo."),
  condSexo: optionalMax(30, "Campo muito longo."),
  condEstadoCivil: optionalMax(30, "Campo muito longo."),
  condRelacao: optionalMax(50, "Campo muito longo."),
  condNomeSocial: optionalMax(150, "Nome social muito longo."),
  condTempoHabilitacao: optionalMax(10, "Campo muito longo."),
  profissao: optionalMax(150, "Profissão muito longa."),
  cepPernoite: optionalDigitsExact([8], "CEP de pernoite inválido."),
  tipoGaragem: optionalMax(100, "Campo muito longo."),
  relacaoComProprietario: optionalMax(100, "Campo muito longo."),
  proprietarioCpf: optionalDigitsExact([11], "CPF do proprietário inválido."),
  proprietarioCnpj: optionalDigitsExact([14], "CNPJ do proprietário inválido."),
  proprietarioNome: optionalMax(150, "Nome do proprietário muito longo."),
  proprietarioNomeSocial: optionalMax(150, "Nome social muito longo."),
  proprietarioSexo: optionalMax(30, "Campo muito longo."),
  proprietarioEstadoCivil: optionalMax(30, "Campo muito longo."),
  tipoResidencia: optionalMax(30, "Campo muito longo."),
  tipoAtividadeEmpresa: optionalMax(30, "Campo muito longo."),
  ramoAtividade: optionalMax(150, "Campo muito longo."),
  profissaoPrincipalCondutor: optionalMax(150, "Profissão muito longa."),
});

export type PerfilFormValues = z.infer<typeof perfilSchema>;
