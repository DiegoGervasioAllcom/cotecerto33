import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { printHtml, escapeHtml } from "@/lib/print";
import { supabase } from "@/integrations/supabase/client";
import { transmitirPropostaQuiver } from "@/lib/quiver.functions";
import type { Form } from "@/components/venda/novo-lead/types";
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import {
  gruposOpcoesResultado,
  ordenarResultados,
  premioNumerico,
} from "@/components/venda/cotacoes/quiver-resultado";

const POLL_TRANSMISSAO_MS = 4000;

type TransmissaoResultado = {
  status: "enviada" | "transmitida" | "falha";
  motivo: string | null;
  mensagem: string | null;
  propostaId: string | null;
};

type EscolhaCard = { grupoId: string; opcaoId: string };

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  calculando: boolean;
  erro: string | null;
  podeCalcular: boolean;
  camposFaltantes: string[];
  cotacaoId: string | null;
  doSimularCalculo: () => void;
};

export function StepCalculo({
  f,
  resultados,
  calculando,
  erro,
  podeCalcular,
  camposFaltantes,
  cotacaoId,
  doSimularCalculo,
}: Props) {
  // Escolha de forma de pagamento/parcelas por card — o robô precisa das duas
  // para clicar na célula certa do modal do portal.
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaCard>>({});
  const [transmitindoCardId, setTransmitindoCardId] = useState<string | null>(null);
  const [erroProposta, setErroProposta] = useState<string | null>(null);
  // Onda 3 (T.10): enquanto uma transmissão está em andamento, escondemos os
  // demais cards e mostramos só o card escolhido com o resultado real do
  // robô (via polling em `cotacao_transmissoes`, mesmo padrão de
  // `useSimulacaoCalculo`).
  const [transmissaoEmAndamento, setTransmissaoEmAndamento] = useState<{
    tentativaId: string;
    card: ResultadoCalculo;
  } | null>(null);
  const [resultadoTransmissao, setResultadoTransmissao] = useState<TransmissaoResultado | null>(
    null,
  );
  const pollTransmissaoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // O 201 significa só que o robô aceitou a solicitação: o resultado real
      // (transmitido / recusado pelo portal) chega depois, pelo webhook —
      // entramos em modo "transmitindo" e fazemos polling da tentativa.
      setTransmissaoEmAndamento({ tentativaId: resposta.tentativaId, card: r });
      iniciarPollingTransmissao(resposta.tentativaId);
    } catch (e) {
      setErroProposta(e instanceof Error ? e.message : "Falha ao gerar a proposta.");
    } finally {
      setTransmitindoCardId(null);
    }
  }

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Coberturas e valores</h2>
          <div className="sub" style={{ margin: 0 }}>
            {calculando
              ? "Calculando com as seguradoras… isso pode levar alguns minutos."
              : resultados.length > 0
                ? `${resultados.length} seguradoras calculadas · ${f.tipoCobertura || "Compreensiva"}`
                : (f.seguradorasSel?.length ?? 0) > 0
                  ? `${f.seguradorasSel.length} seguradoras selecionadas · clique em Calcular agora`
                  : "Selecione seguradoras no passo Seguro"}
          </div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        {cotacaoId && (
          <Link
            to="/venda/cotacoes/$id"
            params={{ id: cotacaoId }}
            className="btn btn-slate btn-sm"
          >
            <svg width="13" height="13">
              <use href="#i-shield" />
            </svg>{" "}
            Comparativo lado a lado
          </Link>
        )}
        <button
          className="btn btn-ghost btn-sm"
          disabled={!podeCalcular || calculando}
          title={
            !podeCalcular ? `Faltam preencher: ${camposFaltantes.join(", ")}` : undefined
          }
          onClick={doSimularCalculo}
        >
          <svg width="13" height="13">
            <use href="#i-refresh" />
          </svg>{" "}
          {calculando ? "Calculando…" : "Recalcular"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={resultados.length === 0}
          onClick={() => {
            const sorted = ordenarResultados(resultados);
            const head = `
              <div class="grid">
                <div class="kv"><b>Cliente:</b> ${escapeHtml(f.nome || "—")}</div>
                <div class="kv"><b>${f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> ${escapeHtml(f.cpf || "—")}</div>
                <div class="kv"><b>Celular:</b> ${escapeHtml(f.celular || "—")}</div>
                <div class="kv"><b>Cidade/UF:</b> ${escapeHtml((f.cidade || "—") + (f.uf ? "/" + f.uf : ""))}</div>
                <div class="kv"><b>Veículo:</b> ${escapeHtml(`${f.marca || ""} ${f.modelo || ""} ${f.anoModelo || ""}`.trim() || "—")}</div>
                <div class="kv"><b>Placa:</b> ${escapeHtml(f.placa || "—")}</div>
                <div class="kv"><b>Tipo de cobertura:</b> ${escapeHtml(f.tipoCobertura || "Compreensiva")}</div>
                <div class="kv"><b>Tipo de cálculo:</b> ${escapeHtml(f.tipoCalculo || "—")}</div>
              </div>`;
            const cards = sorted
              .map((r) => {
                const rows = r.opcoes
                  .map(
                    (o) =>
                      `<tr><td>${escapeHtml(o.tipo || "—")}</td><td>${escapeHtml(o.franquia || "—")}</td><td class="num"><strong>${escapeHtml(o.avista || "—")}</strong></td><td class="num">${escapeHtml(o.parcelas || "—")}</td></tr>`,
                  )
                  .join("");
                return `<div class="card">
                  <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <strong style="font-size:14px">${escapeHtml(r.seguradora)}</strong>
                    <span style="color:#64748b;font-size:11px">${escapeHtml(r.produto ? `${r.produto} · ${r.nome}` : r.nome || "Compreensiva")}</span>
                  </div>
                  <table style="margin-top:8px">
                    <tr><th>Plano</th><th>Franquia</th><th class="num">À vista</th><th class="num">Parcelado</th></tr>
                    ${rows}
                  </table>
                </div>`;
              })
              .join("");
            const cobRows = (r: ResultadoCalculo) =>
              [
                ...Object.entries(r.coberturasBasicas ?? {}),
                ...Object.entries(r.coberturasAdicionais ?? {}),
              ]
                .map(
                  ([label, valor]) =>
                    `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(valor)}</td></tr>`,
                )
                .join("");
            const cobBlocks = sorted
              .map(
                (r) =>
                  `<h2>Coberturas · ${escapeHtml(r.seguradora)}</h2><table><tr><th>Item</th><th>Valor</th></tr>${cobRows(r) || `<tr><td colspan="2">Não informado pela seguradora</td></tr>`}</table>`,
              )
              .join("");
            printHtml(
              "Cotação · " + (f.nome || "Cliente"),
              `<h1>Resumo da cotação</h1><div class="sub">${sorted.length} seguradora(s) calculada(s)</div>${head}<h2>Prêmios</h2>${cards}${cobBlocks}<p style="font-size:11px;color:#64748b">Cotação válida por 5 dias. Sujeita à aceitação da seguradora.</p>`,
            );
          }}
        >
          <svg width="13" height="13">
            <use href="#i-download" />
          </svg>{" "}
          Imprimir
        </button>
      </div>

      {erro && (
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
          {erro}
        </div>
      )}

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
              <Link to="/venda/aceite" className="btn btn-yellow" style={{ marginTop: 12 }}>
                Ir para Aceite &amp; Transmissão
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
                {/* RECUSADA_PELO_PORTAL é rejeição de regra de negócio do portal (ex.:
                    duplicidade) — reenviar os mesmos dados não muda o resultado, então
                    "Tentar novamente" não faz sentido aqui. A proposta já foi registrada
                    como negociação recusada (com o motivo no histórico de versão), então
                    o link certo é a tela de Propostas, não Aceite & Transmissão. */}
                {resultadoTransmissao.motivo === "RECUSADA_PELO_PORTAL" ? (
                  resultadoTransmissao.propostaId && (
                    <Link
                      to="/venda/propostas"
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
                        to="/venda/aceite"
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

      {!transmissaoEmAndamento && calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <span className="muted small">
            Enviamos a cotação para as seguradoras — o resultado chega em alguns minutos, sem
            precisar ficar nesta tela.
          </span>
        </div>
      )}

      {!transmissaoEmAndamento && resultados.length === 0 && !calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <button
            className="btn btn-yellow"
            disabled={!podeCalcular}
            title={
              !podeCalcular ? `Faltam preencher: ${camposFaltantes.join(", ")}` : undefined
            }
            onClick={doSimularCalculo}
          >
            <svg width="14" height="14">
              <use href="#i-bolt" />
            </svg>
            {podeCalcular ? " Calcular agora" : " Faltam campos"}
          </button>
          {!podeCalcular && camposFaltantes.length > 0 && (
            <div className="muted small" style={{ marginTop: 6 }}>
              Faltam: {camposFaltantes.join(", ")}
            </div>
          )}
        </div>
      )}

      {!transmissaoEmAndamento && resultados.length > 0 && (
        <div className="calc-grid">
          {ordenarResultados(resultados).map((r) => {
            const basicas = Object.entries(r.coberturasBasicas ?? {});
            const adicionais = Object.entries(r.coberturasAdicionais ?? {});
            const gruposPagamento = gruposOpcoesResultado(r);
            const escolha = escolhaDoCard(r);
            const grupoSelecionado = gruposPagamento.find((grupo) => grupo.id === escolha.grupoId);
            const opcaoSelecionada = grupoSelecionado?.opcoes.find(
              (opcao) => opcao.id === escolha.opcaoId,
            );
            const opcoesExibidas = opcaoSelecionada ? [opcaoSelecionada] : r.opcoes;
            return (
              <div className="calc-card" key={r.cardId}>
                <div className="calc-head">
                  <div className="calc-ins">
                    <svg width="16" height="16">
                      <use href="#i-shield" />
                    </svg>{" "}
                    {r.seguradora}
                  </div>
                  <span className="chip chip-slate">
                    {r.produto ? `${r.produto} · ${r.nome}` : r.nome}
                  </span>
                  <span className="chip chip-slate" style={{ marginLeft: "auto" }}>
                    {r.nome || "Compreensiva"}
                  </span>
                </div>
                <div className="calc-tiers">
                  {opcoesExibidas.map((o, opcaoIndex) => (
                    <div className="calc-tier" key={`${r.cardId}-opcao-${opcaoIndex}`}>
                      <div className="t-lbl">{o.tipo || "—"}</div>
                      <div className="t-fr">{o.franquia || "—"}</div>
                      <div className="t-vista">{o.avista || "—"}</div>
                      <div className="t-parc">{o.parcelas || "—"}</div>
                      {o.desconto && <div className="chip chip-ok">{o.desconto}</div>}
                    </div>
                  ))}
                </div>
                <div className="calc-cobs">
                  <div className="cob-col">
                    <div className="cob-h">Coberturas básicas</div>
                    {basicas.length === 0 && (
                      <div className="cob-row muted small">Não informado pela seguradora</div>
                    )}
                    {basicas.map(([label, valor]) => (
                      <div className="cob-row" key={label}>
                        <span>{label}</span>
                        <b>{valor}</b>
                      </div>
                    ))}
                  </div>
                  <div className="cob-col">
                    <div className="cob-h">Adicionais</div>
                    {adicionais.length === 0 && (
                      <div className="cob-row muted small">Não informado pela seguradora</div>
                    )}
                    {adicionais.map(([label, valor]) => (
                      <div className="cob-row" key={label}>
                        <span>{label}</span>
                        <b>{valor}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="calc-foot">
                  <select
                    className="select-mini"
                    aria-label="Forma de pagamento"
                    value={escolha.grupoId}
                    disabled={gruposPagamento.length === 0}
                    onChange={(e) => {
                      const grupo = gruposPagamento.find((item) => item.id === e.target.value);
                      setEscolha(r.cardId, {
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
                      setEscolha(r.cardId, { grupoId: escolha.grupoId, opcaoId: e.target.value })
                    }
                  >
                    {!grupoSelecionado && <option value="">Indisponível</option>}
                    {grupoSelecionado?.opcoes.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {[opcao.tipo, opcao.parcelas].filter(Boolean).join(" · ") || "Opção"}
                      </option>
                    ))}
                  </select>
                  <button className="ic-btn" title="Observações">
                    <svg width="15" height="15">
                      <use href="#i-message" />
                    </svg>
                  </button>
                  <button className="ic-btn" title="Enviar">
                    <svg width="15" height="15">
                      <use href="#i-download" />
                    </svg>
                  </button>
                  <button
                    className="ic-btn ok"
                    title={
                      cotacaoId
                        ? `Gerar proposta (${r.seguradora})`
                        : "Salve a cotação antes de gerar a proposta"
                    }
                    disabled={!cotacaoId || !opcaoSelecionada || transmitindoCardId !== null}
                    onClick={() => void gerarProposta(r)}
                  >
                    <svg width="15" height="15">
                      <use href={transmitindoCardId === r.cardId ? "#i-clock" : "#i-check"} />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
