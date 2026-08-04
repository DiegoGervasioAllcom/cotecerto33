// V11.5b.5 — Aba "Personalização geral" › sub-aba "Histórico" da Franquia
// Full. Mesma estrutura de `HistoricoPanel` (G6.5: tabela, filtro de área,
// botão "Ver DE/PARA"), mas com filtro EXPLÍCITO de `empresa_id` — mais
// preciso do que confiar só no RLS de `historico_alteracoes` (que também
// deixaria passar histórico de eventuais "empresas-shell" de vendedores da
// própria Full, se algum dia tiverem linha própria — defensivo, não é bug
// hoje, mas evita depender só da policy implícita).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";

type DePara = { campo: string; de: unknown; para: unknown };

type LinhaHistorico = {
  id: string;
  quando: string;
  autor_nome: string;
  area: string;
  o_que: string;
  de_para: DePara[] | null;
};

const FILTRO_TODAS = "__todas__";

function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function FullHistoricoPanel({ empresaId }: { empresaId: string }) {
  const [filtroArea, setFiltroArea] = useState<string>(FILTRO_TODAS);
  const [detalheAberto, setDetalheAberto] = useState<LinhaHistorico | null>(null);

  const query = useQuery({
    queryKey: ["full-historico", empresaId],
    queryFn: async () => {
      // Sem paginação — o volume de alterações de política de UMA franquia
      // (régua + complementos) é bem menor que o histórico global da Matriz;
      // 200 linhas cobre com folga qualquer cenário real.
      const { data, error } = await supabase
        .from("historico_alteracoes")
        .select("id,quando,autor_nome,area,o_que,de_para")
        .eq("empresa_id", empresaId)
        .order("quando", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaHistorico[];
    },
  });

  const linhas = useMemo(() => query.data ?? [], [query.data]);
  const areas = useMemo(() => {
    const set = new Set(linhas.map((l) => l.area));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [linhas]);
  const linhasFiltradas = useMemo(() => {
    if (filtroArea === FILTRO_TODAS) return linhas;
    return linhas.filter((l) => l.area === filtroArea);
  }, [filtroArea, linhas]);

  if (query.isLoading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando histórico…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="history" size={16} /> Histórico da sua franquia
        </h3>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <label className="muted small" htmlFor="full-historico-filtro-area">
            Área
          </label>
          <select
            id="full-historico-filtro-area"
            className="input"
            style={{ maxWidth: 220 }}
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
          >
            <option value={FILTRO_TODAS}>Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      {query.error && (
        <div className="card-b">
          <div className="banner alert">{(query.error as Error).message}</div>
        </div>
      )}
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Área</th>
              <th>O que</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 24 }}>
                  <span className="muted small">Nenhuma alteração registrada ainda.</span>
                </td>
              </tr>
            )}
            {linhasFiltradas.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(l.quando).toLocaleString("pt-BR")}
                </td>
                <td>{l.autor_nome}</td>
                <td>{l.area}</td>
                <td>{l.o_que}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {Array.isArray(l.de_para) && l.de_para.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetalheAberto(l)}>
                      <Icon id="eye" size={13} /> Ver DE/PARA
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalheAberto && (
        <div
          className="modal-host"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetalheAberto(null);
          }}
        >
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-h">
              <Icon id="history" size={18} />
              <h3>DE/PARA — {detalheAberto.o_que}</h3>
              <div
                className="x"
                onClick={() => setDetalheAberto(null)}
                role="button"
                aria-label="Fechar"
              >
                <Icon id="x" size={18} />
              </div>
            </div>
            <div className="modal-b">
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                {detalheAberto.autor_nome} ·{" "}
                {new Date(detalheAberto.quando).toLocaleString("pt-BR")} · {detalheAberto.area}
              </p>
              <table className="table-pipe">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>De</th>
                    <th>Para</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalheAberto.de_para ?? []).map((d, i) => (
                    <tr key={i}>
                      <td>{d.campo}</td>
                      <td>{formatarValor(d.de)}</td>
                      <td>{formatarValor(d.para)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-f">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setDetalheAberto(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
