import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProtoIcons } from "@/components/proto-icons";
import {
  marcarCotacaoVista,
  useCotacoesNovas,
  useInvalidateCotacoesNovas,
  type CotacaoNova,
} from "@/lib/cotacao-novas";

/**
 * Aviso lateral "COTAÇÃO FINALIZADA" (protótipo V12 · `avisoCotacao()`).
 * Montado uma vez em `AppShell` para quem enxerga a área de venda — fica
 * até o vendedor agir ("Abrir cálculo") ou dispensar ("Depois"), nunca some
 * sozinho por timeout (é intencional: o protótipo trata isso como diferente
 * de um toast, porque a ação nos minutos seguintes decide a venda).
 *
 * `sessionStorage` guarda os ids já apresentados nesta aba/sessão: como não
 * há realtime aqui (poll de `COTACOES_NOVAS_POLL_MS`), sem essa marca a
 * troca de rota (que remonta `AppShell`, e portanto este componente) faria
 * o mesmo card reaparecer com a animação de entrada de novo enquanto o
 * vendedor ainda não decidiu — a lista em si (`useCotacoesNovas`) já é a
 * fonte da verdade de quais cotações ainda estão "novas".
 */
const SESSION_KEY = "cotecerto:aviso-cotacao-mostrados";

function lerMostrados(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function marcarMostrado(id: string) {
  try {
    const atuais = lerMostrados();
    atuais.add(id);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...atuais]));
  } catch {
    // sessionStorage indisponível (modo privado etc.) — só perde o "não repetir
    // a animação", a lista de novas continua correta.
  }
}

function veiculoResumo(cot: CotacaoNova): string {
  const v = cot.veiculo;
  if (!v) return "";
  return `${v.marca_nome ?? ""} ${v.modelo_nome ?? ""} ${v.ano_modelo ?? ""}`.trim();
}

export function CotacaoFinalizadaAviso({ uid, ativo }: { uid: string | null; ativo: boolean }) {
  const navigate = useNavigate();
  const { data: novas } = useCotacoesNovas(uid, ativo);
  const invalidar = useInvalidateCotacoesNovas();
  const [jaMostrados, setJaMostrados] = useState<Set<string>>(() => lerMostrados());
  const marcandoRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!novas?.length) return;
    const novosIds = novas.map((c) => c.id).filter((id) => !jaMostrados.has(id));
    if (novosIds.length === 0) return;
    novosIds.forEach(marcarMostrado);
    setJaMostrados((atual) => new Set([...atual, ...novosIds]));
  }, [novas, jaMostrados]);

  if (!ativo || !uid || !novas?.length) return null;

  async function agir(cotacaoId: string, abrir: boolean) {
    if (marcandoRef.current.has(cotacaoId)) return;
    marcandoRef.current.add(cotacaoId);
    try {
      await marcarCotacaoVista(cotacaoId, uid as string);
    } finally {
      marcandoRef.current.delete(cotacaoId);
    }
    invalidar();
    if (abrir) {
      void navigate({ to: "/venda/novo-lead", search: { id: cotacaoId, step: 5 } });
    }
  }

  return (
    <div className="aviso-host" id="avisoHost" data-tour="aviso-cotacao-finalizada">
      <ProtoIcons />
      {novas.map((cot) => {
        const semAnimacao = jaMostrados.has(cot.id);
        return (
          <div
            key={cot.id}
            className="aviso-card"
            style={semAnimacao ? { animation: "none" } : undefined}
          >
            <div className="av-top">
              <span className="av-ic">
                <svg width={16} height={16}>
                  <use href="#i-check-circle" />
                </svg>
              </span>
              <span className="av-t">COTAÇÃO FINALIZADA</span>
              <span
                className="av-x"
                title="Dispensar"
                role="button"
                tabIndex={0}
                onClick={() => void agir(cot.id, false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") void agir(cot.id, false);
                }}
              >
                <svg width={15} height={15}>
                  <use href="#i-x" />
                </svg>
              </span>
            </div>
            <div className="av-cli">{cot.segurado?.nome || "—"}</div>
            <div className="av-sub">
              {veiculoResumo(cot)} · todas as seguradoras responderam. Fale com ele enquanto o preço
              está fresco.
            </div>
            <div className="av-acoes">
              <button
                type="button"
                className="btn btn-yellow btn-sm"
                onClick={() => void agir(cot.id, true)}
              >
                <svg width={13} height={13}>
                  <use href="#i-compare" />
                </svg>{" "}
                Abrir cálculo
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void agir(cot.id, false)}
              >
                Depois
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
