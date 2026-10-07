// "Personalizar coberturas" da engrenagem em `.seg-acoes` (V12.3.7) — espelha
// `segPersoModal()` do protótipo V12: ajusta só esta seguradora e recalcula só
// ela. Só a aba "Coberturas" é funcional (franquia 1ª/2ª opção, vidros, carro
// reserva — os únicos campos com opções reais no sistema); as outras três
// aparecem desabilitadas "(em breve)".
import { useState } from "react";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import { AbasPersonalizacao, type AbaPersonalizacao } from "../coberturas/AbasPersonalizacao";
import { CampoComissao } from "../coberturas/CampoComissao";
import { comissaoEditavel } from "@/lib/seguradora-canonica";
import {
  CAMPOS_AJUSTE as CAMPOS,
  comissaoInicial,
  entradaDoAjuste,
  valoresIniciais,
  type Campo,
  type CoberturaGlobal,
} from "../coberturas/camposAjuste";
import {
  ajusteSeguradoraSchema,
  type AjusteSeguradora,
} from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import {
  useSalvarAjusteSeguradora,
  type AjusteGuardado,
} from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";

export type { CoberturaGlobal };

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
  const [valores, setValores] = useState<Record<Campo, string>>(() =>
    valoresIniciais(global, guardado),
  );
  const [aba, setAba] = useState<AbaPersonalizacao>("cob");
  const [comissao, setComissao] = useState(() => comissaoInicial(guardado));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aplicar() {
    setErro(null);
    const entrada = entradaDoAjuste(
      valores,
      global,
      guardado,
      comissaoEditavel(seguradora) ? comissao : "",
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
          <AbasPersonalizacao className="u-mb-14" ativa={aba} onChange={setAba} />
          {aba === "com" && (
            <CampoComissao
              id="perso-comissao"
              editavel={comissaoEditavel(seguradora)}
              value={comissao}
              onChange={setComissao}
            />
          )}
          <div className="wizard-grid cols-2" hidden={aba !== "cob"}>
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
