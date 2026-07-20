// Painel de negociação de proposta (G7.2) — histórico de versões + registro de
// nova versão (via RPC registrar_versao_proposta) + ações de status
// (aceita/recusada) e prazo de resposta. Usado em src/routes/_authenticated/venda/propostas.tsx.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { propostaVersaoSchema } from "@/lib/schemas/propostaVersao.schema";

type PropostaVersaoRow = {
  id: string;
  versao: number;
  premio: number | null;
  forma_pagamento: string | null;
  parcelas: number | null;
  nota: string;
  criado_em: string;
};

export type PropostaResumo = {
  id: string;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  negociacao_status: string;
  prazo_resposta: string | null;
  segurado: string | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function negociacaoChip(s: string) {
  if (s === "em_negociacao") return <span className="chip chip-yellow">Em negociação</span>;
  if (s === "aceita") return <span className="chip chip-ok">Aceita</span>;
  if (s === "recusada") return <span className="chip chip-alert">Recusada</span>;
  return <span className="chip chip-slate">Aguardando</span>;
}

export { negociacaoChip };

export function NegociacaoPropostaPanel({
  proposta,
  onChanged,
}: {
  proposta: PropostaResumo;
  onChanged: () => void;
}) {
  const [versoes, setVersoes] = useState<PropostaVersaoRow[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [histErr, setHistErr] = useState<string | null>(null);

  const [premio, setPremio] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [nota, setNota] = useState("");
  const [prazo, setPrazo] = useState(proposta.prazo_resposta ?? "");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  async function loadHistorico() {
    setLoadingHist(true);
    setHistErr(null);
    const { data, error } = await supabase
      .from("proposta_versoes")
      .select("id,versao,premio,forma_pagamento,parcelas,nota,criado_em")
      .eq("proposta_id", proposta.id)
      .order("versao", { ascending: false });
    if (error) setHistErr(error.message);
    setVersoes((data ?? []) as PropostaVersaoRow[]);
    setLoadingHist(false);
  }

  useEffect(() => {
    void loadHistorico();
    setPrazo(proposta.prazo_resposta ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposta.id]);

  async function handleRegistrarVersao() {
    setFormErr(null);
    setOk(null);
    const premioNum = premio.trim() ? Number(premio.replace(",", ".")) : Number.NaN;
    const parcelasNum = parcelas.trim() ? Number(parcelas) : Number.NaN;
    const parsed = propostaVersaoSchema.safeParse({
      premio: premioNum,
      formaPagamento: formaPagamento.trim() || undefined,
      parcelas: parcelasNum,
      nota,
    });
    if (!parsed.success) {
      setFormErr(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("registrar_versao_proposta", {
      p_proposta_id: proposta.id,
      p_premio: Number.isNaN(premioNum) ? (proposta.premio ?? proposta.valor ?? 0) : premioNum,
      p_forma_pagamento: formaPagamento.trim() || "",
      p_parcelas: Number.isNaN(parcelasNum) ? 1 : parcelasNum,
      p_nota: parsed.data.nota,
    });
    setBusy(false);
    if (error) {
      setFormErr(error.message);
      return;
    }
    setPremio("");
    setFormaPagamento("");
    setParcelas("");
    setNota("");
    setOk("Nova versão registrada.");
    await loadHistorico();
    onChanged();
  }

  async function handleStatus(status: "aceita" | "recusada") {
    setBusy(true);
    setFormErr(null);
    const { error } = await supabase.rpc("definir_negociacao_status", {
      p_proposta_id: proposta.id,
      p_status: status,
    });
    setBusy(false);
    if (error) {
      setFormErr(error.message);
      return;
    }
    onChanged();
  }

  async function handlePrazo() {
    setBusy(true);
    setFormErr(null);
    const { error } = await supabase.rpc("definir_prazo_resposta", {
      p_proposta_id: proposta.id,
      ...(prazo ? { p_prazo: prazo } : {}),
    });
    setBusy(false);
    if (error) {
      setFormErr(error.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="prop-shell" style={{ marginTop: 18 }}>
      <div>
        <div className="card">
          <div className="card-h">
            <h3>Negociação · {proposta.segurado || "—"}</h3>
            {negociacaoChip(proposta.negociacao_status)}
          </div>
          <div className="card-b">
            <div className="kv" style={{ marginBottom: 4 }}>
              <b>Nº:</b> {proposta.numero || "—"}
            </div>
            <div className="kv" style={{ marginBottom: 4 }}>
              <b>Seguradora:</b> {proposta.seguradora || "—"}
            </div>
            <div className="kv" style={{ marginBottom: 4 }}>
              <b>Prêmio atual:</b> {fmtBRL(proposta.premio ?? proposta.valor)}
            </div>
            <div className="kv" style={{ marginBottom: 14 }}>
              <b>Prazo de resposta:</b>{" "}
              {proposta.prazo_resposta
                ? new Date(proposta.prazo_resposta).toLocaleDateString("pt-BR")
                : "não definido"}
            </div>

            {formErr && <div className="alert alert-err">{formErr}</div>}
            {ok && (
              <div
                className="chip chip-ok"
                style={{ display: "block", marginBottom: 12, padding: 8 }}
              >
                {ok}
              </div>
            )}

            <div className="prop-section">
              <h4>Registrar nova versão</h4>
              <div className="wizard-grid">
                <div className="field-group">
                  <label>Prêmio</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={premio}
                    onChange={(e) => setPremio(e.target.value)}
                    placeholder="ex.: 3420,00"
                    maxLength={20}
                  />
                </div>
                <div className="field-group">
                  <label>Forma de pagamento</label>
                  <input
                    className="input"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    placeholder="ex.: Cartão de crédito"
                    maxLength={60}
                  />
                </div>
                <div className="field-group">
                  <label>Parcelas</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={99}
                    value={parcelas}
                    onChange={(e) => setParcelas(e.target.value)}
                    placeholder="ex.: 12"
                  />
                </div>
              </div>
              <div className="field-group">
                <label>Nota para esta versão</label>
                <textarea
                  className="input"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={1000}
                  placeholder="Ex: cliente pediu redução de franquia."
                />
              </div>
              <div className="row" style={{ paddingTop: 10 }}>
                <span className="spacer" />
                <button className="btn btn-yellow" disabled={busy} onClick={handleRegistrarVersao}>
                  {busy ? "Registrando…" : "Registrar nova versão"}
                </button>
              </div>
            </div>

            <div
              className="prop-section"
              style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 14 }}
            >
              <h4>Ações</h4>
              <div className="field-group">
                <label>Prazo de resposta</label>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                  />
                  <button className="btn btn-ghost" disabled={busy} onClick={handlePrazo}>
                    Salvar prazo
                  </button>
                </div>
              </div>
              <div className="row" style={{ gap: 8, paddingTop: 8 }}>
                <button
                  className="btn btn-yellow"
                  disabled={busy}
                  onClick={() => handleStatus("aceita")}
                >
                  Marcar como Aceita
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => handleStatus("recusada")}
                >
                  Marcar como Recusada
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="history">
        <div className="h">Histórico de versões</div>
        {histErr && <div className="alert alert-err">{histErr}</div>}
        {loadingHist && (
          <div className="muted" style={{ padding: 12 }}>
            Carregando…
          </div>
        )}
        {!loadingHist && versoes.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>
            Nenhuma versão registrada ainda.
          </div>
        )}
        {versoes.map((v, i) => {
          const isCurrent = i === 0;
          const anterior = versoes[i + 1];
          const diffs: { l: string; from: string; to: string }[] = [];
          if (anterior) {
            if ((anterior.premio ?? null) !== (v.premio ?? null)) {
              diffs.push({ l: "Prêmio", from: fmtBRL(anterior.premio), to: fmtBRL(v.premio) });
            }
            if ((anterior.forma_pagamento ?? "") !== (v.forma_pagamento ?? "")) {
              diffs.push({
                l: "Forma de pagamento",
                from: anterior.forma_pagamento || "—",
                to: v.forma_pagamento || "—",
              });
            }
            if ((anterior.parcelas ?? null) !== (v.parcelas ?? null)) {
              diffs.push({
                l: "Parcelas",
                from: anterior.parcelas ? `${anterior.parcelas}x` : "—",
                to: v.parcelas ? `${v.parcelas}x` : "—",
              });
            }
          }
          return (
            <div className={`v-item ${isCurrent ? "current" : ""}`} key={v.id}>
              <div className="v-head">
                <span className={`v-tag ${isCurrent ? "curr" : ""}`}>V{v.versao}</span>
                <span className="v-date">{fmtDate(v.criado_em)}</span>
              </div>
              <div className="v-note">&ldquo;{v.nota}&rdquo;</div>
              {diffs.length > 0 && (
                <div className="diff">
                  {diffs.map((d) => (
                    <div className="di" key={d.l}>
                      <strong>{d.l}:</strong> <span className="from">{d.from}</span>
                      <span className="to">→ {d.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
