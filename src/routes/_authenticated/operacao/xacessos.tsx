import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
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
import { FullTeamTable, type FullTeamMember } from "@/components/operacao/acessos/full/full-team";
import { fullTeamMemberMatches } from "@/components/operacao/acessos/full/full-team-utils";
import { FullMemberModal } from "@/components/operacao/acessos/full/full-member-modal";
import { FullDirectModal } from "@/components/operacao/acessos/full/full-direct-modal";
import { useTeamData, type MembroEquipe } from "@/components/operacao/acessos/full/use-team-data";
import {
  FullDisabledPanel,
  GenericTeamTable,
} from "@/components/operacao/acessos/full/team-panels";
import { MasterMemberModal } from "@/components/operacao/acessos/full/master-member-modal";
import { useRequireGrupoAcessos } from "@/lib/require-role";

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

/**
 * V11.5b.4 — a Full ganha 2 seções novas ("Personalização geral",
 * "Performance") além do que já existia (equipe/pendentes/desligamentos,
 * agrupados sob "Meu time"). Toggle no mesmo padrão de `toggle-sub` de
 * `perso-geral.tsx`. Master/Supervisor continuam vendo só "Meu time", sem o
 * toggle aparecer — `isFranqFull` (via `useGroupScope`, modalidade
 * `modelos_franquia` — não `empresa.tipo`, que é só pj/pf documental) é o
 * único gate.
 */
type Secao = "time" | "pend" | "deslig" | "perso" | "performance";

