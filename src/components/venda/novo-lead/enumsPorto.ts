// Opções da Efetivação da Porto no portal Quiver (select
// #Padrao2000_Cobertura7164 e #Padrao2000_Cobertura7202), lidas ao vivo em
// 14/10/2026 (leitura somente). Texto exato do portal: o robô casa por ele.
export const RENDAS_MENSAIS_PORTO = [
  "Até R$ 2.500,00",
  "De R$ 2.501,00 a R$ 5.000,00",
  "De R$ 5.001,00 a R$ 10.000,00",
  "Acima de R$ 10.000,00",
] as const;

export const PEP_PORTO = ["Sim", "Não", "Relacionamento Próximo"] as const;

// Tokio: mesmos ids (#Padrao2000_Cobertura7164 / #7202), lidos ao vivo em 19/10/2026 — a renda traz
// duas opções a mais que a da Porto; a PEP é igual.
export const RENDAS_MENSAIS_TOKIO = [
  "Não desejo informar",
  "Sem Renda",
  ...RENDAS_MENSAIS_PORTO,
] as const;

export type RendaMensalPorto = (typeof RENDAS_MENSAIS_PORTO)[number];
export type PepPorto = (typeof PEP_PORTO)[number];
