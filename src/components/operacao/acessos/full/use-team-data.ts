import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SistemaRole = "master" | "vendedor" | "franqueado" | "supervisor";

export type MembroEquipe = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string | null;
  role: SistemaRole;
  tipoLabel: string;
  supervisaoLabel: string;
  cpf: string | null;
  equipe: string | null;
  produtos: number;
  comissao: number | null;
  leadsDia: number | null;
  desde: string;
  performanceStatus: string | null;
  personalizado: boolean;
};

type ProfileLite = {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  empresa_id: string | null;
  superior_id: string | null;
  desligado_em: string | null;
  equipe: string | null;
  created_at: string;
  comissao_modelo: number | null;
  leads_dia: number | null;
  performance_status: string | null;
};

export function useTeamData(profile: { id: string; nome: string } | null, reloadKey: number) {
  const [rows, setRows] = useState<MembroEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      const ur = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("role", ["master", "vendedor", "franqueado", "supervisor"])
        .order("user_id", { ascending: true })
        .order("role", { ascending: true });
      if (ur.error) {
        setErr(ur.error.message);
        setLoading(false);
        return;
      }
      const roleByUser: Record<string, SistemaRole> = {};
      (ur.data ?? []).forEach((item) => {
        roleByUser[item.user_id] ??= item.role as SistemaRole;
      });
      const ids = Object.keys(roleByUser).filter((id) => id !== profile?.id);
      if (!ids.length) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [pr, em, produtos, configs] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,nome,email,cpf,empresa_id,superior_id,desligado_em,equipe,created_at,comissao_modelo,leads_dia,performance_status",
          )
          .in("id", ids),
        supabase.from("empresas").select("id,modelo_id"),
        supabase.from("profile_produtos").select("profile_id"),
        supabase.from("full_vendedor_config").select("profile_id,comissao_venda_pct,personalizado"),
      ]);
      if (pr.error) {
        setErr(pr.error.message);
        setLoading(false);
        return;
      }
      const profiles = (pr.data ?? []) as ProfileLite[];
      const profileById = Object.fromEntries(profiles.map((item) => [item.id, item]));
      const produtosPorProfile = (produtos.data ?? []).reduce<Record<string, number>>(
        (acc, item) => {
          acc[item.profile_id] = (acc[item.profile_id] ?? 0) + 1;
          return acc;
        },
        {},
      );
      const configPorProfile = Object.fromEntries(
        (configs.data ?? []).map((item) => [item.profile_id, item]),
      );
      const empresaById = Object.fromEntries((em.data ?? []).map((item) => [item.id, item]));
      const tipoLabel = (item: ProfileLite, role: SistemaRole) => {
        if (role === "supervisor") return "Supervisor (Matriz)";
        if (role === "master") return "Master franqueado";
        if (role === "franqueado") return "Franquia";
        return item.empresa_id && empresaById[item.empresa_id]?.modelo_id
          ? "Vendedor de franquia"
          : "Vendedor CLT";
      };
      setRows(
        ids
          .map((id) => {
            const item = profileById[id];
            const role = roleByUser[id];
            return {
              id,
              nome: item?.nome ?? "—",
              email: item?.email ?? "—",
              desligado_em: item?.desligado_em ?? null,
              role,
              tipoLabel: item ? tipoLabel(item, role) : "—",
              supervisaoLabel: !item?.superior_id
                ? "—"
                : item.superior_id === profile?.id
                  ? profile.nome
                  : (profileById[item.superior_id]?.nome ?? "—"),
              cpf: item?.cpf ?? null,
              equipe: item?.equipe ?? null,
              produtos: produtosPorProfile[id] ?? 0,
              comissao: configPorProfile[id]?.comissao_venda_pct ?? item?.comissao_modelo ?? null,
              leadsDia: item?.leads_dia ?? null,
              desde: item?.created_at ? String(new Date(item.created_at).getFullYear()) : "—",
              performanceStatus: item?.performance_status ?? null,
              personalizado: configPorProfile[id]?.personalizado ?? false,
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      setLoading(false);
    })();
  }, [profile?.id, profile?.nome, reloadKey]);

  return { rows, loading, err };
}
