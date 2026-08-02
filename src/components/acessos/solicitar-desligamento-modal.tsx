// Modal "Solicitar desligamento" (V11 · C8) — xAcessos (visão de grupo).
// Envia um pedido para a Matriz resolver via RPC `solicitar_desligamento`;
// não desliga ninguém aqui — só a aprovação da Matriz executa (C9).
import { useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";

export function SolicitarDesligamentoModal({
  alvoId,
  alvoNome,
  onClose,
  onEnviado,
}: {
  alvoId: string;
  alvoNome: string;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!motivo.trim()) {
      setErro("Motivo é obrigatório.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.rpc("solicitar_desligamento", {
      p_alvo_profile_id: alvoId,
      p_motivo: motivo.trim(),
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onEnviado();
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <Icon id="trash" size={18} />
          <h3>Solicitar desligamento — {alvoNome}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <div className="field-group full">
            <label htmlFor="sd-motivo">Motivo (obrigatório)</label>
            <textarea
              id="sd-motivo"
              className="input"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o motivo do desligamento…"
            />
          </div>
          <div className="clt-note" style={{ marginTop: 10 }}>
            <Icon id="info" size={15} />
            <div>
              O pedido vai para a <strong>Matriz</strong> resolver. O desligamento só acontece de
              fato quando ela aprovar.
            </div>
          </div>
          {erro && (
            <div className="banner alert" style={{ marginTop: 12 }}>
              {erro}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button
            className="btn btn-yellow"
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
          >
            <Icon id="send" size={14} /> {enviando ? "Enviando…" : "Enviar para a Matriz"}
          </button>
        </div>
      </div>
    </div>
  );
}
