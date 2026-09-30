// Selo "personalizada" (V12.3.7) — só quando o ajuste da seguradora já foi
// aplicado no último envio (`aplicado_em` preenchido). Ajuste guardado mas não
// aplicado não ganha selo. Classe existente do proto.css (`.chip`).
import { useAjustesSeguradora } from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";

export function SeloPersonalizada({
  cotacaoId,
  seguradora,
}: {
  cotacaoId: string | null;
  seguradora: string;
}) {
  const ajuste = useAjustesSeguradora(cotacaoId)[seguradora];
  if (!ajuste?.aplicadoEm) return null;
  return (
    <span
      className="chip chip-info"
      data-testid="selo-personalizada"
      title="Calculada com coberturas ajustadas só para esta seguradora"
    >
      personalizada
    </span>
  );
}
