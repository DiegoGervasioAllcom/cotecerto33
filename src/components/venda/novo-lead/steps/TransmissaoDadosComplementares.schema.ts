import { z } from "zod";

// Espelha as colunas endereco_corresp_* de `proposta_dados_complementares`
// (migration 20260908152312) — só são exigidas quando o segurado usa um
// endereço de correspondência diferente do residencial.
const enderecoCorrespondenciaSchema = z.object({
  cep: z.string(),
  logradouro: z.string(),
  numero: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
});

export const dadosComplementaresTransmissaoSchema = z
  .object({
    rg: z.string().trim().min(1, "Informe o RG.").max(20, "RG muito longo."),
    dataEmissaoRg: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato dd/mm/aaaa."),
    orgaoEmissorRg: z.string().trim().min(1, "Informe o órgão emissor.").max(20),
    cepResidencial: z.string().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
    numeroEndereco: z.string().trim().min(1, "Informe o número."),
    mesmoEnderecoCorrespondencia: z.boolean(),
    enderecoCorrespondencia: enderecoCorrespondenciaSchema,
    renavam: z.string().regex(/^\d{9,11}$/, "Informe um Renavam com 9 a 11 dígitos."),
    corVeiculo: z.string().trim().min(1, "Informe a cor."),
    diaVencimentoDemaisParcelas: z.string().regex(/^(?:[1-9]|[12]\d|30)$/, "Escolha um dia."),
    desejaReceberPropostaPorEmail: z.enum(["Sim", "Não"], {
      invalid_type_error: "Escolha Sim ou Não.",
    }),
  })
  .superRefine((val, ctx) => {
    // Endereço residencial já é validado acima (cepResidencial/numeroEndereco)
    // — aqui só valida o de correspondência, e só quando ele é usado de fato.
    if (val.mesmoEnderecoCorrespondencia) return;
    const e = val.enderecoCorrespondencia;
    const campo = (chave: keyof typeof e, mensagem: string) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enderecoCorrespondencia", chave],
        message: mensagem,
      });
    };
    if (!/^\d{5}-?\d{3}$/.test(e.cep)) campo("cep", "Informe um CEP válido.");
    if (!e.logradouro.trim()) campo("logradouro", "Informe o endereço.");
    if (!e.numero.trim()) campo("numero", "Informe o número.");
    if (!e.bairro.trim()) campo("bairro", "Informe o bairro.");
    if (!e.cidade.trim()) campo("cidade", "Informe a cidade.");
    if (e.uf.trim().length !== 2) campo("uf", "Use a sigla do estado (2 letras).");
  });

export type DadosComplementaresTransmissao = z.infer<typeof dadosComplementaresTransmissaoSchema>;
