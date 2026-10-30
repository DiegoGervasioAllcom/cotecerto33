import { z } from "zod";
import { erroTelefoneFixo } from "@/lib/telefone-fixo";
import { erroVencimentoTokio } from "@/lib/transmissao-tokio";
import {
  PEP_PORTO,
  RENDAS_MENSAIS_ALLIANZ,
  RENDAS_MENSAIS_PORTO,
  RENDAS_MENSAIS_TOKIO,
} from "@/components/venda/novo-lead/enumsPorto";
import { errosDadosBradesco, RENDAS_MENSAIS_BRADESCO } from "@/lib/transmissao-bradesco";
import { errosDadosMapfre, RENDAS_MENSAIS_MAPFRE } from "@/lib/transmissao-mapfre";
import { RAMOS_ATIVIDADE_ALLIANZ } from "@/components/venda/novo-lead/enumsRamoAtividadeAllianz";
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
  rendaMensal: z
    .enum([
      ...RENDAS_MENSAIS_TOKIO,
      ...RENDAS_MENSAIS_ALLIANZ,
      ...RENDAS_MENSAIS_MAPFRE,
      ...RENDAS_MENSAIS_BRADESCO,
    ])
    .optional(),
  // Só Mapfre: tipo do documento (declaração do vendedor, sem padrão), kit da apólice por e-mail e em nome de quem sai o certificado.
  tipoDocumento: z.string().trim().optional(),
  kitApolicePorEmail: z.enum(["Sim", "Não"]).optional(),
  certificadoEmNomeDe: z.string().trim().max(60, "Nome muito longo (máx. 60).").optional(),
  // Só Allianz: "Veículo Alienado" (do cadastro do veículo; o vendedor pode corrigir).
  veiculoAlienado: z.enum(["Sim", "Não"]).optional(),
  // Sem `.max`: o limite é a própria lista fechada (alguns ramos do portal
  // passam de 100 caracteres — o maior tem 137). Ver `RAMOS_ATIVIDADE_PORTO`.
  ramoAtividade: z.string().trim().optional(),
  pessoaPoliticamenteExposta: z.enum(PEP_PORTO).optional(),
  // Só Tokio: tipo do logradouro deduzido do endereço do CEP (Rua, Avenida…); o portal nem sempre o preenche sozinho.
  tipoLogradouro: z.string().trim().max(40).optional(),
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

// Mapfre: sem RG (número), renavam nem cor. O órgão emissor dela tem texto longo ("MAE - MIN. DA AERONAUTICA").
const camposBaseMapfre = camposBase
  .partial({ rg: true, renavam: true, corVeiculo: true, diaVencimentoDemaisParcelas: true })
  .extend({ orgaoEmissorRg: z.string().trim().min(1, "Informe o órgão emissor.").max(40) });

// Bradesco: documento e órgão vêm do cadastro no portal; sem renavam nem cor.
const camposBaseBradesco = camposBase.partial({
  rg: true,
  dataEmissaoRg: true,
  orgaoEmissorRg: true,
  renavam: true,
  corVeiculo: true,
  diaVencimentoDemaisParcelas: true,
});

type OpcoesSchema = {
  /** true quando a seguradora do card é a Porto: renda, ramo e PEP viram obrigatórios. */
  exigePorto: boolean;
  /** Tokio: renda, PEP, vencimento e telefone fixo; sem RG/renavam/cor. */
  exigeTokio?: boolean;
  /** Allianz: faixa de renda, ramo e veículo alienado; sem RG/renavam/cor/PEP. */
  exigeAllianz?: boolean;
  /** Mapfre: tipo de documento, emissão, órgão, ramo e renda (sem padrão); sem RG/renavam/cor. */
  exigeMapfre?: boolean;
  /** Bradesco: ramo, renda e tipo de logradouro (sem padrão); sem documento/renavam/cor. */
  exigeBradesco?: boolean;
};

export function criarSchemaDadosComplementares({
  exigePorto,
  exigeTokio = false,
  exigeAllianz = false,
  exigeMapfre = false,
  exigeBradesco = false,
}: OpcoesSchema) {
  // O cast mantém o tipo de saída (strict) do schema geral: na Tokio o estado do formulário sempre traz esses
  // campos (strings vazias), só a obrigatoriedade deixa de valer em tempo de execução.
  const base = (exigeBradesco
    ? camposBaseBradesco
    : exigeMapfre
      ? camposBaseMapfre
      : exigeTokio || exigeAllianz
        ? camposBaseTokio
        : camposBase) as unknown as typeof camposBase;
  return base.superRefine((val, ctx) => {
    if (exigeBradesco) {
      for (const [campo, message] of Object.entries(errosDadosBradesco(val))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message });
      }
    }
    if (exigeMapfre) {
      for (const [campo, message] of Object.entries(errosDadosMapfre(val))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message });
      }
    }
    if (exigeAllianz) {
      const add = (campo: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message });
      if (
        !val.rendaMensal ||
        !(RENDAS_MENSAIS_ALLIANZ as readonly string[]).includes(val.rendaMensal)
      ) {
        add("rendaMensal", "Informe a faixa de renda.");
      }
      if (!val.ramoAtividade || !RAMOS_ATIVIDADE_ALLIANZ.includes(val.ramoAtividade)) {
        add("ramoAtividade", "Escolha o ramo de atividade na lista.");
      }
    }
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

