import type { ReactNode } from "react";

type Props = { label: string; erro?: string; dica?: ReactNode; children: ReactNode };

export function Campo({ label, erro, dica, children }: Props) {
  return (
    <label className="m-field">
      <span className="m-label">{label}</span>
      {children}
      {dica ? <span className="m-hint">{dica}</span> : null}
      {erro ? <span className="m-err">{erro}</span> : null}
    </label>
  );
}

type Opcao = { valor: string; rotulo: string };

export function Escolha({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Opcao[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="m-chips" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={valor === o.valor ? "m-chip on" : "m-chip"}
          onClick={() => onChange(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
