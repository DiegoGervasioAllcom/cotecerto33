// Estado e ações da página "Acessos e permissões": carrega pendentes,
// desligados, modelos de franquia/CLT, superiores elegíveis e franquias
// aprovadas; expõe as ações de analisar/recusar/liberar um cadastro pendente.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  CltConfig,
  CltRegras,
  Deslig,
  FranquiaAprovada,
  Modelo,
  ModeloParams,
  Pair,
  Pendente,
  PersoSub,
  Superior,
  Tab,
} from "../types";
import { CLT_DEFAULT } from "../constants";
import type { AprovarAcessoParams } from "@/components/acessos/classificar-acesso-modal";
import { fetchPendentes, mapPendentes } from "./pendentes-query";
import { dispatchAccessEmail } from "@/lib/email.functions";
import { selectInBatches } from "@/lib/supabase-in-batches";

type DesligBruto = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string;
  desligado_motivo: string | null;
  empresa_id: string | null;
  cargo_id: string | null;
};

// Mesmo critério de `CadastrosMatrizTab` para separar time interno de rede
// externa: cargo_id definido, ou role='vendedor' numa empresa sem modelo de
// franquia (Vendedor Matriz — nunca é dono/vinculado de uma franquia).
async function classificarDeslig(
  perfis: DesligBruto[],
  onError: (mensagem: string) => void,
): Promise<Deslig[]> {
  if (perfis.length === 0) return [];
  const empresaIds = [
    ...new Set(perfis.map((p) => p.empresa_id).filter((id): id is string => !!id)),
  ];
  const [empresasRes, rolesRes] = await Promise.all([
    selectInBatches(empresaIds, (lote) =>
      supabase.from("empresas").select("id,modelo_id").in("id", lote),
    ),
    selectInBatches(
      perfis.map((p) => p.id),
      (lote) => supabase.from("user_roles").select("user_id,role").in("user_id", lote),
    ),
  ]);
  if (empresasRes.error || rolesRes.error) {
    onError(
      `Não foi possível carregar todos os desligamentos: ${(empresasRes.error ?? rolesRes.error)?.message}`,
    );
  }
  const modeloPorEmpresa = new Map(
    (empresasRes.data as { id: string; modelo_id: string | null }[]).map((e) => [
      e.id,
      e.modelo_id,
    ]),
  );
  const roleByUser = new Map(
    (rolesRes.data as { user_id: string; role: string }[]).map((r) => [r.user_id, r.role]),
  );
  return perfis.map((p) => {
    const interno =
      !!p.cargo_id ||
      (roleByUser.get(p.id) === "vendedor" &&
        (p.empresa_id == null || modeloPorEmpresa.get(p.empresa_id) == null));
    return { ...p, bloco: interno ? "interno" : "externo" };
  });
}

