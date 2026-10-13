import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { filtraOpcoes } from "@/lib/normalizaTexto";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  invalido?: boolean;
  descritoPor?: string;
};

export function ComboboxBusca({
  value,
  onChange,
  options,
  placeholder,
  id,
  ariaLabel,
  invalido,
  descritoPor,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => filtraOpcoes(options, busca), [options, busca]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          role="combobox"
          aria-invalid={invalido || undefined}
          aria-describedby={descritoPor}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="input"
          style={{ textAlign: "left", width: "100%" }}
        >
          {value || <span style={{ opacity: 0.6 }}>{placeholder ?? "Selecione"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        {/* shouldFilter=false: o filtro sem acento é nosso */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar..." value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {lista.map((o) => (
              <CommandItem
                key={o}
                value={o}
                onSelect={() => {
                  onChange(o);
                  setOpen(false);
                  setBusca("");
                }}
              >
                {o}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
