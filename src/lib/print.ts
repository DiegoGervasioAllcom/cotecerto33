// Open a popup window with printable HTML and trigger print.
// Used to produce real printable layouts instead of capturing the on-screen UI.
import logoSupper from "@/assets/logo-supper-doc.png?inline";
import { SEG_MARCAS } from "@/lib/seguradora-marcas";

const BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:24px;font-size:12px;line-height:1.45}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:18px 0 8px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .sub{color:#64748b;font-size:11px;margin-bottom:14px}
  .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #facc15;padding-bottom:10px;margin-bottom:14px}
  .brand .logo{font-weight:800;color:#0f172a;font-size:16px;letter-spacing:.5px}
  .brand .meta{font-size:11px;color:#64748b;text-align:right}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#475569}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:6px 0 12px}
  .kv{font-size:12px}
  .kv b{color:#475569;font-weight:600;margin-right:4px}
  .card{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:10px}
  .price{font-size:16px;font-weight:700;color:#0f172a}
  .badge{display:inline-block;background:#facc15;color:#0f172a;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px}
  .foot{margin-top:20px;color:#94a3b8;font-size:10px;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
  @page{size:A4;margin:14mm}
  @media print{body{margin:0}}
`;

export function printHtml(title: string, bodyHtml: string) {
  const when = new Date().toLocaleString("pt-BR");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${BASE_CSS}</style></head><body>
    <div class="brand">
      <div class="logo">CoteCerto</div>
      <div class="meta">${escapeHtml(title)}<br/>${when}</div>
    </div>
    ${bodyHtml}
    <div class="foot">CoteCerto · Documento gerado em ${when}</div>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Permita pop-ups para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Wait for layout before printing.
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* noop */
    }
  }, 300);
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const fmtBRL = (n: number) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* =====================================================================
 * Impressão de cotação (Frente 3 V12 · 7a — modal "Imprimir cotação")
 *
 * `buildCotacaoDoc` espelha `docCotacaoHtml()` do protótipo V12
 * (`cotecerto_prototipo_v12 - cópia.html`, linhas ~4964-5115), mas só com os
 * campos que o app realmente tem hoje (segurado/veículo/seguro/perfil das
 * tabelas `cotacao_*`, ofertas do `quiver_resultado_raw`). Diferenças
 * deliberadas em relação ao protótipo:
 *  - "Controle interno" e "Comissão da corretora" só saem no documento
 *    INTERNO (fatia B, `opcoes.interno` + `opcoes.pctComissao`); o PDF do
 *    cliente nunca os traz (ver docs/v12/PLANO_TASKS_V12.md, linhas 7a/7b).
 *  - Sem os toggles de franquia 1ª/2ª opção/sem franquia: o app não calcula
 *    uma franquia sintética por seguradora — cada `opcao` que a seguradora
 *    devolveu já é o próprio nível de franquia, então o documento lista
 *    todos os níveis reais em vez de recriar uma matriz artificial.
 *  - Sem o toggle "mensagens da seguradora no PDF": não existe hoje nenhuma
 *    tabela com esse texto por seguradora.
 *  - Modelo "Marca da seguradora" não embute o logo real da cia (não há
 *    esse asset no repo) — usa o mesmo bloco `.doc-logo-cia` só com o nome.
 * ===================================================================== */

/** Uma faixa de franquia/plano que a seguradora devolveu (um `opcoes[i]` do
 * card do Quiver). */
export type DocOpcaoOferta = {
  tipo?: string | null;
  franquia?: string | null;
  /** Valor à vista (parcela "1"). */
  avista?: string | null;
  /** Textos como "6x sem juros de R$ 1.896,08" — uma por parcela oferecida. */
  parcelasOpcoes?: string[] | null;
};

/** Uma seguradora selecionável no documento. */
export type DocSeguradoraOferta = {
  /** Identificador único do card (ex.: `cardId` do Quiver) — evita colidir
   * quando a mesma seguradora aparece em mais de um produto. */
  id: string;
  seguradora: string;
  planoNome?: string | null;
  /** Preço de referência já formatado (ex. "R$ 1.896,08") — mostrado no
   * card de seleção; opcional porque nem toda origem tem um valor único. */
  precoLabel?: string | null;
  coberturasBasicas?: Record<string, string>;
  coberturasAdicionais?: Record<string, string>;
  opcoes: DocOpcaoOferta[];
};

export type DocSegurado = {
  nome?: string | null;
  cpfCnpj?: string | null;
  nascimento?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  telefone?: string | null;
  email?: string | null;
};

export type DocSeguro = {
  tipo?: string | null;
  vigIni?: string | null;
  vigFim?: string | null;
};

export type DocVeiculo = {
  descricao?: string | null;
  anoFab?: string | null;
  anoModelo?: string | null;
  combustivel?: string | null;
  zeroKm?: boolean | null;
  placa?: string | null;
  chassi?: string | null;
  cepPernoite?: string | null;
  tipoUso?: string | null;
};

export type DocPerfil = {
  condutorMesmo?: boolean | null;
  jovens1825?: boolean | null;
};

export type DocDados = {
  cotacaoNumero: string;
  segurado: DocSegurado;
  seguro?: DocSeguro;
  veiculo?: DocVeiculo;
  perfil?: DocPerfil;
  /** `cotacoes.id` — necessário para ler o % de comissão e registrar a
   * impressão (fatia B). Sem ele o modal não oferece "Imprimir comissão". */
  cotacaoId?: string;
  /** `cotacao_seguro.grupo_producao` — só aparece no documento interno. */
  grupoProducao?: string | null;
  /** Padrão de cálculo — o app não tem esse dado hoje; só entra no documento
   * interno quando alguma origem passar a fornecê-lo. */
  padraoCalculo?: string | null;
  /** Universo de seguradoras com retorno — a config escolhe o subconjunto. */
  seguradoras: DocSeguradoraOferta[];
};

export type DocConfigImpressao = {
  modelo: "supper" | "cia";
  tipo: "resumida" | "detalhada";
  /** `id`s de `DocSeguradoraOferta` escolhidos — mínimo 1 (validado no zod
   * do formulário). */
  seguradorasSelecionadas: string[];
  /** 1 = à vista, 2..12 = parcelas — mínimo 1. */
  parcelas: number[];
  economia: boolean;
  colunado: boolean;
};

/** Opções do documento interno (fatia B). Só com `interno === true` E
 * `pctComissao` definido sai comissão/controle interno/faixa de uso interno. */
export type DocOpcoesInterno = { interno?: boolean; pctComissao?: number | null };

export function docEhInterno(o?: DocOpcoesInterno): o is { interno: true; pctComissao: number } {
  return o?.interno === true && o.pctComissao != null && Number.isFinite(o.pctComissao);
}

const FAIXA_INTERNO_STYLE =
  "justify-content:center;text-align:center;font-weight:800;letter-spacing:.05em;background:var(--alert-soft);border-color:var(--alert);color:var(--alert)";

function faixaInternoHtml(): string {
  return `<div class="doc-aviso doc-uso-interno" style="${FAIXA_INTERNO_STYLE}">USO INTERNO — NÃO ENVIAR AO CLIENTE</div>`;
}

function controleInternoHtml(d: DocDados): string {
  const partes = [
    d.grupoProducao ? `Grupo de produção: ${escapeHtml(d.grupoProducao)}` : "",
    d.padraoCalculo ? `Padrão de cálculo: ${escapeHtml(d.padraoCalculo)}` : "",
  ].filter(Boolean);
  if (partes.length === 0) return "";
  return `<div class="doc-interno">Controle interno · ${partes.join(" | ")}</div>`;
}

function docLinha(rotulo: string, valor?: string | null): string {
  return `<div class="doc-li"><span>${escapeHtml(rotulo)}</span><strong>${escapeHtml(
    valor || "—",
  )}</strong></div>`;
}

/** Formata datas ISO (`cotacao_segurado.nascimento` etc.); textos que já vêm
 * formatados (ex. `Form.nasc` do wizard, "dd/mm/aaaa") passam direto. */
function fmtDataOuBruto(v?: string | null): string {
  if (!v) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return v;
}

function simNao(v?: boolean | null, textoSim = "Sim", textoNao = "Não"): string {
  if (v == null) return "—";
  return v ? textoSim : textoNao;
}

const ICONE_COL = {
  user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  car: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  shield:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
};

const ICONE_INFO =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

function seloSeguradoraHtml(nome: string, tam: "sm" | "xs"): string {
  const m = SEG_MARCAS[nome] ?? { cor: "#5B6770", wm: nome, sub: "" };
  return `<span class="seg-badge ${tam}"><span class="wm" style="color:${m.cor}">${escapeHtml(m.wm)}${
    m.sub ? `<small>${escapeHtml(m.sub)}</small>` : ""
  }</span></span>`;
}

/** Valor da parcela como o protótipo mostra: só o "R$ …", com " *" quando é sem juros. */
function parcelaCelula(texto: string | null, parcela: number): string {
  if (!texto) return "—";
  const valor = texto.match(/R\$\s*[\d.]+,\d{2}/)?.[0] ?? texto;
  return escapeHtml(valor) + (parcela > 1 && /sem juros/i.test(texto) ? " *" : "");
}

function resumidaHtml(d: DocDados): string {
  const { segurado: seg, veiculo: veic, seguro } = d;
  return `<div class="doc-cols3">
    <div><div class="doc-col-t">${ICONE_COL.user} Segurado</div>
      ${docLinha("CPF/CNPJ", seg.cpfCnpj)}
      ${docLinha("Nascimento", fmtDataOuBruto(seg.nascimento))}
      ${docLinha("Sexo", seg.sexo)}
      ${docLinha("Estado civil", seg.estadoCivil)}
      ${docLinha("Telefone", seg.telefone)}
      ${docLinha("E-mail", seg.email)}
    </div>
    <div><div class="doc-col-t">${ICONE_COL.car} Veículo</div>
      ${docLinha("Modelo", veic?.descricao)}
      ${docLinha("Ano fab./modelo", veic ? `${veic.anoFab || "—"} / ${veic.anoModelo || "—"}` : "—")}
      ${docLinha("Placa", veic?.placa)}
      ${docLinha("Chassi", veic?.chassi)}
      ${docLinha("Combustível", veic?.combustivel)}
      ${docLinha("CEP pernoite", veic?.cepPernoite)}
    </div>
    <div><div class="doc-col-t">${ICONE_COL.shield} Seguro</div>
      ${docLinha("Tipo", seguro?.tipo)}
      ${docLinha("Início vigência", fmtDataOuBruto(seguro?.vigIni))}
      ${docLinha("Final vigência", fmtDataOuBruto(seguro?.vigFim))}
    </div>
  </div>`;
}

function detalhadaHtml(d: DocDados): string {
  const { segurado: seg, veiculo: veic, seguro, perfil } = d;
  return `
    <div class="doc-sec">Dados do segurado / proprietário</div>
    <div class="doc-bloco">
      ${docLinha("Nome", seg.nome?.toUpperCase())}
      ${docLinha("CPF / CNPJ", seg.cpfCnpj)}
      ${docLinha("Data de nascimento", fmtDataOuBruto(seg.nascimento))}
      ${docLinha("Sexo", seg.sexo)}
      ${docLinha("Estado civil", seg.estadoCivil)}
      ${docLinha("Telefone", seg.telefone)}
      ${docLinha("E-mail", seg.email)}
    </div>
    <div class="doc-sec">Dados do seguro</div>
    <div class="doc-bloco">
      ${docLinha("Tipo de seguro", seguro?.tipo)}
      ${docLinha("Início de vigência", fmtDataOuBruto(seguro?.vigIni))}
      ${docLinha("Final de vigência", fmtDataOuBruto(seguro?.vigFim))}
    </div>
    <div class="doc-sec">Dados do veículo</div>
    <div class="doc-bloco">
      ${docLinha("Modelo", veic?.descricao)}
      ${docLinha("Ano de fabricação", veic?.anoFab)}
      ${docLinha("Ano do modelo", veic?.anoModelo)}
      ${docLinha("Combustível", veic?.combustivel)}
      ${docLinha("É zero km?", simNao(veic?.zeroKm))}
      ${docLinha("Placa", veic?.placa)}
      ${docLinha("Chassi", veic?.chassi)}
      ${docLinha("CEP pernoite", veic?.cepPernoite)}
      ${docLinha("Tipo de uso", veic?.tipoUso)}
    </div>
    <div class="doc-sec">Perfil do condutor</div>
    <div class="doc-bloco">
      ${docLinha(
        "Relação com o segurado",
        perfil?.condutorMesmo == null
          ? "—"
          : simNao(perfil.condutorMesmo, "Próprio segurado", "Terceiro condutor principal"),
      )}
    </div>
    <div class="doc-sec">Condutores e/ou residentes jovens</div>
    <div class="doc-bloco">
      ${docLinha("Jovens de 17 a 25 anos?", simNao(perfil?.jovens1825))}
    </div>
  `;
}

function parcelaValor(op: DocOpcaoOferta, parcela: number): string | null {
  if (parcela === 1) return op.avista ?? null;
  const achado = (op.parcelasOpcoes ?? []).find((texto) => texto.trim().startsWith(`${parcela}x`));
  return achado ?? null;
}

/** Monta o HTML do documento comparativo. Sem `opcoes` (ou sem % de
 * comissão) é o PDF do cliente: sem comissão e sem "Controle interno". Com
 * `interno` + `pctComissao` é o documento interno. Usado tanto na pré-visualização (dentro do modal,
 * via `dangerouslySetInnerHTML`) quanto no PDF/impressão local. */
export function buildCotacaoDoc(
  dados: DocDados,
  config: DocConfigImpressao,
  opcoes?: DocOpcoesInterno,
): string {
  const interno = docEhInterno(opcoes);
  const selecionadas = dados.seguradoras.filter((s) =>
    config.seguradorasSelecionadas.includes(s.id),
  );
  const hoje = new Date();
  const validade = new Date(hoje);
  validade.setDate(validade.getDate() + 5);
  const dataHoje = hoje.toLocaleDateString("pt-BR");
  const dataValidade = validade.toLocaleDateString("pt-BR");

  const marca =
    config.modelo === "supper"
      ? `<img class="doc-logo" src="${logoSupper}" alt="Supper Certo Seguros">`
      : selecionadas[0]
        ? `<div class="doc-logo-cia">${seloSeguradoraHtml(selecionadas[0].seguradora, "sm")}<span>${escapeHtml(
            selecionadas[0].seguradora,
          )}</span><small>Orçamento de Seguro Auto</small></div>`
        : `<div class="doc-logo-cia"><span>Seguradora</span></div>`;

  const topo = `<div class="doc-topo">${marca}
      <div class="doc-meta">Cotação <strong>${escapeHtml(
        dados.cotacaoNumero,
      )}</strong>, realizada em ${dataHoje} e válida até <strong>${dataValidade}</strong>
        <div class="doc-obs">* Valores sujeitos a alterações conforme as seguradoras, sem aviso prévio.</div>
        <div class="doc-obs">Impresso em: ${dataHoje}</div>
      </div>
    </div>
    <p class="doc-ola">Olá <strong>${escapeHtml(
      (dados.segurado.nome || "CLIENTE").toUpperCase(),
    )}</strong>, você está recebendo as cotações para o seguro do seu veículo.</p>`;

  const cabecalho = config.tipo === "detalhada" ? detalhadaHtml(dados) : resumidaHtml(dados);
  const coberturaLabels = [
    ...new Set(
      selecionadas.flatMap((s) => [
        ...Object.keys(s.coberturasBasicas ?? {}),
        ...Object.keys(s.coberturasAdicionais ?? {}),
      ]),
    ),
  ];
  const headCoberturas = `<tr><td class="doc-k"></td>${selecionadas
    .map(
      (s) =>
        `<td><div class="doc-seg">${seloSeguradoraHtml(s.seguradora, "xs")}<strong>${escapeHtml(s.seguradora)}</strong>${
          s.planoNome ? `<small>${escapeHtml(s.planoNome)}</small>` : ""
        }</div></td>`,
    )
    .join("")}</tr>`;
  const coberturaRows = coberturaLabels
    .map((label) => {
      const cols = selecionadas
        .map((s) => {
          const valor = s.coberturasBasicas?.[label] ?? s.coberturasAdicionais?.[label];
          return `<td>${escapeHtml(valor || "—")}</td>`;
        })
        .join("");
      return `<tr><td class="doc-k">${escapeHtml(label)}</td>${cols}</tr>`;
    })
    .join("");

  const col = (fn: (s: DocSeguradoraOferta) => string) =>
    selecionadas.map((s) => `<td>${fn(s)}</td>`).join("");
  const titulo = (rotulo: string) =>
    `<tr class="doc-tit"><td class="doc-k">${rotulo}</td>${col(() => "")}</tr>`;
  const maxOpcoes = Math.max(0, ...selecionadas.map((s) => s.opcoes.length));
  const sufixoOpcao = (i: number) => (maxOpcoes > 1 ? ` · ${i + 1}ª opção` : "");

  const franquiaRows = Array.from({ length: maxOpcoes }, (_, i) => {
    const cols = col((s) => {
      const op = s.opcoes[i];
      if (!op) return "—";
      return `${escapeHtml(op.franquia || "—")}${
        op.tipo ? `<div class="doc-obs">${escapeHtml(op.tipo)}</div>` : ""
      }`;
    });
    return `<tr><td class="doc-k">${i + 1}ª opção de franquia</td>${cols}</tr>`;
  }).join("");

  const parcelaRows = Array.from({ length: maxOpcoes }, (_, i) =>
    config.parcelas
      .map((n) => {
        const cols = col((s) => {
          const op = s.opcoes[i];
          return op ? parcelaCelula(parcelaValor(op, n), n) : "—";
        });
        const rotulo = (n === 1 ? "À vista" : `${n} parcelas`) + sufixoOpcao(i);
        return `<tr${n === 1 ? ' class="doc-vista"' : ""}><td class="doc-k">${rotulo}</td>${cols}</tr>`;
      })
      .join(""),
  ).join("");

  // A comissão é o % efetivo da corretora (um só), repetido em cada coluna.
  const comissaoRow = interno
    ? `<tr class="doc-com"><td class="doc-k">Comissão da corretora</td>${col(
        () =>
          `${opcoes.pctComissao.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}%`,
      )}</tr>`
    : "";

  const temTabela = coberturaLabels.length > 0 || maxOpcoes > 0;
  const tabela = temTabela
    ? `<table class="doc-table"><tbody>${headCoberturas}${coberturaRows}${
        maxOpcoes
          ? `${titulo("Franquias do veículo")}${franquiaRows}${titulo(
              "Parcelas (* sem juros)",
            )}${parcelaRows}`
          : ""
      }${comissaoRow}</tbody></table>`
    : `<div class="doc-obs">Nenhuma cobertura ou opção de pagamento retornada pela seguradora.</div>`;

  const avisoModeloCia =
    config.modelo === "cia" && selecionadas.length > 1
      ? `<div class="doc-aviso">${ICONE_INFO} No modelo da seguradora sai um documento por cia. Aqui você vê o de <strong>${escapeHtml(
          selecionadas[0]?.seguradora ?? "",
        )}</strong>; os outros ${selecionadas.length - 1} seguem no mesmo PDF.</div>`
      : "";

  return `<div class="doc${config.economia ? " economia" : ""}${config.colunado ? " colunado" : ""}">
    ${interno ? faixaInternoHtml() : ""}
    ${topo}
    ${cabecalho}
    <div class="doc-sec">Coberturas e valores do seguro</div>
    ${tabela}
    ${avisoModeloCia}
    ${interno ? controleInternoHtml(dados) : ""}
    <div class="doc-rodape">Cotação gerada pelo CoteCerto · Supper Certo Seguros · valores válidos até ${dataValidade}</div>
    ${interno ? faixaInternoHtml() : ""}
  </div>`;
}

// CSS isolado para a janela de impressão — a janela do `window.open` não
// carrega `src/styles/proto.css`, então repetimos aqui só as variáveis/regras
// `.doc*` que `buildCotacaoDoc` usa (mesmos valores de `proto.css`; ao
// atualizar um lado, atualize o outro).
const DOC_CSS_RULES = `
  .doc{background:#fff;padding:0;font-size:var(--fs-xs);color:#2f3d48;line-height:1.5}
  .doc.economia{line-height:1.38}
  .doc-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid var(--slate);padding-bottom:14px;margin-bottom:14px}
  .doc-logo{width:96px;height:auto;flex:none}
  .doc.economia .doc-logo{width:76px}
  .doc-logo-cia{display:flex;flex-direction:column;align-items:flex-start;gap:4px;flex:none}
  .doc-logo-cia span{font-weight:800;font-size:var(--fs-lg);color:var(--slate);letter-spacing:.02em}
  .doc-logo-cia small{font-size:var(--fs-2xs);color:#7a8794;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
  .doc-meta{text-align:right;font-size:var(--fs-xs)}
  .doc-obs{font-size:var(--fs-2xs);color:#7a8794;margin-top:3px}
  .doc-ola{margin:0 0 14px}
  .doc-sec{background:var(--offwhite);border-left:3px solid var(--yellow);font-weight:800;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;padding:7px 11px;margin:16px 0 10px}
  .doc-bloco{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 22px;margin-bottom:4px}
  .doc-cols3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 22px;margin-bottom:12px}
  .doc-col-t{display:flex;align-items:center;gap:6px;font-weight:800;font-size:var(--fs-xs);color:var(--slate);border-bottom:1px solid var(--border-soft);padding-bottom:5px;margin-bottom:6px}
  .doc-li{display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-bottom:1px dotted var(--cool-100)}
  .doc-li span{color:#7a8794}
  .doc-li strong{text-align:right;font-weight:700}
  .doc-table{width:100%;border-collapse:collapse;margin-top:4px}
  .doc-table td{padding:5px 9px;border-bottom:1px dotted var(--cool-100);text-align:center;vertical-align:middle}
  .doc-table .doc-k{text-align:left;color:#7a8794;width:210px;font-weight:600}
  .doc-table tr.doc-tit td{background:var(--offwhite);font-weight:800;text-transform:uppercase;font-size:var(--fs-2xs);letter-spacing:.05em;border-bottom:0;padding-top:9px}
  .doc-table tr.doc-tit .doc-k{color:var(--slate)}
  .doc-table tr.doc-vista td{background:var(--cream-hi);font-weight:800}
  .doc-table tr.doc-com td{background:var(--cream-soft);font-weight:700}
  .seg-badge{width:62px;height:62px;flex:none;border-radius:50%;background:#fff;border:1.5px solid var(--border-soft);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(18,28,36,.09);padding:7px;box-sizing:border-box;overflow:hidden;color:var(--muted)}
  .seg-badge .wm{font-weight:800;letter-spacing:-.02em;line-height:1.05;text-align:center;font-size:var(--fs-sm);white-space:normal;word-break:break-word;max-width:100%}
  .seg-badge .wm small{display:block;font-size:6.5px;font-weight:700;letter-spacing:.02em;opacity:.78;margin-top:2px;white-space:nowrap;max-width:100%;overflow:hidden}
  .seg-badge.sm{width:50px;height:50px;padding:6px}
  .seg-badge.sm .wm{font-size:var(--fs-2xs)}
  .seg-badge.sm .wm small{font-size:5.5px}
  .seg-badge.xs{width:38px;height:38px;padding:4px}
  .seg-badge.xs .wm{font-size:8px}
  .seg-badge.xs .wm small{display:none}
  .doc-seg{display:flex;flex-direction:column;align-items:center;gap:2px}
  .doc-seg strong{font-size:var(--fs-xs)}
  .doc-seg small{font-size:var(--fs-2xs);color:#7a8794}
  .doc.colunado .doc-table td{border-right:1px solid var(--cool-50)}
  .doc-aviso{display:flex;align-items:center;gap:8px;background:var(--cream-soft);border:1px solid var(--cream-border);border-radius:8px;padding:9px 12px;margin-top:14px;font-size:var(--fs-xs);color:var(--gold-ink)}
  .doc-interno{font-size:var(--fs-2xs);color:#7a8794;margin-top:12px;padding-top:8px;border-top:1px solid var(--border-soft)}
  .doc-rodape{margin-top:18px;padding-top:10px;border-top:1px solid var(--border-soft);font-size:var(--fs-2xs);color:#7a8794;text-align:center}
`;

const DOC_PRINT_CSS = `
  :root{--slate:#425563;--muted:#7a8794;--yellow:#ffb600;--offwhite:#f6f4ee;
    --border-soft:#efead9;--alert:#c0392b;--alert-soft:#fdecea;--cream-hi:#fffdf5;--cream-soft:#fbf7e8;
    --cream-border:#f0e6c2;--gold-ink:#8a6d1a;--cool-100:#e3e8ec;--cool-50:#f4f6f8;
    --fs-2xs:10px;--fs-xs:11px;--fs-sm:12px;--fs-md:13px;--fs-lg:15px}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:24px}
  ${DOC_CSS_RULES}
  @page{size:A4;margin:14mm}
  @media print{body{margin:0}}
`;

/** Abre a janela de impressão só com o documento (sem o cabeçalho/rodapé
 * genérico do `printHtml`) — o documento já tem seu próprio topo e rodapé. */
export function printCotacaoDoc(title: string, docHtml: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${DOC_PRINT_CSS}</style></head><body>${docHtml}</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Permita pop-ups para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* noop */
    }
  }, 300);
}
