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

/** Período corrido dos últimos N dias (não alinhado a mês) — usado pelo
 * recorte "Últimos 90 dias" da tela de Relatórios. A competência fica no
 * mês atual (comissão/premiação continuam pela competência corrente). */
export function ultimosDiasPeriodo(dias: number): Periodo {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const ini = new Date(fim);
  ini.setDate(ini.getDate() - dias);
  ini.setHours(0, 0, 0, 0);
  const competencia = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}`;
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    competencia,
    label: `Últimos ${dias} dias`,
  };
}
