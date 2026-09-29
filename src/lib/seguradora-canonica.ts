// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Nome canônico aceito pela Quiver (seguro.seguradorasDisponiveis) a partir
// do nome exibido no app. Cobre os 12 canônicos + variações mais comuns;
// qualquer seguradora fora dessa lista não é enviada (a Quiver rejeitaria).
// R.12 (revisão form vs robô Quiver, 2026-08): o robô trata "hdi seguros fit"
// e "hdi seguros basico" como produtos DISTINTOS, mas o front só oferece
// "HDI" genérico na lista de seguradoras (mapeado abaixo sempre para
// "hdi seguros"). Não implementado agora — exige decisão de produto (qual
// variante o vendedor quer cotar, ou perguntar as duas?). Só documentado
// aqui para não perder o achado.
export const SEGURADORA_QUIVER: Record<string, string> = {
  aliro: "aliro",
  allianz: "allianz",
  azul: "azul",
  "azul seguros": "azul",
  bradesco: "bradesco",
  "bradesco auto": "bradesco",
  hdi: "hdi seguros",
  "hdi seguros": "hdi seguros",
  mapfre: "mapfre",
  porto: "porto",
  "porto seguro": "porto",
  suhai: "suhai",
  tokio: "tokio",
  yelum: "yelum",
};

/** Nome canônico do robô para um nome de exibição; sem mapa, devolve o nome aparado em minúsculas. */
export function nomeCanonicoSeguradora(nome: string): string {
  const k = nome.trim().toLowerCase();
  return SEGURADORA_QUIVER[k] ?? k;
}
