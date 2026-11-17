import { beforeEach, describe, expect, test, vi } from "vitest";

// Harness mínimo de hooks (o repo não tem jsdom/testing-library): slots por índice de chamada.
const h = vi.hoisted(() => ({ slots: [] as unknown[], i: 0 }));
vi.mock("react", () => ({
  useRef: (init: unknown) => {
    const k = h.i++;
    if (!(k in h.slots)) h.slots[k] = { current: init };
    return h.slots[k];
  },
  useState: (init: unknown) => {
    const k = h.i++;
    if (!(k in h.slots)) h.slots[k] = init;
    return [h.slots[k], (v: unknown) => (h.slots[k] = v)];
  },
  useCallback: (fn: unknown) => {
    h.i++;
    return fn;
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));
const consultarCpfMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cpf.functions", () => ({ consultarCpf: consultarCpfMock }));

import { useConsultaCpf as hookCpf } from "@/components/venda/novo-lead/hooks/useConsultaCpf";
import type { Form } from "@/components/venda/novo-lead/types";

const CPF = "123.456.789-09";
const dados = { nome: "Maria da API", sexo: "F", dataNascimento: "1990-01-02" };

function montar(inicial: Partial<Form>) {
  let form = { ...inicial } as Form;
  const setF = (fn: (p: Form) => Form) => {
    form = fn(form);
  };
  h.slots = [];
  h.i = 0;
  const render = () => {
    h.i = 0;
    return hookCpf({ setF: setF as never, cotacaoId: "cot-1" });
  };
  return { consultar: render().consultar, form: () => form };
}

beforeEach(() => {
  consultarCpfMock.mockReset();
  consultarCpfMock.mockResolvedValue({ ok: true, dados });
});

describe("useConsultaCpf", () => {
  test("sem opções, o nome já preenchido é preservado", async () => {
    const { consultar, form } = montar({ nome: "Digitado", sexo: "", nasc: "" });
    await consultar(CPF);
    expect(form().nome).toBe("Digitado");
  });

  test("com sobrescreverNome o nome é substituído e o servidor recebe forcar=false", async () => {
    const { consultar, form } = montar({ nome: "Digitado" });
    await consultar(CPF, { sobrescreverNome: true });
    expect(form().nome).toBe("Maria da API");
    expect(consultarCpfMock.mock.calls[0][0].data.forcar).toBe(false);
  });

  test("sexo e nascimento só são preenchidos se vazios", async () => {
    const a = montar({ nome: "", sexo: "M", nasc: "2000-05-05" });
    await a.consultar(CPF, { sobrescreverNome: true });
    expect(a.form().sexo).toBe("M");
    expect(a.form().nasc).toBe("2000-05-05");
    const b = montar({ nome: "", sexo: "", nasc: "" });
    await b.consultar(CPF);
    expect(b.form().sexo).toBe("F");
    expect(b.form().nasc).toBe("1990-01-02");
  });

  test("mesmo CPF sem opções não chama a API; com sobrescreverNome chama de novo", async () => {
    const { consultar } = montar({ nome: "" });
    await consultar(CPF);
    await consultar(CPF);
    expect(consultarCpfMock).toHaveBeenCalledTimes(1);
    await consultar(CPF, { sobrescreverNome: true });
    expect(consultarCpfMock).toHaveBeenCalledTimes(2);
  });

  test("CPF com menos de 11 dígitos não consulta", async () => {
    const { consultar } = montar({ nome: "" });
    await consultar("123.456.789");
    await consultar("123.456.789", { sobrescreverNome: true });
    expect(consultarCpfMock).not.toHaveBeenCalled();
  });
});
