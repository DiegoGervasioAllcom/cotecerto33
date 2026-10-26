import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/mobile/MobileShell";
import { CotarWizard } from "@/components/mobile/cotar/CotarWizard";

export const Route = createFileRoute("/_authenticated/m/cotar")({ component: CotarMobile });

function CotarMobile() {
  return (
    <MobileShell titulo="Cotar">
      <CotarWizard />
    </MobileShell>
  );
}
