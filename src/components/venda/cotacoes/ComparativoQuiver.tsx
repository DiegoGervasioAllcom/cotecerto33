import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SolicitarDescontoModal } from "@/components/venda/solicitar-desconto-modal";
import { supabase } from "@/integrations/supabase/client";
import { transmitirPropostaQuiver } from "@/lib/quiver.functions";
import { escapeHtml, fmtBRL, printHtml } from "@/lib/print";
import {
  faixasComParcelas,
  formasPagamentoResultado,
  gruposOpcoesResultado,
  ordenarResultados,
  premioNumerico,
  tituloResultado,
  vincularPremiosQuiver,
  type ResultadoCalculo,
} from "./quiver-resultado";

const POLL_TRANSMISSAO_MS = 4000;

type TransmissaoResultado = {
  status: "enviada" | "transmitida" | "falha";
  motivo: string | null;
  mensagem: string | null;
  propostaId: string | null;
};

type EscolhaCard = { grupoId: string; opcaoId: string };

export type PremioComparativo = {
  id: string;
  seguradora: string;
  cobertura: string | null;
  premio: number;
};

export type SolicitacaoComparativo = {
  id: string;
  seguradora_id: string;
  pct_pedido: number;
  pct_concedido: number | null;
  status: string;
};

type Props = {
  cotacaoId: string;
  resultados: ResultadoCalculo[];
  premios: PremioComparativo[];
  seguradoras: { id: string; nome: string }[];
  solicitacoes: SolicitacaoComparativo[];
  busySolId: string | null;
  onAceitar: (id: string) => void;
  onCancelar: (id: string) => void;
  onDescontoEnviado: () => void;
  printMeta: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aguardando_aceite: "Aguardando seu aceite",
  aprovado: "Aprovado",
  negado: "Negado",
  cancelado: "Cancelado",
};
const STATUS_CHIP: Record<string, string> = {
  pendente: "chip-yellow",
  aguardando_aceite: "chip-info",
  aprovado: "chip-ok",
  negado: "chip-alert",
  cancelado: "chip-outline",
};

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

function coberturaEntries(resultado: ResultadoCalculo) {
  return [
    ...Object.entries(resultado.coberturasBasicas ?? {}),
    ...Object.entries(resultado.coberturasAdicionais ?? {}),
  ];
}

const opcaoTexto = (opcao: ResultadoCalculo["opcoes"][number]) =>
  [opcao.tipo, opcao.franquia, opcao.avista, opcao.parcelas, opcao.desconto]
    .filter(Boolean)
    .join(" · ");

const DETAIL_COLUMN_WIDTH = 190;
const OFFER_COLUMN_WIDTH = 280;

