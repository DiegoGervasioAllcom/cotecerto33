import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/comando/distribuicao")({
  head: () => ({ meta: [{ title: "Distribuição · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Distribuição">
      <ProtoPage pageKey="mdist" />
    </AppShell>
  );
}
