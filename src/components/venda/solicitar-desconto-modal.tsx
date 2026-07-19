// Modal "Solicitar desconto adicional" (G3.3) — tela de cotação do vendedor.
// Chama a RPC solicitar_desconto (resolve seguradora_id pelo nome antes),
// que cria o pedido roteado ao superior do vendedor.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pctPedidoSchema } from "@/lib/schemas/desconto-solicitacao.schema";

export function SolicitarDescontoModal({
  cotacaoId,
  seguradoraNome,
  seguradoraId,
  premio,
  onClose,
  onSent,
}: {
  cotacaoId: string;
  seguradoraNome: string;
  seguradoraId: string | null;
  premio: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [pct, setPct] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleEnviar() {
    setErr(null);
    if (!seguradoraId) {
      setErr("Não foi possível identificar a seguradora.");
      return;
    }
    const n = Number(pct.replace(",", "."));
    const parsed = pctPedidoSchema.safeParse(n);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Percentual inválido.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("solicitar_desconto", {
      p_cotacao_id: cotacaoId,
      p_seguradora_id: seguradoraId,
      p_pct_pedido: parsed.data,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOk(true);
    onSent();
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
          <h3>Solicitar desconto adicional — {seguradoraNome}</h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <div className="modal-b">
          {ok ? (
            <div className="chip chip-ok" style={{ display: "block", padding: 12 }}>
              Pedido enviado ao seu superior para aprovação.
            </div>
          ) : (
            <>
              <div className="kv" style={{ marginBottom: 12 }}>
                <b>Prêmio atual:</b>{" "}
                {premio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              {err && (
                <div className="banner alert" style={{ marginBottom: 12 }}>
                  {err}
                </div>
              )}
              <div className="field-group">
                <label>Percentual de desconto desejado</label>
                <input
                  className="input"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="ex.: 10"
                  inputMode="decimal"
                  maxLength={6}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-f">
          {ok ? (
            <button className="btn btn-yellow" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
                Cancelar
              </button>
              <button className="btn btn-yellow" disabled={busy} onClick={handleEnviar}>
                {busy ? "Enviando…" : "Enviar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
