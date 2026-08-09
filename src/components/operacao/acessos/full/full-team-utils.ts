import type { FullTeamMember } from "./full-team";

export function fullTeamMemberMatches(
  membro: FullTeamMember,
  busca: string,
  equipe: string,
  ano: string,
) {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  if (
    termo &&
    !`${membro.nome} ${membro.email} ${membro.cpf ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo)
  )
    return false;
  if (equipe && (membro.equipe ?? "—") !== equipe) return false;
  if (ano && membro.desde !== ano) return false;
  return true;
}
