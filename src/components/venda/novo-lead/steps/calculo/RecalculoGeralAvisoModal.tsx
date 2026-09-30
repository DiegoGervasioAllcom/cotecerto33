// Aviso do "Recalcular" da barra quando o último recálculo foi só de uma
// seguradora (a seleção do passo Seguro ficou reduzida a ela).
import { createPortal } from "react-dom";
import type { AvisoRecalculoGeral } from "@/components/venda/novo-lead/recalculo-unico";

type Props = {
  aviso: AvisoRecalculoGeral;
  onCancelar: () => void;
  onSoEla: () => void;
  onVoltar: () => void;
};

export function RecalculoGeralAvisoModal({ aviso, onCancelar, onSoEla, onVoltar }: Props) {
  return createPortal(
    <div className="modal-host" onClick={onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <svg width="18" height="18">
            <use href="#i-refresh" />
          </svg>
          <h3>Recalcular</h3>
          <div className="x" onClick={onCancelar}>
            ×
          </div>
        </div>
        <div className="modal-b">
          O último recálculo foi só da {aviso.seguradora}, então só ela está no cálculo agora.
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn-ghost" type="button" onClick={onSoEla}>
            Recalcular só {aviso.seguradora}
          </button>
          {aviso.voltarN !== null && (
            <button className="btn btn-yellow" type="button" onClick={onVoltar}>
              Voltar às {aviso.voltarN} seguradoras de antes e recalcular
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
