import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { MobileEstado, MobileShell } from "@/components/mobile/MobileShell";
import { rotuloStatusCotacao } from "@/components/mobile/status";
import { docDadosDoBanco } from "@/components/venda/cotacoes/doc-dados";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import {
  ordenarResultados,
  parseQuiverResultado,
} from "@/components/venda/cotacoes/quiver-resultado";
import { CALCULO_POLL_MS, useCalculoProgresso } from "@/hooks/useCalculoProgresso";
import { useSeguradorasDoCalculo } from "@/hooks/useSeguradorasDoCalculo";
import { supabase } from "@/integrations/supabase/client";
import { linkWhatsapp, montarMensagemWhatsappComResumo } from "@/lib/cotacao-envio";
import { estadoCalculoMobile } from "@/lib/cotacao-estado-mobile";

export const Route = createFileRoute("/_authenticated/m/cotacoes/$id")({
  component: DetalheMobile,
});

async function fetchCotacao(id: string) {
  const { data, error } = await supabase
    .from("cotacoes")
    .select(
      "id,numero,status,criado_em,quiver_resultado_raw,segurado:cotacao_segurado(nome,celular,cpf_cnpj),veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function DetalheMobile() {
  const { id } = Route.useParams();
  const progressoMap = useCalculoProgresso([id]);
  const progresso = progressoMap.get(id);
  const emCurso = !!progresso?.etapa && !progresso.final;

  const query = useQuery({
    queryKey: ["cotacoes", "m-detalhe", id],
    queryFn: () => fetchCotacao(id),
    // Fallback por status: relê enquanto calcula, caso o Realtime caia.
    refetchInterval: (q) =>
      emCurso || q.state.data?.status === "rascunho" ? CALCULO_POLL_MS * 2 : false,
  });
  const { refetch } = query;

  // Rede móvel instável: ao voltar para a aba, relê a cotação.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refetch]);

  // Ao concluir pelo progresso, relê para trazer os resultados.
  const final = progresso?.final;
  useEffect(() => {
    if (final) void refetch();
  }, [final, refetch]);

  const c = query.data;
  const resultados = useMemo(() => parseQuiverResultado(c?.quiver_resultado_raw), [c]);
  const estado = c ? estadoCalculoMobile(progresso, c.status, resultados.length > 0) : "aguardando";
  const totalSeg = useSeguradorasDoCalculo(id, estado === "calculando", progresso?.etapa);

  const numero = c ? cotNum(c.numero, c.criado_em) : "";
  const doc = useMemo(() => {
    if (!c) return null;
    return docDadosDoBanco(
      { cotacaoNumero: numero, cotacaoId: c.id, segurado: c.segurado, veiculo: c.veiculo },
      ordenarResultados(resultados),
    );
  }, [c, numero, resultados]);

  if (query.isLoading)
    return (
      <Shell>
        <MobileEstado>Carregando…</MobileEstado>
      </Shell>
    );
  if (query.isError) {
    return (
      <Shell>
        <MobileEstado erro>
          Não foi possível carregar.{" "}
          <button type="button" className="m-btn" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </MobileEstado>
      </Shell>
    );
  }
  if (!c || !doc)
    return (
      <Shell>
        <MobileEstado>Cotação não encontrada.</MobileEstado>
      </Shell>
    );

  const v = c.veiculo;
  const veic = [v?.marca_nome, v?.modelo_nome, v?.ano_modelo].filter(Boolean).join(" ");
  const ofertas = doc.seguradoras;
  const podeEnviar = estado === "pronta" && ofertas.some((o) => o.precoLabel);

  return (
    <Shell>
      <div className="m-card">
        <div className="m-card-top">
          <span>{numero}</span>
          <span className="m-badge">{rotuloStatusCotacao(c.status)}</span>
        </div>
        <div className="m-card-title">{c.segurado?.nome ?? "Sem segurado"}</div>
        <div className="m-card-sub">
          {veic || "Veículo não informado"}
          {v?.placa ? ` · ${v.placa}` : ""}
        </div>
      </div>

      {estado === "calculando" && progresso && (
        <div className="m-card" role="status" aria-live="polite">
          <div className="m-card-top">
            <span>{progresso.rotulo}</span>
            <span>
              {progresso.passo}/{progresso.totalPassos}
            </span>
          </div>
          <div
            className="m-progress"
            role="progressbar"
            aria-valuenow={progresso.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="m-progress-bar" style={{ width: `${progresso.percent}%` }} />
          </div>
          <div className="m-card-sub">
            {totalSeg ? `Consultando ${totalSeg} seguradoras. ` : ""}
            Ainda calculando, pode sair da tela.
            {progresso.semAtualizacaoHaSegundos !== null &&
              ` Sem atualização há ${progresso.semAtualizacaoHaSegundos} s.`}
          </div>
        </div>
      )}
      {estado === "aguardando" && (
        <MobileEstado>Aguardando o início do cálculo. Pode sair da tela.</MobileEstado>
      )}
      {estado === "erro" && (
        <MobileEstado erro>
          {progresso?.erro ?? "O cálculo falhou."} Para refazer, abra a versão completa.
        </MobileEstado>
      )}

      {estado === "pronta" && ofertas.length === 0 && (
        <MobileEstado>Nenhum prêmio retornado.</MobileEstado>
      )}
      {estado === "pronta" &&
        ofertas.map((o) => (
          <div key={o.id} className="m-card">
            <div className="m-card-top">
              <span>{o.seguradora}</span>
              <strong>{o.precoLabel ?? "—"}</strong>
            </div>
            {o.planoNome && <div className="m-card-sub">{o.planoNome}</div>}
            {o.opcoes[0]?.parcelasOpcoes?.[0] && (
              <div className="m-card-sub">{o.opcoes[0].parcelasOpcoes[0]}</div>
            )}
          </div>
        ))}

      {podeEnviar && (
        <a
          className="m-btn"
          href={linkWhatsapp(c.segurado?.celular, montarMensagemWhatsappComResumo(doc))}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </a>
      )}
      <Link to="/venda/cotacoes/$id" params={{ id }} className="m-btn">
        Abrir na versão completa
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <MobileShell titulo="Cotação">{children}</MobileShell>;
}
