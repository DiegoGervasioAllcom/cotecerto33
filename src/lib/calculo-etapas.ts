// Etapas do cálculo da cotação no robô (Quiver). Compartilhado entre o webhook
// (servidor) e o widget (front). `seq` é o mesmo número que o robô envia — ver
// src/api/utils/etapa.ts no repo do robô e a RPC registrar_calculo_etapa.
export const CALCULO_ETAPAS = [
  "na_fila",
  "login",
  "segurado",
  "veiculo",
  "seguradoras",
  "calculando",
  "lendo_resultados",
] as const;

export type CalculoEtapaRobo = (typeof CALCULO_ETAPAS)[number];
export type CalculoEtapa = CalculoEtapaRobo | "concluido" | "erro";

/** seq enviado pelo robô para cada etapa (0 = reinicia o ciclo). */
export const CALCULO_ETAPA_SEQ: Record<CalculoEtapaRobo, number> = {
  na_fila: 0,
  login: 1,
  segurado: 2,
  veiculo: 3,
  seguradoras: 4,
  calculando: 5,
  lendo_resultados: 6,
};

/** seq usado pelo servidor para fechar o ciclo (concluido/erro). */
export const CALCULO_SEQ_FINAL = 9;

export const CALCULO_ETAPA_ROTULO: Record<CalculoEtapa, string> = {
  na_fila: "Na fila do robô",
  login: "Entrando no portal",
  segurado: "Preenchendo dados do segurado",
  veiculo: "Preenchendo dados do veículo",
  seguradoras: "Selecionando seguradoras",
  calculando: "Calculando nas seguradoras",
  lendo_resultados: "Lendo os resultados",
  concluido: "Cálculo concluído",
  erro: "Erro no cálculo",
};

/** Etapas que contam na barra: o último passo (lendo_resultados) fecha em 100%. */
export const CALCULO_TOTAL_PASSOS = CALCULO_ETAPAS.length - 1;
