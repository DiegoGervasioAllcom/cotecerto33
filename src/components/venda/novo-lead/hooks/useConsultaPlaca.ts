import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { consultarPlaca } from "@/lib/placa.functions";
import { normalizePlaca } from "@/lib/masks";
import {
  normalizarCombustivel,
  type PlacaDecodificada,
  type PlacaParcial,
  type PrecificadorFipe,
} from "@/lib/placa-decodificador";
import type { Form } from "../types";

export type StatusPlaca = { tipo: "ok" | "erro" | "aviso"; texto: string };

type Params = {
  setF: React.Dispatch<React.SetStateAction<Form>>;
  marcas: { codigo: string; nome: string }[];
  setModelos: React.Dispatch<React.SetStateAction<{ codigo: number; nome: string }[]>>;
  cotacaoId: string | null;
  /** Placa atual do formulário e se um rascunho ainda está carregando (useCotacaoRascunho). */
  placaAtual: string;
  carregandoRascunho: boolean;
  /**
   * true quando os dados do veículo já foram resolvidos por uma consulta de
   * placa anterior (ex.: `marca` preenchida) — usado só para não reconsultar
   * ao reabrir uma cotação já trabalhada. Placa chegando pré-preenchida SEM
   * isso (ex.: lead assumido via `assumir_lead`, que grava
   * `cotacao_veiculo.placa` direto no banco sem nunca consultar o
   * decodificador) NÃO deve travar a consulta — o vendedor precisa que ela
   * rode na primeira vez que o campo perder o foco.
   */
  veiculoJaResolvido: boolean;
};

