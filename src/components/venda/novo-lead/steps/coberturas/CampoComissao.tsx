// Campo de comissão % por seguradora (aba "+ Comissões"), compartilhado entre o
// modal da engrenagem (Cálculo) e o bloco "Personalizar por seguradora".
import {
  COMISSAO_MAX,
  COMISSAO_MIN,
  COMISSAO_SEM_APROVACAO_MIN,
  comissaoEhAgravo,
  comissaoExigeAprovacao,
} from "@/components/venda/novo-lead/ajusteSeguradora.schema";

function numeroDigitado(v: string): number | null {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

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
  const n = numeroDigitado(value);
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
        Entre {COMISSAO_MIN}% e {COMISSAO_MAX}% · abaixo de {COMISSAO_SEM_APROVACAO_MIN}% requer
        aprovação
      </div>
      {n !== null && comissaoEhAgravo(n) && (
        <span className="chip chip-yellow" style={{ marginTop: 6 }}>
          Agravo
        </span>
      )}
      {n !== null && n >= COMISSAO_MIN && comissaoExigeAprovacao(n) && (
        <span className="chip chip-alert" style={{ marginTop: 6 }}>
          Requer aprovação
        </span>
      )}
    </div>
  );
}
