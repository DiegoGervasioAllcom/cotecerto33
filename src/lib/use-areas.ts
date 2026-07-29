import { useQuery } from "@tanstack/react-query";
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
  /**
   * Nome do cargo (ex.: "Supervisor de Vendas"). O protótipo identifica o time
   * interno pelo cargo, não pelo perfil — dois cargos diferentes moram no mesmo
   * perfil, então o perfil não serve de rótulo. NULL para a rede externa.
   */
  cargoNome: string | null;
}

/**
 * Perfis que recortam menu por área. Rede externa (master, franqueado,
 * vendedor) tem nav própria e não passa por cargo — para eles o hook resolve
 * imediatamente com conjunto vazio, sem ida ao banco.
 */
const PERFIS_INTERNOS = new Set(["matriz", "coordenador", "supervisor", "interno"]);

/**
 * Time interno da Matriz: menu recortado por área e home em /comando/visao-geral
 * (não em /inicio, que é a home de venda).
 *
 * Vive aqui e é usado pelo `app-shell`, por `/inicio` e pela raiz. Estava
 * repetido nos quatro e a lista divergiu quando `interno` entrou — o perfil novo
 * ganhava o menu certo e continuava caindo na home de venda.
 */
export function ehPerfilInterno(role: string | null | undefined): boolean {
  return !!role && PERFIS_INTERNOS.has(role);
}

/**
 * Escopo e cargo do usuário, buscados UMA vez por sessão.
 *
 * Usa react-query de propósito, não `useEffect`: o `AppShell` remonta a cada
 * navegação, e com efeito local o mesmo RPC disparava a cada troca de tela — um
 * E2E do tutorial pegou 6 chamadas idênticas num único fluxo. Cargo e áreas só
 * mudam quando a Matriz reclassifica o acesso, então cache longo é correto aqui;
 * o `queryKey` por uid invalida sozinho na troca de usuário.
 */
export function useAreas(): AreasEscopo {
  const { role, session } = useAuth();
  const ehInterno = ehPerfilInterno(role);
  const uid = session?.user?.id ?? null;

  const { data, isPending } = useQuery({
    queryKey: ["areas-cargo", uid],
    enabled: ehInterno && !!uid,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const [res, perfilRes] = await Promise.all([
        supabase.rpc("fn_areas_do_usuario", { _user_id: uid! }),
        supabase.from("profiles").select("cargos(nome)").eq("id", uid!).maybeSingle(),
      ]);
      // Falha de rede/policy: conjunto vazio é o lado seguro — some menu, não
      // aparece menu que a pessoa não deveria ver.
      const chaves = res.error ? [] : (res.data ?? []).map((r) => r.area_chave);
      const cargo = perfilRes.data?.cargos as { nome: string } | null | undefined;
      return { chaves, cargoNome: cargo?.nome ?? null };
    },
  });

  const areas = new Set<string>(data?.chaves ?? []);
  const cargoNome = data?.cargoNome ?? null;
  // Rede externa não consulta nada, então nunca fica "carregando".
  const loading = ehInterno && !!uid && isPending;

  return {
    loading,
    areas,
    cargoNome,
    temArea: (chave: AreaChave) => !loading && areas.has(chave),
  };
}
