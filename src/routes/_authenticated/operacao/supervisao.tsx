import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/supervisao")({
  head: () => ({ meta: [{ title: "Supervisão · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Supervisão">
      <ProtoPage pageKey="msuperv" />
    </AppShell>
  );
}
