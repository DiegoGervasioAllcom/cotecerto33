import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { resolverAcessoAreaInterna } from "@/lib/route-access";
import {
  limparChaveRedirecionamentoFalho,
  proximaChaveRedirecionamento,
} from "@/lib/redirect-once";
import { ehPerfilInterno, useAreas } from "@/lib/use-areas";

function areaLoading() {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <p style={{ color: "#fff" }}>Carregando permissões…</p>
    </div>
  );
}

function areaRestrita() {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-card">
        <h1>Acesso restrito</h1>
        <p className="muted">
          Seu acesso não possui nenhuma área disponível. Fale com a Matriz para revisar sua
          visualização.
        </p>
      </div>
    </div>
  );
}

function areaFalhaNavegacao(onRetry: () => void) {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-card">
        <h1>Não foi possível abrir a área</h1>
        <p className="muted">A navegação falhou. Verifique sua conexão e tente novamente.</p>
        <button className="auth-btn" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

/**
 * Guard único das 17 áreas do time interno. Perfis externos não são recortados
 * aqui e continuam obedecendo aos guards e à RLS próprios de cada experiência.
 */
export function useRequireAreaAtual(): ReactNode | null {
  const { loading: authLoading, role } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { loading: areasLoading, areas } = useAreas();
  const navigate = useNavigate();
  const ultimoRedirecionamento = useRef<string | null>(null);
  const [erroRedirecionamento, setErroRedirecionamento] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const pronto = !authLoading && !!role && ehPerfilInterno(role) && !areasLoading;
  const resolucao = pronto ? resolverAcessoAreaInterna({ role, pathname, areas }) : null;
  const destino = resolucao?.tipo === "redirecionar" ? resolucao.to : null;

  useEffect(() => {
    if (!destino || destino === pathname) {
      ultimoRedirecionamento.current = null;
      setErroRedirecionamento(null);
      return;
    }

    const chaveDesejada = [pathname, destino].join("->");
    if (erroRedirecionamento === chaveDesejada) return;
    if (erroRedirecionamento) setErroRedirecionamento(null);

    const chave = proximaChaveRedirecionamento([pathname, destino], ultimoRedirecionamento.current);
    if (!chave) return;
    ultimoRedirecionamento.current = chave;
    void navigate({ to: destino, replace: true }).catch(() => {
      if (ultimoRedirecionamento.current !== chave) return;
      ultimoRedirecionamento.current = limparChaveRedirecionamentoFalho(
        ultimoRedirecionamento.current,
        chave,
      );
      setErroRedirecionamento(chave);
    });
  }, [destino, erroRedirecionamento, navigate, pathname, retryNonce]);

  if (authLoading || !role) return null;
  if (!ehPerfilInterno(role)) return null;

  if (areasLoading) return areaLoading();

  if (resolucao?.tipo === "permitir") return null;
  if (erroRedirecionamento) {
    return areaFalhaNavegacao(() => {
      setErroRedirecionamento(null);
      setRetryNonce((atual) => atual + 1);
    });
  }
  // Mantém a rota anterior coberta enquanto a navegação idempotente conclui.
  if (destino) return areaLoading();
  return areaRestrita();
}
