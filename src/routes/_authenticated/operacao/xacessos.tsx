import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useGroupScope } from "@/lib/group-scope";
import { useAuth } from "@/lib/auth";
import { ConvidarModal, type EscopoConvite } from "@/components/acessos/convidar-modal";
import { ClassificarAcessoModal } from "@/components/acessos/classificar-acesso-modal";
import { Icon } from "@/components/operacao/acessos/icon";
import { SolicitarDesligamentoModal } from "@/components/acessos/solicitar-desligamento-modal";
import { MinhasSolicitacoesDesligamento } from "@/components/acessos/minhas-solicitacoes-desligamento";
import { PendentesTab } from "@/components/operacao/acessos/pendentes-tab";
import { useFilaFranquiaData } from "@/components/operacao/acessos/hooks/useFilaFranquiaData";
import type { FranquiaAprovada } from "@/components/operacao/acessos/types";
import { FullPersonalizacaoPanel } from "@/components/operacao/acessos/full-personalizacao-panel";
import { FullPerformancePanel } from "@/components/operacao/acessos/full-performance-panel";

/**
 * Acessos da equipe (xacessos) — visão de grupo (master/supervisor/franquia Full).
 *
 * Diferente de `/operacao/acessos` (classificação de cadastros — exclusivo da
 * Matriz), aqui o gestor de grupo só acompanha a própria equipe. O escopo é
 * garantido pelo RLS (`empresas_visiveis` multinível): a query de profiles já
 * volta só a rede do usuário logado — não é preciso filtrar de novo aqui.
 *
 * V11 · C11 — cadastrar vendedor passa a ser só via "Convidar" (Convite
 * Supper, escopo master já tem as opções "Vendedor · da minha operação" e
 * "Vendedor · de uma Franquia Full"). O caminho antigo (`vendedor_solicitacoes`/
 * G1.6c: pedido→Matriz aprova→Matriz cria manualmente em Usuários) foi retirado
 * — o convite já cria o usuário direto na aprovação, sem o passo manual que
 * faltava ali.
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

/**
 * V11.5b.4 — a Full ganha 2 seções novas ("Personalização geral",
 * "Performance") além do que já existia (equipe/pendentes/desligamentos,
 * agrupados sob "Meu time"). Toggle no mesmo padrão de `toggle-sub` de
 * `perso-geral.tsx`. Master/Supervisor continuam vendo só "Meu time", sem o
 * toggle aparecer — `isFranqFull` (via `useGroupScope`, modalidade
 * `modelos_franquia` — não `empresa.tipo`, que é só pj/pf documental) é o
 * único gate.
 */
type Secao = "equipe" | "perso" | "performance";

