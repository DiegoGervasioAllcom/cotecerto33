// Modal "Imprimir cotação" (Frente 3 V12 · 7a) na lista de Em finalização —
// extraído da rota (revisão V12.3.10). "Em finalização" só guarda a
// seguradora/prêmio da própria tentativa de transmissão (sem
// `quiver_resultado_raw`, essa lista não tem o comparativo inteiro do
// Quiver), então usa o mesmo adaptador de "Em negociação"
// (`docDadosDaTransmissao`, `doc-dados.ts`).
import { docDadosDaTransmissao } from "@/components/venda/cotacoes/doc-dados";
import { useImprimirCotacaoModal } from "@/components/venda/cotacoes/ImprimirCotacaoModal";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import type { DocDados } from "@/lib/print";
import type { Row } from "./queries";

function docDadosDaLinha(r: Row): DocDados {
  return docDadosDaTransmissao(
    {
      cotacaoNumero: `#${cotNum(r.numero, r.cotacaoCriadoEm)}`,
      cotacaoId: r.cotacaoId,
      segurado: r.segurado !== "—" ? { nome: r.segurado } : null,
      veiculo: r.veiculoRaw,
    },
    {
      seguradora: r.seguradora,
      premio: r.premio,
      parcelasNum: r.parcelasNum,
      valorParcela: r.valorParcela,
    },
  );
}

/** `abrir(r)` já monta o `DocDados` da linha — o chamador só passa a `Row`. */
export function useEmFinalizacaoImprimir() {
  const { abrir, modal } = useImprimirCotacaoModal();
  return { modal, abrir: (r: Row) => abrir(docDadosDaLinha(r)) };
}