export const Route = createFileRoute("/_authenticated/operacao/xacessos")({
  head: () => ({ meta: [{ title: "Acessos da equipe · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const denied = useRequireGrupoAcessos();
  const { group, groupPct, isFranqFull } = useGroupScope();
  const { role, profile, empresa } = useAuth();
  const [convidando, setConvidando] = useState<EscopoConvite | null>(null);
  const [secao, setSecao] = useState<Secao>("time");

  // V11: o Master convida a rede dele; a Franquia Full, o time dela.
  const escopoConvite: EscopoConvite | null =
    role === "master" ? "master" : role === "franqueado" ? "full" : null;
  const [busca, setBusca] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [selecionado, setSelecionado] = useState<{
    membro: FullTeamMember;
    modo: "ver" | "configurar" | "excluir";
  } | null>(null);
  const [reloadEquipe, setReloadEquipe] = useState(0);
  const { rows, loading, err } = useTeamData(profile, reloadEquipe);
  const [cadastroDireto, setCadastroDireto] = useState(false);
  const [avisoCadastro, setAvisoCadastro] = useState<string | null>(null);
  // Igual ao protótipo (cadDiretoNext → openFullApprove): depois de cadastrar
  // a identidade, a "próxima tela" (aqui, o modal Configurar) abre sozinha
  // pra equipe/leads/produtos/canais — sem o usuário ter de procurar a linha
  // na tabela. Guarda o id até a lista recarregada trazer esse membro.
  const [pendingConfigureId, setPendingConfigureId] = useState<string | null>(null);
  // V11 · C8 — "Solicitar desligamento" só faz sentido para vendedor/franquia
  // (o próprio solicitar_desligamento também barra o resto no banco); o
  // reloadTick força o card "Minhas solicitações" a buscar de novo após enviar.
  const [desligando, setDesligando] = useState<{ id: string; nome: string } | null>(null);
  const [desligamentoReloadTick, setDesligamentoReloadTick] = useState(0);
  const [masterVer, setMasterVer] = useState<MembroEquipe | null>(null);

  // V11 · F9 — a Franquia Full aprova o próprio vendedor (F1/F2: a RLS já
  // entrega só o pedido dela). Individual não tem equipe para aprovar — "o
  // franqueado opera como um vendedor", sem cadastro de vendedores.
  const isFull = role === "franqueado" && isFranqFull;
  // Master só acompanha — ele convida (Convite Supper) e a fila é da Matriz
  // classificar; por isso a lista abaixo não ganha "Analisar" (ver PendentesTab).
  const isMaster = role === "master";
  const fila = useFilaFranquiaData(isFull || isMaster);
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

  const membrosFull: FullTeamMember[] = rows
    .filter((row) => row.role === "vendedor")
    .map((row) => ({ ...row, desligadoEm: row.desligado_em }));
  const ativosFull = membrosFull.filter((membro) => !membro.desligadoEm);
  const desligadosFull = membrosFull.filter((membro) => !!membro.desligadoEm);
  const equipes = Array.from(new Set(ativosFull.map((m) => m.equipe || "—"))).sort();
  const anos = Array.from(new Set(ativosFull.map((m) => m.desde)))
    .sort()
    .reverse();
  const filtradasFull = ativosFull.filter((m) =>
    fullTeamMemberMatches(m, busca, filtroEquipe, filtroAno),
  );
  const filtradas = rows.filter((r) => !r.desligado_em);

  useEffect(() => {
    if (!pendingConfigureId) return;
    const membro = membrosFull.find((m) => m.id === pendingConfigureId);
    if (!membro) return;
    setPendingConfigureId(null);
    setSecao("time");
    setSelecionado({ membro, modo: "configurar" });
  }, [pendingConfigureId, membrosFull]);

  if (denied) return denied;

  return (
    <AppShell title="Acessos e permissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>{isFull ? "Acessos e permissões" : "Acessos da equipe"}</h1>
          <div className="sub">
            {isFull ? (
              "Sua equipe, sua gestão — convite, aprovação, desligamento e regras são da franquia"
            ) : role === "supervisor" ? (
              "Você não cadastra nem desliga — acompanha o desempenho e aciona a Matriz."
            ) : (
              <>
                Sua rede{group ? ` · ${groupPct}% sobre a equipe` : ""} —{" "}
                {escopoConvite === "full"
                  ? "convide o vendedor da sua franquia; a aprovação é sua."
                  : "convide a sua rede; a Matriz aprova e classifica."}
              </>
            )}
          </div>
        </div>
        {escopoConvite && !isFull && (
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
      {avisoCadastro && (
        <div className="banner warn" style={{ marginBottom: 14 }}>
          {avisoCadastro}
        </div>
      )}

      {isFranqFull && (
        <div
          className="acc-group"
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid var(--slate)",
            background: "#f4f6f8",
          }}
        >
          <div
            className="small muted"
            style={{
              fontWeight: 800,
              letterSpacing: ".08em",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon id="store" size={13} /> MINHA FRANQUIA
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto" }}
              type="button"
              onClick={() => setCadastroDireto(true)}
            >
              <Icon id="edit" size={13} /> Cadastro direto
            </button>
            <button
              className="btn btn-slate btn-sm"
              type="button"
              onClick={() => setConvidando("full")}
            >
              <Icon id="plus" size={13} /> Convidar · Convite Supper
            </button>
          </div>
          <div className="toggle">
            <button className={secao === "time" ? "on" : ""} onClick={() => setSecao("time")}>
              Meu time <span>({ativosFull.length})</span>
            </button>
            <button className={secao === "pend" ? "on" : ""} onClick={() => setSecao("pend")}>
              Pendentes de aprovação <span>({fila.pendentes.length})</span>
            </button>
            <button className={secao === "deslig" ? "on" : ""} onClick={() => setSecao("deslig")}>
              Desligamentos <span>({desligadosFull.length})</span>
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
        </div>
      )}

      {secao === "time" && (
        <>
          {isMaster && (
            <div style={{ marginBottom: 18 }}>
              <div
                className="small muted"
                style={{ fontWeight: 800, letterSpacing: ".04em", marginBottom: 8 }}
              >
                CADASTROS ENVIADOS, AGUARDANDO A MATRIZ ({fila.pendentes.length})
              </div>
              <PendentesTab pendentes={fila.pendentes} />
            </div>
          )}
          <div className="card">
            <div className="card-h">
              <h3>
                <Icon id="users" size={16} /> {isFull ? "Meu time" : "Equipe"}
              </h3>
              <span className="small muted">
                {isFull
                  ? `${filtradasFull.length} de ${ativosFull.length}`
                  : `${filtradas.length} de ${rows.length}`}{" "}
                usuário(s)
              </span>
            </div>
            <div className="card-b" style={{ display: "flex", gap: 10 }}>
              {isFull && (
                <input
                  className="input"
                  style={{ maxWidth: 260 }}
                  placeholder="Buscar vendedor…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              )}
              {isFull && (
                <select
                  className="input"
                  style={{ maxWidth: 180 }}
                  value={filtroEquipe}
                  onChange={(e) => setFiltroEquipe(e.target.value)}
                >
                  <option value="">Equipe · todas</option>
                  {equipes.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              )}
              {isFull && (
                <select
                  className="input"
                  style={{ maxWidth: 140 }}
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                >
                  <option value="">Ano · todos</option>
                  {anos.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
              {loading ? (
                <div className="muted small" style={{ padding: 16 }}>
                  Carregando…
                </div>
              ) : isFull ? (
                <FullTeamTable
                  membros={filtradasFull}
                  onVer={(membro) => setSelecionado({ membro, modo: "ver" })}
                  onConfigurar={(membro) => setSelecionado({ membro, modo: "configurar" })}
                  onExcluir={(membro) => setSelecionado({ membro, modo: "excluir" })}
                />
              ) : (
                <GenericTeamTable
                  membros={filtradas}
                  onVer={isMaster ? (membro) => setMasterVer(membro) : undefined}
                  onDesligar={(membro) => setDesligando({ id: membro.id, nome: membro.nome })}
                />
              )}
            </div>
          </div>

          {!isFull && (
            <div style={{ marginTop: 18 }}>
              <MinhasSolicitacoesDesligamento reloadKey={desligamentoReloadTick} />
            </div>
          )}
        </>
      )}

      {secao === "pend" && isFull && (
        <PendentesTab pendentes={fila.pendentes} onAnalisar={fila.openAnalisar} />
      )}

      {secao === "deslig" && isFull && <FullDisabledPanel membros={desligadosFull} />}

      {secao === "perso" && isFranqFull && empresa?.id && (
        <FullPersonalizacaoPanel empresaId={empresa.id} />
      )}

      {secao === "performance" && isFranqFull && empresa?.id && (
        <FullPerformancePanel empresaId={empresa.id} />
      )}

      {convidando && <ConvidarModal escopo={convidando} onClose={() => setConvidando(null)} />}
      {cadastroDireto && (
        <FullDirectModal
          onClose={() => setCadastroDireto(false)}
          onSaved={({ userId, aviso }) => {
            setCadastroDireto(false);
            setAvisoCadastro(aviso);
            setSecao("time");
            setPendingConfigureId(userId);
            setReloadEquipe((value) => value + 1);
          }}
        />
      )}
      {selecionado && (
        <FullMemberModal
          membro={selecionado.membro}
          modo={selecionado.modo}
          onClose={() => setSelecionado(null)}
          onSaved={() => {
            setSelecionado(null);
            setReloadEquipe((value) => value + 1);
          }}
        />
      )}
      {masterVer && <MasterMemberModal membro={masterVer} onClose={() => setMasterVer(null)} />}
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
          onLiberar={async (params, persist, tag) => {
            await fila.liberar(params, persist, tag);
            // A Full aprova o próprio vendedor por aqui — "Meu time" usa
            // useTeamData, uma query separada da fila; sem isto, o vendedor
            // recém-aprovado só aparecia depois de recarregar a página.
            setReloadEquipe((value) => value + 1);
          }}
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
