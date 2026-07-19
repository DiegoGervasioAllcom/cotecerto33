// Modal "Usuários · <perfil>" — lista, edita, (des)ativa e cria usuários de
// um perfil específico (Matriz/Franqueado/Vendedor).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminCreateUser, adminDeleteUser } from "@/lib/admin-users.functions";
import { ModalShell } from "./modal-shell";
import { EditUserModal } from "./edit-user-modal";
import { CreateUserModal } from "./create-user-modal";
import type { Empresa, UserFull } from "./types";

export function UsuariosModal({
  role,
  title,
  onClose,
}: {
  role: "matriz" | "franqueado" | "vendedor";
  title: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<UserFull[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<UserFull | null>(null);
  const [creating, setCreating] = useState(false);

  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);

  const targetRoles: ("matriz" | "master" | "vendedor" | "franqueado")[] =
    role === "franqueado" ? ["franqueado", "master"] : [role];

  async function load() {
    setLoading(true);
    setErr(null);
    const ur = await supabase.from("user_roles").select("user_id,role").in("role", targetRoles);
    if (ur.error) {
      setErr(ur.error.message);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((ur.data ?? []).map((x: { user_id: string }) => x.user_id)));
    const rolesByUser: Record<string, string[]> = {};
    (ur.data ?? []).forEach((x: { user_id: string; role: string }) => {
      (rolesByUser[x.user_id] ||= []).push(x.role);
    });

    const [em, pr] = await Promise.all([
      supabase.from("empresas").select("id,nome,tipo").order("nome"),
      ids.length
        ? supabase
            .from("profiles")
            .select("id,nome,email,status,empresa_id,desligado_em")
            .in("id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setEmpresas((em.data ?? []) as Empresa[]);
    const empMap = Object.fromEntries(((em.data ?? []) as Empresa[]).map((e) => [e.id, e.nome]));
    setRows(
      (pr.data ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        status: p.status,
        empresa_id: p.empresa_id,
        empresa_nome: p.empresa_id ? (empMap[p.empresa_id] ?? null) : null,
        desligado_em: p.desligado_em,
        roles: rolesByUser[p.id] ?? [],
      })),
    );
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [role]);

  async function toggleAtivo(u: UserFull) {
    const ativo = !!u.desligado_em; // se já está desligado → reativar
    const motivo = !ativo ? (prompt("Motivo da desativação (opcional):") ?? null) : null;
    const { error } = await supabase.rpc("admin_set_usuario_status", {
      p_user_id: u.id,
      p_ativo: ativo,
      p_motivo: motivo ?? undefined,
    });
    if (error) setErr(error.message);
    void load();
  }

  async function remover(u: UserFull) {
    if (!confirm(`Excluir definitivamente ${u.nome || u.email}? Esta ação é irreversível.`)) return;
    const { data: sess } = await supabase.auth.getSession();
    try {
      await deleteFn({ data: { user_id: u.id, caller_token: sess.session?.access_token ?? "" } });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const empresasFiltradas =
    role === "franqueado" ? empresas.filter((e) => e.tipo !== "matriz") : empresas;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted small" style={{ marginRight: "auto" }}>
            {rows.length} usuário(s)
          </span>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Novo usuário
          </button>
        </>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : (
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              {role !== "matriz" && <th>{role === "franqueado" ? "Franquia" : "Unidade"}</th>}
              <th>Status</th>
              <th style={{ width: 200, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const desligado = !!u.desligado_em;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nome || "—"}</strong>
                  </td>
                  <td className="muted">{u.email}</td>
                  {role !== "matriz" && <td>{u.empresa_nome ?? "—"}</td>}
                  <td>
                    <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                      {desligado ? "Desativado" : "Ativo"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleAtivo(u)}
                      style={{ marginLeft: 6 }}
                    >
                      {desligado ? "Reativar" : "Desativar"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remover(u)}
                      style={{ marginLeft: 6, color: "#b91c1c" }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={role === "matriz" ? 4 : 5}
                  className="muted small"
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Nenhum usuário com este perfil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {edit && (
        <EditUserModal
          user={edit}
          empresas={empresasFiltradas}
          role={role}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void load();
          }}
        />
      )}
      {creating && (
        <CreateUserModal
          role={role}
          empresas={empresasFiltradas}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
          createFn={async (payload) => {
            const { data: sess } = await supabase.auth.getSession();
            return createFn({
              data: { ...payload, caller_token: sess.session?.access_token ?? "" },
            });
          }}
        />
      )}
    </ModalShell>
  );
}
