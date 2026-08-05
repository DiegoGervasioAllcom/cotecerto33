import type { Empresa, Perfil, Profile } from "@/integrations/supabase/client";
import type { TutorialKind, TutorialPersona } from "./tutorial-types";

type TutorialPersonaInput = {
  role: Perfil | null;
  profile?: Profile | null;
  empresa?: Empresa | null;
  isGroupView: boolean;
  isFranqIndividual: boolean;
  scopeLoading: boolean;
};

/** Espelha as seis experiências do mapa de perfis; o carregamento da franquia não exibe roteiro. */
export function resolveTutorialKind({
  role,
  isGroupView,
  isFranqIndividual,
  scopeLoading,
}: TutorialPersonaInput): TutorialKind | null {
  if (role === "matriz") return "matriz";
  if (role === "franqueado" && scopeLoading) return null;
  if (role === "vendedor" || (role === "franqueado" && isFranqIndividual)) return "sales";
  // supervisor é sempre um dos 3 cargos internos (H1-H8) e por isso saiu de
  // `isGroupView` (não supervisiona franquia) — mas o roteiro de tutorial
  // dele é independente disso e continua com copy própria abaixo.
  if (role === "supervisor") return "group";
  return isGroupView ? "group" : null;
}

function firstName(name: string | null | undefined, fallback: string) {
  return name?.trim().split(/\s+/)[0] || fallback;
}

/** Aberturas das seis personas, seguindo `curTourCfg()` do protótipo V10. */
export function resolveTutorialPersona(input: TutorialPersonaInput): TutorialPersona | null {
  const kind = resolveTutorialKind(input);
  if (!kind) return null;

  if (input.role === "matriz") {
    const name = firstName(input.profile?.nome, "Ana");
    return {
      kind,
      avatar: "C",
      guideName: "CoteCerto",
      eyebrow: "TUTORIAL · CENTRO DE COMANDO DA MATRIZ",
      title: `Olá, ${name}! Vou te mostrar o sistema`,
      intro:
        "Sou o assistente do CoteCerto e vou te guiar pela área da Matriz. Cada capítulo dura poucos minutos — comece do início ou pule pro que quiser.",
    };
  }

  if (input.role === "master") {
    const name = firstName(input.profile?.nome, "Douglas");
    return {
      kind,
      avatar: name[0].toUpperCase(),
      guideName: "CoteCerto",
      eyebrow: "TUTORIAL · ÁREA DO MASTER FRANQUEADO",
      title: `Olá, ${name}! Vou te mostrar a sua área`,
      intro:
        "Sou o assistente do CoteCerto e vou te guiar pela sua área de master franqueado — onde você acompanha só a sua equipe. Cada capítulo dura poucos minutos; comece do início ou pule pro que quiser.",
    };
  }

  if (input.role === "supervisor") {
    const name = firstName(input.profile?.nome, "Paula");
    return {
      kind,
      avatar: name[0].toUpperCase(),
      guideName: "CoteCerto",
      eyebrow: "TUTORIAL · ÁREA DO SUPERVISOR (MATRIZ)",
      title: `Olá, ${name}! Vou te mostrar a sua área`,
      intro:
        "Sou o assistente do CoteCerto e vou te guiar pela sua área de supervisão — você acompanha as franquias sob sua responsabilidade. Cada capítulo dura poucos minutos.",
    };
  }

  if (input.role === "franqueado" && input.isFranqIndividual) {
    const name = firstName(input.profile?.nome ?? input.empresa?.nome, "Felipe");
    return {
      kind,
      avatar: name[0].toUpperCase(),
      guideName: "CoteCerto",
      eyebrow: "TUTORIAL · ÁREA DA FRANQUIA (INDIVIDUAL)",
      title: `Olá, ${name}! Vou te mostrar a sua área`,
      intro:
        "Sua franquia opera como um vendedor: você atende leads, faz cotações e acompanha os seus resultados. Cada capítulo dura poucos minutos; comece do início ou pule pro que quiser.",
    };
  }

  if (input.role === "franqueado") {
    const name = firstName(input.profile?.nome ?? input.empresa?.nome, "Marcelo");
    return {
      kind,
      avatar: name[0].toUpperCase(),
      guideName: "CoteCerto",
      eyebrow: "TUTORIAL · ÁREA DO FRANQUEADO",
      title: `Olá, ${name}! Vou te mostrar a sua área`,
      intro:
        "Sou o assistente do CoteCerto e vou te guiar pela área da sua franquia — seus vendedores, seu pipeline e o resultado da unidade. Cada capítulo dura poucos minutos.",
    };
  }

  return {
    kind,
    avatar: "R",
    guideName: "Rafinha",
    eyebrow: "TUTORIAL · A PRIMEIRA SEMANA DA RAFINHA",
    title: "Aprenda o CoteCerto comigo",
    intro:
      "Sou a Rafinha. Vou te acompanhar pelos capítulos do tutorial, organizados em módulos. Cada um dura entre 3 e 6 minutos. Você pode começar do início ou pular pro que quiser.",
  };
}
