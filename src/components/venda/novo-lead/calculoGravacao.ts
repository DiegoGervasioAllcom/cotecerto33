export const MSG_FALHA_GRAVAR =
  "Não foi possível salvar a cotação antes de calcular. Verifique a conexão e tente de novo.";

/**
 * O servidor lê do banco o que a Quiver vai receber; se a gravação do rascunho
 * falhar (retorno `false` ou exceção), o Calcular NÃO pode seguir — enviaria
 * dados antigos ao robô. Devolve `true` só quando gravou.
 */
export async function gravouAntesDeCalcular(
  persistir: (overrides?: { seguradorasSel?: string[] }) => Promise<boolean>,
  overrides?: { seguradorasSel?: string[] },
): Promise<boolean> {
  try {
    return (await persistir(overrides)) === true;
  } catch {
    return false;
  }
}
