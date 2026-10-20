import { z } from "zod";
import { erroTelefoneFixo } from "@/lib/telefone-fixo";
import { erroVencimentoTokio } from "@/lib/transmissao-tokio";
import {
  PEP_PORTO,
  RENDAS_MENSAIS_PORTO,
  RENDAS_MENSAIS_TOKIO,
} from "@/components/venda/novo-lead/enumsPorto";
import { RAMOS_ATIVIDADE_PORTO } from "@/components/venda/novo-lead/enumsRamoAtividade";

// Espelha as colunas endereco_corresp_* de `proposta_dados_complementares`
// (migration 20260908152312) — só são exigidas quando o segurado usa um
// endereço de correspondência diferente do residencial.
const enderecoCorrespondenciaSchema = z.object({
  cep: z.string(),
  logradouro: z.string(),
  numero: z.string().max(10, "Número muito longo (máx. 10)."),
  complemento: z.string().trim().max(30, "Complemento muito longo (máx. 30).").optional(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
});

const camposBase = z.object({
  rg: z.string().trim().min(1, "Informe o RG.").max(20, "RG muito longo."),
  dataEmissaoRg: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato dd/mm/aaaa."),
  orgaoEmissorRg: z.string().trim().min(1, "Informe o órgão emissor.").max(20),
  cepResidencial: z.string().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
  numeroEndereco: z
    .string()
    .trim()
    .min(1, "Informe o número.")
    .max(10, "Número muito longo (máx. 10)."),
  complementoEndereco: z.string().trim().max(30, "Complemento muito longo (máx. 30).").optional(),
  // Obrigatório só aqui (opcional no passo 1). Bloqueio real é no servidor.
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .max(254, "E-mail muito longo.")
    .email("E-mail inválido."),
  mesmoEnderecoCorrespondencia: z.boolean(),
  enderecoCorrespondencia: enderecoCorrespondenciaSchema,
  renavam: z.string().regex(/^\d{9,11}$/, "Informe um Renavam com 9 a 11 dígitos."),
  corVeiculo: z.string().trim().min(1, "Informe a cor."),
  diaVencimentoDemaisParcelas: z.string().regex(/^(?:[1-9]|[12]\d|30)$/, "Escolha um dia."),
  desejaReceberPropostaPorEmail: z.enum(["Sim", "Não"], {
    invalid_type_error: "Escolha Sim ou Não.",
  }),
  // Declarações do cliente exigidas só na Efetivação da Porto (ver
  // `exigePorto` abaixo). NUNCA têm valor padrão: o robô não assume essas
  // respostas pelo cliente. Não são persistidas (ver useRetomarTransmissao:
  // "nenhuma fonte com dado pessoal") — vivem só no estado do passo.
  // União das opções (Porto + Tokio): cada seguradora restringe no refinamento abaixo.
  rendaMensal: z.enum(RENDAS_MENSAIS_TOKIO).optional(),
  // Sem `.max`: o limite é a própria lista fechada (alguns ramos do portal
  // passam de 100 caracteres — o maior tem 137). Ver `RAMOS_ATIVIDADE_PORTO`.
  ramoAtividade: z.string().trim().optional(),
  pessoaPoliticamenteExposta: z.enum(PEP_PORTO).optional(),
  // Telefones FIXOS opcionais (só Porto; ver `@/lib/telefone-fixo`). Vazio é válido.
  dddTelefoneResidencial: z.string().optional(),
  telefoneResidencial: z.string().optional(),
  dddTelefoneComercial: z.string().optional(),
  telefoneComercial: z.string().optional(),
  // Tokio: vencimento da 1ª parcela / do boleto (dd/mm/aaaa). Ignorado nas outras seguradoras.
  vencimentoPrimeiraParcela: z.string().optional(),
});

// A Efetivação da Tokio NÃO tem estes campos (sem RG, renavam, cor, chassi nem ramo): deixam de ser obrigatórios.
const camposBaseTokio = camposBase.partial({
  rg: true,
  dataEmissaoRg: true,
  orgaoEmissorRg: true,
  renavam: true,
  corVeiculo: true,
  diaVencimentoDemaisParcelas: true,
  desejaReceberPropostaPorEmail: true,
});

type OpcoesSchema = {
  /** true quando a seguradora do card é a Porto: renda, ramo e PEP viram obrigatórios. */
  exigePorto: boolean;
  /** Tokio: renda, PEP, vencimento e telefone fixo; sem RG/renavam/cor. */
  exigeTokio?: boolean;
};

export function criarSchemaDadosComplementares({ exigePorto, exigeTokio = false }: OpcoesSchema) {
  // O cast mantém o tipo de saída (strict) do schema geral: na Tokio o estado do formulário sempre traz esses
  // campos (strings vazias), só a obrigatoriedade deixa de valer em tempo de execução.
  const base = (exigeTokio ? camposBaseTokio : camposBase) as unknown as typeof camposBase;
  return base.superRefine((val, ctx) => {
    if (exigeTokio) {
      const add = (campo: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message });
      if (
        !val.rendaMensal ||
        !(RENDAS_MENSAIS_TOKIO as readonly string[]).includes(val.rendaMensal)
      ) {
        add("rendaMensal", "Informe a renda mensal.");
      }
      if (!val.pessoaPoliticamenteExposta) {
        add("pessoaPoliticamenteExposta", "Informe se é pessoa politicamente exposta.");
      }
      const erroVenc = erroVencimentoTokio(val.vencimentoPrimeiraParcela);
      if (erroVenc) add("vencimentoPrimeiraParcela", erroVenc);
      const erroTel = erroTelefoneFixo(
        val.dddTelefoneResidencial,
        val.telefoneResidencial,
        "residencial",
      );
      if (erroTel) add("telefoneResidencial", erroTel);
    }
    if (exigePorto) {
      if (
        !val.rendaMensal ||
        !(RENDAS_MENSAIS_PORTO as readonly string[]).includes(val.rendaMensal)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rendaMensal"],
          message: "Informe a renda mensal.",
        });
      }
      if (!val.pessoaPoliticamenteExposta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pessoaPoliticamenteExposta"],
          message: "Informe se é pessoa politicamente exposta.",
        });
      }
      // O robô só aceita o texto exato do portal: o ramo precisa ser um item
      // da lista fechada (não texto livre).
      if (!val.ramoAtividade || !RAMOS_ATIVIDADE_PORTO.includes(val.ramoAtividade)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ramoAtividade"],
          message: "Escolha o ramo de atividade na lista.",
        });
      }
      const telefones = [
        ["telefoneResidencial", val.dddTelefoneResidencial, val.telefoneResidencial, "residencial"],
        ["telefoneComercial", val.dddTelefoneComercial, val.telefoneComercial, "comercial"],
      ] as const;
      for (const [campo, ddd, numero, rotulo] of telefones) {
        const erro = erroTelefoneFixo(ddd, numero, rotulo);
        if (erro) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: erro });
      }
    }

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
}

