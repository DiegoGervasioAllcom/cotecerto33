// Modal "Classificar acesso" (G1.4, V11 F7/F8) — Acessos e permissões.
//
// V11: quando o pedido tem Convite Supper, o modal abre TRAVADO no tipo e
// vínculo que o convite declarou — "Reclassificar" é exceção, exige motivo, e
// fica registrado no próprio pedido (não sobrescreve o declarado, que continua
// no convite). Sem convite (criação manual por exceção), abre livre, como
// sempre foi.
//
// A aprovação em si (papel, cargo, áreas, produtos, canais, supervisão) vai
// numa transação só via `aprovar_acesso` (F5) — os campos de comissão/modelo
// que são domínio de G3/G4 (modelo de franquia, % do Master, salário CLT)
// continuam num `persist()` à parte, como já era antes da V11: são um eixo
// diferente do que a Frente 2 mexe.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import {
  FAIXAS,
  FORM_FIELDS_BY_TIPO,
  FORM_INTERNAL_KEYS,
  MODELO_PARAMS_LABELS,
} from "@/components/operacao/acessos/constants";
import type {
  Pendente,
  Modelo,
  Superior,
  FranquiaAprovada,
} from "@/components/operacao/acessos/types";
import { MaskedInput } from "@/components/masked-input";
import { parseBRL, parsePct, maskCpfCnpj, maskTelefone } from "@/lib/masks";
import { supabase, type Perfil } from "@/integrations/supabase/client";
import { rotuloConvite } from "@/lib/convite-rotulo";
import { perfilDoCargo, CARGOS_SUPERVISAO } from "@/lib/cargo-perfil";
import { CargoAreasFields, useCargos } from "@/components/acessos/cargo-areas-fields";
import { ProdutosCanaisFields } from "@/components/acessos/produtos-canais-fields";
import {
  pctSchema,
  valorNaoNegativoSchema,
  diaPagamentoSchema,
  leadsDiaSchema,
  checkOptionalNumber,
  checkOptionalEquipe,
} from "@/lib/schemas/classificacao-acesso.schema";

type TipoPJ = "franquia" | "master";
// "vendedor_clt" é o Vendedor Matriz (perfil vendedor, sem cargo — vende, tem
// produtos/canais). "interno" cobre os 7 cargos (Direção, Coordenador e os 3
// supervisores inclusive — que antes da V11 não tinham como ser aprovados por
// este modal: só existia o "Supervisor (Matriz)" solto, sem cargo nem áreas).
type TipoPF = "vendedor_clt" | "vendedor_franquia" | "interno";

export type AprovarAcessoParams = {
  perfil: Perfil;
  cargoId?: string | null;
  areas?: string[];
  produtos?: string[];
  canais?: string[];
  superiorId?: string | null;
  reclassificado?: boolean;
  motivo?: string;
};

async function buscarSupervisoresDeVendas(): Promise<Array<{ id: string; nome: string }>> {
  const { data } = await supabase
    .from("profiles")
    .select("id,nome")
    .in("cargo_id", CARGOS_SUPERVISAO)
    .is("desligado_em", null);
  return (data as Array<{ id: string; nome: string }>) ?? [];
}

/** Deriva o estado inicial (e travado) do modal a partir do que o convite declarou. */
function estadoDoConvite(pendente: Pendente): { tipoPJ: TipoPJ; tipoPF: TipoPF; cargoId: string } {
  const c = pendente.convite;
  if (!c) return { tipoPJ: "franquia", tipoPF: "vendedor_clt", cargoId: "" };
  if (c.trilha === "interno") {
    return {
      tipoPJ: "franquia",
      tipoPF: c.cargo_id ? "interno" : "vendedor_clt",
      cargoId: c.cargo_id ?? "",
    };
  }
  switch (c.perfil) {
    case "master":
      return { tipoPJ: "master", tipoPF: "vendedor_clt", cargoId: "" };
    case "franquia_full":
    case "franquia_indiv":
      return { tipoPJ: "franquia", tipoPF: "vendedor_clt", cargoId: "" };
    case "vendedor":
      // O de Franquia Full nunca chega aqui — a RLS (F2) já filtrou. O que
      // sobra é sempre vendedor da operação do Master.
      return { tipoPJ: "franquia", tipoPF: "vendedor_franquia", cargoId: "" };
    default:
      return { tipoPJ: "franquia", tipoPF: "vendedor_clt", cargoId: "" };
  }
}

