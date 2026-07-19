import { useState } from "react";
import { onlyDigits } from "@/lib/masks";
import type { Form } from "../types";

/**
 * Busca de endereço via ViaCEP. Usado tanto para o CEP do segurado
 * quanto (via `prefix`) para outros CEPs do formulário.
 */
export function useCepLookup(setF: React.Dispatch<React.SetStateAction<Form>>) {
  const [cepLoading, setCepLoading] = useState(false);

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

  return { cepLoading, lookupCep };
}
