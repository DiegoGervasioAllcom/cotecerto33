// Modal "Classificar acesso" (G1.4) — Acessos e permissões.
// Reconstrói os 5 tipos de classificação (PJ: franquia/master · PF: vendedor
// CLT/vendedor de franquia/supervisor da Matriz) com os campos condicionais
// da seção 5 do MAPA_PROTOTIPO_PERFIS.md, persistindo hierarquia (superior_id)
// e configuração de comissão/remuneração.
import { useMemo, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import {
  FAIXAS,
  FORM_FIELDS_BY_TIPO,
  FORM_INTERNAL_KEYS,
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
import {
  pctSchema,
  valorNaoNegativoSchema,
  diaPagamentoSchema,
  leadsDiaSchema,
  checkOptionalNumber,
  checkOptionalEquipe,
} from "@/lib/schemas/classificacao-acesso.schema";

type TipoPJ = "franquia" | "master";
type TipoPF = "vendedor_clt" | "vendedor_franquia" | "supervisor_matriz";

// Substitui a(s) role(s) do usuário em user_roles pela role definitiva da
// classificação. Necessário porque cadastrar_franquia grava 'vendedor' para
// todo mundo e a tabela é UNIQUE(user_id, role) — useAuth() espera no máximo
// 1 linha (.maybeSingle()), então nunca inserir sem antes remover a anterior.
async function substituirRole(profileId: string, role: Perfil) {
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", profileId);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabase.from("user_roles").insert({ user_id: profileId, role });
  if (insErr) throw new Error(insErr.message);
}

async function substituirRolePorEmpresa(empresaId: string, role: Perfil) {
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("empresa_id", empresaId)
    .single();
  if (profErr) throw new Error(profErr.message);
  await substituirRole(prof.id, role);
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
  onLiberar: (persist: () => Promise<void>, tag: string) => Promise<void>;
  busy: boolean;
}) {
  const isPF = pendente.tipo === "pf";
  const [fullForm, setFullForm] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  // ---- PJ: franquia | master --------------------------------------------
  const [tipoPJ, setTipoPJ] = useState<TipoPJ>("franquia");
  const [clSuperior, setClSuperior] = useState("");
  const [clFranquia, setClFranquia] = useState(
    () => modelosFranquia.find((m) => m.tipo === "franqueada")?.id ?? "",
  );
  const [isenta, setIsenta] = useState(false);
  const [clLeads, setClLeads] = useState(FAIXAS[1][1]);
  const [clMmCom, setClMmCom] = useState("20%");
  const [clMmRoy, setClMmRoy] = useState("");

  // ---- PF: vendedor_clt | vendedor_franquia | supervisor_matriz ----------
  const [tipoPF, setTipoPF] = useState<TipoPF>("vendedor_clt");
  const [clCltSup, setClCltSup] = useState("");
  const [clEquipe, setClEquipe] = useState("");
  const [clSalario, setClSalario] = useState("");
  const [cltLeads, setCltLeads] = useState(FAIXAS[1][1]);
  const [clBonus, setClBonus] = useState("");
  const [clDiapg, setClDiapg] = useState("10");
  const [clFaixaval, setClFaixaval] = useState("");
  const [clFaixapct, setClFaixapct] = useState("");
  const [clFranquiaVinculo, setClFranquiaVinculo] = useState("");
  const [clMsCom, setClMsCom] = useState("");
  const [clMsRoy, setClMsRoy] = useState("");
  const [clMsFranq, setClMsFranq] = useState<string[]>([]);

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

  async function handleLiberar() {
    setLocalErr(null);

    if (!isPF) {
      if (tipoPJ === "franquia") {
        if (!clFranquia) {
          setLocalErr("Selecione o modelo de franquia.");
          return;
        }
        const leads = checkOptionalNumber(clLeads, Number, leadsDiaSchema);
        if (leads.error) return setLocalErr(leads.error);
        const persist = async () => {
          const { error: e1 } = await supabase
            .from("empresas")
            .update({ modelo_id: clFranquia, isenta, leads_dia: leads.value })
            .eq("id", pendente.id);
          if (e1) throw new Error(e1.message);
          const { error: e2 } = await supabase
            .from("profiles")
            .update({ superior_id: clSuperior || null })
            .eq("empresa_id", pendente.id);
          if (e2) throw new Error(e2.message);
          await substituirRolePorEmpresa(pendente.id, "franqueado");
        };
        const m = modelosFranquia.find((x) => x.id === clFranquia);
        await onLiberar(persist, m ? ` (${m.nome})` : "");
        return;
      }
      // master
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
        await substituirRolePorEmpresa(pendente.id, "master");
      };
      await onLiberar(persist, " (Master franqueado)");
      return;
    }

    // PF
    if (tipoPF === "vendedor_clt") {
      const salario = checkOptionalNumber(clSalario, parseBRL, valorNaoNegativoSchema);
      if (salario.error) return setLocalErr(salario.error);
      const leads = checkOptionalNumber(cltLeads, Number, leadsDiaSchema);
      if (leads.error) return setLocalErr(leads.error);
      const bonus = checkOptionalNumber(clBonus, parseBRL, valorNaoNegativoSchema);
      if (bonus.error) return setLocalErr(bonus.error);
      const dia = checkOptionalNumber(clDiapg, Number, diaPagamentoSchema);
      if (dia.error) return setLocalErr(dia.error);
      const faixaVal = checkOptionalNumber(clFaixaval, parseBRL, valorNaoNegativoSchema);
      if (faixaVal.error) return setLocalErr(faixaVal.error);
      const faixaPct = checkOptionalNumber(clFaixapct, parsePct, pctSchema);
      if (faixaPct.error) return setLocalErr(faixaPct.error);
      const equipe = checkOptionalEquipe(clEquipe);
      if (equipe.error) return setLocalErr(equipe.error);
      const persist = async () => {
        const { error } = await supabase
          .from("profiles")
          .update({
            superior_id: clCltSup || null,
            equipe: equipe.value,
            salario_base: salario.value,
            leads_dia: leads.value,
            bonus_campanha: bonus.value,
            dia_pagamento: dia.value,
            faixa_elite_valor: faixaVal.value,
            faixa_elite_pct: faixaPct.value,
          })
          .eq("empresa_id", pendente.id);
        if (error) throw new Error(error.message);
        await substituirRolePorEmpresa(pendente.id, "vendedor");
      };
      await onLiberar(persist, " (Vendedor CLT)");
      return;
    }

    if (tipoPF === "vendedor_franquia") {
      if (!clFranquiaVinculo) {
        setLocalErr("Selecione a franquia de vínculo.");
        return;
      }
      const franquia = franquiasAprovadas.find((f) => f.id === clFranquiaVinculo);
      const persist = async () => {
        // Precisa substituir a role ANTES de mudar empresa_id, pois a busca
        // do profile ainda depende de pendente.id (empresa_id atual).
        await substituirRolePorEmpresa(pendente.id, "vendedor");
        const { error } = await supabase
          .from("profiles")
          .update({ empresa_id: clFranquiaVinculo, superior_id: franquia?.donoProfileId ?? null })
          .eq("empresa_id", pendente.id);
        if (error) throw new Error(error.message);
      };
      await onLiberar(persist, ` (Vendedor de franquia — ${franquia?.nome ?? ""})`);
      return;
    }

    // supervisor_matriz
    const com = checkOptionalNumber(clMsCom, parsePct, pctSchema);
    if (com.error) return setLocalErr(com.error);
    const roy = checkOptionalNumber(clMsRoy, parseBRL, valorNaoNegativoSchema);
    if (roy.error) return setLocalErr(roy.error);
    const persist = async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ comissao_modelo: com.value, royalties: roy.value })
        .eq("empresa_id", pendente.id);
      if (error) throw new Error(error.message);
      await substituirRolePorEmpresa(pendente.id, "supervisor");
      if (clMsFranq.length > 0) {
        const { data: supProfile, error: e2 } = await supabase
          .from("profiles")
          .select("id")
          .eq("empresa_id", pendente.id)
          .maybeSingle();
        if (e2) throw new Error(e2.message);
        const donoIds = clMsFranq
          .map((fid) => franquiasAprovadas.find((f) => f.id === fid)?.donoProfileId)
          .filter((id): id is string => !!id);
        if (supProfile && donoIds.length > 0) {
          const { error: e3 } = await supabase
            .from("profiles")
            .update({ superior_id: supProfile.id })
            .in("id", donoIds);
          if (e3) throw new Error(e3.message);
        }
      }
    };
    await onLiberar(persist, " (Supervisor · Matriz)");
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
          ) : !isPF ? (
            <>
              <div className="acc-sec-t">Tipo de cadastro</div>
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

              {tipoPJ === "franquia" ? (
                <>
                  <div className="acc-sec-t">Modelo de franquia</div>
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
                  <div className="acc-grid" style={{ marginTop: 10 }}>
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
                </>
              ) : (
                <>
                  <div className="acc-sec-t">Supervisão</div>
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
              <div className="acc-sec-t">Tipo de cadastro</div>
              <div className="acc-pills">
                <button
                  className={`acc-pill ${tipoPF === "vendedor_clt" ? "on" : ""}`}
                  onClick={() => setTipoPF("vendedor_clt")}
                >
                  Vendedor CLT
                </button>
                <button
                  className={`acc-pill ${tipoPF === "vendedor_franquia" ? "on" : ""}`}
                  onClick={() => setTipoPF("vendedor_franquia")}
                >
                  Vendedor de franquia
                </button>
                <button
                  className={`acc-pill ${tipoPF === "supervisor_matriz" ? "on" : ""}`}
                  onClick={() => setTipoPF("supervisor_matriz")}
                >
                  Supervisor (Matriz)
                </button>
              </div>

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
                    <div className="field-group">
                      <label>Bônus de campanha</label>
                      <MaskedInput
                        mask="brl"
                        className="input"
                        value={clBonus}
                        onValueChange={setClBonus}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="field-group">
                      <label>Dia de pagamento</label>
                      <input
                        className="input"
                        value={clDiapg}
                        onChange={(e) => setClDiapg(e.target.value.replace(/\D/g, "").slice(0, 2))}
                        placeholder="10"
                        maxLength={2}
                      />
                    </div>
                    <div className="field-group">
                      <label>Faixa Elite: acima de (R$)</label>
                      <MaskedInput
                        mask="brl"
                        className="input"
                        value={clFaixaval}
                        onValueChange={setClFaixaval}
                        placeholder="R$ 50.000,00"
                      />
                    </div>
                    <div className="field-group">
                      <label>…comissão passa a</label>
                      <MaskedInput
                        mask="pct"
                        className="input"
                        value={clFaixapct}
                        onValueChange={setClFaixapct}
                        placeholder="55%"
                      />
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
                </>
              )}

              {tipoPF === "supervisor_matriz" && (
                <>
                  <div className="acc-sec-t">Parâmetros do Supervisor</div>
                  <div className="acc-grid">
                    <div className="field-group">
                      <label>Comissão modelo Supervisor</label>
                      <MaskedInput
                        mask="pct"
                        className="input"
                        value={clMsCom}
                        onValueChange={setClMsCom}
                        placeholder="0%"
                      />
                    </div>
                    <div className="field-group">
                      <label>Royalties</label>
                      <MaskedInput
                        mask="brl"
                        className="input"
                        value={clMsRoy}
                        onValueChange={setClMsRoy}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                  <div className="acc-sec-t">Franquias que vai supervisionar</div>
                  <div className="acc-grid">
                    {franquiasAprovadas.length === 0 && (
                      <span className="muted small">Nenhuma franquia aprovada ainda.</span>
                    )}
                    {franquiasAprovadas.map((f) => (
                      <label
                        key={f.id}
                        className="chk-row"
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={clMsFranq.includes(f.id)}
                          onChange={(e) =>
                            setClMsFranq((prev) =>
                              e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                            )
                          }
                        />
                        {f.nome}
                      </label>
                    ))}
                  </div>
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
