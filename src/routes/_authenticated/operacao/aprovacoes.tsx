import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/operacao/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações · CoteCerto" }] }),
  component: Page,
});

// Placeholder até a frente G3 (desconto multinível). O item já aparece na nav do
// grupo marcado "EM FORMULAÇÃO"; esta rota evita 404 ao clicar.
function Page() {
  return (
    <AppShell title="Aprovações" crumbs="Grupo">
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Em formulação</h3>
        <p style={{ color: "var(--muted)" }}>
          A fila de Aprovações (pedidos de desconto do seu nível, com alçada e escalonamento) será
          entregue na frente G3. A navegação e a visibilidade por perfil já estão ativas.
        </p>
      </div>
    </AppShell>
  );
}
