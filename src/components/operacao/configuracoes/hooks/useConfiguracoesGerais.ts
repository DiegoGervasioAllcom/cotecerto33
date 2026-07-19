// Estado e ações da página "Configurações": carrega configurações gerais,
// distribuição, integrações, seguradoras (preview) e contagem de perfis;
// expõe `update` para persistir toggles/metas e os derivados
// `roleCount`/`modoLabel` usados na apresentação.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CFG } from "../constants";
import type { Cfg, Integracao, ModalKind, RoleCount } from "../types";

export function useConfiguracoesGerais() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [dist, setDist] = useState<{
    modo: string;
    automatico_on: boolean;
    sla_segundos: number;
  } | null>(null);
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [segCount, setSegCount] = useState(0);
  const [segPreview, setSegPreview] = useState<string>("");
  const [roles, setRoles] = useState<RoleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const [c, d, ig, sg, rl] = await Promise.all([
      supabase.from("configuracoes_gerais").select("*").eq("id", "default").maybeSingle(),
      supabase
        .from("distribuicao_config")
        .select("modo,automatico_on,sla_segundos")
        .eq("id", "default")
        .maybeSingle(),
      supabase.from("integracoes").select("id,nome,descricao,status").order("ordem"),
      supabase
        .from("seguradoras")
        .select("nome", { count: "exact" })
        .eq("ativo", true)
        .order("nome")
        .limit(5),
      supabase.from("user_roles").select("role"),
    ]);
    if (c.data) {
      setCfg({
        meta_vendedor: c.data.meta_vendedor ?? 14,
        meta_franquia: c.data.meta_franquia ?? 48,
        auditoria_comissoes: !!c.data.auditoria_comissoes,
        exigir_motivo_estorno: !!c.data.exigir_motivo_estorno,
        aprovacao_dupla_comissao: !!c.data.aprovacao_dupla_comissao,
        notif_sla_estourado: !!c.data.notif_sla_estourado,
        notif_venda_nao_paga: !!c.data.notif_venda_nao_paga,
        notif_renovacao_vencer: !!c.data.notif_renovacao_vencer,
        notif_resumo_diario: !!c.data.notif_resumo_diario,
      });
    }
    if (d.data)
      setDist({
        modo: d.data.modo,
        automatico_on: !!d.data.automatico_on,
        sla_segundos: d.data.sla_segundos,
      });
    setIntegracoes((ig.data ?? []) as Integracao[]);
    setSegCount(sg.count ?? 0);
    setSegPreview(((sg.data ?? []) as { nome: string }[]).map((s) => s.nome).join(", "));
    const counts: Record<string, number> = {};
    ((rl.data ?? []) as { role: string }[]).forEach((r) => {
      counts[r.role] = (counts[r.role] ?? 0) + 1;
    });
    setRoles(Object.entries(counts).map(([role, count]) => ({ role, count })));
    setLoading(false);
    if (c.error) setErr(c.error.message);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(patch: Partial<Cfg>, key: string) {
    setSavingKey(key);
    const next = { ...cfg, ...patch };
    setCfg(next);
    const { error } = await supabase.from("configuracoes_gerais").update(patch).eq("id", "default");
    if (error) {
      setErr(error.message);
    }
    setSavingKey(null);
  }

  const roleCount = (r: string) => {
    if (r === "franqueado")
      return (
        (roles.find((x) => x.role === "franqueado")?.count ?? 0) +
        (roles.find((x) => x.role === "master")?.count ?? 0)
      );
    return roles.find((x) => x.role === r)?.count ?? 0;
  };
  const modoLabel =
    dist?.modo === "regiao"
      ? "Automático por região"
      : dist?.modo === "performance"
        ? "Performance (vendedores disponíveis)"
        : dist?.modo === "fila"
          ? "Fila (round-robin)"
          : "—";
  const rolesTotal = roles.reduce((acc, r) => acc + r.count, 0);

  return {
    cfg,
    setCfg,
    dist,
    integracoes,
    segCount,
    segPreview,
    loading,
    savingKey,
    err,
    modal,
    setModal,
    load,
    update,
    roleCount,
    modoLabel,
    rolesTotal,
  };
}