/** Comparação tolerante de nomes FIPE: sem acento, sem pontuação, sem caixa. */
function norm(v: string): string {
  return String(v ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Integração de placa no wizard de cotação: consulta o decodificador
 * (server function `consultarPlaca`) e preenche os campos do veículo.
 *
 * Marca/modelo são resolvidos contra a lista da FIPE — o decodificador
 * devolve o nome FIPE ("GM - Chevrolet" / "COBALT LTZ 1.8 8V ... Mec."),
 * mas o formulário guarda os *códigos*. Quando a placa tem mais de uma
 * versão FIPE (ex.: câmbio manual e automático), nada é escolhido por
 * conta própria: `versoes` fica preenchido e a tela pede a escolha.
 */
export function useConsultaPlaca({
  setF,
  marcas,
  setModelos,
  cotacaoId,
  placaAtual,
  carregandoRascunho,
  veiculoJaResolvido,
}: Params) {
  const [consultando, setConsultando] = useState(false);
  const [status, setStatus] = useState<StatusPlaca | null>(null);
  const [versoes, setVersoes] = useState<PrecificadorFipe[]>([]);
  // Última placa consultada, para não repetir a chamada a cada blur do campo.
  const ultimaPlaca = useRef<string>("");
  // Sequência da chamada em voo mais recente: se o vendedor corrigir a
  // placa e sair do campo de novo antes da 1ª consulta responder, a
  // resposta antiga (mais lenta) não pode sobrescrever a mais nova.
  const sequencia = useRef(0);

  // Ao terminar de carregar um rascunho existente (?id=) cujo veículo já foi
  // resolvido antes, os campos já refletem o que está salvo para a placa
  // carregada — sem isto, o primeiro blur no campo Placa depois de reabrir a
  // cotação reconsultava a mesma placa e sobrescrevia edições manuais já
  // salvas. NÃO trava quando a placa chegou pré-preenchida sem consulta real
  // (`assumir_lead` grava `cotacao_veiculo.placa` direto no banco quando o
  // lead distribuído já traz a placa, ex. Movida) — aí `veiculoJaResolvido`
  // é falso e o primeiro blur precisa disparar a consulta de verdade.
  const sincronizouRascunho = useRef(false);
  useEffect(() => {
    if (carregandoRascunho || sincronizouRascunho.current) return;
    sincronizouRascunho.current = true;
    if (veiculoJaResolvido) ultimaPlaca.current = normalizePlaca(placaAtual);
  }, [carregandoRascunho, placaAtual, veiculoJaResolvido]);

  /** Acha a marca FIPE correspondente ao nome livre e já popula `modelos`
   * dessa marca (fetch da FIPE) — usado tanto para aplicar uma versão FIPE
   * completa quanto para aproveitar uma identificação parcial (sem versão). */
  const resolverMarca = useCallback(
    async (nomeMarca: string) => {
      const alvo = norm(nomeMarca);
      const marcaMatch =
        marcas.find((m) => norm(m.nome) === alvo) ??
        marcas.find((m) => norm(m.nome).includes(alvo) || alvo.includes(norm(m.nome)));
      if (!marcaMatch)
        return { marcaMatch: undefined, lista: [] as { codigo: number; nome: string }[] };

      let lista: { codigo: number; nome: string }[] = [];
      try {
        const r = await fetch(
          `https://parallelum.com.br/fipe/api/v1/carros/marcas/${marcaMatch.codigo}/modelos`,
        );
        const j = await r.json();
        lista = j.modelos || [];
      } catch {
        /* sem lista: quem chamou decide o aviso de seleção manual */
      }
      if (lista.length) setModelos(lista);
      return { marcaMatch, lista };
    },
    [marcas, setModelos],
  );

  const aplicarVersao = useCallback(
    async (v: PrecificadorFipe) => {
      setVersoes([]);
      const { marcaMatch, lista } = await resolverMarca(v.marca);

      if (!marcaMatch) {
        setStatus({
          tipo: "aviso",
          texto: `Dados preenchidos. Marca "${v.marca}" não está na lista FIPE — selecione marca e modelo manualmente.`,
        });
        return;
      }

      const alvoModelo = norm(v.modelo);
      const modeloMatch =
        lista.find((m) => norm(m.nome) === alvoModelo) ??
        lista.find((m) => norm(m.nome).startsWith(alvoModelo));

      setF((p) => ({
        ...p,
        marca: marcaMatch.codigo,
        modelo: modeloMatch ? String(modeloMatch.codigo) : "",
        // Cada versão FIPE pode ter um combustível diferente (ex.: uma Flex,
        // outra Diesel) — precisa ser resolvido de novo a cada escolha, não
        // só na primeira aplicação em aplicarDados.
        combustivel:
          normalizarCombustivel(v.combustivel) || normalizarCombustivel(v.modelo) || p.combustivel,
      }));

      setStatus(
        modeloMatch
          ? { tipo: "ok", texto: `Veículo identificado: ${marcaMatch.nome} · ${modeloMatch.nome}` }
          : {
              tipo: "aviso",
              texto: `Dados preenchidos. Modelo "${v.modelo}" não está na lista FIPE — selecione manualmente.`,
            },
      );
    },
    [resolverMarca, setF],
  );

  /**
   * Identificação PARCIAL do decodificador (ex.: "Somente País/Marca/Ano
   * Identificados", sem versão FIPE) — aproveita marca/ano/chassi em vez de
   * descartar tudo e deixar o formulário vazio.
   */
  const aplicarParcial = useCallback(
    async (parcial: PlacaParcial, mensagemProvedor: string) => {
      setF((p) => ({
        ...p,
        chassi: parcial.chassi || p.chassi,
        anoModelo: parcial.anoModelo || p.anoModelo,
        anoFab: parcial.anoFabricacao || p.anoFab,
      }));

      if (!parcial.marca) {
        setStatus({
          tipo: "aviso",
          texto: `${mensagemProvedor} Preencha marca e modelo manualmente.`,
        });
        return;
      }
      const { marcaMatch } = await resolverMarca(parcial.marca);
      if (!marcaMatch) {
        setStatus({
          tipo: "aviso",
          texto: `${mensagemProvedor} Preencha marca e modelo manualmente.`,
        });
        return;
      }
      setF((p) => ({ ...p, marca: marcaMatch.codigo }));
      setStatus({
        tipo: "aviso",
        texto: `${mensagemProvedor} Marca preenchida (${marcaMatch.nome}) — selecione o modelo manualmente.`,
      });
    },
    [resolverMarca, setF],
  );

  const aplicarDados = useCallback(
    async (dados: PlacaDecodificada) => {
      // O que não depende da FIPE entra na hora.
      setF((p) => ({
        ...p,
        placa: normalizePlaca(dados.placa) || p.placa,
        chassi: dados.chassi || p.chassi,
        anoModelo: dados.anoModelo || p.anoModelo,
        anoFab: dados.anoFabricacao || p.anoFab,
        // DsCombustivel de cada versão FIPE é o campo autoritativo — o nome
        // livre do modelo ("... Econo.Flex 4p Mec.") só serve de fallback
        // quando a API não devolveu o combustível (ex.: "Gasolina" na versão
        // não pode perder pra "Flex" que aparece no texto do nome).
        combustivel:
          normalizarCombustivel(dados.fipe[0]?.combustivel) ||
          normalizarCombustivel(dados.fipe[0]?.modelo) ||
          p.combustivel,
      }));

      if (dados.fipe.length === 0) {
        setStatus({
          tipo: "aviso",
          texto: `${dados.marca} ${dados.modelo} ${dados.anoModelo}. Sem versão FIPE na consulta — selecione marca e modelo manualmente.`,
        });
        return;
      }
      if (dados.fipe.length > 1) {
        // Mais de uma versão para a mesma placa: quem escolhe é o vendedor.
        setVersoes(dados.fipe);
        setStatus({
          tipo: "aviso",
          texto: `${dados.marca} ${dados.modelo} ${dados.anoModelo}. Selecione a versão do veículo abaixo.`,
        });
        return;
      }
      await aplicarVersao(dados.fipe[0]);
    },
    [aplicarVersao, setF],
  );

  /**
   * Dispara a consulta. `forcar` ignora o cache de 30 dias do servidor e
   * a proteção contra reconsultar a mesma placa.
   */
  const consultar = useCallback(
    async (placaBruta: string, opts?: { forcar?: boolean }) => {
      const placa = normalizePlaca(placaBruta);
      if (placa.length < 7) return;
      if (!opts?.forcar && placa === ultimaPlaca.current) return;

      ultimaPlaca.current = placa;
      const minhaSequencia = ++sequencia.current;
      const souAtual = () => sequencia.current === minhaSequencia;

      setConsultando(true);
      setVersoes([]);
      setStatus(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const r = await consultarPlaca({
          data: {
            placa,
            caller_token: sess.session?.access_token ?? "",
            cotacaoId: cotacaoId ?? null,
            forcar: opts?.forcar ?? false,
          },
        });
        // Uma consulta mais nova (placa corrigida e reenviada) já assumiu
        // o hook enquanto esta esperava a API — não aplicar resposta stale.
        if (!souAtual()) return;
        if (r.ok && r.dados) {
          await aplicarDados(r.dados);
        } else if (r.parcial) {
          await aplicarParcial(r.parcial, r.mensagem || "Identificação parcial.");
        } else {
          setStatus({
            tipo: "erro",
            texto: r.mensagem || "Placa não identificada. Preencha os dados manualmente.",
          });
        }
      } catch (e) {
        if (!souAtual()) return;
        // Falha da consulta não bloqueia o wizard — o preenchimento manual continua valendo.
        ultimaPlaca.current = "";
        setStatus({
          tipo: "erro",
          texto: e instanceof Error ? e.message : "Falha ao consultar a placa.",
        });
      } finally {
        if (souAtual()) setConsultando(false);
      }
    },
    [aplicarDados, aplicarParcial, cotacaoId],
  );

  return { consultando, status, versoes, consultar, escolherVersao: aplicarVersao };
}
