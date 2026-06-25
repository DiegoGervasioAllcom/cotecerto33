import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProtoPage } from "@/components/proto-page";

export const Route = createFileRoute("/_authenticated/operacao/pipeline-geral")({
  head: () => ({ meta: [{ title: "Pipeline geral · CoteCerto" }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Pipeline geral">
      <ProtoPage pageKey="mpipe" />
    </AppShell>
  );
}
