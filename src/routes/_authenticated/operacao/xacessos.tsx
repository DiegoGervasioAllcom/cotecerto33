import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useGroupScope } from "@/lib/group-scope";
import { Icon } from "@/routes/_authenticated/operacao/acessos";
import { CadastrarVendedorForm } from "@/components/acessos/cadastrar-vendedor-form";

/**
 * Acessos da equipe (xacessos) — visão de grupo (master/supervisor/franquia Full).
 *
 * Diferente de `/operacao/acessos` (classificação de cadastros — exclusivo da
 * Matriz), aqui o gestor de grupo só acompanha a própria equipe. O escopo é
 * garantido pelo RLS (`empresas_visiveis` multinível): a query de profiles já
 * volta só a rede do usuário logado — não é preciso filtrar de novo aqui.
 *
 * "Cadastrar vendedor" registra um pedido em `vendedor_solicitacoes`
 * (RPC `solicitar_vendedor`) para a Matriz aprovar — ver G1.6c.
 */

type SistemaRole = "master" | "vendedor" | "franqueado" | "supervisor";

const TIPO_CHIP_CLASS: Record<string, string> = {
  "Supervisor (Matriz)": "chip-slate",
  "Master franqueado": "chip-yellow",
  "Franquia (Full)": "chip-info",
  "Franquia (Individual)": "chip-info",
  "Vendedor CLT": "chip-outline",
  "Vendedor de franquia": "chip-outline",
};

type Membro = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string | null;
  role: SistemaRole;
  tipoLabel: string;
  supervisaoLabel: string;
};

export const Route = createFileRoute("/_authenticated/operacao/xacessos")({
  head: () => ({ meta: [{ title: "Acessos da equipe · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const { group, groupPct } = useGroupScope();
  const [rows, setRows] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

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
      (ur.data ?? []).forEach((x) => {
        roleByUser[x.user_id] ??= x.role as SistemaRole;
      });
      const ids = Object.keys(roleByUser);
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [pr, em] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nome,email,empresa_id,superior_id,desligado_em")
          .in("id", ids),
        supabase.from("empresas").select("id,tipo,modelo_id"),
      ]);
      if (pr.error) {
        setErr(pr.error.message);
        setLoading(false);
        return;
      }
      type ProfileLite = {
        id: string;
        nome: string;
        email: string;
        empresa_id: string | null;
        superior_id: string | null;
        desligado_em: string | null;
      };
      const profiles = (pr.data ?? []) as ProfileLite[];
      const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
      const empresaById = Object.fromEntries(
        ((em.data ?? []) as { id: string; tipo: string; modelo_id: string | null }[]).map((e) => [
          e.id,
          e,
        ]),
      );

      function tipoLabel(p: ProfileLite, role: SistemaRole): string {
        if (role === "supervisor") return "Supervisor (Matriz)";
        if (role === "master") return "Master franqueado";
        if (role === "franqueado") {
          const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
          return emp?.tipo === "pj" ? "Franquia (Full)" : "Franquia (Individual)";
        }
        const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
        return emp?.tipo === "pj" ? "Vendedor de franquia" : "Vendedor CLT";
      }

      function supervisaoLabel(p: ProfileLite): string {
        if (!p.superior_id) return "—";
        return profileById[p.superior_id]?.nome ?? "—";
      }

      setRows(
        ids
          // não lista o próprio gestor logado na tabela de equipe
          .map((id) => {
            const p = profileById[id];
            const role = roleByUser[id];
            return {
              id,
              nome: p?.nome ?? "—",
              email: p?.email ?? "—",
              desligado_em: p?.desligado_em ?? null,
              role,
              tipoLabel: p ? tipoLabel(p, role) : "—",
              supervisaoLabel: p ? supervisaoLabel(p) : "—",
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      setLoading(false);
    })();
  }, []);

  const tipos = Array.from(new Set(rows.map((r) => r.tipoLabel))).sort();
  const filtradas = rows.filter((r) => {
    if (filtroTipo && r.tipoLabel !== filtroTipo) return false;
    if (filtroStatus === "ativo" && r.desligado_em) return false;
    if (filtroStatus === "desativado" && !r.desligado_em) return false;
    return true;
  });

  return (
    <AppShell title="Acessos da equipe">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Acessos da equipe</h1>
          <div className="sub">
            Sua rede{group ? ` · ${groupPct}% sobre a equipe` : ""} — cadastro de novos vendedores é
            feito pela Matriz em Acessos e permissões.
          </div>
        </div>
      </div>

      {err && (
        <div className="banner alert" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <CadastrarVendedorForm />
      </div>

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="users" size={16} /> Equipe
          </h3>
          <span className="small muted">
            {filtradas.length} de {rows.length} usuário(s)
          </span>
        </div>
        <div className="card-b" style={{ display: "flex", gap: 10 }}>
          <select
            className="input"
            style={{ maxWidth: 220 }}
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ maxWidth: 180 }}
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="desativado">Desativado</option>
          </select>
        </div>
        <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
          {loading ? (
            <div className="muted small" style={{ padding: 16 }}>
              Carregando…
            </div>
          ) : (
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Tipo</th>
                  <th>Supervisão</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => {
                  const desligado = !!u.desligado_em;
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.nome}</strong>
                        <div className="muted small">{u.email}</div>
                      </td>
                      <td>
                        <span className={`chip ${TIPO_CHIP_CLASS[u.tipoLabel] ?? "chip-outline"}`}>
                          {u.tipoLabel}
                        </span>
                      </td>
                      <td>
                        <small className="muted">{u.supervisaoLabel}</small>
                      </td>
                      <td>
                        <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                          {desligado ? "Desativado" : "Ativo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtradas.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}
                    >
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
