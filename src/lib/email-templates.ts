type WelcomeBase = {
  tipo: "boas_vindas";
  nome: string;
  link?: string;
};

type WelcomeTemplate =
  | (WelcomeBase & { variante: "matriz"; aprovador: string })
  | (WelcomeBase & {
      variante: "cargo";
      cargo: string;
      areas: string[];
      janela: string;
    })
  | (WelcomeBase & {
      variante: "supervisor";
      tipo_supervisor: "Vendas" | "Operacional";
      areas: string[];
    })
  | (WelcomeBase & { variante: "master"; grupo: string; regiao: string })
  | (WelcomeBase & {
      variante: "franquia_full";
      franquia: string;
      cidade_uf: string;
    })
  | (WelcomeBase & {
      variante: "franquia_individual";
      modelo: "Smart" | "Conecta" | "Light" | "Link" | "Flex";
      responsavel: string;
    })
  | (WelcomeBase & {
      variante: "vendedor";
      origem: "Matriz" | "Master" | "Full";
      responsavel: string;
    });

export type EmailTemplate =
  | {
      tipo: "pendencia";
      nome: string;
      tipo_declarado: string;
      pendencia: string;
      data_pedido: string;
    }
  | {
      tipo: "recusa";
      nome: string;
      tipo_declarado: string;
      motivo: string;
    }
  | WelcomeTemplate;

export type RenderedEmail = { subject: string; html: string; text: string };

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });

const shell = (body: string) =>
  `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f4f1;font-family:Arial,sans-serif;color:#26313a"><div style="max-width:620px;margin:24px auto;background:#fff;border:1px solid #e2e6e9;border-radius:12px;overflow:hidden"><div style="background:#425563;color:#fff;padding:16px 22px;font-weight:800">SUPPER <span style="color:#ffb600">CERTO</span></div><div style="padding:22px;line-height:1.55">${body}</div></div></body></html>`;

const detail = (label: string, value: string) =>
  `<div style="background:#fff6e0;border-left:4px solid #ffb600;padding:12px 14px;margin:16px 0"><strong>${label}</strong><br>${escapeHtml(value)}</div>`;

const passwordButton = (link: string) =>
  `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ffb600;color:#26313a;padding:11px 18px;border-radius:8px;font-weight:700;text-decoration:none">Criar minha senha</a></p>`;

const welcome = (
  subject: string,
  name: string,
  link: string,
  bodyHtml: string,
  noticeHtml: string,
  bodyText: string,
  noticeText: string,
): RenderedEmail => ({
  subject,
  html: shell(
    `<p>Olá, ${escapeHtml(name)}.</p>${bodyHtml}${passwordButton(link)}<p style="color:#7c8a95">${noticeHtml}</p>`,
  ),
  text: `Olá, ${name}.\n\n${bodyText}\n\nCrie sua senha: ${link}\n\n${noticeText}`,
});

