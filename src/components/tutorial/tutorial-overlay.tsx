import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useFocusTrap } from "./tutorial-focus";
import type { TutorialProgress } from "./tutorial-progress";
import type { TutorialDefinition, TutorialPersona, TutorialStep } from "./tutorial-types";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 16;
const VIEWPORT_EDGE = 10;

export function TutorialOverlay({
  definition,
  persona,
  step,
  progress,
  spot,
  isTransitioning,
  isLastChapter,
  isLastStep,
  onPrevious,
  onNext,
  onClose,
}: {
  definition: TutorialDefinition;
  persona: TutorialPersona;
  step: TutorialStep;
  progress: TutorialProgress;
  spot: DOMRect | null;
  isTransitioning: boolean;
  isLastChapter: boolean;
  isLastStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, closeRef);
  const preferred = step.position ?? "right";
  const [placement, setPlacement] = useState<TooltipPlacement>(CORNER_PLACEMENT);
  const spotlight = spot ? clampSpotlight(spot) : null;
  const chapter = definition.chapters[progress.chapter];

  useLayoutEffect(() => {
    setPlacement(positionTooltip(tooltipRef.current, spot, preferred));
  }, [preferred, spot, step]);

  return (
    <div
      ref={containerRef}
      className="tour-host active"
      aria-live="polite"
      aria-busy={isTransitioning}
      tabIndex={-1}
    >
      <div className="tour-backdrop" />
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}
      <div
        ref={tooltipRef}
        className={`tour-tip pos-${placement.position}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-step-title"
        style={placement.style}
      >
        <span className="arrow" />
        <div className="tip-head">
          <div className="avatar">{persona.avatar}</div>
          <div className="who">
            <small>
              CAP. {chapter.id} · {chapter.title}
            </small>
            <strong>{persona.guideName}</strong>
          </div>
          <div className="progress">
            {progress.step + 1} / {chapter.steps.length}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="x"
            aria-label="Sair do tutorial"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="tip-body">
          {step.hook && <div className="hook">{step.hook}</div>}
          <h4 id="tutorial-step-title">{step.title}</h4>
          <div dangerouslySetInnerHTML={{ __html: step.body }} />
          {step.tip && (
            <div className="pill-tip">
              <span className="ico">✦</span>
              <div className="txt">
                <strong>{step.tip.label}</strong>
                {step.tip.text}
              </div>
            </div>
          )}
        </div>
        <div className="tip-foot">
          <span className="ch">
            Capítulo {chapter.id} de {definition.chapters.length}
          </span>
          <span className="spc" />
          <button
            type="button"
            className="prev"
            disabled={isTransitioning || (progress.chapter === 0 && progress.step === 0)}
            onClick={onPrevious}
          >
            <ChevronLeft size={13} />
            Anterior
          </button>
          <button type="button" className="exit" onClick={onClose}>
            Sair
          </button>
          <button type="button" className="next" disabled={isTransitioning} onClick={onNext}>
            {isLastStep ? (isLastChapter ? "Terminar tour" : "Próximo capítulo") : "Próximo"}
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

type TooltipSide = Exclude<NonNullable<TutorialStep["position"]>, "center">;

type TooltipPlacement = {
  position: TooltipSide | "corner";
  style: CSSProperties;
};

const CORNER_PLACEMENT: TooltipPlacement = {
  position: "corner",
  style: { right: 24, bottom: 24 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampSpotlight(target: DOMRect) {
  const top = Math.max(0, target.top - SPOTLIGHT_PADDING);
  const left = Math.max(0, target.left - SPOTLIGHT_PADDING);
  const right = Math.min(window.innerWidth, target.right + SPOTLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight, target.bottom + SPOTLIGHT_PADDING);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function rectsOverlap(
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number },
) {
  return !(
    first.right < second.left ||
    first.left > second.right ||
    first.bottom < second.top ||
    first.top > second.bottom
  );
}

function positionTooltip(
  tooltip: HTMLDivElement | null,
  target: DOMRect | null,
  preferred: NonNullable<TutorialStep["position"]>,
): TooltipPlacement {
  if (!tooltip || !target || preferred === "center") return CORNER_PLACEMENT;

  const tooltipWidth = tooltip.offsetWidth || 380;
  const tooltipHeight = tooltip.offsetHeight || 260;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const fits: Record<TooltipSide, boolean> = {
    right: target.right + TOOLTIP_GAP + tooltipWidth <= viewportWidth - VIEWPORT_EDGE,
    left: target.left - TOOLTIP_GAP - tooltipWidth >= VIEWPORT_EDGE,
    bottom: target.bottom + TOOLTIP_GAP + tooltipHeight <= viewportHeight - VIEWPORT_EDGE,
    top: target.top - TOOLTIP_GAP - tooltipHeight >= VIEWPORT_EDGE,
  };
  const fallbackOrder: TooltipSide[] = ["right", "bottom", "left", "top"];
  const side = fits[preferred] ? preferred : fallbackOrder.find((candidate) => fits[candidate]);
  if (!side) return CORNER_PLACEMENT;

  let left = target.right + TOOLTIP_GAP;
  let top = target.top + target.height / 2 - tooltipHeight / 2;
  if (side === "left") {
    left = target.left - TOOLTIP_GAP - tooltipWidth;
  } else if (side === "bottom") {
    left = target.left + target.width / 2 - tooltipWidth / 2;
    top = target.bottom + TOOLTIP_GAP;
  } else if (side === "top") {
    left = target.left + target.width / 2 - tooltipWidth / 2;
    top = target.top - TOOLTIP_GAP - tooltipHeight;
  }

  const maximumLeft = Math.max(VIEWPORT_EDGE, viewportWidth - tooltipWidth - VIEWPORT_EDGE);
  const maximumTop = Math.max(VIEWPORT_EDGE, viewportHeight - tooltipHeight - VIEWPORT_EDGE);
  left = clamp(left, VIEWPORT_EDGE, maximumLeft);
  top = clamp(top, VIEWPORT_EDGE, maximumTop);

  if (
    rectsOverlap({ left, top, right: left + tooltipWidth, bottom: top + tooltipHeight }, target)
  ) {
    return CORNER_PLACEMENT;
  }

  return { position: side, style: { left, top } };
}