/** Campos do formulário geral que a Efetivação da Allianz NÃO tem (o estado do form os guarda como ""). */
const CAMPOS_AUSENTES_NA_ALLIANZ = [
  "rg",
  "dataEmissaoRg",
  "orgaoEmissorRg",
  "renavam",
  "corVeiculo",
] as const;

/**
 * Valida os dados da Allianz (mesma técnica da Tokio: os campos que ela não tem saem ANTES da validação, e voltam
 * como ""). O dia de vencimento das demais parcelas é opcional aqui (só vale no parcelado) — vazio sai antes da regex.
 */
export function validarDadosComplementaresAllianz(dados: DadosComplementaresTransmissao) {
  const copia: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_AUSENTES_NA_ALLIANZ) delete copia[campo];
  if (!dados.diaVencimentoDemaisParcelas) delete copia.diaVencimentoDemaisParcelas;
  const r = dadosComplementaresTransmissaoAllianzSchema.safeParse(copia);
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
      diaVencimentoDemaisParcelas: dados.diaVencimentoDemaisParcelas ?? "",
      desejaReceberPropostaPorEmail: dados.desejaReceberPropostaPorEmail,
    } as DadosComplementaresTransmissao,
  };
}

/** Campos do formulário geral que a Efetivação da Mapfre NÃO tem (o estado do form os guarda como ""). */
const CAMPOS_AUSENTES_NA_MAPFRE = [
  "rg",
  "renavam",
  "corVeiculo",
  "diaVencimentoDemaisParcelas",
] as const;

/**
 * Valida os dados da Mapfre (mesma técnica: campos que ela não tem saem ANTES e voltam como ""). Tipo de documento,
 * data de emissão, órgão, ramo e renda são obrigatórios e sem valor padrão.
 */
export function validarDadosComplementaresMapfre(dados: DadosComplementaresTransmissao) {
  const copia: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_AUSENTES_NA_MAPFRE) delete copia[campo];
  const r = dadosComplementaresTransmissaoMapfreSchema.safeParse(copia);
  if (!r.success) return r;
  return {
    success: true as const,
    data: {
      ...r.data,
      rg: "",
      renavam: "",
      corVeiculo: "",
      diaVencimentoDemaisParcelas: "",
      desejaReceberPropostaPorEmail: dados.desejaReceberPropostaPorEmail,
    } as DadosComplementaresTransmissao,
  };
}

/** Campos do formulário geral que a Efetivação da Bradesco NÃO tem (o estado do form os guarda como ""). */
const CAMPOS_AUSENTES_NA_BRADESCO = [
  "rg",
  "dataEmissaoRg",
  "orgaoEmissorRg",
  "renavam",
  "corVeiculo",
  "diaVencimentoDemaisParcelas",
] as const;

/**
 * Valida os dados da Bradesco (mesma técnica: campos que ela não tem saem ANTES e voltam como ""). Ramo, renda e tipo
 * de logradouro são obrigatórios e sem valor padrão.
 */
export function validarDadosComplementaresBradesco(dados: DadosComplementaresTransmissao) {
  const copia: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_AUSENTES_NA_BRADESCO) delete copia[campo];
  const r = dadosComplementaresTransmissaoBradescoSchema.safeParse(copia);
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

/** Não exportado: só `validarDadosComplementaresBradesco` pode chamá-lo (ele tira os campos ausentes antes). */
const dadosComplementaresTransmissaoBradescoSchema = criarSchemaDadosComplementares({
  exigePorto: false,
  exigeBradesco: true,
});

/** Não exportado: só `validarDadosComplementaresMapfre` pode chamá-lo (ele tira os campos ausentes antes). */
const dadosComplementaresTransmissaoMapfreSchema = criarSchemaDadosComplementares({
  exigePorto: false,
  exigeMapfre: true,
});

/** Não exportado: só `validarDadosComplementaresAllianz` pode chamá-lo (ele tira os campos ausentes antes). */
const dadosComplementaresTransmissaoAllianzSchema = criarSchemaDadosComplementares({
  exigePorto: false,
  exigeAllianz: true,
});

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
