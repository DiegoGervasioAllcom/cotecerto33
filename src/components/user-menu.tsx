// Menu do usuário no topbar (avatar + nome) — abre um dropdown com atalhos
// de acessibilidade (fonte, alto contraste), link de configurações (Matriz) e sair.
// Reaproveita as classes `.user-menu`/`.um-*` já existentes em src/styles/proto.css.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, Settings, LogOut } from "lucide-react";
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

export function UserMenu({
  profile,
  empresa,
  role,
  brandLabel,
  onSignOut,
}: {
  profile: Profile | null;
  empresa: Empresa | null;
  role: Perfil | null;
  brandLabel: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [highContrast, setHighContrast] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedFont = (localStorage.getItem(FONT_SIZE_KEY) as FontSize | null) ?? "md";
    setFontSize(savedFont);
    setHighContrast(localStorage.getItem(HIGH_CONTRAST_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

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
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="user-cluster"
        onClick={() => setOpen((v) => !v)}
        title="Menu do usuário"
      >
        <div className="user-info">
          <div className="nm">{profile?.nome ?? "Usuário"}</div>
          <div className="co">
            {empresa?.nome ?? "—"} · {brandLabel}
          </div>
        </div>
        <div className="avatar">{initials(profile?.nome)}</div>
      </button>

      {open && (
        <div
          className="user-menu"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0 }}
        >
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
    </div>
  );
}
