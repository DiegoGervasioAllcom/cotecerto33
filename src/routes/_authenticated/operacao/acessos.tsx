import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { ConvidarModal, type EscopoConvite } from "@/components/acessos/convidar-modal";
import { ClassificarAcessoModal } from "@/components/acessos/classificar-acesso-modal";
import { SolicitacoesVendedorTab } from "@/components/acessos/solicitacoes-vendedor-tab";
import { useAcessosData } from "@/components/operacao/acessos/hooks/useAcessosData";
import { useAcessosTutorialPreview } from "@/components/operacao/acessos/hooks/useAcessosTutorialPreview";
import { AcessosNavigation } from "@/components/operacao/acessos/AcessosNavigation";
import { PendentesTab } from "@/components/operacao/acessos/pendentes-tab";
import { DesligamentosTab } from "@/components/operacao/acessos/desligamentos-tab";
import { PersoGeral } from "@/components/operacao/acessos/perso-geral";
import { useRequireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const denied = useRequireRole("matriz");
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
    recusar,
    liberar,
  } = useAcessosData(!denied);
  const { visibleTab, setVisibleTab, visiblePersoSub, setVisiblePersoSub } =
    useAcessosTutorialPreview({
      tab,
      setTab,
      persoSub,
      setPersoSub,
    });

  const [convidando, setConvidando] = useState<EscopoConvite | null>(null);

  if (denied) return denied;

  return (
    <AppShell title="Acessos e permissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Acessos e permissões</h1>
          <div className="sub">
            Aprove novos cadastros e classifique cada usuário por modelo de franquia
          </div>
        </div>
        {/* V11: todo cadastro nasce de um Convite Supper. Dois escopos aqui —
            o time interno da Matriz e a rede externa (Master e Individual direta). */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-slate" type="button" onClick={() => setConvidando("interno")}>
            Convidar · time interno
          </button>
          <button className="btn btn-yellow" type="button" onClick={() => setConvidando("externo")}>
            Convidar · rede externa
          </button>
        </div>
      </div>

      <AcessosNavigation
        tab={visibleTab}
        pendentes={pendentes.length}
        desligamentos={deslig.length}
        onChange={setVisibleTab}
      />

      {err && (
        <div className="banner alert" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      {visibleTab === "pend" && <PendentesTab pendentes={pendentes} onAnalisar={openAnalisar} />}

      {visibleTab === "vendedores" && <SolicitacoesVendedorTab />}

      {visibleTab === "deslig" && <DesligamentosTab deslig={deslig} />}

      {visibleTab === "modelos" && (
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
        />
      )}

      {analisando && (
        <ClassificarAcessoModal
          pendente={analisando}
          modelosFranquia={modelos.filter((m) => m.tipo === "franqueada")}
          superiores={superiores}
          franquiasAprovadas={franquiasAprovadas}
          onClose={closeModal}
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
    </AppShell>
  );
}
