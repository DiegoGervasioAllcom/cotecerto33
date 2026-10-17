// Módulo compartilhado (cliente + servidor): telefone FIXO (residencial/comercial) da
// Efetivação da Porto. O portal preenche esses campos com uma cópia do celular e a
// Porto recusa a venda no "Confirmar" (telefones[n].numero inválido para o tipo) —
// por isso aceitamos só fixo de verdade ou deixamos em branco. Espelha a validação
// do robô (`telefoneResidencial` / `telefoneComercial` em POST /transmissao).

export type TelefoneFixo = { ddd: string; numero: string };

// Aceita `unknown`: a entrada da função de servidor é só um cast de tipo, então um valor
// que não seja texto vira "" (campo vazio) em vez de lançar TypeError.
function digitos(valor: unknown): string {
  return typeof valor === "string" ? valor.replace(/\D/g, "") : "";
}

/** "33334444" -> "3333-4444" (até 8 dígitos). */
export function mascararTelefoneFixo(valor: string): string {
  const d = digitos(valor).slice(0, 8);
  return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
}

/** "11" -> "11" (só dígitos, até 2). */
export function mascararDdd(valor: string): string {
  return digitos(valor).slice(0, 2);
}

/**
 * Valida o par DDD + número. Os dois vazios = tudo certo (campo opcional: o robô
 * limpa o celular copiado pelo portal). Devolve a mensagem de erro, ou `null`.
 * A mensagem nunca repete o valor digitado.
 */
export function erroTelefoneFixo(
  ddd: string | undefined,
  numero: string | undefined,
  rotulo: string,
): string | null {
  const d = digitos(ddd);
  const n = digitos(numero);
  if (!d && !n) return null;
  if (!/^\d{2}$/.test(d))
    return `Informe o DDD (2 dígitos) do telefone ${rotulo}, ou deixe em branco.`;
  if (n.length === 9 || (n.length > 0 && n.startsWith("9"))) {
    return `O telefone ${rotulo} precisa ser fixo: celular não é aceito. Informe um fixo ou deixe em branco.`;
  }
  if (!/^[2-5]\d{7}$/.test(n)) {
    return `Informe o telefone ${rotulo} com 8 dígitos (fixo), ou deixe em branco.`;
  }
  return null;
}

/** Par válido e preenchido -> objeto do payload; vazio ou inválido -> `undefined`. */
export function telefoneFixoPayload(
  ddd: string | undefined,
  numero: string | undefined,
): TelefoneFixo | undefined {
  if (erroTelefoneFixo(ddd, numero, "") !== null) return undefined;
  const d = digitos(ddd);
  const n = digitos(numero);
  return d && n ? { ddd: d, numero: n } : undefined;
}
