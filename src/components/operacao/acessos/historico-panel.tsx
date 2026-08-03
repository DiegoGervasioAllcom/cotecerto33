// Aba "Personalização geral" — sub-aba "Histórico" (G6.5). Leitura pura de
// `historico_alteracoes` (append-only, V11.0.6): a RLS já filtra por área
// (mconf/macessos veem o histórico global) ou por empresas_visiveis(), então
// esta tela não decide nada de escopo — só lista o que a query devolve.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

function chaveFiltro(userId: string): string {
  return `historico-filtro-area:${userId}`;
}

function readStoredFiltro(userId: string): string {
  try {
    return localStorage.getItem(chaveFiltro(userId)) ?? FILTRO_TODAS;
  } catch {
    return FILTRO_TODAS;
  }
}

function writeStoredFiltro(userId: string, area: string) {
  try {
    localStorage.setItem(chaveFiltro(userId), area);
  } catch {
    /* armazenamento pode estar indisponível */
  }
}

function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function HistoricoPanel() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [linhas, setLinhas] = useState<LinhaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>(FILTRO_TODAS);
  const [detalheAberto, setDetalheAberto] = useState<LinhaHistorico | null>(null);
  const [filtroCarregado, setFiltroCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function load() {
      setLoading(true);
      setErr(null);
      // Sem paginação nesta primeira versão — 200 linhas mais recentes cobre
      // com folga o volume real de alterações de política (não é log de
      // ação de usuário, é só a governança das 4 telas gated + diretores).
      const { data, error } = await supabase
        .from("historico_alteracoes")
        .select("id,quando,autor_nome,area,o_que,de_para")
        .order("quando", { ascending: false })
        .limit(200);
      if (!ativo) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      setLinhas((data ?? []) as unknown as LinhaHistorico[]);
      setLoading(false);
    }
    void load();
    return () => {
      ativo = false;
    };
  }, []);

  // Restaura o filtro salvo por usuário só depois de saber quem é o usuário
  // — evita gravar/ler com uma chave errada durante o primeiro render.
  useEffect(() => {
    if (!uid || filtroCarregado) return;
    setFiltroArea(readStoredFiltro(uid));
    setFiltroCarregado(true);
  }, [uid, filtroCarregado]);

  const areas = useMemo(() => {
    const set = new Set(linhas.map((l) => l.area));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [linhas]);

  const linhasFiltradas = useMemo(() => {
    if (filtroArea === FILTRO_TODAS) return linhas;
    return linhas.filter((l) => l.area === filtroArea);
  }, [filtroArea, linhas]);

  function selecionarFiltro(area: string) {
    setFiltroArea(area);
    if (uid) writeStoredFiltro(uid, area);
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="history" size={16} /> Histórico
        </h3>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <label className="muted small" htmlFor="historico-filtro-area">
            Área
          </label>
          <select
            id="historico-filtro-area"
            className="input"
            style={{ maxWidth: 240 }}
            value={filtroArea}
            onChange={(e) => selecionarFiltro(e.target.value)}
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
      {err && (
        <div className="card-b">
          <div className="banner alert">{err}</div>
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
                  <span className="muted small">Nenhuma alteração registrada.</span>
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
