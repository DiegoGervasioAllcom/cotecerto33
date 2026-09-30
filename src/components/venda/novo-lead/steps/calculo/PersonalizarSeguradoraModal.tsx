// "Personalizar coberturas" da engrenagem em `.seg-acoes` (V12.3.7) — espelha
// `segPersoModal()` do protótipo V12: ajusta só esta seguradora e recalcula só
// ela. Só a aba "Coberturas" é funcional (franquia 1ª/2ª opção, vidros, carro
// reserva — os únicos campos com opções reais no sistema); as outras três
// aparecem desabilitadas "(em breve)".
import { useState } from "react";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import {
  FRANQUIA_OPCOES,
  FRANQUIA_SEGUNDA_OPCOES,
  NIVEL_COBERTURA_OPCOES,
} from "@/components/venda/novo-lead/enumsCoberturas";
import {
  ajusteSeguradoraSchema,
  type AjusteSeguradora,
  type AjusteSeguradoraEntrada,
} from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import {
  useSalvarAjusteSeguradora,
  type AjusteGuardado,
} from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";

/** Coberturas globais do Passo 5 (valor inicial dos selects). */
export type CoberturaGlobal = {
  franquia1: string;
  franquia2: string;
  vidros: string;
  carroReserva: string;
};

const ABAS = [
  ["assist", "+ Assistências"],
  ["cob", "+ Coberturas"],
  ["desc", "% Descontos"],
  ["com", "+ Comissões"],
] as const;

type Campo = keyof AjusteSeguradoraEntrada;

const CAMPOS: { k: Campo; label: string; opcoes: readonly string[] }[] = [
  { k: "franquia1", label: "1ª opção de franquia", opcoes: FRANQUIA_OPCOES },
  { k: "franquia2", label: "2ª opção de franquia", opcoes: FRANQUIA_SEGUNDA_OPCOES },
  { k: "vidros", label: "Vidros, faróis e retrovisores", opcoes: NIVEL_COBERTURA_OPCOES },
  { k: "carroReserva", label: "Carro reserva", opcoes: NIVEL_COBERTURA_OPCOES },
];

type Props = {
  seguradora: string;
  plano: string;
  cotacaoId: string | null;
  global: CoberturaGlobal;
  guardado?: AjusteGuardado;
  onClose: () => void;
  /** Ajuste salvo: o chamador segue para a confirmação do recálculo. */
  onSalvo: (ajuste: AjusteSeguradora) => void;
};

const validoOuVazio = (v: string, opcoes: readonly string[]) => (opcoes.includes(v) ? v : "");

export function PersonalizarSeguradoraModal({
  seguradora,
  plano,
  cotacaoId,
  global,
  guardado,
  onClose,
  onSalvo,
}: Props) {
  const salvar = useSalvarAjusteSeguradora(cotacaoId);
  const [valores, setValores] = useState<Record<Campo, string>>(
    () =>
      Object.fromEntries(
        CAMPOS.map((c) => [c.k, validoOuVazio(guardado?.[c.k] ?? global[c.k], c.opcoes)]),
      ) as Record<Campo, string>,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aplicar() {
    setErro(null);
    // Só vira ajuste o que difere do Passo 5 (ou já estava ajustado): o resto
    // segue valendo o global e não sobrescreve nada no envio.
    const entrada = Object.fromEntries(
      CAMPOS.map((c) => {
        const v = valores[c.k];
        const igualGlobal = v === global[c.k] && !guardado?.[c.k];
        return [c.k, v === "" || igualGlobal ? null : v];
      }),
    );
    const r = ajusteSeguradoraSchema.safeParse(entrada);
    if (!r.success) {
      setErro(r.error.issues[0]?.message ?? "Ajuste inválido.");
      return;
    }
    setSalvando(true);
    const res = await salvar(seguradora, r.data);
    setSalvando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    onSalvo(r.data);
  }

  return (
    <div className="modal-host" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <svg width="18" height="18">
            <use href="#i-settings" />
          </svg>
          <h3>Personalizar {seguradora}</h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <div className="modal-b">
          <div className="seg-modal-topo">
            <SeguradoraBadge nome={seguradora} tam="sm" />
            <div>
              <strong style={{ color: "var(--slate)" }}>{plano}</strong>
              <div className="muted small">
                Ajuste só esta seguradora e recalcule sem sair do comparativo.
              </div>
            </div>
          </div>
          <div className="toggle toggle-sub u-mb-14">
            {ABAS.map(([id, rotulo]) => {
              const ativa = id === "cob";
              return (
                <button
                  key={id}
                  type="button"
                  className={ativa ? "on" : ""}
                  disabled={!ativa}
                  title={ativa ? undefined : "Em breve"}
                >
                  {rotulo}
                  {ativa ? "" : " (em breve)"}
                </button>
              );
            })}
          </div>
          <div className="wizard-grid cols-2">
            {CAMPOS.map((c) => (
              <div className="field-group" key={c.k}>
                <label htmlFor={`perso-${c.k}`}>{c.label}</label>
                <select
                  id={`perso-${c.k}`}
                  className="input"
                  value={valores[c.k]}
                  onChange={(e) => setValores((prev) => ({ ...prev, [c.k]: e.target.value }))}
                >
                  <option value="">Como nas coberturas</option>
                  {c.opcoes.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {erro && (
            <div className="banner alert u-mt-14" role="alert">
              {erro}
            </div>
          )}
          <div className="clt-note u-mt-14">
            <svg width="15" height="15">
              <use href="#i-info" />
            </svg>
            <div>
              O que você mudar aqui vale <strong>só para {seguradora}</strong>. As demais continuam
              com o que foi definido nas coberturas.
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-yellow"
            type="button"
            disabled={salvando || !cotacaoId}
            onClick={() => void aplicar()}
          >
            <svg width="14" height="14">
              <use href="#i-refresh" />
            </svg>{" "}
            Aplicar e recalcular {seguradora}
          </button>
        </div>
      </div>
    </div>
  );
}
