// Schema zod da etapa "Veículo" do wizard novo-lead (cotacao_veiculo).
// Espelha as constraints reais do banco (D1 tamanho — cotacao_veiculo não tem
// checks de formato D3): todo campo é opcional e só valida tamanho se
// preenchido, sem tornar nenhum campo obrigatório.

import { z } from "zod";

function optionalMax(max: number, message: string) {
  return z.string().max(max, message).optional();
}

export const veiculoSchema = z.object({
  placa: optionalMax(8, "Placa muito longa."),
  chassi: optionalMax(17, "Chassi muito longo."),
  renavam: optionalMax(11, "Renavam muito longo."),
  marcaCodigo: optionalMax(20, "Código da marca muito longo."),
  modeloCodigo: optionalMax(20, "Código do modelo muito longo."),
  marcaNome: optionalMax(150, "Marca muito longa."),
  modeloNome: optionalMax(150, "Modelo muito longo."),
  anoModelo: optionalMax(4, "Ano modelo inválido."),
  anoFab: optionalMax(4, "Ano fabricação inválido."),
  combustivel: optionalMax(50, "Combustível muito longo."),
  cor: optionalMax(50, "Cor muito longa."),
  banco: optionalMax(150, "Banco/financeira muito longo."),
  usoComercial: optionalMax(50, "Campo muito longo."),
  kmMensal: optionalMax(100, "KM mensal muito longo."),
  fipeValor: optionalMax(100, "Valor FIPE muito longo."),
  // Uso do veículo / dados complementares (espelha cotacao_veiculo — G2.1)
  tipoUso: optionalMax(100, "Tipo de uso muito longo."),
  usoTrabalho: optionalMax(150, "Campo muito longo."),
  usoEstudo: optionalMax(150, "Campo muito longo."),
  categoriaTaxi: optionalMax(50, "Categoria de táxi muito longa."),
  utilizacaoLocadora: optionalMax(100, "Campo muito longo."),
  condutoresQueUtilizam: optionalMax(100, "Campo muito longo."),
  cepCirculacao: optionalMax(20, "CEP de circulação inválido."),
  numPassageiros: optionalMax(10, "Número de passageiros inválido."),
  leilao: optionalMax(150, "Campo muito longo."),
  isencaoImposto: optionalMax(50, "Isenção de imposto muito longa."),
  valorAdaptacaoPcd: optionalMax(50, "Valor de adaptação PcD muito longo."),
  antifurto: optionalMax(50, "Antifurto muito longo."),
  coberturaBlindagem: optionalMax(150, "Cobertura de blindagem muito longa."),
  valorBlindagem: optionalMax(50, "Valor de blindagem muito longo."),
  valorKitGas: optionalMax(50, "Valor de kit gás muito longo."),
});

export type VeiculoFormValues = z.infer<typeof veiculoSchema>;