export function useAcessosData(enabled = true) {
  const [tab, setTab] = useState<Tab>("pend");
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [deslig, setDeslig] = useState<Deslig[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [persoSub, setPersoSub] = useState<PersoSub>("franquia");
  const [clt, setClt] = useState<CltConfig>(CLT_DEFAULT);
  const [err, setErr] = useState<string | null>(null);

  const [analisando, setAnalisando] = useState<Pendente | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);
  const [superiores, setSuperiores] = useState<Superior[]>([]);
  const [franquiasAprovadas, setFranquiasAprovadas] = useState<FranquiaAprovada[]>([]);

  const reload = useCallback(async () => {
    setErr(null);
    const [p, d, m, c, roles] = await Promise.all([
      // V11 · F6: o join com convites é o que diz se o pedido veio via Convite
      // Supper (com tipo/vínculo travados) ou é criação manual por exceção
      // (convite_id nulo — "sem tipo declarado, a Matriz define na análise").
      // A RLS de F2 já garante que o pendente do vendedor de uma Franquia Full
      // não aparece aqui: não é preciso filtrar isso no cliente.
      fetchPendentes(),
      supabase
        .from("profiles")
        .select("id,nome,email,desligado_em,desligado_motivo,empresa_id,cargo_id")
        .not("desligado_em", "is", null)
        .order("desligado_em", { ascending: false }),
      supabase.from("modelos_franquia").select("*").order("ordem").order("nome"),
      supabase.from("clt_config").select("*").eq("id", "default").maybeSingle(),
      supabase.from("user_roles").select("user_id,role").in("role", ["master", "supervisor"]),
    ]);
    if (p.error) setErr(p.error.message);
    setPendentes(mapPendentes(p.data));
    setDeslig(await classificarDeslig((d.data ?? []) as DesligBruto[], setErr));
    const modelosData = ((m.data ?? []) as Modelo[]).map((x) => ({
      ...x,
      params: (x.params ?? {}) as ModeloParams,
    }));
    setModelos(modelosData);

    // Superiores elegíveis para "Reporta a" (Master ou Supervisor da Matriz).
    const roleIds = ((roles.data ?? []) as Array<{ user_id: string; role: string }>).filter(
      (r) => r.role === "master" || r.role === "supervisor",
    );
    if (roleIds.length > 0) {
      const { data: profs, error: profsError } = await selectInBatches(
        roleIds.map((r) => r.user_id),
        (lote) =>
          supabase
            .from("profiles")
            .select("id,nome")
            .in("id", lote)
            .eq("status", "aprovada")
            .is("desligado_em", null),
      );
      if (profsError) {
        setErr(`Não foi possível carregar todos os superiores elegíveis: ${profsError.message}`);
      }
      const roleById = new Map(roleIds.map((r) => [r.user_id, r.role as "master" | "supervisor"]));
      setSuperiores(
        (profs as Array<{ id: string; nome: string }>).map((pr) => ({
          id: pr.id,
          nome: pr.nome,
          role: roleById.get(pr.id) ?? "master",
        })),
      );
    } else {
      setSuperiores([]);
    }

    // Franquias aprovadas (PJ com modelo de franquia atribuído) — para "vínculo
    // com franquia" (vendedor de franquia) e "franquias que vai supervisionar".
    const { data: franqData } = await supabase
      .from("empresas")
      .select("id,nome,modelo_id")
      .eq("tipo", "pj")
      .eq("status", "aprovada")
      .not("modelo_id", "is", null);
    const franquias = (franqData ?? []) as Array<{
      id: string;
      nome: string;
      modelo_id: string | null;
    }>;
    if (franquias.length > 0) {
      const { data: donos, error: donosError } = await selectInBatches(
        franquias.map((f) => f.id),
        (lote) => supabase.from("profiles").select("id,empresa_id").in("empresa_id", lote),
      );
      if (donosError) {
        setErr(`Não foi possível carregar todos os donos de franquia: ${donosError.message}`);
      }
      const donoByEmpresa = new Map(
        (donos as Array<{ id: string; empresa_id: string | null }>).map((pr) => [
          pr.empresa_id,
          pr.id,
        ]),
      );
      setFranquiasAprovadas(
        franquias.map((f) => {
          const modelo = modelosData.find((mm) => mm.id === f.modelo_id);
          return {
            id: f.id,
            nome: f.nome,
            modeloNome: modelo?.nome ?? "",
            modalidade: modelo?.modalidade ?? null,
            donoProfileId: donoByEmpresa.get(f.id) ?? null,
          };
        }),
      );
    } else {
      setFranquiasAprovadas([]);
    }

    if (c.data) {
      setClt({
        progressiva: (c.data.progressiva ?? []) as Pair[],
        fator_novas: (c.data.fator_novas ?? []) as Pair[],
        fator_remalho: (c.data.fator_remalho ?? []) as Pair[],
        seguradora_planos: (c.data.seguradora_planos ?? []) as Pair[],
        seguradora_adic: (c.data.seguradora_adic ?? []) as Pair[],
        regras: { ...CLT_DEFAULT.regras, ...((c.data.regras ?? {}) as Partial<CltRegras>) },
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [reload, enabled]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function openAnalisar(p: Pendente) {
    setAnalisando(p);
  }

  function closeModal() {
    setAnalisando(null);
  }

  async function enviarOutbox(outboxId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    await dispatchAccessEmail({ data: { outbox_id: outboxId, caller_token: token } });
  }

  async function solicitarPendencia(motivo: string) {
    if (!analisando) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: analisando.id,
      p_pendencia: motivo,
    });
    if (error || !data) {
      setBusy(false);
      setErr(error?.message ?? "Falha ao registrar a pendência.");
      return;
    }
    try {
      await enviarOutbox(String(data));
      setToast({ msg: `Pendência enviada · ${analisando.nome}`, kind: "ok" });
      closeModal();
      await reload();
    } catch (e) {
      setErr(
        `Pendência registrada, mas o e-mail não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function recusar(motivo: string) {
    if (!analisando) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("recusar_empresa", {
      p_empresa_id: analisando.id,
      motivo,
    });
    if (error || !data) {
      setBusy(false);
      setErr(error?.message ?? "A recusa não retornou a fila do e-mail.");
      return;
    }
    try {
      await enviarOutbox(String(data));
      setToast({ msg: `Cadastro recusado e e-mail enviado · ${analisando.nome}`, kind: "alert" });
      closeModal();
      await reload();
    } catch (e) {
      setErr(
        `Cadastro recusado, mas o e-mail não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  // V11 · F5/F7: papel, cargo, áreas, produtos, canais e supervisão vão numa
  // transação só via `aprovar_acesso` — antes dela vinham em chamadas soltas
  // do front, e uma falha no meio deixava o acesso meio classificado.
  // `persist()` continua existindo à parte para o que é domínio de G3/G4
  // (modelo de franquia, comissão do Master/Supervisor, salário CLT), que a
  // RPC não toca — são dois eixos diferentes.
  async function liberar(params: AprovarAcessoParams, persist: () => Promise<void>, tag: string) {
    if (!analisando) return;
    setBusy(true);
    const { data: outboxId, error } = await supabase.rpc("aprovar_acesso_com_boas_vindas", {
      p_empresa_id: analisando.id,
      p_perfil: params.perfil,
      p_cargo_id: params.cargoId ?? undefined,
      p_areas: params.areas && params.areas.length > 0 ? params.areas : undefined,
      p_produtos: params.produtos && params.produtos.length > 0 ? params.produtos : undefined,
      p_canais: params.canais && params.canais.length > 0 ? params.canais : undefined,
      p_superior_id: params.superiorId ?? undefined,
      p_reclassificado: params.reclassificado ?? false,
      p_motivo: params.motivo || undefined,
    });
    if (error || !outboxId) {
      setBusy(false);
      console.error("aprovar_acesso_com_boas_vindas error", error);
      setErr(
        error
          ? `${error.message}${error.details ? ` · ${error.details}` : ""}${error.hint ? ` · ${error.hint}` : ""}`
          : "A aprovação não retornou a fila do e-mail de boas-vindas.",
      );
      return;
    }
    try {
      await persist();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Erro ao salvar a classificação.");
      await reload();
      return;
    }
    try {
      await enviarOutbox(String(outboxId));
    } catch (e) {
      setBusy(false);
      setErr(
        `Acesso aprovado, mas o e-mail de boas-vindas não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
      await reload();
      return;
    }
    setBusy(false);
    setToast({
      msg: `Acesso liberado · ${analisando.nome}${tag} · e-mail enviado`,
      kind: "ok",
    });
    closeModal();
    await reload();
  }

  return {
    tab,
    setTab,
    pendentes,
    deslig,
    modelos,
    setModelos,
    persoSub,
    setPersoSub,
    clt,
    setClt,
    err,
    setErr,
    analisando,
    busy,
    toast,
    setToast,
    superiores,
    franquiasAprovadas,
    reload,
    openAnalisar,
    closeModal,
    solicitarPendencia,
    recusar,
    liberar,
  };
}
