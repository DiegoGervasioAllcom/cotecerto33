// Modal "Imprimir cotação" (Frente 3 V12 · 7a) — espelha `calcImprimir()` /
// `imprimirConfig()` / `imprimirPreview()` do protótipo V12. Duas portas
// ("Configurar impressão" e "Impressão expressa") levam ao mesmo preview do
// documento comparativo (`buildCotacaoDoc`, em `src/lib/print.ts`).
//
// Fatia A (V12.1.31-33, 36): sem comissão, sem banco, sem envio externo —
// "Imprimir comissão"/E-mail/SMS/WhatsApp/Gerar link ficam desabilitados com
// aviso "disponível em breve" (mesmo padrão de `EmissaoRowCells.tsx`). Só
// "Baixar PDF / imprimir local" funciona de verdade.
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import {
  buildCotacaoDoc,
  printCotacaoDoc,
  type DocDados,
  type DocConfigImpressao,
} from "@/lib/print";
import {
  IMPRIMIR_COTACAO_PARCELAS_PADRAO,
  imprimirCotacaoConfigSchema,
  type ImprimirCotacaoConfig,
} from "@/lib/schemas/imprimirCotacao.schema";

/** Aviso curto nos controles que a fatia A ainda não liga (envio externo e
 * comissão impressa — ver V12.1.34-35/37 na fatia B). */
export const AVISO_IMPRESSAO_EM_BREVE = "Disponível em breve";

type Etapa = "porta" | "config" | "preview";

function configPadrao(dados: DocDados): ImprimirCotacaoConfig {
  return {
    modelo: "supper",
    tipo: "resumida",
    seguradorasSelecionadas: dados.seguradoras.map((s) => s.id),
    parcelas: IMPRIMIR_COTACAO_PARCELAS_PADRAO,
    economia: false,
    colunado: false,
  };
}

