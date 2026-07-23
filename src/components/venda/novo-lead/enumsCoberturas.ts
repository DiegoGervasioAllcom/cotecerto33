// Enums do Passo 5 (Coberturas) — espelham o protótipo v10 e/ou o contrato
// real da API de cotação (Quiver). Fonte: protótipo
// (/Users/diego.gervasio/Downloads/cotecerto_prototipo_v10 (1).html) e
// /Users/diego.gervasio/Documents/playwright/src/api/validators/
// cotacao.validator.ts + openapi.yaml (objeto `cobertura`).

// cobertura.plano na Quiver — só esse enum é estrito (case-insensitive:
// facil/pleno/total/personalizado). Rótulos com acento do protótipo.
export const PLANO_COBERTURA = ["Fácil", "Pleno", "Total", "Personalizada"] as const;

// cobertura.modalidade — texto livre na Quiver, só esses 2 valores existem
// no select real do protótipo/portal.
export const MODALIDADE_COBERTURA = ["Valor de Mercado", "Valor Determinado"] as const;

// cobertura.franquiaPrimeiraOpcao / franquiaSegundaOpcao — texto livre na
// Quiver, só esses 9 valores existem no select real do protótipo/portal.
export const FRANQUIA_OPCOES = [
  "Reduzida 25%",
  "Reduzida 50%",
  "Reduzida 75%",
  "Normal 100%",
  "Majorada 125%",
  "Majorada 150%",
  "Majorada 175%",
  "Majorada 200%",
  "Majorada 300%",
] as const;

// cobertura.danosMateriaisTerceiros / danosCorporaisTerceiros — texto livre
// na Quiver, protótipo usa select fixo com esses 4 valores monetários.
export const RCF_VALORES = [50000, 100000, 150000, 200000] as const;

// cobertura.despesasExtras — texto livre na Quiver, só esses 2 valores
// existem no select real do protótipo/portal.
export const DESPESAS_EXTRAS_OPCOES = ["Não contratada", "Contratada"] as const;

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
