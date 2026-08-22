// Enums do Passo 5 (Coberturas) — espelham o protótipo v10 e/ou o contrato
// real da API de cotação (Quiver). Fonte: protótipo
// (/Users/diego.gervasio/Downloads/cotecerto_prototipo_v10 (1).html) e
// /Users/diego.gervasio/Documents/playwright/src/api/validators/
// cotacao.validator.ts + openapi.yaml (objeto `cobertura`).

// cobertura.plano na Quiver — só esse enum é estrito (case-insensitive:
// facil/pleno/total/personalizado). Rótulos com acento do protótipo.
// "Personalizado" (masculino) é proposital: a normalização do robô só
// remove acentos e faz lowercase, não troca gênero — "Personalizada"
// normalizava para "personalizada", que não bate com "personalizado" e
// gerava 422. Trocamos apenas o "a" final por "o".
export const PLANO_COBERTURA = ["Fácil", "Pleno", "Total", "Personalizado"] as const;

// cobertura.modalidade — texto livre na Quiver, só esses 2 valores existem
// no select real do protótipo/portal.
export const MODALIDADE_COBERTURA = ["Valor de Mercado", "Valor Determinado"] as const;

// cobertura.franquiaPrimeiraOpcao — texto livre na Quiver, só esses 7
// valores existem no select real do portal (PremiosCob_4031).
export const FRANQUIA_OPCOES = [
  "Reduzida 25%",
  "Reduzida 50%",
  "Reduzida 75%",
  "Normal 100%",
  "Majorada 150%",
  "Majorada 200%",
  "Majorada 300%",
] as const;

// cobertura.franquiaSegundaOpcao — mesmos 7 valores da 1ª opção mais "Não"
// (select real do portal, PremiosCob_7031).
export const FRANQUIA_SEGUNDA_OPCOES = [...FRANQUIA_OPCOES, "Não"] as const;

// cobertura.danosMateriaisTerceiros / danosCorporaisTerceiros — texto livre
// na Quiver, select real do portal (PremiosCob_4) tem esses 59 valores.
export const RCF_VALORES = [
  0, 10000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000,
  80000, 85000, 90000, 95000, 100000, 110000, 120000, 125000, 130000, 140000, 150000, 160000,
  170000, 175000, 180000, 200000, 230000, 250000, 275000, 300000, 350000, 400000, 450000, 500000,
  550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000, 1100000, 1200000,
  1300000, 1400000, 1500000, 1600000, 1700000, 1800000, 1900000, 2000000,
] as const;

// cobertura.despesasExtras — texto livre na Quiver, só esses 2 valores
// existem no select real do portal (PremiosCob_20).
export const DESPESAS_EXTRAS_OPCOES = ["Não contratada", "Sim"] as const;

// cobertura.vidrosFarosRetrovisores / assistencia24h / carroReserva — enum
// estrito de 4 níveis, idêntico para os 3 campos (contrato real Quiver, ver
// EXTERNAL_API_GUIDE.md do repo do robô). Antes eram um boolean (vidros) ou
// selects com opções que não existem de fato no portal (assist24: "Básica/
// Intermediária/Premium"; carroReserva: "Não/7/15/30 dias").
export const NIVEL_COBERTURA_OPCOES = [
  "Não contratada",
  "Básico",
  "Intermediário",
  "Superior",
] as const;

// Seguradoras habilitadas por padrão nos folds de Descontos/Comissões
// quando a cotação ainda não tem seguradoras selecionadas (Passo 2) — mesma
// lista SEG_HABILITADAS do protótipo.
export const SEG_HABILITADAS = [
  "Mapfre",
  "Aliro",
  "Yelum",
  "HDI",
  "Suhai",
  "Porto",
  "Azul",
  "Itaú",
  "Tokio",
] as const;
