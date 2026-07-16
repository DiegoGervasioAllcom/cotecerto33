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
  profissao: optionalMax(150, "Profissão muito longa."),
  cepPernoite: optionalDigitsExact([8], "CEP de pernoite inválido."),
});

export type PerfilFormValues = z.infer<typeof perfilSchema>;
