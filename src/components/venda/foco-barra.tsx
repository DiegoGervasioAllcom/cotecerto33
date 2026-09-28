// Faixa "de onde você veio" — espelha focoBarra() do protótipo V12
// (cotecerto_prototipo_v12.html ~linhas 2415-2424; classes em proto.css).
// Título/subtítulo vêm do motivo real gravado por quem navegou (ver
// use-foco-ao-chegar.ts); sem motivo salvo, cai para o rótulo da fonte —
// nunca texto inventado.
import {
  FONTE_FOCO_LABEL,
  lerFocoMotivo,
  serializeFoco,
  type FonteFoco,
} from "@/lib/use-foco-ao-chegar";

export function FocoBarra({
  ativo,
  fonte,
  id,
  onLimpar,
}: {
  ativo: boolean;
  fonte: FonteFoco | null;
  id: string | null;
  onLimpar: () => void;
}) {
  if (!ativo || !fonte || !id) return null;
  const motivo = lerFocoMotivo(serializeFoco({ fonte, id }));
  const titulo = motivo?.titulo ?? FONTE_FOCO_LABEL[fonte];

  return (
    <div className="foco-barra">
      <span className="fb-ic">
        <svg width={17} height={17}>
          <use href="#i-target" />
        </svg>
      </span>
      <div className="fb-tx">
        <strong>{titulo}</strong>
        {motivo?.texto && <small>{motivo.texto}</small>}
      </div>
      <button
        type="button"
        className="fb-x"
        title="Sair do foco"
        aria-label="Sair do foco"
        onClick={onLimpar}
      >
        <svg width={15} height={15}>
          <use href="#i-x" />
        </svg>
      </button>
    </div>
  );
}
