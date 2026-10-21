import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { contarSeguradorasConsultadas } from "@/lib/seguradora-canonica";

/**
 * Nº de seguradoras que o cálculo em andamento consulta, lido da seleção salva da
 * cotação (`cotacao_seguro.seguradoras_sel`) — não do formulário, porque o recálculo
 * de uma só seguradora força a seleção apenas na persistência. Relê quando `chave`
 * muda (a etapa do robô), já que a seleção é gravada logo depois de o cálculo iniciar.
 */
export function useSeguradorasDoCalculo(
  cotacaoId: string | null | undefined,
  ativo: boolean,
  chave?: string | null,
): number | undefined {
  const [n, setN] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!ativo || !cotacaoId) return;
    let vivo = true;
    void supabase
      .from("cotacao_seguro")
      .select("seguradoras_sel,ramo")
      .eq("cotacao_id", cotacaoId)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data) setN(contarSeguradorasConsultadas(data.seguradoras_sel, data.ramo));
      });
    return () => {
      vivo = false;
    };
  }, [ativo, cotacaoId, chave]);
  return n;
}
