// Constantes da tela "Acessos e permissões".
import type { CltConfig } from "./types";

export const SEGURADORAS = [
  "Ituran",
  "Porto Seguro",
  "Azul Seguros",
  "Bradesco Seguros",
  "SulAmérica",
  "HDI",
  "Allianz",
  "Mapfre",
  "Tokio Marine",
  "Liberty",
  "Itaú",
  "Zurich",
];

export const CLT_DEFAULT: CltConfig = {
  progressiva: [],
  fator_novas: [],
  fator_remalho: [],
  seguradora_planos: [],
  seguradora_adic: [],
  regras: {
    apuracao_ini: "26",
    apuracao_fim: "25",
    pagamento: "5º dia útil",
    iof: "7,38%",
    rules: [],
  },
};

export const FAIXAS: Array<[string, string]> = [
  ["Faixa 1", "8"],
  ["Faixa 2", "12"],
  ["Faixa 3", "16"],
  ["Faixa 4", "20"],
];

export const PARAMS = [
  { k: "leads", l: "Leads · média/dia útil" },
  { k: "comVenda", l: "Comissão de venda" },
  { k: "comRenov", l: "Comissão na renovação" },
  { k: "incentivo", l: "Incentivo comercial" },
  { k: "software", l: "Taxa de software" },
  { k: "franquia", l: "Taxa de franquia" },
  { k: "royalties", l: "Royalties + FPP" },
];

// Campos puramente internos (id técnico, enum de roteamento) que nunca
// aparecem no "Formulário completo" do protótipo — o tipo já vem como chip
// no cabeçalho do modal, e o _user_id não interessa a quem está analisando.
export const FORM_INTERNAL_KEYS = ["tipo", "_user_id"] as const;

// Ordem e rótulos dos campos do "Formulário completo", espelhando os arrays
// PJ/PF do protótipo v10 (ver PENDING[].form em cotecerto_prototipo_v10.html)
// — cada tipo tem sua própria ordem e rótulos (ex.: "Chave Pix (conta PJ)"
// só existe na variante PJ).
export const FORM_FIELDS_BY_TIPO: Record<"pj" | "pf", Array<[string, string]>> = {
  pj: [
    ["nome", "Razão Social"],
    ["documento", "CNPJ"],
    ["endereco", "Endereço completo"],
    ["socio_nome", "Nome do sócio operador"],
    ["socio_cpf", "CPF do sócio operador"],
    ["socio_rg", "RG do sócio operador"],
    ["data_nascimento", "Data de nascimento"],
    ["celular", "Celular"],
    ["telefone_recado", "Outro telefone / recado"],
    ["email", "E-mail"],
    ["pix_chave", "Chave Pix (conta PJ)"],
    ["dados_bancarios", "Banco / Agência / Conta (PJ)"],
  ],
  pf: [
    ["nome", "Nome completo"],
    ["documento", "CPF"],
    ["rg", "RG"],
    ["data_nascimento", "Data de nascimento"],
    ["celular", "Celular"],
    ["endereco", "Endereço completo"],
    ["telefone_recado", "Outro telefone / recado"],
    ["contato_emergencia", "Contato de emergência"],
    ["email", "E-mail"],
    ["pix_chave", "Chave Pix"],
    ["dados_bancarios", "Banco / Agência / Conta"],
  ],
};
