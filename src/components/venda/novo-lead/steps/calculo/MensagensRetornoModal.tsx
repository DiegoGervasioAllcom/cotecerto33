// Modal "Mensagens de retorno" (V12.4.5) — mensagens da seguradora agrupadas
// por faixa, como `segAcao(..., 'retorno')` no protótipo V12. Só texto.
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";

export function MensagensRetornoModal({
  resultado,
  onClose,
}: {
  resultado: ResultadoCalculo;
  onClose: () => void;
}) {
  return (
    <div className="modal-host" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <svg width="18" height="18">
            <use href="#i-message" />
          </svg>
          <h3>Mensagens de retorno — {resultado.seguradora}</h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <div className="modal-b">
          {(resultado.mensagensRetorno ?? []).map((grupo, idx) => (
            <div className="msg-bloco" key={`${grupo.faixa ?? "geral"}-${idx}`}>
              <div className="mb-h">
                <div>
                  <strong>{grupo.faixa ?? "Mensagens da seguradora"}</strong>
                </div>
              </div>
              <ul className="mb-lista">
                {grupo.mensagens.map((mensagem, i) => (
                  <li key={i}>{mensagem}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
