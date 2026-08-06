// Rótulo do veículo a partir do JSON `dados` de um lead.
// Compartilhado entre telas (atender, distribuição) para leitura consistente.
// O veículo pode vir aninhado em `dados.veiculo` ou direto na raiz de `dados`,
// com nomes canônicos (marca_nome/…) ou legados (marca/…).

function textPart(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectLabel(v: Record<string, unknown>): string {
  const marca = textPart(v.marca_nome ?? v.marca ?? v.veiculo_marca);
  const modelo = textPart(v.modelo_nome ?? v.modelo ?? v.veiculo_modelo);
  const ano = textPart(v.ano_modelo ?? v.ano ?? v.veiculo_ano);
  const cor = textPart(v.cor);
  const head = [marca, modelo, ano].filter(Boolean).join(" ");
  return [head, cor].filter(Boolean).join(" · ");
}

export function veiculoLabel(d: Record<string, unknown> | null): string {
  if (!d) return "—";

  const flattened = objectLabel({
    veiculo_marca: d.veiculo_marca,
    veiculo_modelo: d.veiculo_modelo,
    veiculo_ano: d.veiculo_ano,
  });
  if (flattened) return flattened;

  if (isRecord(d.veiculo)) return objectLabel(d.veiculo) || "—";

  const legacyText = textPart(d.veiculo);
  if (legacyText) return legacyText;

  return objectLabel(d) || "—";
}
