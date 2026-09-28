// Catálogo de produtos/tipos de seguro do wizard — espelha PRODUTOS do
// protótipo V12 (cotecerto_prototipo_v12.html:11673-11682) e o CHECK de
// `ramo` no banco (migration do produto "banco" desta task). Só Auto tem
// jornada pronta; os demais entram como "em breve" no picker.
export type ProdutoId = "auto" | "moto" | "vida" | "resid" | "celular";

export type Produto = {
  id: ProdutoId;
  /** rótulo exibido e também o valor gravado em `ramo` (cotacao_seguro) */
  ramo: "Automóvel" | "Moto" | "Vida" | "Residencial" | "Celular";
  nome: string;
  /** id do símbolo em proto-icons.svg (TIPO_ITEM_ICONES do protótipo) */
  icone: string;
};

export const PRODUTOS: Produto[] = [
  { id: "auto", ramo: "Automóvel", nome: "Auto", icone: "car" },
  { id: "moto", ramo: "Moto", nome: "Moto", icone: "moto" },
  { id: "vida", ramo: "Vida", nome: "Vida", icone: "vida" },
  { id: "resid", ramo: "Residencial", nome: "Residencial", icone: "casa" },
  { id: "celular", ramo: "Celular", nome: "Celular", icone: "mobile" },
];

/** Só Auto tem jornada pronta por ora (produtoTemJornada do protótipo). */
export function produtoTemJornada(id: ProdutoId): boolean {
  return id === "auto";
}

export function produtoPorRamo(ramo: string): Produto | undefined {
  return PRODUTOS.find((p) => p.ramo === ramo);
}

export function produtoNome(id: ProdutoId): string {
  return PRODUTOS.find((p) => p.id === id)?.nome ?? id;
}
