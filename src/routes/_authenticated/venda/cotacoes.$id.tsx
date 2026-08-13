import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import {
  ComparativoQuiver,
  type PremioComparativo,
  type SolicitacaoComparativo,
} from "@/components/venda/cotacoes/ComparativoQuiver";
import { parseQuiverResultado } from "@/components/venda/cotacoes/quiver-resultado";
import { supabase } from "@/integrations/supabase/client";
import { maskCpfCnpj } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/venda/cotacoes/$id")({
  head: () => ({ meta: [{ title: "Comparativo · CoteCerto" }] }),
  component: Page,
});

type Data = {
  id: string;
  numero: number;
  status: string;
  criado_em: string;
  quiver_resultado_raw: unknown;
  segurado: { nome: string | null; cpf_cnpj: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
    placa: string | null;
  } | null;
  premios: PremioComparativo[];
};

type Solicitacao = SolicitacaoComparativo & { criado_em: string };

type ComparativoData = {
  cotacao: Data | null;
  seguradoras: { id: string; nome: string }[];
  solicitacoes: Solicitacao[];
};

const pad = (numero: number) => String(numero).padStart(5, "0");
const cotNum = (numero: number, criadoEm: string) =>
  `COT-${new Date(criadoEm).getFullYear()}-${pad(numero)}`;

async function fetchComparativo(id: string): Promise<ComparativoData> {
  const [cotacaoResult, seguradorasResult, solicitacoesResult] = await Promise.all([
    supabase
      .from("cotacoes")
      .select(
        "id,numero,status,criado_em,quiver_resultado_raw," +
          "segurado:cotacao_segurado(nome,cpf_cnpj)," +
          "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa)," +
          "premios:cotacao_premios(id,seguradora,cobertura,premio)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("seguradoras").select("id,nome"),
    supabase
      .from("desconto_solicitacoes")
      .select("id,seguradora_id,pct_pedido,pct_concedido,status,criado_em")
      .eq("cotacao_id", id)
      .order("criado_em", { ascending: false }),
  ]);
  const error = cotacaoResult.error ?? seguradorasResult.error ?? solicitacoesResult.error;
  if (error) throw error;
  return {
    cotacao: cotacaoResult.data as unknown as Data | null,
    seguradoras: seguradorasResult.data ?? [],
    solicitacoes: solicitacoesResult.data ?? [],
  };
}

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [busySolId, setBusySolId] = useState<string | null>(null);

  const queryKey = ["comparativo-cotacao", id] as const;
  const comparativoQuery = useQuery({ queryKey, queryFn: () => fetchComparativo(id) });
  const data = comparativoQuery.data?.cotacao ?? null;
  const seguradoras = comparativoQuery.data?.seguradoras ?? [];
  const solicitacoes = comparativoQuery.data?.solicitacoes ?? [];
  const erro =
    erroAcao ?? (comparativoQuery.error instanceof Error ? comparativoQuery.error.message : null);

  const descontoMutation = useMutation({
    mutationFn: async ({
      solicitacaoId,
      acao,
    }: {
      solicitacaoId: string;
      acao: "aceitar" | "cancelar";
    }) => {
      setBusySolId(solicitacaoId);
      const result =
        acao === "aceitar"
          ? await supabase.rpc("aceitar_desconto", { p_id: solicitacaoId })
          : await supabase.rpc("cancelar_desconto", { p_id: solicitacaoId });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      setErroAcao(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) =>
      setErroAcao(error instanceof Error ? error.message : "Falha ao atualizar desconto."),
    onSettled: () => setBusySolId(null),
  });

  async function handleAceitar(solicitacaoId: string) {
    await descontoMutation.mutateAsync({ solicitacaoId, acao: "aceitar" }).catch(() => undefined);
  }

  async function handleCancelar(solicitacaoId: string) {
    await descontoMutation.mutateAsync({ solicitacaoId, acao: "cancelar" }).catch(() => undefined);
  }

  if (comparativoQuery.isLoading) {
    return (
      <AppShell title="Comparativo">
        <div className="muted">Carregando…</div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Comparativo">
        <ProtoIcons />
        <div className="alert alert-err">{erro || "Cotação não encontrada."}</div>
        <Link to="/venda/cotacoes" className="btn">
          <svg width={14} height={14}>
            <use href="#i-chevron-left" />
          </svg>{" "}
          Voltar para lista
        </Link>
      </AppShell>
    );
  }

  const headName = data.segurado?.nome || "—";
  const veiculo = data.veiculo;
  const headCar = veiculo
    ? `${veiculo.marca_nome ?? ""} ${veiculo.modelo_nome ?? ""} ${veiculo.ano_modelo ?? ""}`.trim() ||
      "—"
    : "—";
  const numero = cotNum(data.numero, data.criado_em);
  const resultados = parseQuiverResultado(data.quiver_resultado_raw);

  return (
    <AppShell title="Comparativo">
      <ProtoIcons />
      {erro && <div className="alert alert-err">{erro}</div>}
      <div className="page-head">
        <div>
          <h1>Comparativo · {headName}</h1>
          <div className="sub">
            {headCar} {veiculo?.placa ? `· ${veiculo.placa}` : ""} · cotação{" "}
            <strong>#{numero}</strong>
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost" onClick={() => navigate({ to: "/venda/cotacoes" })}>
            <svg width={14} height={14}>
              <use href="#i-chevron-left" />
            </svg>{" "}
            Voltar para lista
          </button>
          <Link
            to="/venda/novo-lead"
            search={{ id: data.id }}
            className="btn btn-ghost"
            data-tour="comparar-mais"
          >
            <svg width={14} height={14}>
              <use href="#i-plus" />
            </svg>{" "}
            Comparar com mais seguradoras
          </Link>
        </div>
      </div>

      <ComparativoQuiver
        cotacaoId={data.id}
        resultados={resultados}
        premios={data.premios ?? []}
        seguradoras={seguradoras}
        solicitacoes={solicitacoes}
        busySolId={busySolId}
        onAceitar={(solicitacaoId) => void handleAceitar(solicitacaoId)}
        onCancelar={(solicitacaoId) => void handleCancelar(solicitacaoId)}
        onDescontoEnviado={() => void queryClient.invalidateQueries({ queryKey })}
        printMeta={`${headName} · ${headCar} · #${numero}${
          data.segurado?.cpf_cnpj ? ` · ${maskCpfCnpj(data.segurado.cpf_cnpj)}` : ""
        }`}
      />

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card card-yellow" style={{ padding: "14px 18px" }}>
          <strong style={{ color: "var(--slate)", fontSize: 13 }}>Resultado da cotação</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            {resultados.length} produto{resultados.length === 1 ? "" : "s"} retornado
            {resultados.length === 1 ? "" : "s"} pelas seguradoras, com todas as opções disponíveis.
          </p>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <strong style={{ color: "var(--slate)", fontSize: 13 }}>Histórico do cliente</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
            {data.segurado?.cpf_cnpj
              ? `CPF/CNPJ ${maskCpfCnpj(data.segurado.cpf_cnpj)}.`
              : "Sem documento registrado."}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
