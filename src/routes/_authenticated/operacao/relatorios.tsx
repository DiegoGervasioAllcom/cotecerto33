import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv, exportPdf } from "@/lib/export-relatorio";
import { monthPeriodo, periodoOptions, ultimosDiasPeriodo } from "@/lib/relatorios/periodo";
import { RELATORIOS } from "@/lib/relatorios/registro";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";

export const Route = createFileRoute("/_authenticated/operacao/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CoteCerto" }] }),
  component: Page,
});

function RepCard({
  reportKey,
  titulo,
  descricao,
  icone,
  onExport,
  loading,
  erro,
}: {
  reportKey: string;
  titulo: string;
  descricao: string;
  icone: string;
  onExport: (formato: "pdf" | "csv") => void;
  loading: "pdf" | "csv" | null;
  erro: string | null;
}) {
  return (
    <div className="rep-card" key={reportKey}>
      <div className="rc-ic">
        <svg width="20" height="20">
          <use href={`#i-${icone}`} />
        </svg>
      </div>
      <div className="rc-t">{titulo}</div>
      <div className="rc-d">{descricao}</div>
      {erro && (
        <div className="small" style={{ color: "var(--alert)" }}>
          {erro}
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-ghost btn-sm"
          disabled={loading !== null}
          onClick={() => onExport("pdf")}
        >
          <svg width="13" height="13">
            <use href="#i-file" />
          </svg>{" "}
          {loading === "pdf" ? "Gerando…" : "PDF"}
        </button>
        <button
          className="btn btn-yellow btn-sm"
          disabled={loading !== null}
          onClick={() => onExport("csv")}
        >
          <svg width="13" height="13">
            <use href="#i-download" />
          </svg>{" "}
          {loading === "csv" ? "Gerando…" : "Excel"}
        </button>
      </div>
    </div>
  );
}

const PERIODO_90_DIAS = "90dias";

function Page() {
  const { profile } = useAuth();
  const { isFranqFull } = useGroupScope();
  const [periodOffset, setPeriodOffset] = useState<number | typeof PERIODO_90_DIAS>(0);
  const periodo = useMemo(
    () => (periodOffset === PERIODO_90_DIAS ? ultimosDiasPeriodo(90) : monthPeriodo(periodOffset)),
    [periodOffset],
  );
  const periodOpts = useMemo(() => periodoOptions(), []);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [formatoAtivo, setFormatoAtivo] = useState<"pdf" | "csv" | null>(null);
  const [erros, setErros] = useState<Record<string, string | null>>({});
  const [franquiaId, setFranquiaId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [franquias, setFranquias] = useState<{ id: string; nome: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const [em, pr] = await Promise.all([
        supabase.from("empresas").select("id,nome").order("nome"),
        supabase.from("profiles").select("id,nome").order("nome"),
      ]);
      setFranquias((em.data ?? []) as { id: string; nome: string }[]);
      setVendedores(
        ((pr.data ?? []) as { id: string; nome: string }[]).filter(
          (vendedor) => !isFranqFull || vendedor.id !== profile?.id,
        ),
      );
    })();
  }, [isFranqFull, profile?.id]);

  async function gerar(reportKey: string, formato: "pdf" | "csv") {
    const def = RELATORIOS.find((r) => r.key === reportKey);
    if (!def) return;
    setLoadingKey(reportKey);
    setFormatoAtivo(formato);
    setErros((prev) => ({ ...prev, [reportKey]: null }));
    try {
      const { colunas, linhas, resumo } = await def.fetch(periodo, {
        empresaId: franquiaId || undefined,
        vendedorId: vendedorId || undefined,
      });
      if (formato === "csv") {
        exportCsv(`${def.titulo}-${periodo.label}`, colunas, linhas);
      } else {
        await exportPdf(def.titulo, colunas, linhas, { periodo: periodo.label, resumo });
      }
    } catch (e) {
      setErros((prev) => ({
        ...prev,
        [reportKey]: e instanceof Error ? e.message : "Falha ao gerar o relatório.",
      }));
    } finally {
      setLoadingKey(null);
      setFormatoAtivo(null);
    }
  }

  return (
    <AppShell title="Relatórios">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <div className="sub">Central de exportação — escolha o recorte e o formato</div>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">RECORTE</span>
        <select
          className="select-mini"
          value={periodOffset}
          onChange={(e) =>
            setPeriodOffset(
              e.target.value === PERIODO_90_DIAS ? PERIODO_90_DIAS : Number(e.target.value),
            )
          }
        >
          {periodOpts.map((p) => (
            <option key={p.off} value={p.off}>
              {p.label}
            </option>
          ))}
          <option value={PERIODO_90_DIAS}>Últimos 90 dias</option>
        </select>
        <select
          className="select-mini"
          value={franquiaId}
          onChange={(e) => setFranquiaId(e.target.value)}
        >
          <option value="">Todas as franquias</option>
          {franquias.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          value={vendedorId}
          onChange={(e) => setVendedorId(e.target.value)}
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="rep-grid">
        {RELATORIOS.map((r) => (
          <RepCard
            key={r.key}
            reportKey={r.key}
            titulo={r.titulo}
            descricao={r.descricao}
            icone={r.icone}
            loading={loadingKey === r.key ? formatoAtivo : null}
            erro={erros[r.key] ?? null}
            onExport={(formato) => gerar(r.key, formato)}
          />
        ))}
      </div>
    </AppShell>
  );
}
