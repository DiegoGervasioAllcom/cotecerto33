import { useEffect, useState } from "react";

/**
 * Integração com a API pública da FIPE: marcas, modelos e valor de tabela.
 * Recebe os campos relevantes do formulário (marca/modelo/ano/combustível)
 * para disparar os efeitos em cascata (marca -> modelos -> valor).
 */
export function useFipe(marca: string, modelo: string, anoModelo: string, combustivel: string) {
  const [marcas, setMarcas] = useState<{ codigo: string; nome: string }[]>([]);
  const [modelos, setModelos] = useState<{ codigo: number; nome: string }[]>([]);
  const [fipeValor, setFipeValor] = useState<string>("");

  // FIPE: marcas
  useEffect(() => {
    fetch("https://parallelum.com.br/fipe/api/v1/carros/marcas")
      .then((r) => r.json())
      .then(setMarcas)
      .catch(() => setMarcas([]));
  }, []);
  // FIPE: modelos quando marca muda
  useEffect(() => {
    if (!marca) {
      setModelos([]);
      return;
    }
    fetch(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${marca}/modelos`)
      .then((r) => r.json())
      .then((j) => setModelos(j.modelos || []))
      .catch(() => setModelos([]));
  }, [marca]);
  // FIPE: valor quando modelo+ano
  useEffect(() => {
    if (!marca || !modelo || !anoModelo) {
      setFipeValor("");
      return;
    }
    const combCode = combustivel === "Diesel" ? 3 : combustivel === "Álcool" ? 2 : 1;
    fetch(
      `https://parallelum.com.br/fipe/api/v1/carros/marcas/${marca}/modelos/${modelo}/anos/${anoModelo}-${combCode}`,
    )
      .then((r) => r.json())
      .then((j) => setFipeValor(j.Valor || ""))
      .catch(() => setFipeValor(""));
  }, [marca, modelo, anoModelo, combustivel]);

  return { marcas, setMarcas, modelos, setModelos, fipeValor, setFipeValor };
}
