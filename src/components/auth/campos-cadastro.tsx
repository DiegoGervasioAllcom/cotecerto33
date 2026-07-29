import { maskFor, type FieldDef } from "@/lib/cadastro-campos";

/**
 * Grade de campos do cadastro, no palco de auth (classes `auth-*` do protótipo).
 *
 * Compartilhada por `auth.cadastro.tsx` (cadastro direto, legado até a frente de
 * e-mail) e por `convite.$token.tsx` (V11 · C7). São as mesmas perguntas e o
 * mesmo visual; duplicar este JSX faria as duas telas divergirem na primeira
 * mudança de campo.
 */

const CAMPOS_NUMERICOS = ["documento", "socio_cpf", "socio_rg", "rg", "celular", "telefone_recado"];

export function CamposCadastro({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, valor: string) => void;
}) {
  return (
    <div className="auth-form">
      <div className="auth-grid">
        {fields.map((f) => (
          <div key={f.key} className={`auth-field${f.full ? " full" : ""}`}>
            <label>
              {f.label}
              {f.required && <span className="req"> *</span>}
            </label>
            <div className="auth-input">
              {f.type === "email" && (
                <svg style={{ width: 16, height: 16, color: "#7A8794", flex: "none" }}>
                  <use href="#i-mail" />
                </svg>
              )}
              {f.type === "password" && (
                <svg style={{ width: 16, height: 16, color: "#7A8794", flex: "none" }}>
                  <use href="#i-lock" />
                </svg>
              )}
              <input
                type={f.type}
                placeholder={f.ph || ""}
                required={f.required}
                minLength={f.type === "password" ? 6 : undefined}
                maxLength={f.maxLen}
                inputMode={CAMPOS_NUMERICOS.includes(f.key) ? "numeric" : undefined}
                value={values[f.key] || ""}
                onChange={(e) => onChange(f.key, maskFor(f.key, e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
