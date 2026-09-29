// Checkbox "Imprimir comissão" + aviso do estado (fatia B). Habilita só com
// % disponível; os demais estados ficam desabilitados com a razão à vista.
import type { ComissaoImpressao } from "./useComissaoImpressao";
import { AVISO_SEM_ACESSO, AVISO_SEM_PCT } from "./comissao-impressao";

function aviso(c: ComissaoImpressao): string | null {
  switch (c.estado) {
    case "carregando":
      return "Verificando…";
    case "sem_pct":
      return AVISO_SEM_PCT;
    case "sem_permissao":
      return AVISO_SEM_ACESSO;
    case "erro":
      return "Não foi possível ler a comissão";
    default:
      return null;
  }
}

export function ComissaoImpressaoBloco({
  comissao,
  marcado,
  onToggle,
}: {
  comissao: ComissaoImpressao;
  marcado: boolean;
  onToggle: () => void;
}) {
  const habilitado = comissao.estado === "disponivel";
  const msg = aviso(comissao);
  return (
    <label
      className={`pr-chk${marcado && habilitado ? " on" : ""}`}
      aria-disabled={habilitado ? undefined : "true"}
      title={msg ?? "Imprimir comissão"}
      style={habilitado ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
      onClick={() => {
        if (habilitado) onToggle();
      }}
    >
      <span className="pr-box">
        {marcado && habilitado && (
          <svg width={11} height={11}>
            <use href="#i-check" />
          </svg>
        )}
      </span>
      Imprimir comissão
      {msg && <small>{msg}</small>}
    </label>
  );
}
