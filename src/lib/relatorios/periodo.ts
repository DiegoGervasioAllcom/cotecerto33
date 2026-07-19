/** Período compartilhado pelos 7 relatórios da tela de Relatórios. Mês
 * corrente por padrão, navegável para meses anteriores — mesmo padrão de
 * `estornos.tsx` / `comissoes.tsx`. */
export type Periodo = {
  /** Início inclusivo (ISO). */
  ini: string;
  /** Fim exclusivo (ISO). */
  fim: string;
  /** Competência no formato YYYY-MM (usada por comissão/premiação). */
  competencia: string;
  /** Rótulo legível, ex.: "Maio de 2026". */
  label: string;
};

export function monthPeriodo(offset: number): Periodo {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const ini = new Date(d.getFullYear(), d.getMonth(), 1);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const label = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const competencia = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, "0")}`;
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    competencia,
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

export function periodoOptions(): { off: number; label: string }[] {
  return [0, -1, -2, -3, -4, -5].map((off) => ({ off, label: monthPeriodo(off).label }));
}
