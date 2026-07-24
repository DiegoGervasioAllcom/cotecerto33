import { describe, expect, it, vi } from "vitest";
import { restoreTutorialFocus } from "@/components/tutorial/tutorial-provider";

describe("foco do tutorial", () => {
  it("restaura o elemento que abriu o tutorial", () => {
    const focus = vi.fn();
    const trigger = { focus } as unknown as HTMLElement;

    restoreTutorialFocus(trigger);

    expect(focus).toHaveBeenCalledOnce();
  });
});
