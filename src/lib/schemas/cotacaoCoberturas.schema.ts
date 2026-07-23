// Schema zod da etapa "Coberturas" do wizard novo-lead (cotacao_coberturas).
// Espelha as constraints reais do banco (D1 tamanho — cotacao_coberturas não
// tem checks de formato D3): todo campo é opcional e só valida tamanho se
// preenchido, sem tornar nenhum campo obrigatório.

import { z } from "zod";

function optionalMax(max: number, message: string) {
  return z.string().max(max, message).optional();
}

export const coberturasSchema = z.object({
  tipoCobertura: optionalMax(50, "Tipo de cobertura muito longo."),
  casco: optionalMax(100, "Casco muito longo."),
  cascoValor: optionalMax(100, "Valor determinado muito longo."),
  franquia: optionalMax(100, "Franquia muito longa."),
  appMorte: optionalMax(100, "APP — Morte muito longo."),
  appInvalidez: optionalMax(100, "APP — Invalidez muito longo."),
  dmh: optionalMax(100, "DMH muito longo."),
  rcfDm: optionalMax(100, "RCF — Danos materiais muito longo."),
  rcfDc: optionalMax(100, "RCF — Danos corporais muito longo."),
  carroReserva: optionalMax(30, "Carro reserva muito longo."),
  assist24: optionalMax(30, "Assistência 24h muito longa."),
  modalidade: optionalMax(50, "Modalidade muito longa."),
  percentualAjuste: optionalMax(10, "Percentual de ajuste muito longo."),
  franquiaPrimeiraOpcao: optionalMax(30, "Campo muito longo."),
  franquiaSegundaOpcao: optionalMax(30, "Campo muito longo."),
  danosMorais: optionalMax(100, "Danos morais muito longo."),
  despesasExtras: optionalMax(30, "Despesas extras muito longo."),
  maisAssistenciasSeguradora: optionalMax(50, "Campo muito longo."),
});

export type CoberturasFormValues = z.infer<typeof coberturasSchema>;
