import type { CSSProperties } from "react";

// Botão "Buscar" (CPF/placa): laranja da família do amarelo da marca para chamar atenção.
// Só sobrescreve a cor; forma, hover e demais estados vêm de .btn/.btn-yellow (proto.css).
export const BOTAO_BUSCAR_STYLE: CSSProperties = {
  background: "#f28a1a",
  color: "var(--ink)",
};