/** Seguradoras em geral (renda/ramo/PEP opcionais e ignorados). */
export const dadosComplementaresTransmissaoSchema = criarSchemaDadosComplementares({
  exigePorto: false,
});

/** Campos do formulário geral que a Efetivação da Tokio NÃO tem (o estado do form os guarda como ""). */
const CAMPOS_AUSENTES_NA_TOKIO = [
  "rg",
  "dataEmissaoRg",
  "orgaoEmissorRg",
  "renavam",
  "corVeiculo",
  "diaVencimentoDemaisParcelas",
  "desejaReceberPropostaPorEmail",
] as const;

/**
 * Valida os dados da Tokio. Os campos que ela não tem saem ANTES: com "" (o valor do estado do form) as regras
 * deles (regex, min 1) rodariam mesmo sendo opcionais e recusariam um campo que nem aparece na tela. O que
 * volta traz esses campos como "" para manter o formato que o resto do app espera.
 */
export function validarDadosComplementaresTokio(dados: DadosComplementaresTransmissao) {
  const copia: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_AUSENTES_NA_TOKIO) delete copia[campo];
  const r = dadosComplementaresTransmissaoTokioSchema.safeParse(copia);
  if (!r.success) return r;
  return {
    success: true as const,
    data: {
      ...r.data,
      rg: "",
      dataEmissaoRg: "",
      orgaoEmissorRg: "",
      renavam: "",
      corVeiculo: "",
      diaVencimentoDemaisParcelas: "",
      desejaReceberPropostaPorEmail: dados.desejaReceberPropostaPorEmail,
    } as DadosComplementaresTransmissao,
  };
}

/**
 * Tokio: renda, PEP e vencimento obrigatórios; RG, renavam e cor não existem na Efetivação dela. NÃO exportado de
 * propósito: o tipo é o do schema geral (cast), então só `validarDadosComplementaresTokio` pode chamá-lo — ele tira os
 * campos ausentes antes de validar.
 */
const dadosComplementaresTransmissaoTokioSchema = criarSchemaDadosComplementares({
  exigePorto: false,
  exigeTokio: true,
});

/** Porto: renda, ramo de atividade e PEP obrigatórios. */
export const dadosComplementaresTransmissaoPortoSchema = criarSchemaDadosComplementares({
  exigePorto: true,
});

export type DadosComplementaresTransmissao = z.infer<typeof dadosComplementaresTransmissaoSchema>;
