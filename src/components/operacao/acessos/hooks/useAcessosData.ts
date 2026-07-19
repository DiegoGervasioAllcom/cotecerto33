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
  Trio,
} from "../types";
import { CLT_DEFAULT } from "../constants";

function toTrio(x: unknown): Trio {
  if (Array.isArray(x)) {
    if (x.length >= 3) return [String(x[0] ?? ""), String(x[1] ?? ""), String(x[2] ?? "")];
    if (x.length === 2) return ["Ituran", String(x[0] ?? ""), String(x[1] ?? "")];
  }
  return ["", "", ""];
}

export function useAcessosData() {
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
      supabase
        .from("empresas")
        .select("id,nome,tipo,documento,cidade,uf,email,telefone,celular,created_at,dados_cadastro")
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,nome,email,desligado_em,desligado_motivo,empresa_id")
        .not("desligado_em", "is", null)
        .order("desligado_em", { ascending: false }),
      supabase.from("modelos_franquia").select("*").order("ordem").order("nome"),
      supabase.from("clt_config").select("*").eq("id", "default").maybeSingle(),
      supabase.from("user_roles").select("user_id,role").in("role", ["master", "supervisor"]),
    ]);
    if (p.error) setErr(p.error.message);
    setPendentes((p.data ?? []) as Pendente[]);
    setDeslig((d.data ?? []) as Deslig[]);
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
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome")
        .in(
          "id",
          roleIds.map((r) => r.user_id),
        )
        .is("desligado_em", null);
      const roleById = new Map(roleIds.map((r) => [r.user_id, r.role as "master" | "supervisor"]));
      setSuperiores(
        ((profs ?? []) as Array<{ id: string; nome: string }>).map((pr) => ({
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
      const { data: donos } = await supabase
        .from("profiles")
        .select("id,empresa_id")
        .in(
          "empresa_id",
          franquias.map((f) => f.id),
        );
      const donoByEmpresa = new Map(
        ((donos ?? []) as Array<{ id: string; empresa_id: string | null }>).map((pr) => [
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
        seguradora_planos: ((c.data.seguradora_planos ?? []) as unknown[]).map(toTrio),
        seguradora_adic: ((c.data.seguradora_adic ?? []) as unknown[]).map(toTrio),
        regras: { ...CLT_DEFAULT.regras, ...((c.data.regras ?? {}) as Partial<CltRegras>) },
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  async function recusar() {
    if (!analisando) return;
    setBusy(true);
    const { error } = await supabase.rpc("recusar_empresa", {
      p_empresa_id: analisando.id,
      motivo: undefined,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setToast({ msg: `Cadastro recusado · ${analisando.nome}`, kind: "alert" });
    closeModal();
    await reload();
  }

  async function liberar(persist: () => Promise<void>, tag: string) {
    if (!analisando) return;
    setBusy(true);
    const { error } = await supabase.rpc("aprovar_empresa", {
      p_empresa_id: analisando.id,
    });
    if (error) {
      setBusy(false);
      console.error("aprovar_empresa error", error);
      setErr(
        `${error.message}${error.details ? ` · ${error.details}` : ""}${error.hint ? ` · ${error.hint}` : ""}`,
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
    recusar,
    liberar,
  };
}
