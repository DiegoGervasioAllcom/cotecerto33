// Menu do usuário — vive no rodapé da sidebar (bloco "side-user" + sino),
// igual ao protótipo: clicar no bloco abre um dropdown fixed ancorado acima
// dele (ver toggleUserMenu() no protótipo v10) com atalhos de acessibilidade
// (fonte, alto contraste), link de configurações (Matriz) e sair.
// Reaproveita as classes `.side-user`/`.side-bell`/`.user-menu`/`.um-*` já
// existentes em src/styles/proto.css.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, Settings, LogOut, Bell } from "lucide-react";
import type { Empresa, Perfil, Profile } from "@/integrations/supabase/client";

const FONT_SIZE_KEY = "cotecerto:fontSize";
const HIGH_CONTRAST_KEY = "cotecerto:highContrast";

type FontSize = "sm" | "md" | "lg";

/**
 * Aplica o tamanho de fonte preferido via classe no <html> usando `zoom`.
 * `zoom` é suportado em Chromium/Safari mas não é padrão CSS (Firefox não
 * suporta) — limitação conhecida e aceita, já que o design system usa `px`
 * fixo e um `font-size` no root não cascatearia para os elementos.
 */
function applyFontSize(size: FontSize) {
  const root = document.documentElement;
  root.classList.remove("font-sm", "font-md", "font-lg");
  if (size !== "md") root.classList.add(`font-${size}`);
}

// Reaproveita a regra `body.hc` já definida em proto.css (ajusta --muted/
// --border-soft/--offwhite/--soft-bg para um contraste mais definido).
function applyHighContrast(on: boolean) {
  document.body.classList.toggle("hc", on);
}

/** Lê as preferências salvas e as aplica ao montar o app-shell. */
export function useAccessibilityPrefs() {
  useEffect(() => {
    const savedFont = (localStorage.getItem(FONT_SIZE_KEY) as FontSize | null) ?? "md";
    applyFontSize(savedFont);
    const savedContrast = localStorage.getItem(HIGH_CONTRAST_KEY) === "1";
    applyHighContrast(savedContrast);
  }, []);
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function SidebarUserMenu({
  profile,
  empresa,
  role,
  brandLabel,
  isFranqIndividual,
  onSignOut,
}: {
  profile: Profile | null;
  empresa: Empresa | null;
  role: Perfil | null;
  brandLabel: string;
  isFranqIndividual: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [highContrast, setHighContrast] = useState(false);
  const [popStyle, setPopStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedFont = (localStorage.getItem(FONT_SIZE_KEY) as FontSize | null) ?? "md";
    setFontSize(savedFont);
    setHighContrast(localStorage.getItem(HIGH_CONTRAST_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popRef.current &&
        !popRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleToggle() {
    setOpen((v) => {
      const next = !v;
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setPopStyle({
          left: r.left,
          bottom: window.innerHeight - r.top + 8,
          width: r.width,
        });
      }
      return next;
    });
  }

  function handleFontSize(size: FontSize) {
    setFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  }

  function handleHighContrast(v: boolean) {
    setHighContrast(v);
    localStorage.setItem(HIGH_CONTRAST_KEY, v ? "1" : "0");
    applyHighContrast(v);
  }

  return (
    <>
      <div ref={triggerRef} className="side-user" onClick={handleToggle} title="Sua conta">
        <div className="avatar">{initials(profile?.nome)}</div>
        <div className="who">
          {profile?.nome ?? "Usuário"}
          {isFranqIndividual && " · individual"}
          <small>{brandLabel}</small>
        </div>
        <button
          type="button"
          className="side-bell"
          title="Notificações"
          onClick={(e) => e.stopPropagation()}
        >
          <Bell style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {open && (
        <div ref={popRef} className="user-menu" style={popStyle}>
          <div className="um-head">
            <div className="um-av">{initials(profile?.nome)}</div>
            <div>
              <div className="um-name">{profile?.nome ?? "Usuário"}</div>
              <div className="um-role">
                {empresa?.nome ?? "—"} · {brandLabel}
              </div>
            </div>
          </div>

          <div
            className="um-item"
            onClick={() => {
              setProfileOpen(true);
              setOpen(false);
            }}
          >
            <User />
            <span>Meu perfil</span>
          </div>

          <div className="um-acc">
            <div className="um-acc-row">
              <span>Tamanho da fonte</span>
              <div className="um-fs">
                <button
                  type="button"
                  className={fontSize === "sm" ? "on" : ""}
                  onClick={() => handleFontSize("sm")}
                >
                  A-
                </button>
                <button
                  type="button"
                  className={fontSize === "md" ? "on" : ""}
                  onClick={() => handleFontSize("md")}
                >
                  A
                </button>
                <button
                  type="button"
                  className={fontSize === "lg" ? "on" : ""}
                  onClick={() => handleFontSize("lg")}
                >
                  A+
                </button>
              </div>
            </div>
            <div className="um-acc-row">
              <span>Alto contraste</span>
              <span
                className={`switch ${highContrast ? "on" : ""}`}
                role="switch"
                aria-checked={highContrast}
                onClick={() => handleHighContrast(!highContrast)}
                style={{ cursor: "pointer" }}
              >
                <span className="track" />
              </span>
            </div>
          </div>

          {role === "matriz" && (
            <>
              <div className="um-div" />
              <div
                className="um-item"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/operacao/configuracoes" });
                }}
              >
                <Settings />
                <span>Configurações</span>
              </div>
            </>
          )}

          <div className="um-div" />
          <div
            className="um-item danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut />
            <span>Sair</span>
          </div>
        </div>
      )}

      {profileOpen && (
        <div
          className="modal-host"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileOpen(false);
          }}
        >
          <div className="modal">
            <div className="modal-h">
              <h3>Meu perfil</h3>
              <div className="x" onClick={() => setProfileOpen(false)}>
                ×
              </div>
            </div>
            <div className="modal-b">
              <div className="field-group">
                <label>Nome</label>
                <div className="input" style={{ background: "var(--offwhite)" }}>
                  {profile?.nome ?? "—"}
                </div>
              </div>
              <div className="field-group">
                <label>E-mail</label>
                <div className="input" style={{ background: "var(--offwhite)" }}>
                  {profile?.email ?? "—"}
                </div>
              </div>
              <div className="field-group">
                <label>Empresa</label>
                <div className="input" style={{ background: "var(--offwhite)" }}>
                  {empresa?.nome ?? "—"}
                </div>
              </div>
              <div className="field-group">
                <label>Perfil</label>
                <span className="tag">{brandLabel}</span>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-yellow" onClick={() => setProfileOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
