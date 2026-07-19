// Modal "Usuários do sistema" (G1.5 — MAPA seção 5): lista central read-only
// com usuário · tipo · supervisão · status, todos os perfis lado a lado com
// filtro por tipo/status. Edição/desativação seguem pelos modais por perfil
// (UsuariosModal).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIPO_CHIP_CLASS } from "./constants";
import { ModalShell } from "./modal-shell";
import type { SistemaRole, UsuarioSistema } from "./types";

export function UsuariosSistemaModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      const ur = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("role", ["matriz", "master", "vendedor", "franqueado", "supervisor"])
        // ordem explícita: torna determinístico o role escolhido no raro caso de
        // múltiplos vínculos para o mesmo usuário (hoje é 1:1 na prática).
        .order("user_id", { ascending: true })
        .order("role", { ascending: true });
      if (ur.error) {
        setErr(ur.error.message);
        setLoading(false);
        return;
      }
      const roleByUser: Record<string, SistemaRole> = {};
      (ur.data ?? []).forEach((x) => {
        // um usuário pode ter mais de um vínculo histórico; mantém o primeiro
        // (determinístico pela ordenação da query acima).
        roleByUser[x.user_id] ??= x.role as SistemaRole;
      });
      const ids = Object.keys(roleByUser);
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [pr, em, mf] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nome,email,empresa_id,superior_id,desligado_em")
          .in("id", ids),
        supabase.from("empresas").select("id,tipo,modelo_id"),
        supabase.from("modelos_franquia").select("id,nome,modalidade"),
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
      const modeloModalidadeById = Object.fromEntries(
        ((mf.data ?? []) as { id: string; nome: string; modalidade: string | null }[]).map((m) => [
          m.id,
          m.modalidade,
        ]),
      );

      function tipoLabel(p: ProfileLite, role: SistemaRole): string {
        if (role === "matriz") return "Matriz";
        if (role === "supervisor") return "Supervisor (Matriz)";
        if (role === "master") return "Master franqueado";
        if (role === "franqueado") {
          const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
          const modalidade = emp?.modelo_id ? modeloModalidadeById[emp.modelo_id] : null;
          return modalidade === "full" ? "Franquia (Full)" : "Franquia (Individual)";
        }
        // vendedor: empresa vinculada com tipo 'pj' (franquia real) → de franquia; senão CLT
        const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
        return emp?.tipo === "pj" ? "Vendedor de franquia" : "Vendedor CLT";
      }

      function supervisaoLabel(p: ProfileLite, role: SistemaRole): string {
        if (role === "matriz") return "—";
        if (!p.superior_id) return "Matriz";
        return profileById[p.superior_id]?.nome ?? "—";
      }

      setRows(
        ids.map((id) => {
          const p = profileById[id];
          const role = roleByUser[id];
          return {
            id,
            nome: p?.nome ?? "—",
            email: p?.email ?? "—",
            desligado_em: p?.desligado_em ?? null,
            role,
            tipoLabel: p ? tipoLabel(p, role) : "—",
            supervisaoLabel: p ? supervisaoLabel(p, role) : "—",
          };
        }),
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
    <ModalShell
      title="Usuários do sistema"
      onClose={onClose}
      wide
      footer={
        <span className="muted small" style={{ marginRight: "auto" }}>
          {filtradas.length} de {rows.length} usuário(s)
        </span>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
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
      {loading ? (
        <div className="muted small">Carregando…</div>
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
                  className="muted small"
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}
