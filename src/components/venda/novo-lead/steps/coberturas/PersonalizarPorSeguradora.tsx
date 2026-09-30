// Bloco "Personalizar por seguradora" do passo Coberturas (V12.3.7) — espelha
// `segPersonalizacao()` do protótipo V12, sem as marcas de foco nem a linha
// "(todas)". Uma linha por seguradora do Passo 2; o ajuste é gravado ao
// alterar (debounce curto) e só vale ao recalcular aquela seguradora.
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { useEffect, useRef, useState } from "react";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import { ajusteSeguradoraSchema } from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import {
  useAjustesSeguradora,
  useSalvarAjusteSeguradora,
  type AjusteGuardado,
} from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";
import { AbasPersonalizacao } from "./AbasPersonalizacao";
import {
  CAMPOS_AJUSTE,
  entradaDoAjuste,
  validoOuVazio,
  type Campo,
  type CoberturaGlobal,
} from "./camposAjuste";

const DEBOUNCE_MS = 500;

type Props = {
  cotacaoId: string | null;
  seguradoras: string[];
  global: CoberturaGlobal;
};

type Status = { tipo: "ok" } | { tipo: "erro"; msg: string } | { tipo: "salvando" } | null;

function Linha({
  seguradora,
  cotacaoId,
  global,
  guardado,
  desabilitado,
}: {
  seguradora: string;
  cotacaoId: string | null;
  global: CoberturaGlobal;
  guardado?: AjusteGuardado;
  desabilitado: boolean;
}) {
  const salvar = useSalvarAjusteSeguradora(cotacaoId);
  const [edicoes, setEdicoes] = useState<Partial<Record<Campo, string>>>({});
  const [status, setStatus] = useState<Status>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sempre a versão mais recente, para o timer não gravar valores velhos.
  const ultimo = useRef<{ valores: Record<Campo, string>; guardado?: AjusteGuardado }>(null);

  const valores = Object.fromEntries(
    CAMPOS_AJUSTE.map((c) => [
      c.k,
      validoOuVazio(edicoes[c.k] ?? guardado?.[c.k] ?? global[c.k], c.opcoes),
    ]),
  ) as Record<Campo, string>;
  ultimo.current = { valores, guardado };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function gravar() {
    const atual = ultimo.current;
    if (!atual) return;
    const r = ajusteSeguradoraSchema.safeParse(
      entradaDoAjuste(atual.valores, global, atual.guardado),
    );
    // Nada difere do Passo 5 e nada foi guardado: não há o que gravar.
    if (!r.success) {
      setStatus(null);
      return;
    }
    setStatus({ tipo: "salvando" });
    const res = await salvar(seguradora, r.data);
    setStatus(res.ok ? { tipo: "ok" } : { tipo: "erro", msg: res.erro });
  }

  function alterar(k: Campo, v: string) {
    setEdicoes((prev) => ({ ...prev, [k]: v }));
    // O timer lê `ultimo` ao disparar, já com a edição aplicada.
    ultimo.current = { valores: { ...valores, [k]: v }, guardado };
    setStatus(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void gravar(), DEBOUNCE_MS);
  }

  return (
    <div className="seg-row" data-testid={`seg-row-${seguradora}`}>
      <SeguradoraBadge nome={seguradora} tam="sm" />
      <div className="seg-row-fields">
        {CAMPOS_AJUSTE.map((c) => (
          <div className="field-group" key={c.k}>
            <label htmlFor={`perso-${seguradora}-${c.k}`}>{c.label}</label>
            <select
              id={`perso-${seguradora}-${c.k}`}
              className="input"
              value={valores[c.k]}
              disabled={desabilitado}
              onChange={(e) => alterar(c.k, e.target.value)}
            >
              {valores[c.k] === "" && <option value="">—</option>}
              {c.opcoes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        ))}
        {status?.tipo === "ok" && (
          <div className="muted small" role="status" data-testid={`seg-status-${seguradora}`}>
            guardado
          </div>
        )}
        {status?.tipo === "erro" && (
          <div className="muted small" role="alert" style={{ color: "var(--alert)" }}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

export function PersonalizarPorSeguradora({ cotacaoId, seguradoras, global }: Props) {
  const tutorial = useTutorialPreview();
  const ajustes = useAjustesSeguradora(tutorial ? null : cotacaoId);
  // Sem cotação (ou no preview do tutorial) o bloco é só ilustrativo: nunca chama o RPC.
  const desabilitado = !cotacaoId || !!tutorial;
  const lista = tutorial ? seguradoras.slice(0, 2) : seguradoras;

  return (
    <>
      <div
        className="acc-sec-t"
        style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        Personalizar por seguradora
        <span className="lbl-soft">cada seguradora tem planos e regras próprias</span>
      </div>
      <div className="seg-perso">
        <AbasPersonalizacao />
        <div style={{ marginTop: 12 }}>
          {lista.length === 0 && (
            <div className="muted small">Selecione seguradoras no passo Seguro.</div>
          )}
          {lista.map((s) => (
            <Linha
              key={s}
              seguradora={s}
              cotacaoId={cotacaoId}
              global={global}
              guardado={ajustes[nomeCanonicoSeguradora(s)]}
              desabilitado={desabilitado}
            />
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 10 }}>
          <svg width="13" height="13">
            <use href="#i-info" />
          </svg>{" "}
          O ajuste vale só ao recalcular uma seguradora; o cálculo geral usa as coberturas acima.
        </div>
      </div>
    </>
  );
}
