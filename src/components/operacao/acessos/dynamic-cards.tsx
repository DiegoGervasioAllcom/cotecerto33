// Cartões de tabela dinâmica (pares/faixas/trios) usados na Personalização
// geral (Modelo CLT) de Acessos e permissões.
import { applyMask, type Mask } from "@/lib/masks";
import { Icon } from "./icon";
import { SEGURADORAS } from "./constants";
import type { Pair, Trio } from "./types";

export function DynamicPairCard({
  title,
  icon,
  lh,
  vh,
  rows,
  onChange,
  footer,
}: {
  title: string;
  icon: string;
  lh: string;
  vh: string;
  rows: Pair[];
  onChange: (rows: Pair[]) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id={icon} size={16} /> {title}
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => onChange([...rows, ["", ""]])}
        >
          <Icon id="plus" size={13} /> Adicionar linha
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th>{lh}</th>
              <th>{vh}</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                  Sem linhas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="input input-mini"
                    value={r[0]}
                    onChange={(e) => {
                      const next = rows.map((x, j) =>
                        j === i ? ([e.target.value, x[1]] as Pair) : x,
                      );
                      onChange(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input input-mini"
                    value={r[1]}
                    onChange={(e) => {
                      const next = rows.map((x, j) =>
                        j === i ? ([x[0], e.target.value] as Pair) : x,
                      );
                      onChange(next);
                    }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="card-b">{footer}</div>}
    </div>
  );
}

export function parseRange(label: string): [string, string] {
  if (!label) return ["", ""];
  const sep = label.match(/^\s*(.+?)\s*(?:–|—|-| a | até )\s*(.+?)\s*$/i);
  if (sep) return [sep[1], sep[2]];
  if (label.trim().endsWith("+")) return [label.trim().slice(0, -1).trim(), ""];
  const lt = label.match(/^<\s*(.+)$/);
  if (lt) return ["", lt[1].trim()];
  const gt = label.match(/^(?:>|acima de)\s*(.+)$/i);
  if (gt) return [gt[1].trim(), ""];
  return [label, ""];
}
export function formatRange(de: string, ate: string): string {
  const d = de.trim(),
    a = ate.trim();
  if (!d && !a) return "";
  if (!d) return `< ${a}`;
  if (!a) return `${d}+`;
  return `${d} – ${a}`;
}

export function DynamicRangeCard({
  title,
  icon,
  lh,
  vh,
  rows,
  onChange,
  footer,
  rangeMask,
  valueMask,
}: {
  title: string;
  icon: string;
  lh: string;
  vh: string;
  rows: Pair[];
  onChange: (rows: Pair[]) => void;
  footer?: React.ReactNode;
  rangeMask?: Mask;
  valueMask?: Mask;
}) {
  function update(i: number, de: string, ate: string, val: string) {
    const next = rows.map((x, j) => (j === i ? ([formatRange(de, ate), val] as Pair) : x));
    onChange(next);
  }
  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id={icon} size={16} /> {title}
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => onChange([...rows, ["", ""]])}
        >
          <Icon id="plus" size={13} /> Adicionar faixa
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th colSpan={2}>{lh}</th>
              <th>{vh}</th>
              <th style={{ width: 60 }}></th>
            </tr>
            <tr>
              <th style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>De</th>
              <th style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>Até</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                  Sem faixas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const [de, ate] = parseRange(r[0]);
              return (
                <tr key={i}>
                  <td>
                    <input
                      className="input input-mini"
                      placeholder={
                        rangeMask === "brl" ? "R$ 0,00" : rangeMask === "pct" ? "0%" : "0"
                      }
                      value={de}
                      onChange={(e) => update(i, applyMask(e.target.value, rangeMask), ate, r[1])}
                    />
                  </td>
                  <td>
                    <input
                      className="input input-mini"
                      placeholder={rangeMask === "brl" ? "R$ ∞" : rangeMask === "pct" ? "∞%" : "∞"}
                      value={ate}
                      onChange={(e) => update(i, de, applyMask(e.target.value, rangeMask), r[1])}
                    />
                  </td>
                  <td>
                    <input
                      className="input input-mini"
                      placeholder={
                        valueMask === "brl" ? "R$ 0,00" : valueMask === "pct" ? "0%" : ""
                      }
                      value={r[1]}
                      onChange={(e) => {
                        const v = applyMask(e.target.value, valueMask);
                        const next = rows.map((x, j) => (j === i ? ([x[0], v] as Pair) : x));
                        onChange(next);
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                      <Icon id="trash" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="card-b">{footer}</div>}
    </div>
  );
}

export function toTrio(x: unknown): Trio {
  if (Array.isArray(x)) {
    if (x.length >= 3) return [String(x[0] ?? ""), String(x[1] ?? ""), String(x[2] ?? "")];
    if (x.length === 2) return ["Ituran", String(x[0] ?? ""), String(x[1] ?? "")];
  }
  return ["", "", ""];
}

export function DynamicTrioCard({
  title,
  icon,
  lh,
  vh,
  rows,
  onChange,
  valueMask,
}: {
  title: string;
  icon: string;
  lh: string;
  vh: string;
  rows: Trio[];
  onChange: (rows: Trio[]) => void;
  valueMask?: Mask;
}) {
  function patch(i: number, k: 0 | 1 | 2, v: string) {
    const masked = k === 2 ? applyMask(v, valueMask) : v;
    onChange(
      rows.map((x, j) => {
        if (j !== i) return x;
        const n: Trio = [x[0], x[1], x[2]];
        n[k] = masked;
        return n;
      }),
    );
  }
  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id={icon} size={16} /> {title}
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => onChange([...rows, ["", "", ""]])}
        >
          <Icon id="plus" size={13} /> Adicionar linha
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Seguradora</th>
              <th>{lh}</th>
              <th style={{ width: 160 }}>{vh}</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                  Sem linhas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <select
                    className="input input-mini"
                    value={r[0]}
                    onChange={(e) => patch(i, 0, e.target.value)}
                    style={{ fontSize: 11 }}
                  >
                    <option value="">— Seguradora —</option>
                    {SEGURADORAS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {r[0] && !SEGURADORAS.includes(r[0]) && <option value={r[0]}>{r[0]}</option>}
                  </select>
                </td>
                <td>
                  <input
                    className="input input-mini"
                    value={r[1]}
                    onChange={(e) => patch(i, 1, e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input input-mini"
                    placeholder={valueMask === "brl" ? "R$ 0,00" : valueMask === "pct" ? "0%" : ""}
                    value={r[2]}
                    onChange={(e) => patch(i, 2, e.target.value)}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
