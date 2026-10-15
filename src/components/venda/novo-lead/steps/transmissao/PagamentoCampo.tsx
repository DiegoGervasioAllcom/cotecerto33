import type { CSSProperties, ReactNode } from "react";

type Props = {
  /** id do controle (o erro usa `${id}-erro`, para `aria-describedby`). */
  id: string;
  label: string;
  erro?: string;
  children: ReactNode;
  style?: CSSProperties;
};

// Rótulo + controle + mensagem de erro do passo "Pagamento" (mesmas classes do
// proto.css dos demais formulários da transmissão).
export function CampoPagamento({ id, label, erro, children, style }: Props) {
  return (
    <div className="field-group" style={style}>
      <label htmlFor={id}>
        {label}
        <span className="req">*</span>
      </label>
      {children}
      {erro && (
        <span id={`${id}-erro`} role="alert" className="small" style={{ color: "var(--alert)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
