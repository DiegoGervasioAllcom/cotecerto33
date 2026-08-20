import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { ConvidarModal, type EscopoConvite } from "@/components/acessos/convidar-modal";
import {
  CadastroManualModal,
  type EscopoCadastroManual,
} from "@/components/acessos/cadastro-manual-modal";
import { ClassificarAcessoModal } from "@/components/acessos/classificar-acesso-modal";
import { DesligamentoSolicitacoesTab } from "@/components/acessos/desligamento-solicitacoes-tab";
import { useAcessosData } from "@/components/operacao/acessos/hooks/useAcessosData";
import {
  PENDENTES_SELECT,
  mapPendentes,
} from "@/components/operacao/acessos/hooks/pendentes-query";
import { useAcessosTutorialPreview } from "@/components/operacao/acessos/hooks/useAcessosTutorialPreview";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { AcessosNavigation } from "@/components/operacao/acessos/AcessosNavigation";
import { PendentesTab } from "@/components/operacao/acessos/pendentes-tab";
import { DesligamentosTab } from "@/components/operacao/acessos/desligamentos-tab";
import { PersoGeral } from "@/components/operacao/acessos/perso-geral";
import { CadastrosMatrizTab } from "@/components/operacao/acessos/cadastros-matriz-tab";
import { CadastrosRedeTab } from "@/components/operacao/acessos/cadastros-rede-tab";
import { CadMatrizModal } from "@/components/acessos/cad-matriz-modal";
import { useAuth } from "@/lib/auth";
import { deveCarregarDadosAcessos, podeAdministrarAcessos } from "@/lib/route-access";
import { useRequirePerfilInterno } from "@/lib/require-role";
import type { Tab } from "@/components/operacao/acessos/types";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: Page,
});

