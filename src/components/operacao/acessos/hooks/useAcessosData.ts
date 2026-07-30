// Estado e ações da página "Acessos e permissões": carrega pendentes,
// desligados, modelos de franquia/CLT, superiores elegíveis e franquias
// aprovadas; expõe as ações de analisar/recusar/liberar um cadastro pendente.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  CltConfig,
  CltRegras,
  ConviteDoPendente,
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
import type { AprovarAcessoParams } from "@/components/acessos/classificar-acesso-modal";

type PendenteBruto = {
  id: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  created_at: string;
  dados_cadastro: Record<string, unknown> | null;
  // PostgREST devolve objeto único para *-a-1, mas o client-gen tipa como
  // array quando não sabe a cardinalidade da FK — tratamos os dois formatos.
  convites:
    | {
        codigo: string;
        trilha: string;
        perfil: string | null;
        cargo_id: string | null;
        vinc_tipo: string;
        vinc_empresa_id: string | null;
        cargos: { nome: string } | { nome: string }[] | null;
      }
    | {
        codigo: string;
        trilha: string;
        perfil: string | null;
        cargo_id: string | null;
        vinc_tipo: string;
        vinc_empresa_id: string | null;
        cargos: { nome: string } | { nome: string }[] | null;
      }[]
    | null;
};

/** Normaliza o join de convites (+ cargo) e deriva o bloco (F6). */
function mapPendentes(data: unknown): Pendente[] {
  return ((data ?? []) as PendenteBruto[]).map((row) => {
    const convRaw = Array.isArray(row.convites) ? row.convites[0] : row.convites;
    let convite: ConviteDoPendente | null = null;
    if (convRaw) {
      const cargoRaw = Array.isArray(convRaw.cargos) ? convRaw.cargos[0] : convRaw.cargos;
      convite = {
        codigo: convRaw.codigo,
        trilha: convRaw.trilha as ConviteDoPendente["trilha"],
        perfil: convRaw.perfil as ConviteDoPendente["perfil"],
        cargo_id: convRaw.cargo_id,
        cargo_nome: cargoRaw?.nome ?? null,
        vinc_tipo: convRaw.vinc_tipo as ConviteDoPendente["vinc_tipo"],
        vinc_empresa_id: convRaw.vinc_empresa_id,
      };
    }
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo,
      documento: row.documento,
      cidade: row.cidade,
      uf: row.uf,
      email: row.email,
      telefone: row.telefone,
      celular: row.celular,
      created_at: row.created_at,
      dados_cadastro: row.dados_cadastro,
      convite,
      // Sem convite: cai no bloco externo, onde a Matriz define o tipo na
      // análise (a "Prime Riscos" do protótipo). Com convite, segue a trilha.
      bloco: convite?.trilha === "interno" ? "interno" : "externo",
    };
  });
}

function toTrio(x: unknown): Trio {
  if (Array.isArray(x)) {
    if (x.length >= 3) return [String(x[0] ?? ""), String(x[1] ?? ""), String(x[2] ?? "")];
    if (x.length === 2) return ["Ituran", String(x[0] ?? ""), String(x[1] ?? "")];
  }
  return ["", "", ""];
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
      supabase
        .from("empresas")
        .select(
          "id,nome,tipo,documento,cidade,uf,email,telefone,celular,created_at,dados_cadastro," +
            "convites!empresas_convite_id_fkey(codigo,trilha,perfil,cargo_id,vinc_tipo,vinc_empresa_id,cargos(nome))",
        )
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
    setPendentes(mapPendentes(p.data));
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

  // V11 · F5/F7: papel, cargo, áreas, produtos, canais e supervisão vão numa
  // transação só via `aprovar_acesso` — antes dela vinham em chamadas soltas
  // do front, e uma falha no meio deixava o acesso meio classificado.
  // `persist()` continua existindo à parte para o que é domínio de G3/G4
  // (modelo de franquia, comissão do Master/Supervisor, salário CLT), que a
  // RPC não toca — são dois eixos diferentes.
  async function liberar(params: AprovarAcessoParams, persist: () => Promise<void>, tag: string) {
    if (!analisando) return;
    setBusy(true);
    const { error } = await supabase.rpc("aprovar_acesso", {
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
    if (error) {
      setBusy(false);
      console.error("aprovar_acesso error", error);
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
