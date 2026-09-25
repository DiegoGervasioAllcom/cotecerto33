/** Forma de pagamento + parcela escolhida por card — compartilhado entre a
 * visão em cartões (`CalculoCardsGrid`) e a lista comparativa
 * (`CalculoLista`), o robô precisa das duas pra clicar na célula certa do
 * modal do portal. */
export type EscolhaCard = { grupoId: string; opcaoId: string };