function Page() {
  // AreaChave decide quais pessoas do time interno entram. As ações continuam
  // limitadas à família administrativa que já existia antes deste recorte.
  const denied = useRequirePerfilInterno();
  const { role, profile } = useAuth();
  const canAdmin = podeAdministrarAcessos(role, profile?.cargo_id);
  const carregarDadosAdmin = deveCarregarDadosAcessos(role, profile?.cargo_id, !!denied);
  const {
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
    solicitarPendencia,
    recusar,
    liberar,
  } = useAcessosData(carregarDadosAdmin);
  const { visibleTab, setVisibleTab, visiblePersoSub, setVisiblePersoSub } =
    useAcessosTutorialPreview({
      tab,
      setTab,
      persoSub,
      setPersoSub,
    });

  const [convidando, setConvidando] = useState<EscopoConvite | null>(null);
  const [cadastroManual, setCadastroManual] = useState<EscopoCadastroManual | null>(null);

  // V11 · C3 — "Cadastro manual · exceção" vai direto para a classificação. Busca
  // o pendente que acabou de nascer direto (o estado `pendentes` do closure ainda
  // não reflete o `reload()` no mesmo tick) e recarrega a lista em paralelo.
  async function aoCriarManual(empresaId: string) {
    setCadastroManual(null);
    void reload();
    const { data } = await supabase
      .from("empresas")
      .select(PENDENTES_SELECT)
      .eq("id", empresaId)
      .single();
    const [criado] = mapPendentes(data ? [data] : []);
    if (criado) openAnalisar(criado);
  }

  // V11 · F6 — dois blocos, espelhando o protótipo: MATRIZ · TIME INTERNO (POR
  // ESCOPO) e EXTERNOS · REDE. `bloco` só decide o realce visual (qual acc-group
  // está "ativo"); o conteúdo de cada aba já é filtrado por `p.bloco` (F1: vem
  // de `convites.trilha`, e a RLS de F2 garante que o pendente do vendedor de
  // uma Franquia Full nunca chega a esta lista).
  const [blocoAtivo, setBlocoAtivo] = useState<"interno" | "externo">("interno");
  // V11 · C4/F6 — sub-aba do bloco Interno: Cadastros Matriz, Pendentes de
  // aprovação, Desligamentos e Personalização geral, espelhando as 4 abas do
  // bloco Externo (protótipo mostra as mesmas 4 nos dois blocos). Independente
  // de qual profile está sendo editado no momento (configurando), que é outro
  // estado — o modal de edição.
  const [tabInterno, setTabInterno] = useState<Tab>("pend");
  const [configurando, setConfigurando] = useState<{ id: string; isVendedorClt: boolean } | null>(
    null,
  );
  const [cadastrosMatrizTick, setCadastrosMatrizTick] = useState(0);
  // Total de cadastros ativos por bloco — o "(N)" da aba, igual ao protótipo
  // (`tb('matriz','Cadastros Matriz', MATRIZ_USERS.length+CLT_VENDEDORES.length)`).
  // null enquanto a aba nunca foi montada/carregada ainda.
  const [totalCadastrosMatriz, setTotalCadastrosMatriz] = useState<number | null>(null);
  const [totalCadastrosRede, setTotalCadastrosRede] = useState<number | null>(null);
  // O tour do módulo M5 (Acessos) força `visibleTab` via `prepare:
  // "acessos-pendentes"` etc., sem saber que agora existem dois blocos — todos
  // os `prepare` de acessos apontam para conteúdo do bloco EXTERNOS (pendentes,
  // desligamentos, personalização; o bloco interno é novo na V11 e ainda não
  // tem passo de tour). Sem este ajuste, o tour ficaria "preparando" uma aba que
  // o bloco errado esconde.
  const tutorialPreview = useTutorialPreview();
  const blocoParaConteudo = tutorialPreview?.startsWith("acessos-") ? "externo" : blocoAtivo;
  const pendentesInterno = pendentes.filter((p) => p.bloco === "interno");
  const pendentesExterno = pendentes.filter((p) => p.bloco === "externo");
  const desligInterno = deslig.filter((d) => d.bloco === "interno");
  const desligExterno = deslig.filter((d) => d.bloco === "externo");

  function abrirInterno() {
    setBlocoAtivo("interno");
  }
  function abrirExterno(t: typeof visibleTab) {
    setBlocoAtivo("externo");
    setVisibleTab(t);
    if (t === "modelos") setVisiblePersoSub("franquia");
  }

  if (denied) return denied;

  if (!canAdmin) {
    return (
      <AppShell title="Acessos e permissões">
        <ProtoIcons />
        <div className="page-head">
          <div>
            <h1>Acessos e permissões</h1>
            <div className="sub">Consulta do escopo de acessos da operação</div>
          </div>
        </div>
        <div className="audit-note" style={{ marginBottom: 18 }}>
          <svg width="16" height="16">
            <use href="#i-eye" />
          </svg>{" "}
          <strong style={{ marginRight: 4 }}>Somente leitura.</strong> Convites, cadastros,
          aprovações, desligamentos e personalizações permanecem com os perfis administrativos.
        </div>
      </AppShell>
    );
  }

  // V11 · F6 — mesmo componente nos dois blocos (Modelo Franquia é o único
  // das 5 sub-abas específico de rede externa), mas a sub-aba Performance
  // precisa ficar travada no bloco de quem entrou (Matriz -> interno,
  // Externos -> rede) — sem picker interno, conforme o protótipo.
  function personalizacaoGeral(bloco: "interno" | "rede") {
    return (
      <PersoGeral
        sub={visiblePersoSub}
        setSub={setVisiblePersoSub}
        modelos={modelos.filter((m) => m.tipo === "franqueada")}
        setModelos={(updater) =>
          setModelos((prev) => {
            const fran = prev.filter((m) => m.tipo === "franqueada");
            const next = typeof updater === "function" ? updater(fran) : updater;
            return [...next, ...prev.filter((m) => m.tipo !== "franqueada")];
          })
        }
        clt={clt}
        setClt={setClt}
        onToast={(msg, kind) => setToast({ msg, kind })}
        onError={(e) => setErr(e)}
        reload={reload}
        bloco={bloco}
      />
    );
  }

  return (
    <AppShell title="Acessos e permissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Acessos e permissões</h1>
          <div className="sub">
            Time interno da Matriz (por escopo) e a rede externa (com regras por modelo)
          </div>
        </div>
      </div>

      {err && (
        <div className="banner alert" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      <div
        className="acc-group"
        style={{
          marginBottom: 12,
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${blocoParaConteudo === "interno" ? "var(--slate)" : "var(--border-soft)"}`,
          background: blocoParaConteudo === "interno" ? "#f4f6f8" : "var(--white)",
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
          MATRIZ · TIME INTERNO (POR ESCOPO)
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            type="button"
            onClick={() => setCadastroManual("interno")}
          >
            Cadastro manual · exceção
          </button>
          <button
            className="btn btn-slate btn-sm"
            style={{ marginLeft: 8 }}
            type="button"
            onClick={() => setConvidando("interno")}
          >
            Convidar · time interno
          </button>
        </div>
        <div className="toggle">
          <button
            className={tabInterno === "cadastros" ? "on" : ""}
            onClick={() => {
              abrirInterno();
              setTabInterno("cadastros");
            }}
          >
            Cadastros Matriz
            {totalCadastrosMatriz != null && (
              <span style={{ opacity: 0.7 }}> ({totalCadastrosMatriz})</span>
            )}
          </button>
          <button
            className={tabInterno === "pend" ? "on" : ""}
            onClick={() => {
              abrirInterno();
              setTabInterno("pend");
            }}
          >
            Pendentes de aprovação <span style={{ opacity: 0.7 }}>({pendentesInterno.length})</span>
          </button>
          <button
            className={tabInterno === "deslig" ? "on" : ""}
            onClick={() => {
              abrirInterno();
              setTabInterno("deslig");
            }}
          >
            Desligamentos <span style={{ opacity: 0.7 }}>({desligInterno.length})</span>
          </button>
          <button
            className={tabInterno === "modelos" ? "on" : ""}
            onClick={() => {
              abrirInterno();
              setTabInterno("modelos");
              setVisiblePersoSub("clt");
            }}
          >
            Personalização geral
          </button>
        </div>
      </div>

      <div
        className="acc-group"
        style={{
          marginBottom: 18,
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${blocoParaConteudo === "externo" ? "var(--slate)" : "var(--border-soft)"}`,
          background: blocoParaConteudo === "externo" ? "#f4f6f8" : "var(--white)",
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
          EXTERNOS · REDE
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            type="button"
            onClick={() => setCadastroManual("externo")}
          >
            Cadastro manual · exceção
          </button>
          <button
            className="btn btn-slate btn-sm"
            style={{ marginLeft: 8 }}
            type="button"
            onClick={() => setConvidando("externo")}
          >
            Convidar · rede externa
          </button>
        </div>
        <AcessosNavigation
          tab={visibleTab}
          cadastros={totalCadastrosRede}
          pendentes={pendentesExterno.length}
          desligamentos={desligExterno.length}
          onChange={abrirExterno}
        />
      </div>

      {blocoParaConteudo === "interno" && tabInterno === "cadastros" && (
        <CadastrosMatrizTab
          key={cadastrosMatrizTick}
          onConfigurar={(id, isVendedorClt) => setConfigurando({ id, isVendedorClt })}
          onTotalChange={setTotalCadastrosMatriz}
        />
      )}

      {blocoParaConteudo === "interno" && tabInterno === "pend" && (
        <PendentesTab pendentes={pendentesInterno} onAnalisar={openAnalisar} />
      )}

      {blocoParaConteudo === "interno" && tabInterno === "deslig" && (
        <DesligamentosTab deslig={desligInterno} />
      )}

      {blocoParaConteudo === "interno" &&
        tabInterno === "modelos" &&
        personalizacaoGeral("interno")}

      {blocoParaConteudo === "externo" && visibleTab === "cadastros" && (
        <CadastrosRedeTab onTotalChange={setTotalCadastrosRede} />
      )}

      {blocoParaConteudo === "externo" && visibleTab === "pend" && (
        <PendentesTab pendentes={pendentesExterno} onAnalisar={openAnalisar} />
      )}

      {blocoParaConteudo === "externo" && visibleTab === "deslig" && (
        <>
          <DesligamentoSolicitacoesTab />
          <DesligamentosTab deslig={desligExterno} />
        </>
      )}

      {blocoParaConteudo === "externo" && visibleTab === "modelos" && personalizacaoGeral("rede")}

      {analisando && (
        <ClassificarAcessoModal
          pendente={analisando}
          modelosFranquia={modelos.filter((m) => m.tipo === "franqueada")}
          superiores={superiores}
          franquiasAprovadas={franquiasAprovadas}
          onClose={closeModal}
          onPendencia={solicitarPendencia}
          onRecusar={recusar}
          onLiberar={liberar}
          busy={busy}
        />
      )}

      {toast && (
        <div
          className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-alert"}`}
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            background: toast.kind === "ok" ? "var(--ok)" : "var(--alert)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            zIndex: 80,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}
      {convidando && <ConvidarModal escopo={convidando} onClose={() => setConvidando(null)} />}
      {cadastroManual && (
        <CadastroManualModal
          escopo={cadastroManual}
          onClose={() => setCadastroManual(null)}
          onCriado={aoCriarManual}
        />
      )}
      {configurando && (
        <CadMatrizModal
          profileId={configurando.id}
          isVendedorClt={configurando.isVendedorClt}
          onClose={() => setConfigurando(null)}
          onSalvo={() => {
            setConfigurando(null);
            setCadastrosMatrizTick((t) => t + 1);
          }}
        />
      )}
    </AppShell>
  );
}
