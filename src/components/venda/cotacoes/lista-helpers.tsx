/**
 * Helpers compartilhados pelas listas "Em cotação" e "Em negociação"
 * (Frente 9 · V12 — divisão da antiga /venda/cotacoes em duas telas).
 */
export type Premio = { seguradora: string; premio: number };

export const money = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const pad = (n: number) => String(n).padStart(5, "0");
export const cotNum = (numero: number) => `COT-${new Date().getFullYear()}-${pad(numero)}`;

export function diasParaExpirar(criadoEm: string) {
  const created = new Date(criadoEm).getTime();
  const exp = created + 5 * 24 * 60 * 60 * 1000;
  return Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000));
}

export function expiraChip(criadoEm: string) {
  const d = diasParaExpirar(criadoEm);
  if (d <= 0)
    return (
      <span className="chip chip-alert" style={{ minWidth: 72 }}>
        Hoje
      </span>
    );
  if (d <= 3)
    return (
      <span className="chip chip-alert" style={{ minWidth: 72 }}>
        {d}d
      </span>
    );
  if (d <= 5)
    return (
      <span className="chip chip-yellow" style={{ minWidth: 72 }}>
        {d}d
      </span>
    );
  return (
    <span className="chip chip-outline" style={{ minWidth: 72 }}>
      {d}d
    </span>
  );
}

export const FAIXAS = [
  { label: "Até R$ 2.500", min: 0, max: 2500 },
  { label: "R$ 2.501 – R$ 5.000", min: 2501, max: 5000 },
  { label: "Acima de R$ 5.000", min: 5001, max: Infinity },
];

export function melhorPreco(premios: Premio[] | null | undefined): number | null {
  if (!premios?.length) return null;
  return Math.min(...premios.map((p) => Number(p.premio) || 0));
}
