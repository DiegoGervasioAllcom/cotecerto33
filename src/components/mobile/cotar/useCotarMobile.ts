import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCepLookup } from "@/components/venda/novo-lead/hooks/useCepLookup";
import { useConsultaCpf } from "@/components/venda/novo-lead/hooks/useConsultaCpf";
import { useConsultaPlaca } from "@/components/venda/novo-lead/hooks/useConsultaPlaca";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import { useFipe } from "@/components/venda/novo-lead/hooks/useFipe";
import { useSimulacaoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useValidacaoEtapas } from "@/components/venda/novo-lead/hooks/useValidacaoEtapas";
import type { Form } from "@/components/venda/novo-lead/types";
import { salvarEAvancar } from "@/lib/persistencia-serial";
import { aplicarRamo, formPadraoMobile, type RamoMobile } from "./defaults";
import { faltantesDoPasso, PASSOS, STEP_DESKTOP } from "./passos";

/** Estado + integrações do wizard mobile; reaproveita os hooks do desktop. */
export function useCotarMobile() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState<Form>(() => formPadraoMobile());
  const [erroPasso, setErroPasso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const { cepLoading, lookupCep } = useCepLookup(setF);
  const fipe = useFipe(f.marca, f.modelo, f.anoModelo, f.combustivel, f.ramo);
  const { marcas, setMarcas, modelos, setModelos, fipeValor, setFipeValor } = fipe;
  const { erros, validarEtapa } = useValidacaoEtapas(f, marcas, modelos, fipeValor);

  const [stepDesktop, setStepDesktop] = useState(0);
  const { cotacaoId, persistir, loading } = useCotacaoRascunho({
    f,
    setF,
    step: stepDesktop,
    setStep: setStepDesktop,
    marcas,
    setMarcas,
    modelos,
    setModelos,
    fipeValor,
    setFipeValor,
    routeId: undefined,
    routeStep: undefined,
  });
  const placa = useConsultaPlaca({
    setF,
    marcas,
    setModelos,
    cotacaoId,
    placaAtual: f.placa,
    carregandoRascunho: loading,
    veiculoJaResolvido: !!f.marca,
    ramo: f.ramo,
  });
  const cpf = useConsultaCpf({ setF, cotacaoId });
  const calculo = useSimulacaoCalculo(f, cotacaoId, persistir);

  useEffect(() => setStepDesktop(STEP_DESKTOP[passo] ?? 0), [passo]);

  function onRamo(r: RamoMobile) {
    setF((p) => aplicarRamo(p, r));
  }

  /** Valida o passo atual (zod do desktop + gate), persiste o rascunho e avança. */
  async function avancar() {
    const faltam = faltantesDoPasso(passo, f);
    const etapaDesktop = [0, 2, undefined, undefined, undefined][passo];
    const okZod = etapaDesktop === undefined ? true : validarEtapa(etapaDesktop);
    if (faltam.length > 0) {
      setErroPasso(`Preencha: ${faltam.join(", ")}.`);
      return;
    }
    if (!okZod) {
      setErroPasso("Revise os campos destacados.");
      return;
    }
    setErroPasso(null);
    setSalvando(true);
    const ok = await salvarEAvancar(persistir, () =>
      setPasso((p) => Math.min(p + 1, PASSOS.length - 1)),
    );
    setSalvando(false);
    if (!ok) setErroPasso("Não foi possível salvar o rascunho. Tente novamente.");
  }

  function voltar() {
    setErroPasso(null);
    setPasso((p) => Math.max(p - 1, 0));
  }

  /** Dispara o cálculo e leva o usuário ao detalhe (que mostra o progresso). */
  async function calcular() {
    if (!calculo.podeCalcular) {
      setErroPasso(`Falta: ${calculo.camposFaltantes.join(", ")}.`);
      return;
    }
    setErroPasso(null);
    await calculo.simularCalculo();
    if (!cotacaoId) {
      setErroPasso("Não foi possível iniciar o cálculo. Tente novamente.");
      return;
    }
    const { data } = await supabase
      .from("cotacoes")
      .select("status")
      .eq("id", cotacaoId)
      .maybeSingle();
    if (data?.status === "enviada_quiver" || data?.status === "calculada") {
      void navigate({ to: "/m/cotacoes/$id", params: { id: cotacaoId } });
    } else {
      setErroPasso("O cálculo não foi iniciado. Verifique os dados e tente novamente.");
    }
  }

  return {
    passo,
    f,
    up,
    erros,
    erroPasso,
    salvando,
    avancar,
    voltar,
    calcular,
    onRamo,
    cepLoading,
    lookupCep,
    cpf,
    placa,
    marcas,
    modelos,
    fipeValor,
    calculo,
  };
}
