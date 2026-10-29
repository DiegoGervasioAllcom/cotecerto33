// Bancos aceitos no débito em conta da Porto: opções do select
// #Padrao2000_Cobertura1411 ("Banco para débito") da Efetivação no portal Quiver,
// lidas ao vivo em 15/10/2026 (leitura somente). O `codigo` é o value do select
// (código do banco) — é o que o robô recebe em `contaDebito.banco`. Não editar à
// mão: regerar lendo o portal de novo.
export const BANCOS_DEBITO_PORTO = [
  { codigo: "1", nome: "Banco do Brasil S.A." },
  { codigo: "10", nome: "Credicoamo Credito Rural Cooperativa" },
  { codigo: "104", nome: "Caixa Economica Federal" },
  {
    codigo: "133",
    nome: "Cresol - Cooperativa de Credito Rural com Interação Solidária de Londrina",
  },
  { codigo: "136", nome: "Banco Unicred do Brasil" },
  { codigo: "237", nome: "Banco Bradesco S.A." },
  { codigo: "33", nome: "Banco Santander (Brasil) S.A." },
  { codigo: "341", nome: "Itaú Unibanco S.A." },
  { codigo: "4", nome: "Banco do Nordeste do Brasil S.A." },
  { codigo: "422", nome: "Banco Safra S.A." },
  { codigo: "47", nome: "Banco do Estado de Sergipe S.A. Banese" },
  { codigo: "748", nome: "Banco Cooperativo Sicredi S.A" },
  { codigo: "756", nome: "Banco Cooperativo do Brasil S.A. - Bancoob" },
  { codigo: "84", nome: "Uniprime Norte do Paraná" },
  { codigo: "85", nome: "Cooperativa Central de Crédito Urbano-Cecred" },
  { codigo: "97", nome: "Cooperativa Central de Crédito Noroeste Brasileiro Ltda" },
] as const;

export type BancoDebitoPorto = (typeof BANCOS_DEBITO_PORTO)[number];

// Bancos do débito em conta da ALLIANZ: select #Padrao2000_Cobertura1411 da Efetivação (forma "Débito em Conta"),
// lido ao vivo em 29/10/2026 (leitura somente). `codigo` = value do select. Não editar à mão: regerar lendo o portal.
export const BANCOS_DEBITO_ALLIANZ = [
  { codigo: "237", nome: "Banco Bradesco S.A." },
  { codigo: "70", nome: "BRB - BANCO DE BRASILIA S.A." },
  { codigo: "748", nome: "BANCO COOPERATIVO SICREDI S.A." },
  { codigo: "756", nome: "Banco Cooperativo do Brasil S.A. – BANCOOB" },
  { codigo: "1", nome: "Banco do Brasil S.A." },
  { codigo: "341", nome: "Banco Itaú S.A." },
  { codigo: "422", nome: "Banco Safra S.A." },
  { codigo: "33", nome: "Banco Santander S.A." },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "47", nome: "BANESE" },
] as const;
