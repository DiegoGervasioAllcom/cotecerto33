import { Link } from "@tanstack/react-router";
import { printHtml, escapeHtml } from "@/lib/print";
import type { Form } from "@/components/venda/novo-lead/types";
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { ordenarResultados } from "@/components/venda/cotacoes/quiver-resultado";

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  calculando: boolean;
  erro: string | null;
  podeCalcular: boolean;
  cotacaoId: string | null;
  doSimularCalculo: () => void;
};

export function StepCalculo({
  f,
  resultados,
  calculando,
  erro,
  podeCalcular,
  cotacaoId,
  doSimularCalculo,
}: Props) {
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

      {calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <span className="muted small">
            Enviamos a cotação para as seguradoras — o resultado chega em alguns minutos, sem
            precisar ficar nesta tela.
          </span>
        </div>
      )}

      {resultados.length === 0 && !calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <button className="btn btn-yellow" disabled={!podeCalcular} onClick={doSimularCalculo}>
            <svg width="14" height="14">
              <use href="#i-bolt" />
            </svg>
            {podeCalcular ? " Calcular agora" : " Selecione seguradoras no passo Seguro"}
          </button>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="calc-grid">
          {ordenarResultados(resultados).map((r) => {
            const basicas = Object.entries(r.coberturasBasicas ?? {});
            const adicionais = Object.entries(r.coberturasAdicionais ?? {});
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
                  {r.opcoes.map((o, i) => (
                    <div className="calc-tier" key={i}>
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
                  <span className="chip chip-slate" style={{ flex: 1 }}>
                    {r.formasPagamento?.selecionada ?? r.formaPagamento ?? "—"}
                  </span>
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
                  <button className="ic-btn ok" title="Gerar proposta">
                    <svg width="15" height="15">
                      <use href="#i-check" />
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
