import { useEffect, useState } from "react";

export type AnoFipe = { codigo: string; nome: string };

const FIPE_URL = "https://parallelum.com.br/fipe/api/v1";

/** Tabela FIPE do item segurado: moto tem tabela própria (`/motos`); o resto segue `/carros`. */
export function fipeBase(ramo?: string): string {
  return `${FIPE_URL}/${ramo === "Moto" ? "motos" : "carros"}`;
}

/**
 * Escolhe o código de ano/combustível da FIPE ("2015-5") para o ano e o
 * combustível do formulário.
 *
 * Por que consultar a lista em vez de montar o código: o sufixo NÃO é
 * 1=Gasolina/2=Álcool/3=Diesel como parecia — Flex é 5, e montar
 * `${ano}-1` para um carro flex devolvia "veículo não encontrado", ou
 * seja, o Valor FIPE ficava vazio para boa parte da frota. Aqui o
 * sufixo vem da própria API e o combustível só desempata.
 */
export function escolherAnoFipe(
  anos: AnoFipe[],
  anoModelo: string,
  combustivel: string,
): AnoFipe | null {
  const doAno = (anos ?? []).filter((a) => String(a?.codigo ?? "").startsWith(`${anoModelo}-`));
  if (doAno.length === 0) return null;
  const alvo = combustivel.trim().toLowerCase();
  if (!alvo) return doAno[0];
  // O nome vem como "2015 Flex" / "2015 Gasolina" / "2015 Diesel".
  const exato = doAno.find((a) =>
    String(a.nome ?? "")
      .toLowerCase()
      .includes(alvo),
  );
  return exato ?? doAno[0];
}

/**
 * Integração com a API pública da FIPE: marcas, modelos e valor de tabela.
 * Recebe os campos relevantes do formulário (marca/modelo/ano/combustível)
 * para disparar os efeitos em cascata (marca -> modelos -> valor).
 */
export function useFipe(
  marca: string,
  modelo: string,
  anoModelo: string,
  combustivel: string,
  ramo?: string,
) {
  const FIPE_BASE = fipeBase(ramo);
  const [marcas, setMarcas] = useState<{ codigo: string; nome: string }[]>([]);
  const [modelos, setModelos] = useState<{ codigo: number; nome: string }[]>([]);
  const [fipeValor, setFipeValor] = useState<string>("");

  // FIPE: marcas (recarrega ao trocar carro <-> moto: as tabelas são distintas)
  useEffect(() => {
    setMarcas([]);
    fetch(`${FIPE_BASE}/marcas`)
      .then((r) => r.json())
      // A API pública devolve 429 (rate limit) com um corpo JSON de erro
      // (`{ error: "..." }`, não um array) sem que o `fetch` chegue a
      // rejeitar — sem essa checagem, `setMarcas` grava esse objeto e
      // qualquer `.find`/`.some` subsequente (ex.: `buildPayload` do
      // autosave) quebra com "marcas.find is not a function".
      .then((j) => setMarcas(Array.isArray(j) ? j : []))
      .catch(() => setMarcas([]));
  }, [FIPE_BASE]);
  // FIPE: modelos quando marca muda
  useEffect(() => {
    if (!marca) {
      setModelos([]);
      return;
    }
    fetch(`${FIPE_BASE}/marcas/${marca}/modelos`)
      .then((r) => r.json())
      .then((j) => setModelos(j.modelos || []))
      .catch(() => setModelos([]));
  }, [marca, FIPE_BASE]);
  // FIPE: valor quando modelo+ano
  useEffect(() => {
    if (!marca || !modelo || !anoModelo) {
      setFipeValor("");
      return;
    }
    // Trocar de veículo no meio da busca não pode deixar o valor antigo na tela.
    let cancelado = false;
    (async () => {
      try {
        const rAnos = await fetch(`${FIPE_BASE}/marcas/${marca}/modelos/${modelo}/anos`);
        const jAnos: unknown = await rAnos.json();
        // A API pública devolve JSON de erro (ex. 429) em vez de lista.
        const anos: AnoFipe[] = Array.isArray(jAnos) ? (jAnos as AnoFipe[]) : [];
        const ano = escolherAnoFipe(anos, anoModelo, combustivel);
        if (!ano) {
          if (!cancelado) setFipeValor("");
          return;
        }
        const rValor = await fetch(
          `${FIPE_BASE}/marcas/${marca}/modelos/${modelo}/anos/${ano.codigo}`,
        );
        const j = await rValor.json();
        if (!cancelado) setFipeValor(j.Valor || "");
      } catch {
        if (!cancelado) setFipeValor("");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [marca, modelo, anoModelo, combustivel, FIPE_BASE]);

  return { marcas, setMarcas, modelos, setModelos, fipeValor, setFipeValor };
}
