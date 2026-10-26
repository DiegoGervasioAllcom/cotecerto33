import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Props = { titulo: string; children: ReactNode };

/** Casca do mini-app mobile: coluna única, header e barra inferior fixa. */
export function MobileShell({ titulo, children }: Props) {
  return (
    <div className="m-app">
      <header className="m-header">{titulo}</header>
      <main className="m-main">{children}</main>
      <nav className="m-tabbar" aria-label="Navegação">
        <Link to="/m/cotacoes" className="m-tab" activeProps={{ className: "m-tab on" }}>
          Cotações
        </Link>
        <Link to="/m/cotar" className="m-tab" activeProps={{ className: "m-tab on" }}>
          Cotar
        </Link>
        <Link to="/m/menu" className="m-tab" activeProps={{ className: "m-tab on" }}>
          Menu
        </Link>
      </nav>
    </div>
  );
}

export function MobileEstado({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return <div className={erro ? "m-state err" : "m-state"}>{children}</div>;
}
