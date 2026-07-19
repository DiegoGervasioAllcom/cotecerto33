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

export const FIELD_LABELS: Record<string, string> = {
  nome: "Nome / Razão Social",
  documento: "Documento (CPF/CNPJ)",
  rg: "RG",
  data_nascimento: "Data de nascimento",
  endereco: "Endereço completo",
  socio_nome: "Sócio operador",
  socio_cpf: "CPF do sócio",
  socio_rg: "RG do sócio",
  celular: "Celular",
  telefone_recado: "Outro telefone / recado",
  email: "E-mail",
  pix_chave: "Chave Pix",
  dados_bancarios: "Banco / Agência / Conta",
  contato_emergencia: "Contato de emergência",
  tipo: "Tipo de cadastro",
};
