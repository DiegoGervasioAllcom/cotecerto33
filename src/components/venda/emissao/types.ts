/** Linha de `/venda/emissao` — uma proposta já transmitida (ou com pendência
 * da seguradora), com os campos que a integração futura vai preencher. */
export type PropostaEmissaoRow = {
  id: string;
  numero: string | null;
  protocolo_seguradora: string | null;
  orcamento_cia: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  parcelas: number | null;
  valor_parcela: number | null;
  transmitida_em: string | null;
  emitida_em: string | null;
  transmissao_status: string | null;
  transmissao_motivo: string | null;
  transmissao_mensagem: string | null;
  cotacao_id: string | null;
  cotacoes: {
    numero: number | null;
    ramo: string | null;
    segurado: { nome: string | null }[] | null;
  } | null;
};
