/**
 * Barra de contexto do passo Cálculo (`.calc-ctx` no protótipo V12 ·
 * `calcContexto()`, cotecerto_prototipo_v12 linha ~4754): nº da cotação,
 * cliente, padrão e validade sempre à vista, qualquer que seja a visão
 * (lista ou cartões) escolhida logo abaixo na `CalculoToolbar`.
 *
 * O nº da cotação é o real (`cotacoes.numero`, formato `COT-AAAA-NNNNN` — o
 * mesmo já usado no comparativo lado a lado / listas de cotação), não um
 * sorteio como `STATE.cotacaoNum` do protótipo nem um pedaço do uuid.
 */
import {
  formatarNumeroCotacao,
  useNumeroCotacao,
} from "@/components/venda/novo-lead/hooks/useNumeroCotacao";

/** Validade da cotação: 5 dias corridos a partir de hoje (mesma regra do
 * protótipo, `calcValidade()`). */
export function validadeCotacao(base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + 5);
  const z = (n: number) => (n < 10 ? "0" : "") + n;
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
}

type Props = {
  cotacaoId: string | null;
  cliente: string;
  padrao: string;
};

export function CalculoContexto({ cotacaoId, cliente, padrao }: Props) {
  const { numero, criadoEm } = useNumeroCotacao(cotacaoId);
  const numeroFormatado = formatarNumeroCotacao(numero, criadoEm);

  return (
    <div className="calc-ctx" data-tour="calc-ctx">
      <span className="cx-item">
        <span className="cx-k">Cotação</span>
        <strong>{numeroFormatado ? `#${numeroFormatado}` : "—"}</strong>
      </span>
      <span className="cx-item">
        <span className="cx-k">Cliente</span>
        <strong>{(cliente || "Cliente").toUpperCase()}</strong>
      </span>
      <span className="cx-item">
        <span className="cx-k">Padrão</span>
        <strong>{padrao.toUpperCase()}</strong>
      </span>
      <span className="cx-item">
        <span className="cx-k">Válida até</span>
        <strong>{validadeCotacao()}</strong>
      </span>
    </div>
  );
}
