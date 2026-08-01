// V11 · F9 — fila própria de aprovação da Franquia Full: só o pedido do
// vendedor vinculado a ELA (a RLS de F2 já restringe, via
// `empresas_fila_da_franquia`; aqui só listamos o que a query devolve).
//
// Bem mais magro que `useAcessosData` (a fila da Matriz): sem modelos de
// franquia/CLT, sem desligamentos, sem lista de superiores — o Full só
// analisa o vendedor da própria operação, que chega travado pelo convite
// (perfil='vendedor', vinc_tipo='full') e nunca passa pelos ramos de
// Master/Franquia do modal.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Pendente } from "../types";
import type { AprovarAcessoParams } from "@/components/acessos/classificar-acesso-modal";
import { fetchPendentes, mapPendentes } from "./pendentes-query";
import { dispatchAccessEmail } from "@/lib/email.functions";
import { findRetryableAccessEmail } from "@/lib/email-outbox-client";

export function useFilaFranquiaData(enabled = true) {
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState<Pendente | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);
  const [emailRetryOutboxId, setEmailRetryOutboxId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await fetchPendentes();
    if (error) setErr(error.message);
    setPendentes(mapPendentes(data));
    try {
      setEmailRetryOutboxId(await findRetryableAccessEmail());
    } catch (retryError) {
      setErr(retryError instanceof Error ? retryError.message : "Falha ao consultar e-mails.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [reload, enabled]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function openAnalisar(p: Pendente) {
    setAnalisando(p);
  }

  function closeModal() {
    setAnalisando(null);
  }

  async function enviarOutbox(outboxId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente.");
    await dispatchAccessEmail({ data: { outbox_id: outboxId, caller_token: token } });
  }

  async function retryEmail() {
    if (!emailRetryOutboxId) return;
    setBusy(true);
    try {
      await enviarOutbox(emailRetryOutboxId);
      setEmailRetryOutboxId(null);
      setToast({ msg: "E-mail enviado.", kind: "ok" });
      closeModal();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao reenviar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  async function solicitarPendencia(motivo: string) {
    if (!analisando) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: analisando.id,
      p_pendencia: motivo,
    });
    if (error || !data) {
      setBusy(false);
      setErr(error?.message ?? "Falha ao registrar a pendência.");
      return;
    }
    try {
      await enviarOutbox(String(data));
      setEmailRetryOutboxId(null);
      setToast({ msg: `Pendência enviada · ${analisando.nome}`, kind: "ok" });
      closeModal();
      await reload();
    } catch (e) {
      setEmailRetryOutboxId(String(data));
      setErr(
        `Pendência registrada, mas o e-mail não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function recusar(motivo: string) {
    if (!analisando) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("recusar_empresa", {
      p_empresa_id: analisando.id,
      motivo,
    });
    if (error || !data) {
      setBusy(false);
      setErr(error?.message ?? "A recusa não retornou a fila do e-mail.");
      return;
    }
    try {
      await enviarOutbox(String(data));
      setEmailRetryOutboxId(null);
      setToast({ msg: `Cadastro recusado e e-mail enviado · ${analisando.nome}`, kind: "alert" });
      closeModal();
      await reload();
    } catch (e) {
      setEmailRetryOutboxId(String(data));
      setErr(
        `Cadastro recusado, mas o e-mail não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function liberar(params: AprovarAcessoParams, persist: () => Promise<void>, tag: string) {
    if (!analisando) return;
    setBusy(true);
    const { data: outboxId, error } = await supabase.rpc("aprovar_acesso_com_boas_vindas", {
      p_empresa_id: analisando.id,
      p_perfil: params.perfil,
      p_cargo_id: params.cargoId ?? undefined,
      p_areas: params.areas && params.areas.length > 0 ? params.areas : undefined,
      p_produtos: params.produtos && params.produtos.length > 0 ? params.produtos : undefined,
      p_canais: params.canais && params.canais.length > 0 ? params.canais : undefined,
      p_superior_id: params.superiorId ?? undefined,
      p_reclassificado: params.reclassificado ?? false,
      p_motivo: params.motivo || undefined,
    });
    if (error || !outboxId) {
      setBusy(false);
      setErr(
        error
          ? `${error.message}${error.details ? ` · ${error.details}` : ""}${error.hint ? ` · ${error.hint}` : ""}`
          : "A aprovação não retornou a fila do e-mail de boas-vindas.",
      );
      return;
    }
    try {
      await persist();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Erro ao salvar a classificação.");
      await reload();
      return;
    }
    try {
      await enviarOutbox(String(outboxId));
    } catch (e) {
      setEmailRetryOutboxId(String(outboxId));
      setBusy(false);
      setErr(
        `Acesso aprovado, mas o e-mail de boas-vindas não foi enviado: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
      await reload();
      return;
    }
    setBusy(false);
    setToast({ msg: `Acesso liberado · ${analisando.nome}${tag} · e-mail enviado`, kind: "ok" });
    closeModal();
    await reload();
  }

  return {
    pendentes,
    loading,
    err,
    setErr,
    analisando,
    busy,
    toast,
    openAnalisar,
    closeModal,
    emailRetryPending: emailRetryOutboxId !== null,
    retryEmail,
    solicitarPendencia,
    recusar,
    liberar,
  };
}