export function renderEmailTemplate(template: EmailTemplate): RenderedEmail {
  const nome = escapeHtml(template.nome);
  if (template.tipo === "pendencia") {
    const tipo = escapeHtml(template.tipo_declarado);
    const subject = "Falta um dado para liberar seu acesso ao Supper Certo";
    return {
      subject,
      html: shell(
        `<p>Olá, ${nome}.</p><p>Recebemos seu pedido de acesso como <strong>${tipo}</strong>, mas precisamos de mais uma informação antes de liberar:</p>${detail("O que falta", template.pendencia)}<p>É só responder este e-mail com o que foi pedido — seu cadastro continua na fila, não precisa refazer.</p><p style="color:#7c8a95">Pedido registrado em ${escapeHtml(template.data_pedido)}.</p>`,
      ),
      text: `Olá, ${template.nome}.\n\nRecebemos seu pedido de acesso como ${template.tipo_declarado}, mas precisamos de mais uma informação antes de liberar:\n\nO que falta: ${template.pendencia}\n\nÉ só responder este e-mail com o que foi pedido — seu cadastro continua na fila, não precisa refazer.\n\nPedido registrado em ${template.data_pedido}.`,
    };
  }
  if (template.tipo === "recusa") {
    const tipo = escapeHtml(template.tipo_declarado);
    const subject = "Sobre o seu pedido de acesso ao Supper Certo";
    return {
      subject,
      html: shell(
        `<p>Olá, ${nome}.</p><p>Analisamos seu pedido de acesso como <strong>${tipo}</strong> e ele <strong>não foi aprovado</strong> neste momento.</p>${detail("Motivo", template.motivo)}<p>Se você acredita que houve engano, responda este e-mail — a Matriz revisa o pedido.</p><p style="color:#7c8a95">Nenhum acesso foi criado e nenhum dado seu fica ativo no sistema.</p>`,
      ),
      text: `Olá, ${template.nome}.\n\nAnalisamos seu pedido de acesso como ${template.tipo_declarado} e ele não foi aprovado neste momento.\n\nMotivo: ${template.motivo}\n\nSe você acredita que houve engano, responda este e-mail — a Matriz revisa o pedido.\n\nNenhum acesso foi criado e nenhum dado seu fica ativo no sistema.`,
    };
  }
  if (!template.link) throw new Error("Link para criar senha ausente.");
  const link = template.link;

  switch (template.variante) {
    case "matriz":
      return welcome(
        "Boas-vindas Supper! Seu acesso à Matriz está liberado",
        template.nome,
        link,
        `<p>Seu acesso à <strong>Matriz</strong> do Supper Certo foi liberado por ${escapeHtml(template.aprovador)}. Esse é o acesso mais amplo do sistema: você enxerga toda a operação e responde pelas configurações.</p>${detail("O que você acessa", "As 17 áreas do sistema, incluindo Aprovações, Comissões, Acessos e permissões e Configurações.")}<p>Para começar, crie sua senha:</p>`,
        "O link vale por 48 horas e só pode ser usado uma vez. Se expirar, peça um novo na tela de login. Se você não solicitou este acesso, avise a Matriz e não use o link.",
        `Seu acesso à Matriz do Supper Certo foi liberado por ${template.aprovador}. Esse é o acesso mais amplo do sistema: você enxerga toda a operação e responde pelas configurações.\n\nO que você acessa: As 17 áreas do sistema, incluindo Aprovações, Comissões, Acessos e permissões e Configurações.\n\nPara começar, crie sua senha:`,
        "O link vale por 48 horas e só pode ser usado uma vez. Se expirar, peça um novo na tela de login. Se você não solicitou este acesso, avise a Matriz e não use o link.",
      );
    case "cargo": {
      const areas = template.areas.join(" · ");
      return welcome(
        `Boas-vindas Supper! Seu acesso como ${template.cargo}`,
        template.nome,
        link,
        `<p>Seu acesso ao Supper Certo foi liberado como <strong>${escapeHtml(template.cargo)}</strong>. Você verá apenas as áreas do seu cargo — nada além disso.</p>${detail("Áreas liberadas para você", areas)}<p>Janela de acesso: ${escapeHtml(template.janela)} (dias e horário em que o login é permitido).</p>`,
        "O link vale por 48 horas. Precisa de uma área que não está na lista? Fale com a Matriz — o escopo pode ser ajustado sem criar um novo acesso.",
        `Seu acesso ao Supper Certo foi liberado como ${template.cargo}. Você verá apenas as áreas do seu cargo — nada além disso.\n\nÁreas liberadas para você: ${areas}\n\nJanela de acesso: ${template.janela} (dias e horário em que o login é permitido).`,
        "O link vale por 48 horas. Precisa de uma área que não está na lista? Fale com a Matriz — o escopo pode ser ajustado sem criar um novo acesso.",
      );
    }
    case "supervisor": {
      const areas = template.areas.join(" · ");
      const explanation =
        template.tipo_supervisor === "Vendas"
          ? "Vendas inclui Aprovações — você tem alçada de desconto sobre o time de vendas."
          : "Operacional cuida de Leads, Distribuição e Acessos e permissões — sem alçada.";
      return welcome(
        `Boas-vindas Supper! Seu acesso de Supervisor (${template.tipo_supervisor})`,
        template.nome,
        link,
        `<p>Você recebeu o acesso de <strong>Supervisor ${template.tipo_supervisor}</strong>. É um papel da Matriz, com acesso por escopo e <strong>sem comissionamento</strong>.</p>${detail("Áreas liberadas", areas)}<p>${explanation}</p>`,
        "O link vale por 48 horas. Sua equipe e sua alçada podem ser ajustadas pela Matriz a qualquer momento.",
        `Você recebeu o acesso de Supervisor ${template.tipo_supervisor}. É um papel da Matriz, com acesso por escopo e sem comissionamento.\n\nÁreas liberadas: ${areas}\n${explanation}`,
        "O link vale por 48 horas. Sua equipe e sua alçada podem ser ajustadas pela Matriz a qualquer momento.",
      );
    }
    case "master":
      return welcome(
        "Boas-vindas Supper! Seu acesso de Master está liberado",
        template.nome,
        link,
        `<p>Seu acesso de <strong>Master franqueado</strong> está liberado para o grupo ${escapeHtml(template.grupo)} — região ${escapeHtml(template.regiao)}. Você responde ao <strong>Coordenador Comercial</strong>.</p>${detail("O que você comanda", "As franquias que você supervisiona e os vendedores delas, além da sua operação própria. Menu de comando com 12 áreas: aprovações, vendas, comissões, premiações, estornos, renovações e relatórios.")}<p>Sua remuneração inclui <strong>20% sobre a comissão da equipe</strong>, além do programa Elite.</p>`,
        "O link vale por 48 horas. Dúvidas sobre comissionamento? Fale com a Matriz.",
        `Seu acesso de Master franqueado está liberado para o grupo ${template.grupo} — região ${template.regiao}. Você responde ao Coordenador Comercial.\n\nO que você comanda: As franquias que você supervisiona e os vendedores delas, além da sua operação própria. Menu de comando com 12 áreas: aprovações, vendas, comissões, premiações, estornos, renovações e relatórios.\n\nSua remuneração inclui 20% sobre a comissão da equipe, além do programa Elite.`,
        "O link vale por 48 horas. Dúvidas sobre comissionamento? Fale com a Matriz.",
      );
    case "franquia_full":
      return welcome(
        "Boas-vindas Supper! Sua franquia Full está ativa",
        template.nome,
        link,
        `<p>A franquia <strong>${escapeHtml(template.franquia)}</strong> (${escapeHtml(template.cidade_uf)}) está ativa no modelo <strong>Full</strong> — o único com equipe abaixo.</p>${detail("Suas condições comerciais", "As regras de comissionamento e o modelo operacional da sua franquia são customizados para a sua operação e estão no seu contrato. Dúvidas? Fale com a Matriz.")}<p>Você convida, aprova e desliga os vendedores da sua equipe, acompanha o ranking e o resultado da unidade.</p>`,
        "O link vale por 48 horas. Cada vendedor entra pelo convite que você enviar e recebe o próprio e-mail de acesso.",
        `A franquia ${template.franquia} (${template.cidade_uf}) está ativa no modelo Full — o único com equipe abaixo.\n\nSuas condições comerciais: As regras de comissionamento e o modelo operacional da sua franquia são customizados para a sua operação e estão no seu contrato. Dúvidas? Fale com a Matriz.\n\nVocê convida, aprova e desliga os vendedores da sua equipe, acompanha o ranking e o resultado da unidade.`,
        "O link vale por 48 horas. Cada vendedor entra pelo convite que você enviar e recebe o próprio e-mail de acesso.",
      );
    case "franquia_individual":
      return welcome(
        `Boas-vindas Supper! Sua franquia ${template.modelo} está ativa`,
        template.nome,
        link,
        `<p>Sua franquia está ativa no modelo <strong>${template.modelo}</strong>. Nas classificações Individuais você <strong>opera como vendedor</strong>: atende, cota e acompanha os próprios resultados.</p>${detail("Suas condições comerciais", "Cada classificação Individual (Smart, Conecta, Light, Link ou Flex) tem um modelo operacional próprio, customizado para a sua operação e definido em contrato.")}`,
        `O link vale por 48 horas. Você se reporta a ${escapeHtml(template.responsavel)} — vínculo definido pelo seu convite.`,
        `Sua franquia está ativa no modelo ${template.modelo}. Nas classificações Individuais você opera como vendedor: atende, cota e acompanha os próprios resultados.\n\nSuas condições comerciais: Cada classificação Individual (Smart, Conecta, Light, Link ou Flex) tem um modelo operacional próprio, customizado para a sua operação e definido em contrato.`,
        `O link vale por 48 horas. Você se reporta a ${template.responsavel} — vínculo definido pelo seu convite.`,
      );
    case "vendedor":
      return welcome(
        "Boas-vindas Supper! Seu acesso de vendedor",
        template.nome,
        link,
        `<p>Seu acesso de <strong>vendedor</strong> está liberado em ${template.origem}. Você enxerga a sua carteira e as suas cotações — nunca dados de outros vendedores.</p>${detail("Seu dia a dia no sistema", "Início · Atender agora · Pipeline · Lead Manual · Cotações · Propostas · Aceite & transmissão · Extrato de vendas · Mensagens prontas")}<p>Atenção ao SLA: o primeiro contato com um lead novo deve sair em <strong>até 3 minutos</strong>. Passou disso, o lead volta para a fila.</p>`,
        `O link vale por 48 horas. Você se reporta a ${escapeHtml(template.responsavel)} — vínculo definido pelo seu convite.`,
        `Seu acesso de vendedor está liberado em ${template.origem}. Você enxerga a sua carteira e as suas cotações — nunca dados de outros vendedores.\n\nSeu dia a dia no sistema: Início · Atender agora · Pipeline · Lead Manual · Cotações · Propostas · Aceite & transmissão · Extrato de vendas · Mensagens prontas\n\nAtenção ao SLA: o primeiro contato com um lead novo deve sair em até 3 minutos. Passou disso, o lead volta para a fila.`,
        `O link vale por 48 horas. Você se reporta a ${template.responsavel} — vínculo definido pelo seu convite.`,
      );
  }
}
