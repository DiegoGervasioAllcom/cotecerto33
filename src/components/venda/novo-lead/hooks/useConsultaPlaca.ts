import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { consultarPlaca } from "@/lib/placa.functions";
import { normalizePlaca } from "@/lib/masks";
import {
  normalizarCombustivel,
  type PlacaDecodificada,
  type PrecificadorFipe,
} from "@/lib/placa-decodificador";
import type { Form } from "../types";

export type StatusPlaca = { tipo: "ok" | "erro" | "aviso"; texto: string };

type Params = {
  setF: React.Dispatch<React.SetStateAction<Form>>;
  marcas: { codigo: string; nome: string }[];
  setModelos: React.Dispatch<React.SetStateAction<{ codigo: number; nome: string }[]>>;
  cotacaoId: string | null;
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
export function useConsultaPlaca({ setF, marcas, setModelos, cotacaoId }: Params) {
  const [consultando, setConsultando] = useState(false);
  const [status, setStatus] = useState<StatusPlaca | null>(null);
  const [versoes, setVersoes] = useState<PrecificadorFipe[]>([]);
  // Última placa consultada, para não repetir a chamada a cada blur do campo.
  const ultimaPlaca = useRef<string>("");

  const aplicarVersao = useCallback(
    async (v: PrecificadorFipe) => {
      setVersoes([]);
      const alvo = norm(v.marca);
      const marcaMatch =
        marcas.find((m) => norm(m.nome) === alvo) ??
        marcas.find((m) => norm(m.nome).includes(alvo) || alvo.includes(norm(m.nome)));

      if (!marcaMatch) {
        setStatus({
          tipo: "aviso",
          texto: `Dados preenchidos. Marca "${v.marca}" não está na lista FIPE — selecione marca e modelo manualmente.`,
        });
        return;
      }

      let lista: { codigo: number; nome: string }[] = [];
      try {
        const r = await fetch(
          `https://parallelum.com.br/fipe/api/v1/carros/marcas/${marcaMatch.codigo}/modelos`,
        );
        const j = await r.json();
        lista = j.modelos || [];
      } catch {
        /* sem lista: cai no aviso de seleção manual abaixo */
      }
      if (lista.length) setModelos(lista);

      const alvoModelo = norm(v.modelo);
      const modeloMatch =
        lista.find((m) => norm(m.nome) === alvoModelo) ??
        lista.find((m) => norm(m.nome).startsWith(alvoModelo));

      setF((p) => ({
        ...p,
        marca: marcaMatch.codigo,
        modelo: modeloMatch ? String(modeloMatch.codigo) : "",
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
    [marcas, setF, setModelos],
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
        combustivel:
          normalizarCombustivel(dados.fipe[0]?.modelo) ||
          normalizarCombustivel(dados.fipe[0]?.combustivel) ||
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
        if (r.ok && r.dados) {
          await aplicarDados(r.dados);
        } else {
          setStatus({
            tipo: "erro",
            texto: r.mensagem || "Placa não identificada. Preencha os dados manualmente.",
          });
        }
      } catch (e) {
        // Falha da consulta não bloqueia o wizard — o preenchimento manual continua valendo.
        ultimaPlaca.current = "";
        setStatus({
          tipo: "erro",
          texto: e instanceof Error ? e.message : "Falha ao consultar a placa.",
        });
      } finally {
        setConsultando(false);
      }
    },
    [aplicarDados, cotacaoId],
  );

  return { consultando, status, versoes, consultar, escolherVersao: aplicarVersao };
}
