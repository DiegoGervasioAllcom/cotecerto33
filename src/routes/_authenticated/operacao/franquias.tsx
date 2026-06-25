import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/franquias")({
  head: () => ({ meta: [{ title: "Franquias · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Franquias">
      <ProtoPage pageKey="mfranq" />
    </AppShell>
  );
}
