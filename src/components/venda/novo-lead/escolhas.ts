import {
  DADOS_CAMPOS,
  PERFIL_CAMPOS,
  USO_CAMPOS,
  dadosEscolhidosTodos,
  perfilEscolhidoTodos,
  usoEscolhidoTodos,
  type Form,
} from "./types";

type Escolhas = Pick<
  Form,
  "zeroKmEscolhido" | "perfilEscolhido" | "usoEscolhido" | "dadosEscolhidos"
>;

/**
 * Chaves das perguntas obrigatórias ainda não respondidas. É o que se grava em
 * `cotacoes.campos_pendentes` — o banco guarda só os valores (com default), então
 * sem isto um rascunho reaberto contaria tudo como respondido.
 */
export function chavesPendentes(f: Escolhas): string[] {
  const out: string[] = [];
  if (!f.zeroKmEscolhido) out.push("zeroKm");
  for (const c of PERFIL_CAMPOS) if (!f.perfilEscolhido[c.chave]) out.push(`perfil:${c.chave}`);
  for (const c of USO_CAMPOS) if (!f.usoEscolhido[c.chave]) out.push(`uso:${c.chave}`);
  for (const c of DADOS_CAMPOS) if (!f.dadosEscolhidos[c.chave]) out.push(`dados:${c.chave}`);
  return out;
}

/** Inverso de `chavesPendentes`: lista vazia (ou ausente) = tudo respondido. */
export function aplicarPendentes(pendentes: readonly string[] | null | undefined): Escolhas {
  const p = new Set(pendentes ?? []);
  const perfil = perfilEscolhidoTodos(true);
  for (const c of PERFIL_CAMPOS) perfil[c.chave] = !p.has(`perfil:${c.chave}`);
  const uso = usoEscolhidoTodos(true);
  for (const c of USO_CAMPOS) uso[c.chave] = !p.has(`uso:${c.chave}`);
  const dados = dadosEscolhidosTodos(true);
  for (const c of DADOS_CAMPOS) dados[c.chave] = !p.has(`dados:${c.chave}`);
  return {
    zeroKmEscolhido: !p.has("zeroKm"),
    perfilEscolhido: perfil,
    usoEscolhido: uso,
    dadosEscolhidos: dados,
  };
}
