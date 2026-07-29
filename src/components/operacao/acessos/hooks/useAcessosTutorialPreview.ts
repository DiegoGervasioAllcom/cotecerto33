import { useCallback } from "react";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import type { PersoSub, Tab } from "../types";

export function useAcessosTutorialPreview({
  tab,
  setTab,
  persoSub,
  setPersoSub,
}: {
  tab: Tab;
  setTab: (next: Tab) => void;
  persoSub: PersoSub;
  setPersoSub: (next: PersoSub) => void;
}) {
  const tutorialPreview = useTutorialPreview();
  const visibleTab: Tab =
    tutorialPreview === "acessos-pendentes"
      ? "pend"
      : tutorialPreview === "acessos-desligamentos"
        ? "deslig"
        : tutorialPreview?.startsWith("acessos-modelos-")
          ? "modelos"
          : tab;
  const visiblePersoSub: PersoSub =
    tutorialPreview === "acessos-modelos-franquia"
      ? "franquia"
      : tutorialPreview === "acessos-modelos-clt"
        ? "clt"
        : persoSub;
  const setVisiblePersoSub = useCallback(
    (next: PersoSub) => {
      if (!tutorialPreview?.startsWith("acessos-modelos-")) setPersoSub(next);
    },
    [setPersoSub, tutorialPreview],
  );
  const setVisibleTab = useCallback(
    (next: Tab) => {
      if (!tutorialPreview?.startsWith("acessos-")) setTab(next);
    },
    [setTab, tutorialPreview],
  );

  return { visibleTab, setVisibleTab, visiblePersoSub, setVisiblePersoSub };
}
