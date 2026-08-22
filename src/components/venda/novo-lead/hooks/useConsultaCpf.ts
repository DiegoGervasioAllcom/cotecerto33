import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { consultarCpf } from "@/lib/cpf.functions";
import { onlyDigits } from "@/lib/masks";
import type { CpfDecodificado } from "@/lib/cpf-decodificador";
import type { Form } from "../types";

export type StatusCpf = { tipo: "ok" | "erro" | "aviso"; texto: string };

type Params = {
  setF: React.Dispatch<React.SetStateAction<Form>>;
  cotacaoId: string | null;
};

/**
 * Integração de CPF no wizard de cotação: consulta a localização simples
 * (server function `consultarCpf`) e preenche os campos do segurado.
 *
 * Só sobrescreve campos que o formulário ainda não tem preenchidos — o
 * vendedor pode ter começado a digitar antes de sair do campo CPF.
 */
export function useConsultaCpf({ setF, cotacaoId }: Params) {
  const [consultando, setConsultando] = useState(false);
  const [status, setStatus] = useState<StatusCpf | null>(null);
  // Último CPF consultado, para não repetir a chamada a cada blur do campo.
  const ultimoCpf = useRef<string>("");
  // Sequência da chamada em voo mais recente: evita que uma resposta lenta
  // e desatualizada sobrescreva o resultado de uma consulta mais nova.
  const sequencia = useRef(0);

  const aplicarDados = useCallback(
    (dados: CpfDecodificado) => {
      setF((p) => ({
        ...p,
        nome: p.nome || dados.nome || p.nome,
        sexo: p.sexo || dados.sexo || p.sexo,
        nasc: p.nasc || dados.dataNascimento || p.nasc,
      }));
      setStatus({ tipo: "ok", texto: `Cadastro encontrado: ${dados.nome}.` });
    },
    [setF],
  );

  /**
   * Dispara a consulta. `forcar` ignora o cache de 30 dias do servidor e
   * a proteção contra reconsultar o mesmo CPF.
   */
  const consultar = useCallback(
    async (cpfBruto: string, opts?: { forcar?: boolean }) => {
      const cpf = onlyDigits(cpfBruto);
      if (cpf.length !== 11) return;
      if (!opts?.forcar && cpf === ultimoCpf.current) return;

      ultimoCpf.current = cpf;
      const minhaSequencia = ++sequencia.current;
      const souAtual = () => sequencia.current === minhaSequencia;

      setConsultando(true);
      setStatus(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const r = await consultarCpf({
          data: {
            cpf,
            caller_token: sess.session?.access_token ?? "",
            cotacaoId: cotacaoId ?? null,
            forcar: opts?.forcar ?? false,
          },
        });
        if (!souAtual()) return;
        if (r.ok && r.dados) {
          aplicarDados(r.dados);
        } else {
          setStatus({
            tipo: "aviso",
            texto: r.mensagem || "CPF não encontrado. Preencha os dados manualmente.",
          });
        }
      } catch (e) {
        if (!souAtual()) return;
        // Falha da consulta não bloqueia o wizard — o preenchimento manual continua valendo.
        ultimoCpf.current = "";
        setStatus({
          tipo: "erro",
          texto: e instanceof Error ? e.message : "Falha ao consultar o CPF.",
        });
      } finally {
        if (souAtual()) setConsultando(false);
      }
    },
    [aplicarDados, cotacaoId],
  );

  return { consultando, status, consultar };
}
