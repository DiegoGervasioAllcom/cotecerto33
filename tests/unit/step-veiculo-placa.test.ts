import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";
import { StepVeiculo } from "@/components/venda/novo-lead/steps/StepVeiculo";
import type { Form } from "@/components/venda/novo-lead/types";

type P = Record<string, unknown>;
function achar(el: unknown, pred: (e: ReactElement<P>) => boolean): ReactElement<P> | null {
  if (!el || typeof el !== "object") return null;
  if (Array.isArray(el)) {
    for (const c of el) {
      const r = achar(c, pred);
      if (r) return r;
    }
    return null;
  }
  const e = el as ReactElement<P>;
  if (pred(e)) return e;
  return achar(e.props?.children, pred);
}

function render(placa: string, onConsultarPlaca = vi.fn(), consultando = false) {
  const tree = StepVeiculo({
    f: { placa } as Form,
    up: vi.fn(),
    erros: {},
    marcas: [],
    modelos: [],
    fipeValor: "",
    placaConsultando: consultando,
    placaStatus: null,
    placaVersoes: [],
    onConsultarPlaca,
    onEscolherVersao: vi.fn(),
  });
  const botao = achar(tree, (e) => e.type === "button")!;
  const input = achar(tree, (e) => e.type === "input" && e.props.placeholder === "AAA0A00")!;
  return { botao, input, onConsultarPlaca };
}

describe("StepVeiculo — consulta de placa", () => {
  test("não há consulta no blur do campo placa", () => {
    const { input, onConsultarPlaca } = render("ABC1D23");
    expect(input.props.onBlur).toBeUndefined();
    expect(onConsultarPlaca).not.toHaveBeenCalled();
  });

  test("botão Buscar fica desabilitado com placa incompleta", () => {
    expect(render("ABC1").botao.props.disabled).toBe(true);
  });

  test("botão Buscar fica desabilitado enquanto consulta", () => {
    expect(render("ABC1D23", vi.fn(), true).botao.props.disabled).toBe(true);
  });

  test("clique chama onConsultarPlaca com reaplicar e sem forcar (usa cache)", () => {
    const { botao, onConsultarPlaca } = render("ABC1D23");
    expect(botao.props.disabled).toBe(false);
    (botao.props.onClick as () => void)();
    expect(onConsultarPlaca).toHaveBeenCalledWith("ABC1D23", { reaplicar: true });
  });
});
