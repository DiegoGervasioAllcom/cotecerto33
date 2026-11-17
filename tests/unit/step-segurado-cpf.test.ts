import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";
import { StepSegurado } from "@/components/venda/novo-lead/steps/StepSegurado";
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

function render(cpf: string, consultarCpf = vi.fn(), consultando = false) {
  const tree = StepSegurado({
    f: { cpf } as Form,
    up: vi.fn(),
    erros: {},
    cepLoading: false,
    lookupCep: vi.fn(),
    cpfConsultando: consultando,
    cpfStatus: null,
    consultarCpf,
  });
  const botao = achar(tree, (e) => e.type === "button")!;
  const input = achar(tree, (e) => e.type === "input" && e.props.placeholder === "000.000.000-00")!;
  return { botao, input, consultarCpf };
}

describe("StepSegurado — consulta de CPF", () => {
  test("não há consulta no blur do campo CPF", () => {
    const { input, consultarCpf } = render("123.456.789-09");
    expect(input.props.onBlur).toBeUndefined();
    expect(consultarCpf).not.toHaveBeenCalled();
  });

  test("botão Buscar fica desabilitado com CPF incompleto", () => {
    expect(render("123.456").botao.props.disabled).toBe(true);
  });

  test("botão Buscar fica desabilitado enquanto consulta", () => {
    expect(render("123.456.789-09", vi.fn(), true).botao.props.disabled).toBe(true);
  });

  test("botão Buscar com CPF completo chama consultarCpf com sobrescreverNome", () => {
    const { botao, consultarCpf } = render("123.456.789-09");
    expect(botao.props.disabled).toBe(false);
    (botao.props.onClick as () => void)();
    expect(consultarCpf).toHaveBeenCalledWith("123.456.789-09", { sobrescreverNome: true });
  });
});
