// Rótulo do veículo a partir do JSON `dados` de um lead.
// Compartilhado entre telas (atender, distribuição) para leitura consistente.
// O veículo pode vir aninhado em `dados.veiculo` ou direto na raiz de `dados`,
// com nomes canônicos (marca_nome/…) ou legados (marca/…).

export function veiculoLabel(d: Record<string, unknown> | null): string {
  if (!d) return "—";
  const v = (d.veiculo as Record<string, unknown> | undefined) ?? d;
  const marca = v?.marca_nome ?? v?.marca ?? "";
  const modelo = v?.modelo_nome ?? v?.modelo ?? "";
  const ano = v?.ano_modelo ?? v?.ano ?? "";
  const cor = v?.cor ?? "";
  const head = [marca, modelo, ano].filter(Boolean).join(" ");
  return [head, cor].filter(Boolean).join(" · ") || "—";
}
