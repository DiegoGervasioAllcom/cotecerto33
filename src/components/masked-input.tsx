import { useEffect, useState } from "react";
import { applyMask, type Mask } from "@/lib/masks";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "defaultValue"
> & {
  mask: Mask;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
};

/**
 * Input controlado que aplica máscara R$ ou % em tempo real.
 * Use em qualquer campo monetário ou percentual da aplicação.
 */
export function MaskedInput({ mask, value, defaultValue, onValueChange, ...rest }: Props) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState<string>(applyMask(defaultValue ?? "", mask));
  const shown = controlled ? applyMask(value ?? "", mask) : inner;

  useEffect(() => {
    if (controlled) return;
    setInner((prev) => applyMask(prev, mask));
  }, [mask, controlled]);

  return (
    <input
      {...rest}
      value={shown}
      inputMode="numeric"
      onChange={(e) => {
        const m = applyMask(e.target.value, mask);
        if (!controlled) setInner(m);
        onValueChange?.(m);
      }}
    />
  );
}
