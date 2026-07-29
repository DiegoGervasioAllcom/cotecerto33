import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Escopo de áreas do time interno da Matriz (H4 da hierarquia V11).
 *
 * As chaves são as mesmas do protótipo V11 (`MATRIZ_AREAS`: mdash, mleads, ...),
 * de propósito — assim o front não traduz nomes entre banco e protótipo.
 *
 * NÃO é segurança. Igual ao `canSee` que ele substitui, isto recorta o menu; o
 * que decide acesso a dado é a policy (regra 7 do AGENTS.md). A resolução real
 * mora em `fn_areas_do_usuario`: override da pessoa se existir, senão o preset
 * do cargo, e Matriz sempre vê todas.
 */
export type AreaChave =
  | "mdash"
  | "mleads"
  | "mdist"
  | "maprov"
  | "mfranq"
  | "mvend"
  | "msuperv"
  | "mpipe"
  | "mvendas"
  | "mcomm"
  | "mprem"
  | "mestorno"
  | "mren"
  | "mrel"
  | "mmsgs"
  | "macessos"
  | "mconf";

export interface AreasEscopo {
  /** true enquanto as áreas ainda não chegaram — não renderizar nav ainda. */
  loading: boolean;
  /** Áreas efetivas do usuário. Vazio para quem não é do time interno. */
  areas: Set<string>;
  /** Atalho de leitura. Sempre false enquanto `loading`. */
  temArea: (chave: AreaChave) => boolean;
}

/**
 * Perfis que recortam menu por área. Rede externa (master, franqueado,
 * vendedor) tem nav própria e não passa por cargo — para eles o hook resolve
 * imediatamente com conjunto vazio, sem ida ao banco.
 */
const PERFIS_INTERNOS = new Set(["matriz", "coordenador", "supervisor"]);

export function useAreas(): AreasEscopo {
  const { role, session } = useAuth();
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const ehInterno = !!role && PERFIS_INTERNOS.has(role);
  const [loading, setLoading] = useState(ehInterno);

  useEffect(() => {
    let active = true;

    if (!ehInterno || !session?.user?.id) {
      setAreas(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase.rpc("fn_areas_do_usuario", { _user_id: session.user.id }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        // Falha de rede/policy: conjunto vazio é o lado seguro — some menu,
        // não aparece menu que a pessoa não deveria ver.
        setAreas(new Set());
      } else {
        setAreas(new Set((data ?? []).map((r) => r.area_chave)));
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [ehInterno, session?.user?.id]);

  return {
    loading,
    areas,
    temArea: (chave: AreaChave) => !loading && areas.has(chave),
  };
}
