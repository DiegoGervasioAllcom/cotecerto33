import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { useConfiguracoesGerais } from "@/components/operacao/configuracoes/hooks/useConfiguracoesGerais";
import { Toggle } from "@/components/operacao/configuracoes/toggle";
import { PerfilRow } from "@/components/operacao/configuracoes/perfil-row";
import { SeguradorasModal } from "@/components/operacao/configuracoes/seguradoras-modal";
import { UsuariosModal } from "@/components/operacao/configuracoes/usuarios-modal";
import { UsuariosSistemaModal } from "@/components/operacao/configuracoes/usuarios-sistema-modal";

export const Route = createFileRoute("/_authenticated/operacao/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const {
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
  } = useConfiguracoesGerais();

  return (
    <AppShell title="Configurações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <div className="sub">Regras, metas, perfis e integrações da operação Supper Certo</div>
        </div>
      </div>

      {err && (
        <div
          className="card"
          style={{ borderColor: "#fecaca", background: "#fef2f2", marginBottom: 12 }}
        >
          <div className="card-b" style={{ color: "#991b1b" }}>
            {err}
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-share" />
                </svg>{" "}
                Distribuição de leads
              </h3>
            </div>
            <div className="card-b">
              <p className="small muted" style={{ marginTop: 0 }}>
                Modo ativo: <strong>{modoLabel}</strong> · SLA de reação{" "}
                <strong>{Math.round((dist?.sla_segundos ?? 180) / 60)} min</strong>.
              </p>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => nav({ to: "/comando/distribuicao" })}
              >
                <svg width="13" height="13">
                  <use href="#i-settings" />
                </svg>{" "}
                Abrir regras de distribuição
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-target" />
                </svg>{" "}
                Metas
              </h3>
            </div>
            <div className="card-b">
              <div className="field-group">
                <label>Meta mensal padrão por vendedor (apólices)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={cfg.meta_vendedor}
                  onChange={(e) => setCfg({ ...cfg, meta_vendedor: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_vendedor: cfg.meta_vendedor }, "meta_vendedor")}
                  disabled={loading}
                />
              </div>
              <div className="field-group">
                <label>Meta mensal padrão por franquia (apólices)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={cfg.meta_franquia}
                  onChange={(e) => setCfg({ ...cfg, meta_franquia: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_franquia: cfg.meta_franquia }, "meta_franquia")}
                  disabled={loading}
                />
              </div>
              {savingKey?.startsWith("meta_") && <div className="small muted">Salvando…</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-lock" />
                </svg>{" "}
                Auditoria e segurança
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle
                  title="Trava de auditoria em comissões"
                  desc="Registrar autor, data e valor anterior em toda alteração"
                  on={cfg.auditoria_comissoes}
                  onChange={(v) => update({ auditoria_comissoes: v }, "auditoria_comissoes")}
                />
                <Toggle
                  title="Exigir motivo em estornos"
                  desc="Cancelamento só conclui com motivo preenchido"
                  on={cfg.exigir_motivo_estorno}
                  onChange={(v) => update({ exigir_motivo_estorno: v }, "exigir_motivo_estorno")}
                />
                <Toggle
                  title="Aprovação dupla para ajuste de comissão"
                  desc="Alterações acima de R$ 500 exigem 2º aprovador"
                  on={cfg.aprovacao_dupla_comissao}
                  onChange={(v) =>
                    update({ aprovacao_dupla_comissao: v }, "aprovacao_dupla_comissao")
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-users" />
                </svg>{" "}
                Perfis e usuários
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <PerfilRow
                  title="Matriz"
                  desc="Acesso total · distribui, audita e remunera"
                  count={roleCount("matriz")}
                  solid
                  onClick={() => setModal("matriz")}
                />
                <PerfilRow
                  title="Franqueado"
                  desc="Vê a própria unidade e equipe"
                  count={roleCount("franqueado")}
                  onClick={() => setModal("franqueado")}
                />
                <PerfilRow
                  title="Vendedor"
                  desc="Pipeline, cotação, proposta e extrato próprios"
                  count={roleCount("vendedor")}
                  onClick={() => setModal("vendedor")}
                />
                <PerfilRow
                  title="Todos os usuários"
                  desc="Lista central: usuário, tipo, supervisão e status"
                  count={rolesTotal}
                  onClick={() => setModal("todos")}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-shield" />
                </svg>{" "}
                Integrações
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                {integracoes.map((i) => (
                  <div key={i.id} className="crit-row">
                    <div className="cr-body">
                      <div className="cr-t">{i.nome}</div>
                      <div className="cr-d">{i.descricao}</div>
                    </div>
                    <span
                      className={`chip ${i.status === "conectado" ? "chip-ok" : "chip-outline"}`}
                    >
                      {i.status === "conectado"
                        ? "Conectado"
                        : i.status === "desconectado"
                          ? "Desconectado"
                          : "Pendente"}
                    </span>
                  </div>
                ))}
                <div
                  className="crit-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => setModal("seguradoras")}
                >
                  <div className="cr-body">
                    <div className="cr-t">Seguradoras ({segCount})</div>
                    <div className="cr-d">{segPreview || "Nenhuma cadastrada"}</div>
                  </div>
                  <span className="chip chip-ok">Gerenciar</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-bell" />
                </svg>{" "}
                Notificações
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle
                  title="SLA estourado"
                  desc="Avisar a Matriz quando um lead voltar para a fila"
                  on={cfg.notif_sla_estourado}
                  onChange={(v) => update({ notif_sla_estourado: v }, "notif_sla_estourado")}
                />
                <Toggle
                  title="Venda não paga"
                  desc="Alertar após 7 dias sem baixa financeira"
                  on={cfg.notif_venda_nao_paga}
                  onChange={(v) => update({ notif_venda_nao_paga: v }, "notif_venda_nao_paga")}
                />
                <Toggle
                  title="Renovação a vencer"
                  desc="Lembrete 60 dias antes do vencimento"
                  on={cfg.notif_renovacao_vencer}
                  onChange={(v) => update({ notif_renovacao_vencer: v }, "notif_renovacao_vencer")}
                />
                <Toggle
                  title="Resumo diário por e-mail"
                  desc="Enviar consolidado às 8h"
                  on={cfg.notif_resumo_diario}
                  onChange={(v) => update({ notif_resumo_diario: v }, "notif_resumo_diario")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal === "seguradoras" && (
        <SeguradorasModal
          onClose={() => {
            setModal(null);
            void load();
          }}
        />
      )}
      {modal === "matriz" && (
        <UsuariosModal role="matriz" title="Usuários · Matriz" onClose={() => setModal(null)} />
      )}
      {modal === "franqueado" && (
        <UsuariosModal
          role="franqueado"
          title="Usuários · Franqueados"
          onClose={() => setModal(null)}
        />
      )}
      {modal === "vendedor" && (
        <UsuariosModal
          role="vendedor"
          title="Usuários · Vendedores"
          onClose={() => setModal(null)}
        />
      )}
      {modal === "todos" && <UsuariosSistemaModal onClose={() => setModal(null)} />}
    </AppShell>
  );
}
