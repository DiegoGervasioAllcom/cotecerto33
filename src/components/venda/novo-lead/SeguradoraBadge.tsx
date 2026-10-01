// Selo de seguradora (círculo com a marca colorida) — espelha o protótipo
// V12 (`segBadge`/`segTile`). As chaves batem com `seguradoras.nome` do banco
// (ver seed em supabase/migrations/20240101000010_seguradoras_planos.sql):
// nomes curtos ("Porto", "Azul", "Itaú"...), não "Porto Seguro" etc.
// Seguradora fora do mapa (ex.: Ezze/Zurich/Alfa/Darwin/Indiana/Sompo, que o
// banco semeia mas o robô Quiver não suporta e por isso não aparecem no
// picker hoje) cai no fallback cinza com o próprio nome por extenso.

import { SEG_MARCAS } from "@/lib/seguradora-marcas";

type Tamanho = "" | "sm" | "xs";

export function SeguradoraBadge({ nome, tam = "" }: { nome: string; tam?: Tamanho }) {
  const m = SEG_MARCAS[nome] ?? { cor: "#5B6770", wm: nome, sub: "" };
  return (
    <span className={`seg-badge ${tam}`.trim()}>
      <span className="wm" style={{ color: m.cor }}>
        {m.wm}
        {m.sub && <small>{m.sub}</small>}
      </span>
    </span>
  );
}

export function SeguradoraTile({
  nome,
  on,
  onClick,
  tam = "",
}: {
  nome: string;
  on: boolean;
  onClick?: () => void;
  tam?: "t-sm" | "t-xs" | "";
}) {
  return (
    <div
      className={`seg-item ${tam} ${on ? "on" : "off"} ${onClick ? "" : "static"}`
        .replace(/\s+/g, " ")
        .trim()}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
      title={nome}
    >
      <span className="seg-badge-wrap">
        <SeguradoraBadge nome={nome} />
        {on && (
          <span className="seg-check">
            <svg width="11" height="11">
              <use href="#i-check" />
            </svg>
          </span>
        )}
      </span>
      <span className="seg-nome">{nome}</span>
    </div>
  );
}