export function ClassificarAcessoModal({
  pendente,
  modelosFranquia,
  superiores,
  franquiasAprovadas,
  onClose,
  onRecusar,
  onLiberar,
  busy,
}: {
  pendente: Pendente;
  modelosFranquia: Modelo[];
  superiores: Superior[];
  franquiasAprovadas: FranquiaAprovada[];
  onClose: () => void;
  onRecusar: () => void;
  onLiberar: (
    params: AprovarAcessoParams,
    persist: () => Promise<void>,
    tag: string,
  ) => Promise<void>;
  busy: boolean;
}) {
  const isPF = pendente.tipo === "pf";
  const [fullForm, setFullForm] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  // V11 · F7 — trava do convite. Sem convite não há o que travar.
  const [locked, setLocked] = useState(!!pendente.convite);
  const [motivo, setMotivo] = useState("");
  const inicial = useMemo(() => estadoDoConvite(pendente), [pendente]);

  const cargosCatalogo = useCargos();
  const [supervisoresVendas, setSupervisoresVendas] = useState<Array<{ id: string; nome: string }>>(
    [],
  );
  useEffect(() => {
    void buscarSupervisoresDeVendas().then(setSupervisoresVendas);
  }, []);

  // ---- PJ: franquia | master --------------------------------------------
  const [tipoPJ, setTipoPJ] = useState<TipoPJ>(inicial.tipoPJ);
  const [clSuperior, setClSuperior] = useState("");
  const [clFranquia, setClFranquia] = useState(
    () => modelosFranquia.find((m) => m.tipo === "franqueada")?.id ?? "",
  );
  const [isenta, setIsenta] = useState(false);
  const [clLeads, setClLeads] = useState(FAIXAS[1][1]);
  const [clFrBonus, setClFrBonus] = useState("");
  const [clFrDiapg, setClFrDiapg] = useState("10");
  const [clFrFaixaval, setClFrFaixaval] = useState("");
  const [clFrFaixapct, setClFrFaixapct] = useState("");
  const [clMmCom, setClMmCom] = useState("20%");
  const [clMmRoy, setClMmRoy] = useState("");
  const [clMasterSupervisor, setClMasterSupervisor] = useState("");
  const [produtosFranquia, setProdutosFranquia] = useState<string[]>([]);
  const [canaisFranquia, setCanaisFranquia] = useState<string[]>([]);

  // ---- PF: vendedor_clt | vendedor_franquia | interno --------------------
  const [tipoPF, setTipoPF] = useState<TipoPF>(inicial.tipoPF);
  const [clCltSup, setClCltSup] = useState("");
  const [clEquipe, setClEquipe] = useState("");
  const [clSalario, setClSalario] = useState("");
  const [cltLeads, setCltLeads] = useState(FAIXAS[1][1]);
  const [produtosVendClt, setProdutosVendClt] = useState<string[]>([]);
  const [canaisVendClt, setCanaisVendClt] = useState<string[]>([]);
  const [clFranquiaVinculo, setClFranquiaVinculo] = useState("");
  const [produtosVendFranquia, setProdutosVendFranquia] = useState<string[]>([]);
  const [canaisVendFranquia, setCanaisVendFranquia] = useState<string[]>([]);
  const [cargoInterno, setCargoInterno] = useState(inicial.cargoId);
  const [areasInterno, setAreasInterno] = useState<string[]>([]);
  const [clMsCom, setClMsCom] = useState("");
  const [clMsRoy, setClMsRoy] = useState("");

  const franquiasFull = useMemo(
    () => franquiasAprovadas.filter((f) => f.modalidade === "full"),
    [franquiasAprovadas],
  );

  const tipoChip = isPF ? (
    <span className="chip chip-outline">Pessoa Física</span>
  ) : (
    <span className="chip chip-slate">Pessoa Jurídica</span>
  );

  const formRows = useMemo(() => {
    const dados = (pendente.dados_cadastro ?? {}) as Record<string, unknown>;
    const hasValue = (k: string) => dados[k] != null && dados[k] !== "";
    const order = FORM_FIELDS_BY_TIPO[isPF ? "pf" : "pj"];
    const rows: [string, string][] = order
      .filter(([k]) => hasValue(k))
      .map(([k, label]) => [label, String(dados[k])]);
    const known = new Set<string>([...order.map(([k]) => k), ...FORM_INTERNAL_KEYS]);
    for (const [k, v] of Object.entries(dados)) {
      if (known.has(k) || v == null || v === "") continue;
      rows.push([k, String(v)]);
    }
    return rows;
  }, [pendente, isPF]);

  function reclassificar() {
    setLocked(false);
  }

  async function handleLiberar() {
    setLocalErr(null);

    // Reclassificar é exceção e exige motivo — o servidor confere de novo
    // (F5), isto é só para não deixar a pessoa clicar e levar um erro genérico.
    const reclassificado = !!pendente.convite && !locked;
    if (reclassificado && motivo.trim().length < 3) {
      setLocalErr("Reclassificar é exceção: diga o motivo (mín. 3 caracteres).");
      return;
    }

    if (!isPF) {
      if (tipoPJ === "franquia") {
        if (!clFranquia) {
          setLocalErr("Selecione o modelo de franquia.");
          return;
        }
        const leads = checkOptionalNumber(clLeads, Number, leadsDiaSchema);
        if (leads.error) return setLocalErr(leads.error);
        const bonus = checkOptionalNumber(clFrBonus, parseBRL, valorNaoNegativoSchema);
        if (bonus.error) return setLocalErr(bonus.error);
        const dia = checkOptionalNumber(clFrDiapg, Number, diaPagamentoSchema);
        if (dia.error) return setLocalErr(dia.error);
        const faixaVal = checkOptionalNumber(clFrFaixaval, parseBRL, valorNaoNegativoSchema);
        if (faixaVal.error) return setLocalErr(faixaVal.error);
        const faixaPct = checkOptionalNumber(clFrFaixapct, parsePct, pctSchema);
        if (faixaPct.error) return setLocalErr(faixaPct.error);
        const persist = async () => {
          const { error } = await supabase
            .from("empresas")
            .update({
              modelo_id: clFranquia,
              isenta,
              leads_dia: leads.value,
              bonus_campanha: bonus.value,
              dia_pagamento: dia.value,
              faixa_elite_valor: faixaVal.value,
              faixa_elite_pct: faixaPct.value,
            })
            .eq("id", pendente.id);
          if (error) throw new Error(error.message);
        };
        const m = modelosFranquia.find((x) => x.id === clFranquia);
        await onLiberar(
          {
            perfil: "franqueado",
            superiorId: clSuperior || null,
            produtos: produtosFranquia,
            canais: canaisFranquia,
            reclassificado,
            motivo,
          },
          persist,
          m ? ` (${m.nome})` : "",
        );
        return;
      }
      // master — sem produtos/canais (não vende, não recebe leads); ganha o
      // seletor de Supervisor de Vendas (Etapa 2).
      const com = checkOptionalNumber(clMmCom, parsePct, pctSchema);
      if (com.error) return setLocalErr(com.error);
      const roy = checkOptionalNumber(clMmRoy, parseBRL, valorNaoNegativoSchema);
      if (roy.error) return setLocalErr(roy.error);
      const persist = async () => {
        const { error } = await supabase
          .from("empresas")
          .update({ perc_equipe: com.value, royalties_fpp: roy.value })
          .eq("id", pendente.id);
        if (error) throw new Error(error.message);
      };
      await onLiberar(
        {
          perfil: "master",
          superiorId: clMasterSupervisor || null,
          reclassificado,
          motivo,
        },
        persist,
        " (Master franqueado)",
      );
      return;
    }

    // PF
    if (tipoPF === "vendedor_clt") {
      const salario = checkOptionalNumber(clSalario, parseBRL, valorNaoNegativoSchema);
      if (salario.error) return setLocalErr(salario.error);
      const leads = checkOptionalNumber(cltLeads, Number, leadsDiaSchema);
      if (leads.error) return setLocalErr(leads.error);
      const equipe = checkOptionalEquipe(clEquipe);
      if (equipe.error) return setLocalErr(equipe.error);
      const persist = async () => {
        const { error } = await supabase
          .from("profiles")
          .update({ equipe: equipe.value, salario_base: salario.value, leads_dia: leads.value })
          .eq("empresa_id", pendente.id);
        if (error) throw new Error(error.message);
      };
      await onLiberar(
        {
          perfil: "vendedor",
          superiorId: clCltSup || null,
          produtos: produtosVendClt,
          canais: canaisVendClt,
          reclassificado,
          motivo,
        },
        persist,
        " (Vendedor Matriz)",
      );
      return;
    }

    if (tipoPF === "vendedor_franquia") {
      if (!clFranquiaVinculo) {
        setLocalErr("Selecione a franquia de vínculo.");
        return;
      }
      const franquia = franquiasAprovadas.find((f) => f.id === clFranquiaVinculo);
      const persist = async () => {
        const { error } = await supabase
          .from("profiles")
          .update({ empresa_id: clFranquiaVinculo })
          .eq("empresa_id", pendente.id);
        if (error) throw new Error(error.message);
      };
      await onLiberar(
        {
          perfil: "vendedor",
          superiorId: franquia?.donoProfileId ?? null,
          produtos: produtosVendFranquia,
          canais: canaisVendFranquia,
          reclassificado,
          motivo,
        },
        persist,
        ` (Vendedor de franquia — ${franquia?.nome ?? ""})`,
      );
      return;
    }

    // interno — cargo (preset) + áreas ajustáveis. Cobre Direção, Coordenador
    // e os 3 supervisores, que antes da V11 não tinham como ser aprovados
    // aqui (só existia o "Supervisor (Matriz)" solto).
    if (!cargoInterno) {
      setLocalErr("Escolha o cargo.");
      return;
    }
    const ehSupervisao = (CARGOS_SUPERVISAO as readonly string[]).includes(cargoInterno);
    let com: { value?: number | null; error?: string | null } = {};
    let roy: { value?: number | null; error?: string | null } = {};
    if (ehSupervisao) {
      com = checkOptionalNumber(clMsCom, parsePct, pctSchema);
      if (com.error) return setLocalErr(com.error);
      roy = checkOptionalNumber(clMsRoy, parseBRL, valorNaoNegativoSchema);
      if (roy.error) return setLocalErr(roy.error);
    }
    const persist = async () => {
      if (!ehSupervisao) return;
      const { error } = await supabase
        .from("profiles")
        .update({ comissao_modelo: com.value, royalties: roy.value })
        .eq("empresa_id", pendente.id);
      if (error) throw new Error(error.message);
    };
    await onLiberar(
      {
        perfil: perfilDoCargo(cargoInterno),
        cargoId: cargoInterno,
        areas: areasInterno,
        reclassificado,
        motivo,
      },
      persist,
      ` (${cargosCatalogo.find((c) => c.id === cargoInterno)?.nome ?? "time interno"})`,
    );
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal lg">
        <div className="modal-h">
          <Icon id={fullForm ? "file" : "shield"} size={18} />
          <h3>
            {fullForm ? "Formulário completo" : "Classificar acesso"} — {pendente.nome}
          </h3>
          <div className="x" onClick={onClose}>
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <div
            className="acc-sol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div>
                {tipoChip}{" "}
                <strong style={{ marginLeft: 6 }}>{maskCpfCnpj(pendente.documento)}</strong>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {pendente.email ?? "—"} ·{" "}
                {(pendente.celular ?? pendente.telefone)
                  ? maskTelefone(pendente.celular ?? pendente.telefone)
                  : "—"}
                {pendente.cidade
                  ? ` · ${pendente.cidade}${pendente.uf ? "/" + pendente.uf : ""}`
                  : ""}
              </div>
            </div>
            {!fullForm && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFullForm(true)}>
                <Icon id="file" size={13} /> Formulário completo
              </button>
            )}
          </div>

          {localErr && (
            <div className="banner alert" style={{ marginTop: 12 }}>
              {localErr}
            </div>
          )}

          {fullForm ? (
            <table className="table-pipe ff-table" style={{ marginTop: 14 }}>
              <tbody>
                {formRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted small" style={{ padding: 16 }}>
                      Sem dados adicionais informados no cadastro.
                    </td>
                  </tr>
                ) : (
                  formRows.map(([k, v]) => (
                    <tr key={k}>
                      <td className="ff-k">{k}</td>
                      <td className="ff-v">{v}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <>
              <div className="acc-sec-t">Tipo de usuário</div>
              {locked ? (
                <>
                  <div
                    className="acc-sol"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <Icon id="mail" size={14} />
                      &nbsp;Definido no convite:{" "}
                      <strong data-testid="tipo-declarado">
                        {rotuloConvite(pendente.convite)}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={reclassificar}
                      data-testid="btn-reclassificar"
                    >
                      Reclassificar
                    </button>
                  </div>
                  <div className="small muted" style={{ margin: "6px 0 12px" }}>
                    O convite já definiu o tipo — reclassifique só em exceção. Se o convite saiu
                    errado, o caminho certo é recusar e enviar um novo.
                  </div>
                </>
              ) : (
                <>
                  {pendente.convite && (
                    <div className="field-group full" style={{ marginBottom: 10 }}>
                      <label>Motivo da reclassificação</label>
                      <input
                        className="input"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        maxLength={400}
                        placeholder="Por que este pedido não segue o que o convite declarou?"
                        data-testid="motivo-reclassificacao"
                      />
                    </div>
                  )}
                  {!isPF ? (
                    <div className="acc-pills">
                      <button
                        className={`acc-pill ${tipoPJ === "franquia" ? "on" : ""}`}
                        onClick={() => setTipoPJ("franquia")}
                      >
                        Franquia
                      </button>
                      <button
                        className={`acc-pill ${tipoPJ === "master" ? "on" : ""}`}
                        onClick={() => setTipoPJ("master")}
                      >
                        Master franqueado
                      </button>
                    </div>
                  ) : (
                    <div className="acc-pills">
                      <button
                        className={`acc-pill ${tipoPF === "vendedor_clt" ? "on" : ""}`}
                        onClick={() => setTipoPF("vendedor_clt")}
                      >
                        Vendedor Matriz
                      </button>
                      <button
                        className={`acc-pill ${tipoPF === "vendedor_franquia" ? "on" : ""}`}
                        onClick={() => setTipoPF("vendedor_franquia")}
                      >
                        Vendedor de franquia
                      </button>
                      <button
                        className={`acc-pill ${tipoPF === "interno" ? "on" : ""}`}
                        onClick={() => setTipoPF("interno")}
                      >
                        Time interno | cargo
                      </button>
                    </div>
                  )}
                </>
              )}

              {!isPF ? (
                <>
                  {tipoPJ === "franquia" ? (
                    <>
                      <div className="acc-sec-t">
                        Modelo de franquia{" "}
                        <span className="muted small" style={{ fontWeight: 500 }}>
                          — Individual (Smart, Conecta, Light, Link, Flex) ou Full (com equipe)
                        </span>
                      </div>
                      <div className="acc-pills">
                        {modelosFranquia.length === 0 && (
                          <span className="muted small">
                            Nenhum modelo cadastrado em Personalização geral.
                          </span>
                        )}
                        {modelosFranquia.map((m) => (
                          <button
                            key={m.id}
                            className={`acc-pill ${m.id === clFranquia ? "on" : ""}`}
                            onClick={() => setClFranquia(m.id)}
                          >
                            {m.nome}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const modelo = modelosFranquia.find((m) => m.id === clFranquia);
                        const isFull = modelo?.modalidade === "full";
                        return (
                          <div className="clt-note" style={{ marginTop: 10 }}>
                            <Icon id="info" size={15} />
                            <div>
                              {isFull ? (
                                <>
                                  <strong>Modelo Full:</strong> o franqueado terá{" "}
                                  <strong>vendedores abaixo</strong> — recebe a área de franqueado
                                  completa (cadastra vendedores, ranking e acompanhamento da
                                  equipe).
                                </>
                              ) : (
                                <>
                                  <strong>Modelo Individual:</strong> o franqueado opera como{" "}
                                  <strong>um vendedor</strong> (atende, cota e vê seus resultados).
                                  Sem cadastro de vendedores nem ranking de equipe — o título de
                                  franquia é estratégia comercial.
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="acc-sec-t">Supervisão</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>Reporta a</label>
                          <select
                            className="input"
                            value={clSuperior}
                            onChange={(e) => setClSuperior(e.target.value)}
                          >
                            <option value="">— Matriz (topo) —</option>
                            {superiores.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome} · {s.role === "master" ? "Master" : "Supervisor"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field-group">
                          <label>Leads · média/dia útil</label>
                          <select
                            className="input"
                            value={clLeads}
                            onChange={(e) => setClLeads(e.target.value)}
                          >
                            {FAIXAS.map(([nome, qtd]) => (
                              <option key={nome} value={qtd}>
                                {nome} — {qtd}/dia
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field-group">
                          <label>Controle de isenção</label>
                          <label
                            className="chk-row"
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <input
                              type="checkbox"
                              checked={isenta}
                              onChange={(e) => setIsenta(e.target.checked)}
                            />
                            Franquia isenta
                          </label>
                        </div>
                      </div>
                      <ProdutosCanaisFields
                        bloco="externo"
                        produtos={produtosFranquia}
                        setProdutos={setProdutosFranquia}
                        canais={canaisFranquia}
                        setCanais={setCanaisFranquia}
                      />
                      <div className="acc-sec-t">
                        Parâmetros{" "}
                        <span className="muted small" style={{ fontWeight: 500 }}>
                          — definidos pelo modelo em Personalização geral
                        </span>
                      </div>
                      <div className="acc-grid">
                        {MODELO_PARAMS_LABELS.map(([k, label]) => (
                          <div className="field-group" key={k}>
                            <label>{label}</label>
                            <div className="input" style={{ background: "var(--offwhite)" }}>
                              {modelosFranquia.find((m) => m.id === clFranquia)?.params?.[k] ?? "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="acc-sec-t">Condições adicionais</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>Dia de pagamento</label>
                          <input
                            className="input"
                            value={clFrDiapg}
                            onChange={(e) =>
                              setClFrDiapg(e.target.value.replace(/\D/g, "").slice(0, 2))
                            }
                            placeholder="10"
                            maxLength={2}
                          />
                        </div>
                        <div className="field-group">
                          <label>Bônus de campanha</label>
                          <MaskedInput
                            mask="brl"
                            className="input"
                            value={clFrBonus}
                            onValueChange={setClFrBonus}
                            placeholder="R$ 0,00"
                          />
                        </div>
                        <div className="field-group">
                          <label>Faixa: acima de (R$)</label>
                          <MaskedInput
                            mask="brl"
                            className="input"
                            value={clFrFaixaval}
                            onValueChange={setClFrFaixaval}
                            placeholder="ex.: 50.000"
                          />
                        </div>
                        <div className="field-group">
                          <label>…comissão passa a</label>
                          <MaskedInput
                            mask="pct"
                            className="input"
                            value={clFrFaixapct}
                            onValueChange={setClFrFaixapct}
                            placeholder="ex.: 55%"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="acc-sec-t">Supervisão</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>Supervisor de Vendas responsável</label>
                          <select
                            className="input"
                            value={clMasterSupervisor}
                            onChange={(e) => setClMasterSupervisor(e.target.value)}
                          >
                            <option value="">— nenhum cadastrado —</option>
                            {supervisoresVendas.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="clt-note">
                        <Icon id="info" size={15} />
                        <div>
                          O Master se reporta a um <strong>Supervisor de Vendas</strong>. Havendo
                          mais de um cadastrado, a Matriz escolhe aqui, na aprovação.
                        </div>
                      </div>
                      <div className="acc-sec-t">Comissão — Modelo Master</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>% sobre a comissão da equipe</label>
                          <MaskedInput
                            mask="pct"
                            className="input"
                            value={clMmCom}
                            onValueChange={setClMmCom}
                            placeholder="20%"
                          />
                        </div>
                        <div className="field-group">
                          <label>Royalties + FPP</label>
                          <MaskedInput
                            mask="brl"
                            className="input"
                            value={clMmRoy}
                            onValueChange={setClMmRoy}
                            placeholder="R$ 0,00"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {tipoPF === "vendedor_clt" && (
                    <>
                      <div className="acc-sec-t">Parâmetros do vendedor (CLT)</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>Reporta a (Supervisor)</label>
                          <select
                            className="input"
                            value={clCltSup}
                            onChange={(e) => setClCltSup(e.target.value)}
                          >
                            <option value="">— Matriz (topo) —</option>
                            {superiores.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome} · {s.role === "master" ? "Master" : "Supervisor"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field-group">
                          <label>Equipe</label>
                          <input
                            className="input"
                            value={clEquipe}
                            onChange={(e) => setClEquipe(e.target.value)}
                            maxLength={120}
                            placeholder="ex.: Novas Vendas"
                          />
                        </div>
                        <div className="field-group">
                          <label>Salário base (R$)</label>
                          <MaskedInput
                            mask="brl"
                            className="input"
                            value={clSalario}
                            onValueChange={setClSalario}
                            placeholder="R$ 1.800,00"
                          />
                        </div>
                        <div className="field-group">
                          <label>Leads · média/dia útil</label>
                          <select
                            className="input"
                            value={cltLeads}
                            onChange={(e) => setCltLeads(e.target.value)}
                          >
                            {FAIXAS.map(([nome, qtd]) => (
                              <option key={nome} value={qtd}>
                                {nome} — {qtd}/dia
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <ProdutosCanaisFields
                        bloco="interno"
                        produtos={produtosVendClt}
                        setProdutos={setProdutosVendClt}
                        canais={canaisVendClt}
                        setCanais={setCanaisVendClt}
                      />
                      <div className="clt-note">
                        <Icon id="info" size={15} />
                        <div>
                          Remuneração pelo <strong>Modelo CLT</strong> (progressiva + fator +
                          Ituran). Edite as tabelas em Personalização geral › Modelo CLT.
                        </div>
                      </div>
                    </>
                  )}

                  {tipoPF === "vendedor_franquia" && (
                    <>
                      <div className="acc-sec-t">Vínculo com a franquia (modelo Full)</div>
                      <div className="acc-grid">
                        <div className="field-group">
                          <label>Franquia</label>
                          <select
                            className="input"
                            value={clFranquiaVinculo}
                            onChange={(e) => setClFranquiaVinculo(e.target.value)}
                          >
                            <option value="">— Selecione —</option>
                            {franquiasFull.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nome}
                              </option>
                            ))}
                          </select>
                          {franquiasFull.length === 0 && (
                            <div className="muted small" style={{ marginTop: 4 }}>
                              Nenhuma franquia modelo Full aprovada ainda.
                            </div>
                          )}
                        </div>
                      </div>
                      <ProdutosCanaisFields
                        bloco="externo"
                        produtos={produtosVendFranquia}
                        setProdutos={setProdutosVendFranquia}
                        canais={canaisVendFranquia}
                        setCanais={setCanaisVendFranquia}
                      />
                      <div className="clt-note">
                        <Icon id="info" size={15} />
                        <div>
                          Vendedor da <strong>operação própria do Master</strong> — remunerado e
                          supervisionado por ele. Vendedor de <strong>Franquia Full</strong> não
                          passa por aqui: quem aprova é a própria franqueada, na fila dela.
                        </div>
                      </div>
                    </>
                  )}

                  {tipoPF === "interno" && (
                    <>
                      <CargoAreasFields
                        cargos={cargosCatalogo}
                        cargoId={cargoInterno}
                        setCargoId={setCargoInterno}
                        areas={areasInterno}
                        setAreas={setAreasInterno}
                        locked={locked}
                      />
                      {(CARGOS_SUPERVISAO as readonly string[]).includes(cargoInterno) && (
                        <>
                          <div className="acc-sec-t">
                            Comissão — Modelo Supervisor{" "}
                            <span className="muted small" style={{ fontWeight: 500 }}>
                              (ajuste por pessoa)
                            </span>
                          </div>
                          <div className="acc-grid">
                            <div className="field-group">
                              <label>% sobre a comissão das franquias</label>
                              <MaskedInput
                                mask="pct"
                                className="input"
                                value={clMsCom}
                                onValueChange={setClMsCom}
                                placeholder="ex.: 15%"
                              />
                            </div>
                            <div className="field-group">
                              <label>Royalties + FPP</label>
                              <MaskedInput
                                mask="brl"
                                className="input"
                                value={clMsRoy}
                                onValueChange={setClMsRoy}
                                placeholder="ex.: 5%"
                              />
                            </div>
                          </div>
                        </>
                      )}
                      <div className="clt-note">
                        <Icon id="info" size={15} />
                        <div>
                          Cargo e áreas vão no e-mail <strong>Boas-vindas Supper</strong> do time
                          interno. Aprovado, o cadastro entra em <strong>Cadastros Matriz</strong>.
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-f">
          {fullForm ? (
            <button className="btn btn-yellow" onClick={() => setFullForm(false)}>
              <Icon id="chevron-left" size={14} /> Voltar à classificação
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={onRecusar}>
                <Icon id="x" size={14} /> Recusar
              </button>
              <button className="btn btn-yellow" disabled={busy} onClick={handleLiberar}>
                <Icon id="check" size={14} /> {busy ? "Processando…" : "Liberar acesso"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
