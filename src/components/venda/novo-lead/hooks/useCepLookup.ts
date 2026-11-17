import { useState } from "react";
import { onlyDigits } from "@/lib/masks";
import type { Form } from "../types";

/**
 * Busca de endereço via ViaCEP. Usado tanto para o CEP do segurado
 * quanto (via `prefix`) para outros CEPs do formulário.
 */
export function useCepLookup(setF: React.Dispatch<React.SetStateAction<Form>>) {
  const [cepLoading, setCepLoading] = useState(false);
  // Endereço do CEP de pernoite: só para exibir abaixo do campo (não vai ao Form).
  const [enderecoPernoite, setEnderecoPernoite] = useState("");

  async function lookupCep(cep: string, prefix: "" | "cond" = "") {
    const d = onlyDigits(cep);
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro && !prefix) {
        setF((p) => ({
          ...p,
          logradouro: j.logradouro || "",
          bairro: j.bairro || "",
          cidade: j.localidade || "",
          uf: j.uf || "",
        }));
      }
    } catch {
      /* noop */
    } finally {
      setCepLoading(false);
    }
  }

  async function lookupCepPernoite(cep: string) {
    const d = onlyDigits(cep);
    if (d.length !== 8) {
      setEnderecoPernoite("");
      return;
    }
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      setEnderecoPernoite(
        j.erro
          ? ""
          : [j.logradouro, j.bairro, [j.localidade, j.uf].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(", "),
      );
    } catch {
      setEnderecoPernoite("");
    }
  }

  return { cepLoading, lookupCep, enderecoPernoite, lookupCepPernoite };
}
