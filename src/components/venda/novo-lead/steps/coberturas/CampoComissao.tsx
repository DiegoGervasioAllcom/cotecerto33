// Campo de comissão % por seguradora (aba "+ Comissões"), compartilhado entre o
// modal da engrenagem (Cálculo) e o bloco "Personalizar por seguradora".
import { COMISSAO_MAX, COMISSAO_MIN } from "@/components/venda/novo-lead/ajusteSeguradora.schema";

type Props = {
  id: string;
  /** false = o portal não permite editar a comissão desta seguradora. */
  editavel?: boolean;
  value: string;
  disabled?: boolean;
  onChange: (valor: string) => void;
};

export function CampoComissao({ id, editavel = true, value, disabled, onChange }: Props) {
  if (!editavel) {
    return (
      <div className="field-group">
        <label>Comissão (%)</label>
        <div className="muted small">Definida pela seguradora — não pode ser alterada aqui.</div>
      </div>
    );
  }
  return (
    <div className="field-group">
      <label htmlFor={id}>Comissão (%)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id={id}
          className="input"
          inputMode="decimal"
          maxLength={5}
          placeholder="Padrão do portal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>%</span>
      </div>
      <div className="muted small">
        Entre {COMISSAO_MIN}% e {COMISSAO_MAX}%
      </div>
    </div>
  );
}
