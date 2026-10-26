import { maskCel, maskCep } from "@/components/venda/novo-lead/masks";
import { ESTADO_CIVIL } from "@/components/venda/novo-lead/enumsPerfil";
import { maskCpfCnpj } from "@/lib/masks";
import type { Form } from "@/components/venda/novo-lead/types";
import { Campo, Escolha } from "./Campo";
import type { Up } from "./passos";

type Props = {
  f: Form;
  up: Up;
  erros: Record<string, string>;
  cpfConsultando: boolean;
  cpfStatus: { tipo: string; texto: string } | null;
  consultarCpf: (cpf: string) => void;
  cepLoading: boolean;
  lookupCep: (cep: string) => void;
};

export function PassoSegurado({
  f,
  up,
  erros,
  cpfConsultando,
  cpfStatus,
  consultarCpf,
  cepLoading,
  lookupCep,
}: Props) {
  return (
    <>
      <Campo
        label="CPF"
        erro={erros.cpf}
        dica={cpfConsultando ? "Consultando…" : (cpfStatus?.texto ?? null)}
      >
        <input
          className="m-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          value={f.cpf}
          onChange={(e) => {
            const v = maskCpfCnpj(e.target.value);
            up("cpf", v);
            consultarCpf(v);
          }}
          placeholder="000.000.000-00"
        />
      </Campo>
      <Campo label="Nome completo" erro={erros.nome}>
        <input
          className="m-input"
          maxLength={150}
          value={f.nome}
          onChange={(e) => up("nome", e.target.value)}
          autoComplete="name"
        />
      </Campo>
      <Campo label="Sexo" erro={erros.sexo}>
        <Escolha
          valor={f.sexo}
          onChange={(v) => up("sexo", v)}
          opcoes={[
            { valor: "Masculino", rotulo: "Masculino" },
            { valor: "Feminino", rotulo: "Feminino" },
          ]}
        />
      </Campo>
      <Campo label="Estado civil" erro={erros.estadoCivil}>
        <select
          className="m-select"
          value={f.estadoCivil}
          onChange={(e) => up("estadoCivil", e.target.value)}
        >
          <option value="">Selecione</option>
          {ESTADO_CIVIL.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Campo>
      <Campo label="Celular" erro={erros.celular}>
        <input
          className="m-input"
          inputMode="tel"
          maxLength={15}
          value={f.celular}
          onChange={(e) => up("celular", maskCel(e.target.value))}
          placeholder="(11) 90000-0000"
          autoComplete="tel"
        />
      </Campo>
      <Campo label="E-mail (opcional)" erro={erros.email}>
        <input
          className="m-input"
          type="email"
          inputMode="email"
          maxLength={254}
          value={f.email}
          onChange={(e) => up("email", e.target.value)}
        />
      </Campo>
      <Campo
        label="CEP residencial"
        erro={erros.cep}
        dica={
          cepLoading
            ? "Buscando endereço…"
            : f.logradouro
              ? `${f.logradouro}, ${f.bairro} — ${f.cidade}/${f.uf}`
              : null
        }
      >
        <input
          className="m-input"
          inputMode="numeric"
          maxLength={9}
          value={f.cep}
          onChange={(e) => {
            const v = maskCep(e.target.value);
            up("cep", v);
            lookupCep(v);
          }}
          placeholder="00000-000"
          autoComplete="postal-code"
        />
      </Campo>
      <Campo label="Número (opcional)" erro={erros.numero}>
        <input
          className="m-input"
          maxLength={10}
          value={f.numero}
          onChange={(e) => up("numero", e.target.value)}
        />
      </Campo>
    </>
  );
}
