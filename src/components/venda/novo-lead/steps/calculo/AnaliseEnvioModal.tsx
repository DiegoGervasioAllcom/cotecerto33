// "Ferramenta de análise" da engrenagem em `.seg-acoes` (V12.3.6) — espelha
// `segAnalise()` do protótipo V12 (linha ~5239), mas com dados reais: a
// coluna esquerda vem de `obterPayloadQuiverAtual` (server fn read-only, só
// remonta o payload de HOJE a partir das tabelas da cotação — nada é
// enviado nem persistido); a coluna direita é o card já carregado da tela
// (`resultado`, que já é o retorno da seguradora parseado de
// `quiver_resultado_raw`). Sem "Prêmios por cobertura" nem "Personalizar
// coberturas" — fora do escopo desta task (ver V12.3.7 e a decisão
// pendente nº 2 do plano V12).
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { obterPayloadQuiverAtual } from "@/lib/quiver.functions";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useAjustesSeguradora } from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";
import { resumoAjuste } from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import {
  coberturaEntries,
  formasPagamentoResultado,
  tituloResultado,
} from "@/components/venda/cotacoes/quiver-resultado";

type Props = {
  cotacaoId: string;
  resultado: ResultadoCalculo;
  onClose: () => void;
};

// Espelha só os campos de `montarPayloadQuiver` (quiver.functions.ts) que
// fazem sentido mostrar ao vendedor aqui — o payload completo tem muito
// mais chaves (endereço, antifurto, blindagem…), fora do escopo desta
// ferramenta de conferência rápida.
type PayloadAtual = {
  segurado?: { nome?: string; cpf?: string; sexo?: string; estadoCivil?: string; cep?: string };
  seguro?: { tipo?: string; seguradorasDisponiveis?: string[] };
  veiculo?: { placa?: string };
  cobertura?: { plano?: string };
} & Record<string, unknown>;

export function AnaliseEnvioModal({ cotacaoId, resultado, onClose }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [payload, setPayload] = useState<PayloadAtual | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const resposta = await obterPayloadQuiverAtual({
          data: { cotacaoId, caller_token: sess.session?.access_token ?? "" },
        });
        if (!cancelado) setPayload(resposta.payload as PayloadAtual);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Falha ao montar o envio atual.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [cotacaoId]);

  const ajuste = useAjustesSeguradora(cotacaoId)[nomeCanonicoSeguradora(resultado.seguradora)];
  const resumo = ajuste ? resumoAjuste(ajuste) : "";
  const segurado = payload?.segurado ?? {};
  const seguro = payload?.seguro ?? {};
  const veiculo = payload?.veiculo ?? {};
  const cobertura = payload?.cobertura ?? {};
  const coberturas = coberturaEntries(resultado);
  const formasPagamento = formasPagamentoResultado(resultado);

  return (
    <div className="modal-host" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal lg">
        <div className="modal-h">
          <svg width="18" height="18">
            <use href="#i-search" />
          </svg>
          <h3>Ferramenta de análise — {resultado.seguradora}</h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <div className="modal-b">
          {carregando && <div className="muted small">Montando o envio atual…</div>}
          {erro && (
            <div className="banner alert" style={{ marginBottom: 12 }}>
              {erro}
            </div>
          )}
          {!carregando && !erro && (
            <div className="wizard-grid cols-2" style={{ alignItems: "start" }}>
              <div>
                <div className="acc-sec-t">O que seria enviado hoje</div>
                <table className="table-pipe ff-table">
                  <tbody>
                    <tr>
                      <td className="ff-k">Nome do segurado</td>
                      <td className="ff-v">{segurado.nome || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">CPF do segurado</td>
                      <td className="ff-v">{segurado.cpf || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">Sexo</td>
                      <td className="ff-v">{segurado.sexo || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">Estado civil</td>
                      <td className="ff-v">{segurado.estadoCivil || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">CEP</td>
                      <td className="ff-v">{segurado.cep || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">Placa</td>
                      <td className="ff-v">{veiculo.placa || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">Tipo de seguro</td>
                      <td className="ff-v">{seguro.tipo || "—"}</td>
                    </tr>
                    <tr>
                      <td className="ff-k">Plano/cobertura</td>
                      <td className="ff-v">{cobertura.plano || "—"}</td>
                    </tr>
                    {ajuste && resumo && (
                      <tr>
                        <td className="ff-k">Personalização</td>
                        <td className="ff-v" data-testid="analise-ajuste">
                          {ajuste.aplicadoEm
                            ? `Ajustada para ${resultado.seguradora}: ${resumo}`
                            : "Ajuste guardado, não aplicado"}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="ff-k">Seguradoras selecionadas</td>
                      <td className="ff-v">
                        {(seguro.seguradorasDisponiveis ?? []).join(", ") || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div className="acc-sec-t">Retorno da seguradora</div>
                <table className="table-pipe ff-table">
                  <tbody>
                    <tr>
                      <td className="ff-k">Produto</td>
                      <td className="ff-v">{tituloResultado(resultado)}</td>
                    </tr>
                    {coberturas.map(([label, valor]) => (
                      <tr key={label}>
                        <td className="ff-k">{label}</td>
                        <td className="ff-v">{valor}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="ff-k">Formas de pagamento</td>
                      <td className="ff-v">{formasPagamento.join(" · ") || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="clt-note u-mt-14">
            <svg width="15" height="15">
              <use href="#i-alert-triangle" />
            </svg>
            <div>
              Estes dados refletem o estado atual da cotação — não necessariamente o que foi enviado
              no momento do cálculo.
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
