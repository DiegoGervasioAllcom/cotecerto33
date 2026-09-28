// Linha de exemplo do tutorial do vendedor (cap. 8, "Em finalização —
// consultar status") — usada quando `useTutorialPreview()` volta
// "em-finalizacao-exemplo" (ver `em-finalizacao.tsx`). Mesmo cliente
// fictício dos outros previews (Fernanda Souza · VW Polo 2023 · Seguradora
// do exemplo).
import type { Row } from "./em-finalizacao/queries";

export const EM_FINALIZACAO_EXEMPLO_ROW: Row = {
  tentativaId: "exemplo-tutorial",
  cotacaoId: "exemplo-tutorial",
  numero: 842,
  cotacaoCriadoEm: "2026-05-20T00:00:00Z",
  status: "enviada",
  motivo: null,
  mensagem: null,
  seguradora: "Seguradora do exemplo",
  premio: 3510,
  parcelasNum: null,
  valorParcela: null,
  formaPagamento: "Boleto Bancário",
  criadoEm: "2026-05-20T16:12:00Z",
  propostaId: null,
  segurado: "Fernanda Souza",
  veiculo: "VW Polo Comfortline 2023",
  veiculoRaw: {
    marca_nome: "VW",
    modelo_nome: "Polo Comfortline",
    ano_modelo: "2023",
    placa: "FRX-2H08",
  },
};
