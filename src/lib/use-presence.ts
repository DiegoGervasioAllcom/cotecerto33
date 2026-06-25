import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

/**
 * Mantém o status de presença do usuário logado.
 * - Marca "online" ao montar e a cada 30s (heartbeat).
 * - Marca "ausente" quando a aba fica oculta.
 * - Marca "offline" ao desmontar / fechar a aba.
 * Também participa de um canal Realtime para detecção rápida via servidor.
 */
export function usePresence() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const lastStatus = useRef<string>("");

  useEffect(() => {
    if (!userId) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;

    const set = async (status: "online" | "ausente" | "offline") => {
      if (lastStatus.current === status) {
        // heartbeat — apenas refresca o last_seen_at
        await supabase.rpc("presence_set", { p_status: status, p_user_agent: ua });
        return;
      }
      lastStatus.current = status;
      await supabase.rpc("presence_set", { p_status: status, p_user_agent: ua });
    };

    // Estado inicial
    void set(document.visibilityState === "hidden" ? "ausente" : "online");

    // Heartbeat
    const hb = window.setInterval(() => {
      void set(document.visibilityState === "hidden" ? "ausente" : "online");
    }, 30_000);

    // Mudança de visibilidade
    const onVis = () => {
      void set(document.visibilityState === "hidden" ? "ausente" : "online");
    };
    document.addEventListener("visibilitychange", onVis);

    // Tentativa de marcar offline ao sair (best effort)
    const onLeave = () => {
      lastStatus.current = "offline";
      // Usa keepalive via fetch direto à RPC
      try {
        const url = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
        const key = (supabase as unknown as { supabaseKey?: string }).supabaseKey;
        if (url && key) {
          void fetch(`${url}/rest/v1/rpc/presence_set`, {
            method: "POST",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ p_status: "offline", p_user_agent: ua }),
          });
        }
      } catch {
        /* noop */
      }
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    // Canal de presença (opcional — útil pra futuras integrações realtime)
    const channel = supabase.channel("global-presence", {
      config: { presence: { key: userId } },
    });
    channel.on("presence", { event: "sync" }, () => { /* noop */ });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ user_id: userId, at: new Date().toISOString() });
      }
    });

    return () => {
      window.clearInterval(hb);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      void supabase.removeChannel(channel);
      void supabase.rpc("presence_set", { p_status: "offline", p_user_agent: ua });
      lastStatus.current = "offline";
    };
  }, [userId]);
}
