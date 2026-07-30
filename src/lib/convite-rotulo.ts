import type { ConviteDoPendente } from "@/components/operacao/acessos/types";

/**
 * Rótulo do tipo declarado no formato "TÍTULO | qualificador" do protótipo —
 * o chip amarelo que a fila e o modal de análise mostram (`p.declarado ||
 * 'Vendedor | Full'` em `accRede()`).
 *
 * Separado de `rotuloDeclarado` em `convidar-modal.tsx` de propósito: aquele
 * opera sobre a SELEÇÃO no formulário de convite (antes de existir convite,
 * `cargoId` nulo já significa Vendedor Matriz); este opera sobre o convite JÁ
 * PERSISTIDO (`perfil` explicitamente `'vendedor'`, `cargo_id` explicitamente
 * nulo). Formas diferentes o suficiente para não valer a pena unificar.
 */
export function rotuloConvite(c: ConviteDoPendente | null): string {
  if (!c) return "sem tipo declarado — a Matriz define na análise";
  if (c.trilha === "interno") {
    return c.cargo_nome ? `Matriz | ${c.cargo_nome}` : "Matriz | Vendedor Matriz (Modelo CLT)";
  }
  switch (c.perfil) {
    case "master":
      return "Master | franqueado";
    case "franquia_full":
      return "Franquia | Full";
    case "franquia_indiv":
      return "Franquia | Individual";
    case "vendedor":
      return c.vinc_tipo === "full" ? "Vendedor | Full" : "Vendedor | Master";
    default:
      return "—";
  }
}
