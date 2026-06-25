import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Pipeline">
      <ProtoPage pageKey="pipeline" />
    </AppShell>
  );
}
