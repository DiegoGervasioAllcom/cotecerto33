import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { ClassificarAcessoModal } from "@/components/acessos/classificar-acesso-modal";
import { SolicitacoesVendedorTab } from "@/components/acessos/solicitacoes-vendedor-tab";
import { useAcessosData } from "@/components/operacao/acessos/hooks/useAcessosData";
import { PendentesTab } from "@/components/operacao/acessos/pendentes-tab";
import { DesligamentosTab } from "@/components/operacao/acessos/desligamentos-tab";
import { PersoGeral } from "@/components/operacao/acessos/perso-geral";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: Page,
});

function Page() {
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
  } = useAcessosData();

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
      </div>

      <div className="toggle" style={{ marginBottom: 18 }}>
        <button className={tab === "pend" ? "on" : ""} onClick={() => setTab("pend")}>
          Pendentes de aprovação <span style={{ opacity: 0.7 }}>({pendentes.length})</span>
        </button>
        <button className={tab === "vendedores" ? "on" : ""} onClick={() => setTab("vendedores")}>
          Solicitações de vendedor
        </button>
        <button className={tab === "deslig" ? "on" : ""} onClick={() => setTab("deslig")}>
          Desligamentos <span style={{ opacity: 0.7 }}>({deslig.length})</span>
        </button>
        <button className={tab === "modelos" ? "on" : ""} onClick={() => setTab("modelos")}>
          Personalização geral
        </button>
      </div>

      {err && (
        <div className="banner alert" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      {tab === "pend" && <PendentesTab pendentes={pendentes} onAnalisar={openAnalisar} />}

      {tab === "vendedores" && <SolicitacoesVendedorTab />}

      {tab === "deslig" && <DesligamentosTab deslig={deslig} />}

      {tab === "modelos" && (
        <PersoGeral
          sub={persoSub}
          setSub={setPersoSub}
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
    </AppShell>
  );
}
