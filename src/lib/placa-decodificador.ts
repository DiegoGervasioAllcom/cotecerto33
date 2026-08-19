// Parser da resposta do decodificador de placa (ws.sisconsulta.com —
// endpoint Integracao/DecodificadorAR). A API responde em XML, não JSON,
// e em dois formatos distintos:
//
//   Sucesso  <Root><placa/><chassi/><Decodificador>…<PrecificadorI/>…</Decodificador></Root>
//   Erro     <NewDataSet><Retorno><Existe_erro>1</Existe_erro><Codigo/><Mensagem/></Retorno></NewDataSet>
//
// A estrutura é plana e previsível (sem atributos, sem namespaces, sem
// aninhamento além de PrecificadorI), então o parse é feito à mão em vez
// de trazer uma dependência de XML só para isso. Módulo puro, sem acesso
// a rede ou env — a chamada HTTP vive em placa.functions.ts.

/** Uma versão FIPE retornada para a placa (bloco <PrecificadorI>). */
export type PrecificadorFipe = {
  /** Código FIPE, ex.: "004420-2". */
  codigo: string;
  combustivel: string;
  /** Marca no padrão FIPE, ex.: "GM - Chevrolet". */
  marca: string;
  /** Modelo no padrão FIPE, ex.: "COBALT LTZ 1.8 8V Econo.Flex 4p Mec.". */
  modelo: string;
  /** Valor em reais; null quando a API não devolve preço. */
  valor: number | null;
};

export type PlacaDecodificada = {
  placa: string;
  chassi: string;
  categoria: string;
  /** Marca do fabricante, ex.: "CHEVROLET" (difere da marca FIPE). */
  marca: string;
  modelo: string;
  versao: string;
  motor: string;
  origem: string;
  localFabricacao: string;
  tipoCarroceria: string;
  anoModelo: string;
  anoFabricacao: string;
  codigoRetorno: string;
  mensagemRetorno: string;
  /** Versões FIPE candidatas — pode vir mais de uma (ex.: Mec. e Aut.). */
  fipe: PrecificadorFipe[];
};

/**
 * Campos que o decodificador pode identificar mesmo quando não fecha uma
 * versão FIPE completa (ex.: "Somente País/Marca/Ano Identificados",
 * NuCdRetorno != 0) — o front usa isso pra preencher o que dá, em vez de
 * jogar fora tudo e deixar o vendedor digitar do zero.
 */
export type PlacaParcial = {
  marca: string;
  anoModelo: string;
  anoFabricacao: string;
  chassi: string;
};

export type ResultadoConsultaPlaca =
  | { ok: true; dados: PlacaDecodificada }
  | { ok: false; codigo: string | null; mensagem: string; parcial?: PlacaParcial };

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodificarEntidades(v: string): string {
  return v.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, ent: string) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const cp = Number.parseInt(ent.slice(2), 16);
      return Number.isNaN(cp) ? all : String.fromCodePoint(cp);
    }
    if (ent.startsWith("#")) {
      const cp = Number.parseInt(ent.slice(1), 10);
      return Number.isNaN(cp) ? all : String.fromCodePoint(cp);
    }
    const found = ENTIDADES[ent.toLowerCase()];
    return found ?? all;
  });
}

/**
 * Conteúdo da primeira ocorrência de `<tag>…</tag>`. Devolve "" quando a
 * tag não existe ou é vazia/auto-fechada (`<Parametro />`).
 */
function tag(xml: string, nome: string): string {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  // Os campos vêm com padding à direita ("COBALT 1.8 LTZ      ").
  return decodificarEntidades(m[1]).trim();
}

