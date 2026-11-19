export const SEG_MARCAS: Record<string, { cor: string; wm: string; sub: string }> = {
  Mapfre: { cor: "#D6006D", wm: "mapfre", sub: "" },
  Aliro: { cor: "#00A6A0", wm: "Aliro", sub: "seguro" },
  Yelum: { cor: "#5B6770", wm: "Yelum", sub: "seguradora" },
  HDI: { cor: "#00933B", wm: "HDI", sub: "Seguros" },
  Suhai: { cor: "#111820", wm: "SUHAI", sub: "seguradora" },
  Porto: { cor: "#0067B1", wm: "Porto", sub: "Seguro" },
  Azul: { cor: "#0090DA", wm: "azul", sub: "seguros" },
  Itaú: { cor: "#EC7000", wm: "Itaú", sub: "seguros" },
  Tokio: { cor: "#00843D", wm: "TOKIO", sub: "marine" },
  Allianz: { cor: "#003781", wm: "Allianz", sub: "" },
  Bradesco: { cor: "#CC092F", wm: "Bradesco", sub: "Seguros" },
  Pier: { cor: "#FF4A6E", wm: "PIER.", sub: "" },
};

const semAcentoMinusculo = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// O robô/portal devolve o nome em minúsculo e com variações ("hdi seguros", "porto seguro"),
// enquanto o mapa usa os nomes do banco ("HDI", "Porto"). Resolve sem diferenciar caixa/acento.
const ALIAS_MARCA: Record<string, string> = {
  "hdi seguros": "HDI",
  "porto seguro": "Porto",
  "azul seguros": "Azul",
  "bradesco auto": "Bradesco",
  "yelum seguradora": "Yelum",
  "tokio marine": "Tokio",
};

function chaveMarca(nome: string): string | null {
  if (SEG_MARCAS[nome]) return nome;
  const chave = semAcentoMinusculo(nome);
  const alias = ALIAS_MARCA[chave];
  if (alias) return SEG_MARCAS[alias] ? alias : null;
  return Object.keys(SEG_MARCAS).find((k) => semAcentoMinusculo(k) === chave) ?? null;
}

export function marcaSeguradora(nome: string): { cor: string; wm: string; sub: string } | null {
  const k = chaveMarca(nome);
  return k ? SEG_MARCAS[k] : null;
}

// Logos oficiais (arquivos em public/seguradoras, vindos do portal Quiver, reduzidos). Seguradora sem
// arquivo cai no selo desenhado (`SEG_MARCAS`).
const LOGO_ARQUIVO: Record<string, string> = {
  Mapfre: "mapfre",
  Aliro: "aliro",
  Yelum: "yelum",
  HDI: "hdi",
  Suhai: "suhai",
  Porto: "porto",
  Azul: "azul",
  Itaú: "itau",
  Tokio: "tokio",
  Allianz: "allianz",
  Bradesco: "bradesco",
  Pier: "pier",
};

export function logoSeguradora(nome: string): string | null {
  const k = chaveMarca(nome);
  const arquivo = k ? LOGO_ARQUIVO[k] : undefined;
  return arquivo ? `/seguradoras/${arquivo}.png` : null;
}