export function ComparativoQuiver({
  cotacaoId,
  resultados,
  premios,
  seguradoras,
  solicitacoes,
  busySolId,
  onAceitar,
  onCancelar,
  onDescontoEnviado,
  printMeta,
}: Props) {
  const [descontoModal, setDescontoModal] = useState<PremioComparativo | null>(null);
  // Escolha de forma de pagamento/parcelas por card — mesmo mecanismo do
  // StepCalculo (novo-lead), replicado aqui pra "Gerar proposta" transmitir
  // de verdade em vez do link estático que existia antes.
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaCard>>({});
  const [transmitindoCardId, setTransmitindoCardId] = useState<string | null>(null);
  const [erroProposta, setErroProposta] = useState<string | null>(null);
  const [transmissaoEmAndamento, setTransmissaoEmAndamento] = useState<{
    tentativaId: string;
    card: ResultadoCalculo;
  } | null>(null);
  const [resultadoTransmissao, setResultadoTransmissao] = useState<TransmissaoResultado | null>(
    null,
  );
  const pollTransmissaoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    canScrollBack: false,
    canScrollForward: false,
  });
  const offers = useMemo(() => ordenarResultados(resultados), [resultados]);
  const tableMinWidth = DETAIL_COLUMN_WIDTH + offers.length * OFFER_COLUMN_WIDTH;
  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const hasOverflow = maxScrollLeft > 1;
    setScrollState({
      hasOverflow,
      canScrollBack: hasOverflow && element.scrollLeft > 1,
      canScrollForward: hasOverflow && element.scrollLeft < maxScrollLeft - 1,
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    const table = element.querySelector("table");
    if (table) observer.observe(table);

    return () => observer.disconnect();
  }, [offers, updateScrollState]);

  const scrollOffers = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * OFFER_COLUMN_WIDTH,
      behavior: "smooth",
    });
  };
  const scrollNotice = scrollState.canScrollBack
    ? scrollState.canScrollForward
      ? "Há mais propostas à esquerda e à direita."
      : "Há mais propostas à esquerda."
    : "Há mais propostas à direita.";
  const coberturaLabels = useMemo(
    () => [
      ...new Set(
        offers.flatMap((resultado) => coberturaEntries(resultado).map(([label]) => label)),
      ),
    ],
    [offers],
  );
  const vinculados = useMemo(() => vincularPremiosQuiver(offers, premios), [offers, premios]);
  const cardsPorSeguradora = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const resultado of offers) {
      const chave = normalizar(resultado.seguradora);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return contagem;
  }, [offers]);

  const seguradoraId = (nome: string) =>
    seguradoras.find((seguradora) => normalizar(seguradora.nome) === normalizar(nome))?.id ?? null;
  const solicitacaoFor = (nome: string) => {
    const id = seguradoraId(nome);
    if (!id) return null;
    return (
      solicitacoes.find(
        (solicitacao) =>
          solicitacao.seguradora_id === id &&
          ["pendente", "aguardando_aceite"].includes(solicitacao.status),
      ) ??
      solicitacoes.find((solicitacao) => solicitacao.seguradora_id === id) ??
      null
    );
  };

  function pararPollingTransmissao() {
    if (pollTransmissaoTimer.current) {
      clearInterval(pollTransmissaoTimer.current);
      pollTransmissaoTimer.current = null;
    }
  }

  useEffect(() => {
    return () => pararPollingTransmissao();
  }, []);

  function iniciarPollingTransmissao(tentativaId: string) {
    pararPollingTransmissao();
    pollTransmissaoTimer.current = setInterval(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("cotacao_transmissoes")
          .select("status,motivo,mensagem,proposta_id")
          .eq("id", tentativaId)
          .maybeSingle();
        if (error || !data) return;
        if (data.status !== "enviada") {
          pararPollingTransmissao();
          setResultadoTransmissao({
            status: data.status as TransmissaoResultado["status"],
            motivo: data.motivo,
            mensagem: data.mensagem,
            propostaId: data.proposta_id,
          });
        }
      })();
    }, POLL_TRANSMISSAO_MS);
  }

  function tentarNovamente() {
    pararPollingTransmissao();
    setTransmissaoEmAndamento(null);
    setResultadoTransmissao(null);
  }

  function escolhaDoCard(r: ResultadoCalculo): EscolhaCard {
    const primeiroGrupo = gruposOpcoesResultado(r)[0];
    return (
      escolhas[r.cardId] ?? {
        grupoId: primeiroGrupo?.id ?? "",
        opcaoId: primeiroGrupo?.opcoes[0]?.id ?? "",
      }
    );
  }

  function setEscolha(cardId: string, escolha: EscolhaCard) {
    setEscolhas((atual) => ({ ...atual, [cardId]: escolha }));
  }

  async function gerarProposta(r: ResultadoCalculo) {
    if (!cotacaoId) {
      setErroProposta("Salve a cotação antes de gerar a proposta.");
      return;
    }
    const escolha = escolhaDoCard(r);
    const grupo = gruposOpcoesResultado(r).find((item) => item.id === escolha.grupoId);
    const opcao = grupo?.opcoes.find((item) => item.id === escolha.opcaoId);
    if (!grupo || !opcao) {
      setErroProposta(
        "Esta cotação não possui uma combinação de pagamento válida para transmissão.",
      );
      return;
    }

    setErroProposta(null);
    setResultadoTransmissao(null);
    setTransmitindoCardId(r.cardId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resposta = await transmitirPropostaQuiver({
        data: {
          cotacaoId,
          caller_token: sess.session?.access_token ?? "",
          seguradora: r.seguradora,
          produtoId: r.produtoId,
          produto: r.produto || r.nome || undefined,
          formaPagamento: grupo.formaPagamento,
          parcelas: opcao.parcelas,
          premio: premioNumerico(opcao),
        },
      });
      setTransmissaoEmAndamento({ tentativaId: resposta.tentativaId, card: r });
      iniciarPollingTransmissao(resposta.tentativaId);
    } catch (e) {
      setErroProposta(e instanceof Error ? e.message : "Falha ao gerar a proposta.");
    } finally {
      setTransmitindoCardId(null);
    }
  }

  const doPrint = (onlyCardId?: string) => {
    const list = onlyCardId == null ? offers : offers.filter((item) => item.cardId === onlyCardId);
    const headers = list
      .map(
        (item) =>
          `<th>${escapeHtml(item.seguradora)}<br><small>${escapeHtml(tituloResultado(item))}</small></th>`,
      )
      .join("");
    const coverageRows = coberturaLabels
      .map(
        (label) =>
          `<tr><td><strong>${escapeHtml(label)}</strong></td>${list
            .map((item) => {
              const value = coberturaEntries(item).find(([candidate]) => candidate === label)?.[1];
              return `<td>${escapeHtml(value || "—")}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");
    const paymentRow = `<tr><td><strong>Opções por forma de pagamento</strong></td>${list
      .map(
        (item) =>
          `<td>${
            gruposOpcoesResultado(item)
              .map(
                (grupo) =>
                  `<strong>${escapeHtml(grupo.formaPagamento)}</strong>${grupo.opcoes
                    .map((opcao) => `<div>${escapeHtml(opcaoTexto(opcao) || "—")}</div>`)
                    .join("")}`,
              )
              .join("<br>") || "—"
          }<br><small>Formas disponíveis: ${escapeHtml(formasPagamentoResultado(item).join(" · ") || "—")}</small></td>`,
      )
      .join("")}</tr>`;
    const registeredRow = `<tr><td><strong>Prêmio registrado</strong></td>${list
      .map((item) => {
        const premio = vinculados.get(item.cardId);
        return `<td>${escapeHtml(premio ? fmtBRL(Number(premio.premio)) : "Vínculo indisponível")}</td>`;
      })
      .join("")}</tr>`;
    printHtml(
      onlyCardId == null ? "Comparativo de cotação" : `Cotação · ${list[0]?.seguradora ?? ""}`,
      `<h1>Comparativo de cotação</h1><div class="sub">${escapeHtml(printMeta)}</div><table><tr><th>Detalhe</th>${headers}</tr>${coverageRows}${paymentRow}${registeredRow}</table><p style="font-size:11px;color:#64748b">Valores e condições retornados pela seguradora. Sujeitos à aceitação.</p>`,
    );
  };

  if (offers.length === 0) {
    return (
      <div className="card">
        <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
          Nenhum resultado detalhado foi retornado pelas seguradoras.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="compare-bar">
        <span className="muted small">
          Cada coluna representa um produto/opção retornado pela seguradora.
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => doPrint()}>
          Imprimir comparativo
        </button>
      </div>

      {erroProposta && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--alert-soft)",
            color: "var(--alert)",
            fontSize: 13,
          }}
        >
          {erroProposta}
        </div>
      )}

      {transmissaoEmAndamento && (
        <div className="card" style={{ padding: 20, marginBottom: 12, textAlign: "center" }}>
          <div className="calc-ins" style={{ justifyContent: "center", marginBottom: 12 }}>
            <svg width="18" height="18">
              <use href="#i-shield" />
            </svg>{" "}
            {transmissaoEmAndamento.card.seguradora}
          </div>

          {!resultadoTransmissao && (
            <>
              <svg width="28" height="28" className="pulse" style={{ margin: "0 auto 12px" }}>
                <use href="#i-clock" />
              </svg>
              <div>Aguardando confirmação da seguradora…</div>
              <div className="sub" style={{ marginTop: 4 }}>
                O robô já enviou a proposta ao portal — o resultado costuma chegar em instantes.
              </div>
            </>
          )}

          {resultadoTransmissao?.status === "transmitida" && (
            <>
              <svg width="28" height="28" style={{ color: "var(--ok, #16a34a)" }}>
                <use href="#i-check" />
              </svg>
              <div style={{ marginTop: 8, fontWeight: 600 }}>Proposta transmitida com sucesso</div>
              <Link
                to="/venda/emissao"
                search={
                  resultadoTransmissao.propostaId
                    ? { selected: resultadoTransmissao.propostaId }
                    : {}
                }
                className="btn btn-yellow"
                style={{ marginTop: 12 }}
              >
                Ir para Emissão
              </Link>
            </>
          )}

          {resultadoTransmissao?.status === "falha" && (
            <>
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--alert-soft)",
                  color: "var(--alert)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                {resultadoTransmissao.motivo && (
                  <span className="chip chip-slate" style={{ marginRight: 8 }}>
                    {resultadoTransmissao.motivo}
                  </span>
                )}
                {resultadoTransmissao.mensagem ||
                  "A seguradora recusou a transmissão desta proposta."}
              </div>
              <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
                {resultadoTransmissao.motivo === "RECUSADA_PELO_PORTAL" ? (
                  resultadoTransmissao.propostaId && (
                    <Link
                      to="/venda/em-negociacao"
                      search={{ selected: resultadoTransmissao.propostaId }}
                      className="btn btn-slate"
                    >
                      Ver proposta
                    </Link>
                  )
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={tentarNovamente}>
                      Tentar novamente
                    </button>
                    {resultadoTransmissao.propostaId && (
                      <Link
                        to="/venda/em-finalizacao"
                        search={{ selected: resultadoTransmissao.propostaId }}
                        className="btn btn-slate"
                      >
                        Ver proposta
                      </Link>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {!transmissaoEmAndamento && scrollState.hasOverflow && (
        <div
          className="compare-bar"
          role="group"
          aria-label="Navegação entre propostas do comparativo"
        >
          <span className="muted small" role="status">
            {scrollNotice}
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={!scrollState.canScrollBack}
            aria-label="Ver proposta anterior"
            onClick={() => scrollOffers(-1)}
          >
            ‹ Anterior
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={!scrollState.canScrollForward}
            aria-label="Ver próxima proposta"
            onClick={() => scrollOffers(1)}
          >
            Próxima ›
          </button>
        </div>
      )}
      {!transmissaoEmAndamento && (
        <div className="compare-table">
          <div
            ref={scrollRef}
            tabIndex={scrollState.hasOverflow ? 0 : undefined}
            role="region"
            aria-label={
              scrollState.hasOverflow
                ? "Comparativo de propostas com rolagem horizontal"
                : "Comparativo de propostas"
            }
            onScroll={updateScrollState}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              scrollOffers(event.key === "ArrowLeft" ? -1 : 1);
            }}
            style={{
              maxWidth: "100%",
              overflowX: "auto",
              overscrollBehaviorX: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table className="ctable" style={{ minWidth: tableMinWidth }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      width: DETAIL_COLUMN_WIDTH,
                      minWidth: DETAIL_COLUMN_WIDTH,
                      background: "var(--offwhite)",
                    }}
                  >
                    DETALHE
                  </th>
                  {offers.map((resultado) => (
                    <th
                      key={resultado.cardId}
                      className="col-ins"
                      style={{ minWidth: OFFER_COLUMN_WIDTH }}
                    >
                      {resultado.seguradora}
                      <br />
                      <span className="chip chip-outline">{tituloResultado(resultado)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coberturaLabels.map((label) => (
                  <tr key={label}>
                    <td
                      className="cov-name"
                      style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--white)" }}
                    >
                      {label}
                    </td>
                    {offers.map((resultado) => (
                      <td key={resultado.cardId} className="cell">
                        <span className="v-lmi">
                          {coberturaEntries(resultado).find(
                            ([candidate]) => candidate === label,
                          )?.[1] ?? "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td
                    className="cov-name"
                    style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--white)" }}
                  >
                    OPÇÕES DE PRÊMIO
                    <small>Plano · franquia · à vista · parcelado · desconto</small>
                  </td>
                  {offers.map((resultado) => (
                    <td key={resultado.cardId} className="cell">
                      {gruposOpcoesResultado(resultado).length === 0 ? (
                        <span className="muted">Não informado</span>
                      ) : (
                        gruposOpcoesResultado(resultado).map((grupo, grupoIndex) => (
                          <div
                            key={`${grupo.formaPagamento}-${grupoIndex}`}
                            style={{ marginBottom: 10 }}
                          >
                            <strong>{grupo.formaPagamento}</strong>
                            {faixasComParcelas(grupo.opcoes).map((faixa, faixaIndex) => (
                              <div key={faixaIndex} style={{ marginTop: 6 }}>
                                <span>{faixa.tipo || "Opção"}</span>
                                <br />
                                <span className="small">Franquia: {faixa.franquia || "—"}</span>
                                <br />
                                <span className="v-lmi">{faixa.avista || "—"}</span>
                                <br />
                                {faixa.parcelas.length === 0 ? (
                                  <span className="small muted">Parcelamento não informado</span>
                                ) : (
                                  faixa.parcelas.map((parcela, parcelaIndex) => (
                                    <span className="small muted" key={parcelaIndex}>
                                      {parcela}
                                      {parcelaIndex < faixa.parcelas.length - 1 ? " · " : ""}
                                    </span>
                                  ))
                                )}
                                {faixa.desconto && (
                                  <div className="chip chip-ok">{faixa.desconto}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td
                    className="cov-name"
                    style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--white)" }}
                  >
                    FORMAS DE PAGAMENTO
                    <small>Condições retornadas pela seguradora</small>
                  </td>
                  {offers.map((resultado) => (
                    <td key={resultado.cardId} className="cell">
                      {formasPagamentoResultado(resultado).join(" · ") || "—"}
                    </td>
                  ))}
                </tr>
                <tr className="total-row">
                  <td
                    className="cov-name"
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "var(--cream-soft)",
                    }}
                  >
                    PRÊMIO REGISTRADO
                    <small>Fonte financeira da cotação</small>
                  </td>
                  {offers.map((resultado) => {
                    const premio = vinculados.get(resultado.cardId);
                    return (
                      <td key={resultado.cardId} className="cell">
                        {premio ? fmtBRL(Number(premio.premio)) : "Vínculo ambíguo"}
                      </td>
                    );
                  })}
                </tr>
                <tr className="actions-row">
                  <td
                    className="cov-name"
                    style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--white)" }}
                  >
                    <small>Forma de pagamento / parcelas</small>
                  </td>
                  {offers.map((resultado) => {
                    const gruposPagamento = gruposOpcoesResultado(resultado);
                    const escolha = escolhaDoCard(resultado);
                    const grupoSelecionado = gruposPagamento.find(
                      (grupo) => grupo.id === escolha.grupoId,
                    );
                    const opcaoSelecionada = grupoSelecionado?.opcoes.find(
                      (opcao) => opcao.id === escolha.opcaoId,
                    );
                    return (
                      <td key={resultado.cardId}>
                        <div className="ins-actions" style={{ flexWrap: "wrap", gap: 6 }}>
                          <select
                            className="select-mini"
                            aria-label="Forma de pagamento"
                            value={escolha.grupoId}
                            disabled={gruposPagamento.length === 0}
                            onChange={(e) => {
                              const grupo = gruposPagamento.find(
                                (item) => item.id === e.target.value,
                              );
                              setEscolha(resultado.cardId, {
                                grupoId: e.target.value,
                                opcaoId: grupo?.opcoes[0]?.id ?? "",
                              });
                            }}
                          >
                            {gruposPagamento.length === 0 && <option value="">Indisponível</option>}
                            {gruposPagamento.map((grupo) => (
                              <option key={grupo.id} value={grupo.id}>
                                {grupo.formaPagamento}
                              </option>
                            ))}
                          </select>
                          <select
                            className="select-mini"
                            aria-label="Parcelas"
                            value={escolha.opcaoId}
                            disabled={!grupoSelecionado}
                            onChange={(e) =>
                              setEscolha(resultado.cardId, {
                                grupoId: escolha.grupoId,
                                opcaoId: e.target.value,
                              })
                            }
                          >
                            {!grupoSelecionado && <option value="">Indisponível</option>}
                            {grupoSelecionado?.opcoes.map((opcao) => (
                              <option key={opcao.id} value={opcao.id}>
                                {[opcao.tipo, opcao.parcelas].filter(Boolean).join(" · ") ||
                                  "Opção"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="ins-actions" style={{ marginTop: 6 }}>
                          <button
                            className="btn btn-yellow btn-sm"
                            type="button"
                            disabled={
                              !cotacaoId || !opcaoSelecionada || transmitindoCardId !== null
                            }
                            title={
                              cotacaoId
                                ? `Gerar proposta (${resultado.seguradora})`
                                : "Salve a cotação antes de gerar a proposta"
                            }
                            onClick={() => void gerarProposta(resultado)}
                          >
                            {transmitindoCardId === resultado.cardId
                              ? "Enviando…"
                              : "Gerar proposta"}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => doPrint(resultado.cardId)}
                          >
                            Imprimir
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr className="actions-row">
                  <td
                    className="cov-name"
                    style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--white)" }}
                  >
                    <small>Desconto adicional</small>
                  </td>
                  {offers.map((resultado) => {
                    const premio = vinculados.get(resultado.cardId);
                    const solicitacao = solicitacaoFor(resultado.seguradora);
                    const multiplosProdutos =
                      (cardsPorSeguradora.get(normalizar(resultado.seguradora)) ?? 0) > 1;
                    const emAndamento =
                      solicitacao && ["pendente", "aguardando_aceite"].includes(solicitacao.status);
                    return (
                      <td key={resultado.cardId}>
                        {solicitacao && (
                          <div style={{ marginBottom: 6 }}>
                            <span
                              className={`chip ${STATUS_CHIP[solicitacao.status] ?? "chip-outline"}`}
                            >
                              Seguradora ·{" "}
                              {solicitacao.status === "aprovado"
                                ? `Aprovado ${solicitacao.pct_concedido ?? solicitacao.pct_pedido}%`
                                : (STATUS_LABEL[solicitacao.status] ?? solicitacao.status)}
                            </span>
                          </div>
                        )}
                        {multiplosProdutos ? (
                          <span className="muted small">
                            Indisponível: o desconto é aplicado à seguradora inteira, que retornou
                            mais de um produto nesta cotação.
                          </span>
                        ) : !premio ? (
                          <span className="muted small">
                            Indisponível: não foi possível vincular este produto a um único prêmio.
                          </span>
                        ) : (
                          <>
                            {emAndamento ? (
                              <div className="ins-actions">
                                {solicitacao.status === "aguardando_aceite" && (
                                  <button
                                    className="btn btn-yellow btn-sm"
                                    type="button"
                                    disabled={busySolId === solicitacao.id}
                                    onClick={() => onAceitar(solicitacao.id)}
                                  >
                                    Aceitar
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  type="button"
                                  disabled={busySolId === solicitacao.id}
                                  onClick={() => onCancelar(solicitacao.id)}
                                >
                                  {solicitacao.status === "aguardando_aceite"
                                    ? "Recusar"
                                    : "Cancelar"}
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn btn-ghost btn-sm"
                                type="button"
                                onClick={() => setDescontoModal(premio)}
                              >
                                Solicitar desconto adicional
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="compare-foot">
            <span>Dados detalhados preservados conforme o retorno de cada seguradora.</span>
            <span>Ações financeiras ficam indisponíveis quando o vínculo não é inequívoco.</span>
          </div>
        </div>
      )}
      {descontoModal && (
        <SolicitarDescontoModal
          cotacaoId={cotacaoId}
          seguradoraNome={descontoModal.seguradora}
          seguradoraId={seguradoraId(descontoModal.seguradora)}
          premio={Number(descontoModal.premio)}
          onClose={() => setDescontoModal(null)}
          onSent={onDescontoEnviado}
        />
      )}
    </>
  );
}
