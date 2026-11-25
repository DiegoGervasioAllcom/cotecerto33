import type { ReactNode } from "react";
import simboloAmarelo from "@/assets/cc-simbolo-amarelo.png";
import simboloCinza from "@/assets/cc-simbolo-cinza.png";

/**
 * Casca visual do loader do protótipo V12 (`ccEspera`: símbolo com onda
 * amarela, título, subtítulo e lista de passos), compartilhada entre o
 * cálculo e a transmissão. Inline (sem overlay): o `.cc-load` do protótipo é
 * `position: fixed`, então o inline style devolve o container ao fluxo.
 * `atual` é 1-based: passos anteriores ficam "ok", o atual "agora".
 */
export function PassosEspera({
  titulo,
  subtitulo,
  passos,
  atual,
  rodape,
}: {
  titulo: string;
  subtitulo: string;
  passos: string[];
  atual: number;
  rodape: ReactNode;
}) {
  return (
    <div
      className="cc-load"
      role="status"
      aria-live="polite"
      style={{
        position: "static",
        inset: "auto",
        zIndex: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: "28px 0 20px",
      }}
    >
      <div className="cc-sym" style={{ width: 108 }}>
        <img className="sym-c" src={simboloCinza} alt="" />
        <img className="sym-a" src={simboloAmarelo} alt="" />
      </div>
      <div className="cc-load-t">{titulo}</div>
      <div className="cc-load-s">{subtitulo}</div>
      <ul className="cc-passos">
        {passos.map((rotulo, i) => {
          const n = i + 1;
          const cls = n < atual ? "ok" : n === atual ? "agora" : undefined;
          return (
            <li key={rotulo} className={cls}>
              <span className="cp-ic" />
              {rotulo}
            </li>
          );
        })}
      </ul>
      <div className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
        {rodape}
      </div>
    </div>
  );
}
