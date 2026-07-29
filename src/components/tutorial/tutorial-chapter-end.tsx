import { useRef } from "react";
import { ArrowRight, CheckCircle, Target } from "lucide-react";
import { useFocusTrap } from "./tutorial-focus";
import type { TutorialChapter } from "./tutorial-types";

export function TutorialChapterEnd({
  chapter,
  isLastChapter,
  onClose,
  onNextChapter,
  onShowIndex,
}: {
  chapter: TutorialChapter;
  isLastChapter: boolean;
  onClose: () => void;
  onNextChapter: () => void;
  onShowIndex: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, primaryRef);
  const Icon = chapter.outro.final ? Target : CheckCircle;

  return (
    <div
      ref={containerRef}
      className="modal-host"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-end-title"
      tabIndex={-1}
    >
      <div className="tour-end">
        <div className="ic">
          <Icon size={42} />
        </div>
        <h3 id="tutorial-end-title">
          {chapter.outro.final ? "Tutorial concluído!" : `Capítulo ${chapter.id} concluído`}
        </h3>
        <div className="hk">{chapter.outro.hook}</div>
        {chapter.outro.big && !isLastChapter && (
          <p className="muted small" style={{ margin: "0 0 18px" }}>
            Você terminou o Módulo 1. Quer seguir para o próximo módulo ou parar aqui?
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Encerrar por agora
          </button>
          {isLastChapter ? (
            <button ref={primaryRef} type="button" className="btn btn-yellow" onClick={onShowIndex}>
              Ver índice de novo
            </button>
          ) : (
            <button
              ref={primaryRef}
              type="button"
              className="btn btn-yellow"
              onClick={onNextChapter}
            >
              <ArrowRight size={13} />
              Próximo capítulo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