/** Todos os blocos `<tag>…</tag>` (PrecificadorI aparece N vezes). */
function blocos(xml: string, nome: string): string[] {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/**
 * "43399" -> 43399 · "45.917,50" -> 45917.5 · "" -> null.
 * Sem vírgula o valor é inteiro em reais (formato observado na API).
 */
function parseValor(v: string): number | null {
  const bruto = v.trim();
  if (!bruto) return null;
  const normalizado = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Traduz o XML do decodificador no resultado usado pelo app. Nunca lança:
 * qualquer coisa que não seja um `<Decodificador>` legível vira
 * `{ ok: false }` com a mensagem que a API mandou (ou uma genérica).
 */
export function parseDecodificadorXml(xml: string): ResultadoConsultaPlaca {
  const texto = String(xml ?? "");

  // Formato de erro: <NewDataSet><Retorno>. Também cobre o caso de o
  // fornecedor devolver <Retorno> junto de um Root sem Decodificador.
  const existeErro = tag(texto, "Existe_erro");
  const temDecodificador = /<Decodificador[\s>]/i.test(texto);
  if (!temDecodificador || existeErro === "1") {
    const mensagem = tag(texto, "Mensagem") || tag(texto, "DsRetorno");
    const codigo = tag(texto, "Codigo") || tag(texto, "NuCdRetorno");
    return {
      ok: false,
      codigo: codigo || null,
      mensagem: mensagem || "Não foi possível decodificar a placa.",
    };
  }

  const dec = blocos(texto, "Decodificador")[0] ?? "";
  const codigoRetorno = tag(dec, "NuCdRetorno");
  const mensagemRetorno = tag(dec, "DsRetorno");

  // NuCdRetorno 0 = "Marca/Modelo/Ano Identificados"; qualquer outro código
  // significa que o veículo não foi TOTALMENTE identificado (ex.: "Somente
  // País/Marca/Ano Identificados") — mas o bloco <Decodificador> ainda pode
  // trazer marca/ano/chassi preenchidos, só sem versão FIPE. Devolve esses
  // campos em `parcial` pro front aproveitar em vez de descartar tudo.
  if (codigoRetorno && codigoRetorno !== "0") {
    const parcial: PlacaParcial = {
      marca: tag(dec, "DsMarca"),
      anoModelo: tag(dec, "NuAnoModelo"),
      anoFabricacao: tag(dec, "NuAnoFabricacao"),
      chassi: tag(dec, "DsChassiTratado") || tag(dec, "DsChassi"),
    };
    const temAlgumDado = Object.values(parcial).some(Boolean);
    return {
      ok: false,
      codigo: codigoRetorno,
      mensagem: mensagemRetorno || "Veículo não identificado para esta placa.",
      ...(temAlgumDado ? { parcial } : {}),
    };
  }

  const fipe: PrecificadorFipe[] = blocos(dec, "PrecificadorI")
    .map((b) => ({
      codigo: tag(b, "DsCodigo"),
      combustivel: tag(b, "DsCombustivel"),
      marca: tag(b, "DsMarca"),
      modelo: tag(b, "DsModelo"),
      valor: parseValor(tag(b, "NuValor")),
    }))
    .filter((p) => p.codigo || p.modelo);

  return {
    ok: true,
    dados: {
      // DsPlaca preserva o padrão Mercosul; a <placa> da raiz vem
      // convertida para o formato antigo (FTP4J82 -> FTP4982).
      placa: tag(dec, "DsPlaca") || tag(texto, "placa"),
      chassi: tag(dec, "DsChassiTratado") || tag(dec, "DsChassi") || tag(texto, "chassi"),
      categoria: tag(dec, "DsCategoria"),
      marca: tag(dec, "DsMarca"),
      modelo: tag(dec, "DsModelo"),
      versao: tag(dec, "DsVersao"),
      motor: tag(dec, "DsMotor"),
      origem: tag(dec, "DsOrigem"),
      localFabricacao: tag(dec, "DsLocalFabricacao"),
      tipoCarroceria: tag(dec, "DsTipoCarroceria"),
      anoModelo: tag(dec, "NuAnoModelo"),
      anoFabricacao: tag(dec, "NuAnoFabricacao"),
      codigoRetorno,
      mensagemRetorno,
      fipe,
    },
  };
}

/**
 * Combustível do padrão FIPE/decodificador para as opções do <select> do
 * formulário ("Flex" | "Gasolina" | "Álcool" | "Diesel" | "Elétrico").
 * Devolve "" quando não há correspondência — o campo fica como estava.
 */
export function normalizarCombustivel(v: string | null | undefined): string {
  const s = String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    // \p{M} = marcas combinantes (acentos separados pelo NFD).
    .replace(/\p{M}/gu, "");
  if (!s) return "";
  // "Econo.Flex", "Flex Fuel", "Álcool/Gasolina" -> Flex.
  if (s.includes("flex") || (s.includes("alcool") && s.includes("gasolina"))) return "Flex";
  if (s.includes("eletric") || s.includes("hibrid")) return "Elétrico";
  if (s.includes("diesel")) return "Diesel";
  if (s.includes("alcool") || s.includes("etanol")) return "Álcool";
  if (s.includes("gasolina")) return "Gasolina";
  return "";
}
