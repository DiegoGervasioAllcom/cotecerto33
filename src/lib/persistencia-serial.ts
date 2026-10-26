/**
 * Serializa gravações assíncronas: chamadas concorrentes reaproveitam a que
 * está em andamento (evita dois `salvar_cotacao_rascunho` com id nulo). Com
 * `reusar: false` espera a atual terminar e então executa a sua.
 */
export function criarPersistenciaSerial() {
  let emAndamento: Promise<boolean> | null = null;
  return async function executar(fn: () => Promise<boolean>, reusar = true): Promise<boolean> {
    while (emAndamento) {
      if (reusar) return emAndamento;
      await emAndamento.catch(() => undefined);
    }
    const p = fn().finally(() => {
      if (emAndamento === p) emAndamento = null;
    });
    emAndamento = p;
    return p;
  };
}

/** Grava e só então avança; devolve false (sem avançar) se a gravação falhar. */
export async function salvarEAvancar(
  persistir: () => Promise<boolean>,
  avancar: () => void,
): Promise<boolean> {
  const ok = await persistir().catch(() => false);
  if (ok) avancar();
  return ok;
}
