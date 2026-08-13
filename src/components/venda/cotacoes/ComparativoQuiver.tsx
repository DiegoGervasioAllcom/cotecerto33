import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SolicitarDescontoModal } from "@/components/venda/solicitar-desconto-modal";
import { escapeHtml, fmtBRL, printHtml } from "@/lib/print";
import {
  formasPagamentoResultado,
  gruposOpcoesResultado,
  ordenarResultados,
  tituloResultado,
  vincularPremiosQuiver,
  type ResultadoCalculo,
} from "./quiver-resultado";

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
  const offers = useMemo(() => ordenarResultados(resultados), [resultados]);
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
      <div className="compare-table">
        <table className="ctable">
          <thead>
            <tr>
              <th style={{ width: "26%" }}>DETALHE</th>
              {offers.map((resultado) => (
                <th key={resultado.cardId} className="col-ins">
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
                <td className="cov-name">{label}</td>
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
              <td className="cov-name">
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
                        {grupo.opcoes.map((opcao, opcaoIndex) => (
                          <div key={opcaoIndex} style={{ marginTop: 6 }}>
                            <span>{opcao.tipo || "Opção"}</span>
                            <br />
                            <span className="small">Franquia: {opcao.franquia || "—"}</span>
                            <br />
                            <span className="v-lmi">{opcao.avista || "—"}</span>
                            <br />
                            <span className="small muted">
                              {opcao.parcelas || "Parcelamento não informado"}
                            </span>
                            {opcao.desconto && <div className="chip chip-ok">{opcao.desconto}</div>}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="cov-name">
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
              <td className="cov-name">
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
              <td />
              {offers.map((resultado) => (
                <td key={resultado.cardId}>
                  <div className="ins-actions">
                    <Link to="/venda/propostas" className="btn btn-yellow">
                      Gerar proposta
                    </Link>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => doPrint(resultado.cardId)}
                    >
                      Imprimir
                    </button>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="actions-row">
              <td className="cov-name">
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
                        Indisponível: o desconto é aplicado à seguradora inteira, que retornou mais
                        de um produto nesta cotação.
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
                              {solicitacao.status === "aguardando_aceite" ? "Recusar" : "Cancelar"}
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
        <div className="compare-foot">
          <span>Dados detalhados preservados conforme o retorno de cada seguradora.</span>
          <span>Ações financeiras ficam indisponíveis quando o vínculo não é inequívoco.</span>
        </div>
      </div>
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
