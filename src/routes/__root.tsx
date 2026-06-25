import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth";

function NotFoundComponent() {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h3>Página não encontrada</h3>
        <p className="lead">O endereço acessado não existe ou foi movido.</p>
        <Link to="/" className="auth-btn" style={{ display: "inline-block" }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h3>Não foi possível carregar esta página</h3>
        <p className="lead">{error.message || "Tente novamente em instantes."}</p>
        <button
          className="auth-btn"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CoteCerto 3.3" },
      { name: "description", content: "Plataforma de gestão de vendas de seguros para franquias." },
      { name: "author", content: "CoteCerto" },
      { property: "og:title", content: "CoteCerto 3.3" },
      { property: "og:description", content: "Plataforma de gestão de vendas de seguros para franquias." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "CoteCerto 3.3" },
      { name: "twitter:description", content: "Plataforma de gestão de vendas de seguros para franquias." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0a6625b7-ce50-4e0c-92ad-34acf1c3c73d/id-preview-0d3f2ea5--3b3f8ee7-b01c-4be4-8a01-3ef73f063d48.lovable.app-1782419526515.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0a6625b7-ce50-4e0c-92ad-34acf1c3c73d/id-preview-0d3f2ea5--3b3f8ee7-b01c-4be4-8a01-3ef73f063d48.lovable.app-1782419526515.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&family=Kalam:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
