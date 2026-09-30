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

/**
 * Escolhe, entre as linhas de ajuste de uma cotação, a da seguradora pedida
 * comparando pelo nome CANÔNICO (aceita linhas antigas gravadas com nome de
 * exibição, ex. "Porto"). Se houver duas que colapsam no mesmo canônico,
 * prefere a já gravada com a chave canônica exata.
 */
export function acharAjusteCanonico<T extends { seguradora: string }>(
  linhas: readonly T[],
  seguradora: string,
): T | null {
  const alvo = nomeCanonicoSeguradora(seguradora);
  const iguais = linhas.filter((l) => nomeCanonicoSeguradora(l.seguradora) === alvo);
  return iguais.find((l) => l.seguradora === alvo) ?? iguais[0] ?? null;
}

/**
 * Agrupa linhas por nome canônico; se duas colapsam no mesmo canônico, fica a
 * gravada com a chave canônica exata (a mesma regra da busca no servidor).
 */
export function agruparPorCanonico<T extends { seguradora: string }>(
  linhas: readonly T[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const c of new Set(linhas.map((l) => nomeCanonicoSeguradora(l.seguradora)))) {
    const achada = acharAjusteCanonico(linhas, c);
    if (achada) out[c] = achada;
  }
  return out;
}