export function ImprimirCotacaoModal({
  dados,
  onClose,
}: {
  /** `null` fecha o modal — controlado pelo hook `useImprimirCotacaoModal`. */
  dados: DocDados | null;
  onClose: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("porta");
  const dadosRef = dados;

  const form = useForm<ImprimirCotacaoConfig>({
    resolver: zodResolver(imprimirCotacaoConfigSchema),
    defaultValues: dadosRef ? configPadrao(dadosRef) : undefined,
  });
  const { watch, setValue, handleSubmit, formState, reset } = form;
  const config = watch();

  // Reabre sempre do zero (porta) com a config padrão daquela cotação —
  // este componente fica montado o tempo todo, só `dados` muda de null p/
  // um valor novo a cada clique em "Imprimir".
  useEffect(() => {
    if (dadosRef) {
      setEtapa("porta");
      reset(configPadrao(dadosRef));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosRef]);

  const doc = useMemo(() => {
    if (!dadosRef || etapa !== "preview") return null;
    const cfg: DocConfigImpressao = {
      modelo: config.modelo,
      tipo: config.tipo,
      seguradorasSelecionadas: config.seguradorasSelecionadas,
      parcelas: config.parcelas,
      economia: config.economia,
      colunado: config.colunado,
    };
    return buildCotacaoDoc(dadosRef, cfg);
  }, [dadosRef, etapa, config]);

  if (!dadosRef) return null;
  const dadosAbertos = dadosRef;

  const fechar = () => {
    setEtapa("porta");
    onClose();
  };

  const abrirPreview = (cfgOverride?: Partial<ImprimirCotacaoConfig>) => {
    if (cfgOverride) {
      for (const [chave, valor] of Object.entries(cfgOverride)) {
        setValue(chave as keyof ImprimirCotacaoConfig, valor as never, { shouldValidate: true });
      }
    }
    setEtapa("preview");
  };

  const impressaoExpressa = () => {
    abrirPreview(configPadrao(dadosAbertos));
  };

  const toggleSeguradora = (id: string) => {
    const atual = config.seguradorasSelecionadas;
    const proximo = atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id];
    setValue("seguradorasSelecionadas", proximo, { shouldValidate: true });
  };

  const toggleParcela = (n: number) => {
    const atual = config.parcelas;
    const proximo = atual.includes(n)
      ? atual.filter((p) => p !== n)
      : [...atual, n].sort((a, b) => a - b);
    setValue("parcelas", proximo, { shouldValidate: true });
  };

  const baixarPdf = () => {
    if (!doc) return;
    printCotacaoDoc(`Cotação · ${dadosAbertos.cotacaoNumero}`, doc);
  };

  // `config` (via `watch()`) só reflete a cotação atual depois que o efeito
  // acima roda `reset(configPadrao(dadosRef))` — no primeiro render após
  // `dados` virar não-nulo (efeitos rodam depois do render), `watch()` ainda
  // devolve os valores da montagem anterior (`undefined`, quando o modal
  // nasceu fechado). Sem este fallback, este cálculo — que roda incondicional
  // em toda renderização, não só na etapa "config" — quebra a rota inteira no
  // primeiro clique em qualquer um dos 3 pontos de entrada.
  const seguradorasSelecionadasSeguro = config.seguradorasSelecionadas ?? [];
  const todasSelecionadas =
    dadosRef.seguradoras.length > 0 &&
    dadosRef.seguradoras.every((s) => seguradorasSelecionadasSeguro.includes(s.id));

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      {etapa === "porta" && (
        <div className="modal">
          <div className="modal-h">
            <svg width={18} height={18}>
              <use href="#i-printer" />
            </svg>
            <h3>Imprimir cotação</h3>
            <div className="x" onClick={fechar}>
              <svg width={18} height={18}>
                <use href="#i-x" />
              </svg>
            </div>
          </div>
          <div className="modal-b" style={{ paddingTop: 10 }}>
            <button type="button" className="op-item" onClick={() => setEtapa("config")}>
              <span className="op-ic">
                <svg width={17} height={17}>
                  <use href="#i-settings" />
                </svg>
              </span>
              <span className="op-tx">
                <strong>Configurar impressão</strong>
                <small>Escolher seguradoras, parcelas e o nível de detalhe</small>
              </span>
              <svg width={14} height={14}>
                <use href="#i-chevron-right" />
              </svg>
            </button>
            <button type="button" className="op-item" onClick={impressaoExpressa}>
              <span className="op-ic">
                <svg width={17} height={17}>
                  <use href="#i-bolt" />
                </svg>
              </span>
              <span className="op-tx">
                <strong>Impressão expressa</strong>
                <small>Sai na hora com todas as seguradoras e a versão resumida</small>
              </span>
              <svg width={14} height={14}>
                <use href="#i-chevron-right" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {etapa === "config" && (
        <form className="modal lg" onSubmit={handleSubmit(() => abrirPreview())}>
          <div className="modal-h">
            <svg width={18} height={18}>
              <use href="#i-printer" />
            </svg>
            <h3>Configurar impressão</h3>
            <div className="x" onClick={fechar}>
              <svg width={18} height={18}>
                <use href="#i-x" />
              </svg>
            </div>
          </div>
          <div className="modal-b">
            <div className="pr-grid2">
              <div>
                <div className="acc-sec-t" style={{ marginTop: 0 }}>
                  Modelo do documento
                </div>
                {(
                  [
                    ["supper", "Marca Supper", "o comparativo que o cliente recebe"],
                    ["cia", "Marca da seguradora", "o modelo próprio de cada cia"],
                  ] as const
                ).map(([valor, rotulo, dica]) => (
                  <label
                    key={valor}
                    className={`pr-radio${config.modelo === valor ? " on" : ""}`}
                    onClick={() => setValue("modelo", valor)}
                  >
                    <span className="pr-dot" />
                    <span>
                      <strong>{rotulo}</strong>
                      <small>{dica}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <div className="acc-sec-t" style={{ marginTop: 0 }}>
                  Nível de detalhe
                </div>
                {(
                  [
                    ["resumida", "Resumida", "segurado, veículo e seguro em três colunas no topo"],
                    [
                      "detalhada",
                      "Detalhada",
                      "abre perfil do condutor, uso do veículo e residentes jovens",
                    ],
                  ] as const
                ).map(([valor, rotulo, dica]) => (
                  <label
                    key={valor}
                    className={`pr-radio${config.tipo === valor ? " on" : ""}`}
                    onClick={() => setValue("tipo", valor)}
                  >
                    <span className="pr-dot" />
                    <span>
                      <strong>{rotulo}</strong>
                      <small>{dica}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="acc-sec-t" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Seguradoras no documento
              <span className="lbl-soft">
                {config.seguradorasSelecionadas.length} de {dadosRef.seguradoras.length}{" "}
                selecionadas
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  setValue(
                    "seguradorasSelecionadas",
                    todasSelecionadas ? [] : dadosRef.seguradoras.map((s) => s.id),
                    { shouldValidate: true },
                  )
                }
              >
                {todasSelecionadas ? "Nenhuma" : "Todas"}
              </button>
            </div>
            <div className="pr-cards">
              {dadosRef.seguradoras.map((s) => {
                const on = config.seguradorasSelecionadas.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className={`pr-card${on ? " on" : ""}`}
                    onClick={() => toggleSeguradora(s.id)}
                  >
                    <SeguradoraBadge nome={s.seguradora} tam="sm" />
                    <div className="pr-nome">{s.seguradora}</div>
                    <div className="pr-preco">{s.precoLabel || "—"}</div>
                    <span className="pr-check">
                      {on && (
                        <svg width={12} height={12}>
                          <use href="#i-check" />
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {formState.errors.seguradorasSelecionadas && (
              <div className="muted small" style={{ color: "var(--alert)" }}>
                {formState.errors.seguradorasSelecionadas.message}
              </div>
            )}

            <div className="acc-sec-t">Parcelas no documento</div>
            <div className="pr-chips">
              {IMPRIMIR_COTACAO_PARCELAS_PADRAO.map((n) => {
                const on = config.parcelas.includes(n);
                return (
                  <button
                    type="button"
                    key={n}
                    className={`pr-chip${on ? " on" : ""}`}
                    onClick={() => toggleParcela(n)}
                  >
                    {on && (
                      <svg width={10} height={10}>
                        <use href="#i-x" />
                      </svg>
                    )}{" "}
                    {n === 1 ? "À vista" : `${n}x`}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setValue(
                    "parcelas",
                    config.parcelas.length < 12 ? IMPRIMIR_COTACAO_PARCELAS_PADRAO : [1],
                    { shouldValidate: true },
                  )
                }
              >
                {config.parcelas.length < 12 ? "Todas as 12" : "Só à vista"}
              </button>
            </div>

            <div className="pr-grid2" style={{ marginTop: 6 }}>
              <div>
                <div className="acc-sec-t">Opções do PDF</div>
                <label
                  className={`pr-chk${config.economia ? " on" : ""}`}
                  onClick={() => setValue("economia", !config.economia)}
                >
                  <span className="pr-box">
                    {config.economia && (
                      <svg width={11} height={11}>
                        <use href="#i-check" />
                      </svg>
                    )}
                  </span>
                  Economia de páginas
                </label>
                <label
                  className={`pr-chk${config.colunado ? " on" : ""}`}
                  onClick={() => setValue("colunado", !config.colunado)}
                >
                  <span className="pr-box">
                    {config.colunado && (
                      <svg width={11} height={11}>
                        <use href="#i-check" />
                      </svg>
                    )}
                  </span>
                  Resultado colunado
                </label>
                <label
                  className="pr-chk"
                  aria-disabled="true"
                  title={`Imprimir comissão — ${AVISO_IMPRESSAO_EM_BREVE}`}
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                  <span className="pr-box" />
                  Imprimir comissão
                  <small>{AVISO_IMPRESSAO_EM_BREVE}</small>
                </label>
              </div>
            </div>
          </div>
          <div className="modal-f">
            <button type="button" className="btn btn-ghost" onClick={fechar}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-yellow"
              disabled={config.seguradorasSelecionadas.length === 0}
            >
              <svg width={14} height={14}>
                <use href="#i-check" />
              </svg>{" "}
              Confirmar
            </button>
          </div>
        </form>
      )}

      {etapa === "preview" && doc && (
        <div className="modal lg modal-print">
          <div className="modal-h">
            <svg width={18} height={18}>
              <use href="#i-printer" />
            </svg>
            <h3>Impressão da cotação</h3>
            <div className="x" onClick={fechar}>
              <svg width={18} height={18}>
                <use href="#i-x" />
              </svg>
            </div>
          </div>
          <div className="modal-b pv-body">
            <div className="pv-doc">
              <div dangerouslySetInnerHTML={{ __html: doc }} />
            </div>
            <div className="pv-lado">
              <div className="pv-h">Como deseja enviar?</div>
              {(
                [
                  ["mail", "E-mail", "com o PDF anexado"],
                  ["message", "SMS", "com o link da cotação"],
                  ["message", "WhatsApp", "o caminho mais usado"],
                ] as const
              ).map(([ico, rotulo, sub]) => (
                <button
                  type="button"
                  key={rotulo}
                  className="pv-env"
                  disabled
                  aria-disabled="true"
                  title={`${rotulo} — ${AVISO_IMPRESSAO_EM_BREVE}`}
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                  <svg width={17} height={17}>
                    <use href={`#i-${ico}`} />
                  </svg>
                  <span>
                    <strong>{rotulo}</strong>
                    <small>{sub}</small>
                  </span>
                </button>
              ))}
              <div className="pv-sep" />
              <button
                type="button"
                className="btn btn-ghost btn-sm pv-btn"
                disabled
                aria-disabled="true"
                title={`Gerar link — ${AVISO_IMPRESSAO_EM_BREVE}`}
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                <svg width={13} height={13}>
                  <use href="#i-share" />
                </svg>{" "}
                Gerar link
              </button>
              <button type="button" className="btn btn-slate btn-sm pv-btn" onClick={baixarPdf}>
                <svg width={13} height={13}>
                  <use href="#i-download" />
                </svg>{" "}
                Baixar PDF
              </button>
              <div className="pv-resumo">
                <div>
                  <span>Versão</span>
                  <strong>{config.tipo === "detalhada" ? "Detalhada" : "Resumida"}</strong>
                </div>
                <div>
                  <span>Seguradoras</span>
                  <strong>{config.seguradorasSelecionadas.length}</strong>
                </div>
                <div>
                  <span>Parcelas</span>
                  <strong>{config.parcelas.length}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-f">
            <button type="button" className="btn btn-ghost" onClick={() => setEtapa("config")}>
              <svg width={14} height={14}>
                <use href="#i-chevron-left" />
              </svg>{" "}
              Voltar
            </button>
            <button type="button" className="btn btn-yellow" onClick={fechar}>
              <svg width={14} height={14}>
                <use href="#i-check" />
              </svg>{" "}
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Estado do modal de impressão — usado nos 3 pontos de entrada (Cálculo,
 * Comparativo e "Em negociação"). `abrir(dados)` monta o `DocDados` daquela
 * tela; o componente cuida do resto. */
export function useImprimirCotacaoModal() {
  const [dados, setDados] = useState<DocDados | null>(null);
  return {
    abrir: (novosDados: DocDados) => setDados(novosDados),
    modal: <ImprimirCotacaoModal dados={dados} onClose={() => setDados(null)} />,
  };
}