export const Route = createFileRoute("/_authenticated/operacao/xacessos")({
  head: () => ({ meta: [{ title: "Acessos da equipe · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const { group, groupPct, isFranqFull } = useGroupScope();
  const { role, profile, empresa } = useAuth();
  const [convidando, setConvidando] = useState<EscopoConvite | null>(null);
  const [secao, setSecao] = useState<Secao>("equipe");

  // V11: o Master convida a rede dele; a Franquia Full, o time dela.
  const escopoConvite: EscopoConvite | null =
    role === "master" ? "master" : role === "franqueado" ? "full" : null;
  const [rows, setRows] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  // V11 · C8 — "Solicitar desligamento" só faz sentido para vendedor/franquia
  // (o próprio solicitar_desligamento também barra o resto no banco); o
  // reloadTick força o card "Minhas solicitações" a buscar de novo após enviar.
  const [desligando, setDesligando] = useState<{ id: string; nome: string } | null>(null);
  const [desligamentoReloadTick, setDesligamentoReloadTick] = useState(0);

  // V11 · F9 — a Franquia Full aprova o próprio vendedor (F1/F2: a RLS já
  // entrega só o pedido dela). Individual não tem equipe para aprovar — "o
  // franqueado opera como um vendedor", sem cadastro de vendedores.
  const isFull = role === "franqueado" && empresa?.tipo === "pj";
  const fila = useFilaFranquiaData(isFull);
  const minhaFranquia: FranquiaAprovada[] =
    isFull && empresa && profile
      ? [
          {
            id: empresa.id,
            nome: empresa.nome,
            modeloNome: "",
            modalidade: "full",
            donoProfileId: profile.id,
          },
        ]
      : [];

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
            Sua rede{group ? ` · ${groupPct}% sobre a equipe` : ""} —{" "}
            {escopoConvite === "full"
              ? "convide o vendedor da sua franquia; a aprovação é sua."
              : "convide a sua rede; a Matriz aprova e classifica."}
          </div>
        </div>
        {escopoConvite && (
          <div style={{ marginLeft: "auto" }}>
            <button
              className="btn btn-yellow"
              type="button"
              onClick={() => setConvidando(escopoConvite)}
            >
              {escopoConvite === "full" ? "Convidar vendedor" : "Convidar"}
            </button>
          </div>
        )}
      </div>

      {err && (
        <div className="banner alert" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}
      {fila.emailRetryPending && !fila.analisando && (
        <div className="banner warn" style={{ marginBottom: 14 }}>
          Há um e-mail de acesso aguardando envio.
          <button className="btn btn-yellow" disabled={fila.busy} onClick={fila.retryEmail}>
            {fila.busy ? "Reenviando…" : "Tentar enviar novamente"}
          </button>
        </div>
      )}

      {isFranqFull && (
        <div className="toggle toggle-sub" style={{ marginBottom: 18 }}>
          <button className={secao === "equipe" ? "on" : ""} onClick={() => setSecao("equipe")}>
            Meu time
          </button>
          <button className={secao === "perso" ? "on" : ""} onClick={() => setSecao("perso")}>
            Personalização geral
          </button>
          <button
            className={secao === "performance" ? "on" : ""}
            onClick={() => setSecao("performance")}
          >
            Performance
          </button>
        </div>
      )}

      {secao === "equipe" && (
        <>
          {isFull && (
            <div style={{ marginBottom: 18 }}>
              <div
                className="small muted"
                style={{ fontWeight: 800, letterSpacing: ".08em", marginBottom: 8 }}
              >
                PENDENTES DE APROVAÇÃO ({fila.pendentes.length})
              </div>
              {fila.err && (
                <div className="banner alert" style={{ marginBottom: 14 }}>
                  {fila.err}
                </div>
              )}
              <PendentesTab pendentes={fila.pendentes} onAnalisar={fila.openAnalisar} />
            </div>
          )}

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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((u) => {
                      const desligado = !!u.desligado_em;
                      // V11 · C8 — só vendedor/franquia são alvo válido de
                      // solicitar_desligamento (a RPC barra o resto de novo).
                      const podeDesligar =
                        !desligado && (u.role === "vendedor" || u.role === "franqueado");
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.nome}</strong>
                            <div className="muted small">{u.email}</div>
                          </td>
                          <td>
                            <span
                              className={`chip ${TIPO_CHIP_CLASS[u.tipoLabel] ?? "chip-outline"}`}
                            >
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
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {podeDesligar && (
                              <button
                                className="btn btn-ghost btn-sm"
                                type="button"
                                onClick={() => setDesligando({ id: u.id, nome: u.nome })}
                              >
                                <Icon id="trash" size={12} /> Solicitar desligamento
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtradas.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
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

          <div style={{ marginTop: 18 }}>
            <MinhasSolicitacoesDesligamento reloadKey={desligamentoReloadTick} />
          </div>
        </>
      )}

      {secao === "perso" && isFranqFull && empresa?.id && (
        <FullPersonalizacaoPanel empresaId={empresa.id} />
      )}

      {secao === "performance" && isFranqFull && empresa?.id && (
        <FullPerformancePanel empresaId={empresa.id} />
      )}

      {convidando && <ConvidarModal escopo={convidando} onClose={() => setConvidando(null)} />}
      {desligando && (
        <SolicitarDesligamentoModal
          alvoId={desligando.id}
          alvoNome={desligando.nome}
          onClose={() => setDesligando(null)}
          onEnviado={() => {
            setDesligando(null);
            setDesligamentoReloadTick((t) => t + 1);
          }}
        />
      )}
      {fila.analisando && (
        <ClassificarAcessoModal
          pendente={fila.analisando}
          modelosFranquia={[]}
          superiores={[]}
          franquiasAprovadas={minhaFranquia}
          onClose={fila.closeModal}
          onPendencia={fila.solicitarPendencia}
          onRecusar={fila.recusar}
          onRetryEmail={fila.retryEmail}
          emailRetryPending={fila.emailRetryPending}
          onLiberar={fila.liberar}
          busy={fila.busy}
        />
      )}
      {fila.toast && (
        <div
          className={`toast ${fila.toast.kind === "ok" ? "toast-ok" : "toast-alert"}`}
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            background: fila.toast.kind === "ok" ? "var(--ok)" : "var(--alert)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            zIndex: 80,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {fila.toast.msg}
        </div>
      )}
    </AppShell>
  );
}
