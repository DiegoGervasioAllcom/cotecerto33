// V11 · D8/D9 (Frente 4) — selo de performance, compartilhado entre as
// listas (Cadastros Matriz/Rede) e o modal de resumo.
export type PerformanceStatus = "ativo" | "atencao" | "travado";

export const PERFORMANCE_STATUS_LABEL: Record<PerformanceStatus, string> = {
  ativo: "Ativo",
  atencao: "Atenção",
  travado: "Travado",
};

export const PERFORMANCE_STATUS_CHIP: Record<PerformanceStatus, string> = {
  ativo: "chip-ok",
  atencao: "chip-yellow",
  travado: "chip-alert",
};
