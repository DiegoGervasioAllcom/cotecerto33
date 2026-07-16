// Schema zod da etapa "Seguro" do wizard novo-lead (cotacao_seguro).
// Espelha as constraints reais do banco (D1 tamanho — cotacao_seguro não tem
// checks de formato D3): todo campo é opcional e só valida tamanho se
// preenchido, sem tornar nenhum campo obrigatório.

import { z } from "zod";

function optionalMax(max: number, message: string) {
  return z.string().max(max, message).optional();
}

export const seguroSchema = z.object({
  tipoSeguro: optionalMax(50, "Tipo de seguro muito longo."),
  categoria: optionalMax(50, "Categoria muito longa."),
  ramo: optionalMax(150, "Ramo muito longo."),
  ciaAtual: optionalMax(150, "Companhia atual muito longa."),
  ciAtual: optionalMax(150, "Corretora atual muito longa."),
  classeBonus: optionalMax(150, "Classe bônus muito longa."),
  apoliceAtual: optionalMax(50, "Apólice atual muito longa."),
});

export type SeguroFormValues = z.infer<typeof seguroSchema>;
