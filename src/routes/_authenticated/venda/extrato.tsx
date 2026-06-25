import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/extrato")({
  head: () => ({ meta: [{ title: "Extrato de vendas · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Extrato de vendas">
      <ProtoPage pageKey="extrato" />
    </AppShell>
  );
}
