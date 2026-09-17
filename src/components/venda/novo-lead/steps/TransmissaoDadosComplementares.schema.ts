import { z } from "zod";

export const dadosComplementaresTransmissaoSchema = z.object({
  rg: z.string().trim().min(1, "Informe o RG.").max(20, "RG muito longo."),
  dataEmissaoRg: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato dd/mm/aaaa."),
  orgaoEmissorRg: z.string().trim().min(1, "Informe o órgão emissor.").max(20),
  cepResidencial: z.string().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
  numeroEndereco: z.string().trim().min(1, "Informe o número."),
  mesmoEnderecoCorrespondencia: z.literal(true, {
    invalid_type_error: "A transmissão automática usa o endereço residencial para correspondência.",
  }),
  renavam: z.string().regex(/^\d{9,11}$/, "Informe um Renavam com 9 a 11 dígitos."),
  corVeiculo: z.string().trim().min(1, "Informe a cor."),
  diaVencimentoDemaisParcelas: z.string().regex(/^(?:[1-9]|[12]\d|30)$/, "Escolha um dia."),
  desejaReceberPropostaPorEmail: z.enum(["Sim", "Não"], {
    invalid_type_error: "Escolha Sim ou Não.",
  }),
});

export type DadosComplementaresTransmissao = z.infer<typeof dadosComplementaresTransmissaoSchema>;
