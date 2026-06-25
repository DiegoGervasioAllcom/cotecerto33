import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/cotacoes")({
  head: () => ({ meta: [{ title: "Cotações · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Cotações">
      <ProtoPage pageKey="compare" />
    </AppShell>
  );
}
