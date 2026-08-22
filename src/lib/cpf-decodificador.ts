// Parser da resposta de localização de CPF (ws.sisconsulta.com — endpoint
// Bot/LocalizacaoSimples, tipo=cpf). A API responde em XML, sem namespaces
// e sem aninhamento profundo, então o parse é feito à mão (mesmo padrão de
// placa-decodificador.ts) em vez de trazer uma dependência de XML só para
// isso. Módulo puro, sem acesso a rede ou env — a chamada HTTP vive em
// cpf.functions.ts.
//
// Formato observado (LocalizacaoSimples?tipo=cpf):
//   <NewDataSet>
//     <Pf><Cpf/><Nome/><Sexo/><DtNasc/><NomeMae/><EstadoCivil/>...</Pf>
//     <Enderecos>...</Enderecos> (0..N)
//     <Telefones>...</Telefones> (0..N)
//     <Celulares>...</Celulares> (0..N)
//     <Emails>...</Emails> (0..N)
//     <Retorno><Existe_erro/><Codigo/><RetornoBase/></Retorno>
//   </NewDataSet>

export type EnderecoCpf = {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type CpfDecodificado = {
  cpf: string;
  nome: string;
  sexo: string;
  /** Data de nascimento normalizada para YYYY-MM-DD, ou "" se ilegível. */
  dataNascimento: string;
  nomeMae: string;
  estadoCivil: string;
  /** Primeiro celular encontrado, formatado (DD) NNNNN-NNNN. */
  celular: string;
  /** Primeiro e-mail encontrado. */
  email: string;
  /** Primeiro endereço encontrado — a API pode listar vários. */
  endereco: EnderecoCpf | null;
};

export type ResultadoConsultaCpf =
  | { ok: true; dados: CpfDecodificado }
  | { ok: false; codigo: string | null; mensagem: string };

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodificarEntidades(v: string): string {
  return v.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, ent: string) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const cp = Number.parseInt(ent.slice(2), 16);
      return Number.isNaN(cp) ? all : String.fromCodePoint(cp);
    }
    if (ent.startsWith("#")) {
      const cp = Number.parseInt(ent.slice(1), 10);
      return Number.isNaN(cp) ? all : String.fromCodePoint(cp);
    }
    const found = ENTIDADES[ent.toLowerCase()];
    return found ?? all;
  });
}

/** Conteúdo da primeira ocorrência de `<tag>…</tag>`, "" se ausente/vazia. */
function tag(xml: string, nome: string): string {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  const v = decodificarEntidades(m[1]).trim();
  return v.toLowerCase() === "não informado" ? "" : v;
}

/** Todos os blocos `<tag>…</tag>` (Enderecos/Celulares podem repetir). */
function blocos(xml: string, nome: string): string[] {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/** "29/05/1993 - Sábado" -> "1993-05-29". "" se não casar o padrão DD/MM/YYYY. */
function normalizarData(v: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v.trim());
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** "MASCULINO"/"FEMININO" -> "Masculino"/"Feminino" (opções do formulário). */
function normalizarSexo(v: string): string {
  const s = v.trim().toUpperCase();
  if (s === "MASCULINO") return "Masculino";
  if (s === "FEMININO") return "Feminino";
  return "";
}

function primeiroEndereco(xml: string): EnderecoCpf | null {
  const bloco = blocos(xml, "Enderecos")[0];
  if (!bloco) return null;
  const endereco: EnderecoCpf = {
    logradouro: tag(bloco, "Logradouro"),
    numero: tag(bloco, "Numero"),
    complemento: tag(bloco, "Complemento"),
    bairro: tag(bloco, "Bairro"),
    cidade: tag(bloco, "Cidade"),
    uf: tag(bloco, "Uf"),
    cep: tag(bloco, "Cep"),
  };
  const temAlgumDado = Object.values(endereco).some(Boolean);
  return temAlgumDado ? endereco : null;
}

/** DDD + número em blocos separados -> "(DD) NNNNN-NNNN". "" se faltar algo. */
function formatarTelefone(bloco: string): string {
  const ddd = tag(bloco, "Ddd").replace(/\D/g, "");
  const fone = tag(bloco, "Fone").replace(/\D/g, "");
  if (!ddd || !fone) return "";
  if (fone.length === 9) return `(${ddd}) ${fone.slice(0, 5)}-${fone.slice(5)}`;
  if (fone.length === 8) return `(${ddd}) ${fone.slice(0, 4)}-${fone.slice(4)}`;
  return "";
}

function primeiroCelular(xml: string): string {
  for (const bloco of blocos(xml, "Celulares")) {
    const f = formatarTelefone(bloco);
    if (f) return f;
  }
  return "";
}

function primeiroEmail(xml: string): string {
  for (const bloco of blocos(xml, "Emails")) {
    const email = tag(bloco, "EMail") || tag(bloco, "Email");
    if (email) return email;
  }
  return "";
}

/**
 * Traduz o XML de LocalizacaoSimples (tipo=cpf) no resultado usado pelo
 * app. Nunca lança: qualquer coisa que não seja um `<Pf>` legível vira
 * `{ ok: false }` com a mensagem que a API mandou (ou uma genérica).
 */
export function parseLocalizacaoCpfXml(xml: string): ResultadoConsultaCpf {
  const texto = String(xml ?? "");

  const existeErro = tag(texto, "Existe_erro");
  const temPf = /<Pf[\s>]/i.test(texto);
  if (!temPf || existeErro === "1") {
    const mensagem = tag(texto, "Mensagem") || tag(texto, "DsRetorno");
    const codigo = tag(texto, "Codigo") || tag(texto, "NuCdRetorno");
    return {
      ok: false,
      codigo: codigo || null,
      mensagem: mensagem || "CPF não encontrado.",
    };
  }

  const pf = blocos(texto, "Pf")[0] ?? "";
  return {
    ok: true,
    dados: {
      cpf: tag(pf, "Cpf").replace(/\D/g, ""),
      nome: tag(pf, "Nome"),
      sexo: normalizarSexo(tag(pf, "Sexo")),
      dataNascimento: normalizarData(tag(pf, "DtNasc")),
      nomeMae: tag(pf, "NomeMae"),
      estadoCivil: tag(pf, "EstadoCivil"),
      celular: primeiroCelular(texto),
      email: primeiroEmail(texto),
      endereco: primeiroEndereco(texto),
    },
  };
}
