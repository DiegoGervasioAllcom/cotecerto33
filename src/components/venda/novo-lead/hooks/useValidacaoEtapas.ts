import { useState } from "react";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";
import { veiculoSchema } from "@/lib/schemas/cotacaoVeiculo.schema";
import { perfilSchema } from "@/lib/schemas/cotacaoPerfil.schema";
import { coberturasSchema } from "@/lib/schemas/cotacaoCoberturas.schema";
import type { Form } from "../types";

/**
 * Validação por etapa do wizard (Zod), espelhando as constraints do banco.
 * Valida só ao avançar (não no autosave). Retorna true se pode avançar.
 */
export function useValidacaoEtapas(
  f: Form,
  marcas: { codigo: string; nome: string }[],
  modelos: { codigo: number; nome: string }[],
  fipeValor: string,
) {
  const [erros, setErros] = useState<Record<string, string>>({});

  function validarEtapa(atual: number): boolean {
    if (atual === 0) {
      const r = seguradoSchema.safeParse({
        cpf: f.cpf,
        pessoa: f.pessoa,
        nome: f.nome,
        nomeSocial: f.nomeSocial,
        sexo: f.sexo,
        estadoCivil: f.estadoCivil,
        celular: f.celular,
        telRes: f.telRes,
        email: f.email,
        cep: f.cep,
        logradouro: f.logradouro,
        bairro: f.bairro,
        cidade: f.cidade,
        uf: f.uf,
      });
      if (!r.success) {
        const novos: Record<string, string> = {};
        for (const issue of r.error.issues) {
          const campo = String(issue.path[0] ?? "");
          if (campo && !novos[campo]) novos[campo] = issue.message;
        }
        setErros(novos);
        return false;
      }
      setErros({});
      return true;
    }
    if (atual === 1) {
      const r = seguroSchema.safeParse({
        tipoSeguro: f.tipoSeguro,
        categoria: f.categoria,
        ramo: f.ramo,
        ciaAtual: f.ciaAtual,
        ciAtual: f.ciAtual,
        classeBonus: f.classeBonus,
        apoliceAtual: f.apoliceAtual,
      });
      if (!r.success) {
        const novos: Record<string, string> = {};
        for (const issue of r.error.issues) {
          const campo = String(issue.path[0] ?? "");
          if (campo && !novos[campo]) novos[campo] = issue.message;
        }
        setErros(novos);
        return false;
      }
      setErros({});
      return true;
    }
    if (atual === 2) {
      const r = veiculoSchema.safeParse({
        placa: f.placa,
        chassi: f.chassi,
        renavam: f.renavam,
        marcaCodigo: f.marca,
        modeloCodigo: f.modelo,
        marcaNome: marcas.find((m) => m.codigo === f.marca)?.nome || "",
        modeloNome: modelos.find((m) => String(m.codigo) === f.modelo)?.nome || "",
        anoModelo: f.anoModelo,
        anoFab: f.anoFab,
        combustivel: f.combustivel,
        cor: f.cor,
        banco: f.banco,
        usoComercial: f.usoComercial,
        kmMensal: f.kmMensal,
        fipeValor: fipeValor,
        tipoUso: f.tipoUso,
        usoTrabalho: f.usoTrabalho,
        usoEstudo: f.usoEstudo,
        categoriaTaxi: f.categoriaTaxi,
        utilizacaoLocadora: f.utilizacaoLocadora,
        condutoresQueUtilizam: f.condutoresQueUtilizam,
        cepCirculacao: f.cepCirculacao,
        numPassageiros: f.numPassageiros,
        leilao: f.leilao,
        isencaoImposto: f.isencaoImposto,
        valorAdaptacaoPcd: f.valorAdaptacaoPcd,
        antifurto: f.antifurto,
        coberturaBlindagem: f.coberturaBlindagem,
        valorBlindagem: f.valorBlindagem,
        valorKitGas: f.valorKitGas,
      });
      if (!r.success) {
        const novos: Record<string, string> = {};
        for (const issue of r.error.issues) {
          const campo = String(issue.path[0] ?? "");
          if (campo && !novos[campo]) novos[campo] = issue.message;
        }
        setErros(novos);
        return false;
      }
      setErros({});
      return true;
    }
    if (atual === 3) {
      const r = perfilSchema.safeParse({
        condCpf: f.condCpf,
        condNome: f.condNome,
        condSexo: f.condSexo,
        condEstadoCivil: f.condEstadoCivil,
        condRelacao: f.condRelacao,
        condNomeSocial: f.condNomeSocial,
        condTempoHabilitacao: f.condTempoHabilitacao,
        profissao: f.profissao,
        cepPernoite: f.cepPernoite,
        tipoGaragem: f.tipoGaragem,
        relacaoComProprietario: f.relacaoComProprietario,
        proprietarioCpf: f.proprietarioCpf,
        proprietarioCnpj: f.proprietarioCnpj,
        proprietarioNome: f.proprietarioNome,
        proprietarioNomeSocial: f.proprietarioNomeSocial,
        proprietarioSexo: f.proprietarioSexo,
        proprietarioEstadoCivil: f.proprietarioEstadoCivil,
        tipoResidencia: f.tipoResidencia,
        tipoAtividadeEmpresa: f.tipoAtividadeEmpresa,
        ramoAtividade: f.ramoAtividade,
        profissaoPrincipalCondutor: f.profissaoPrincipalCondutor,
      });
      if (!r.success) {
        const novos: Record<string, string> = {};
        for (const issue of r.error.issues) {
          const campo = String(issue.path[0] ?? "");
          if (campo && !novos[campo]) novos[campo] = issue.message;
        }
        setErros(novos);
        return false;
      }
      setErros({});
      return true;
    }
    if (atual === 4) {
      const r = coberturasSchema.safeParse({
        tipoCobertura: f.tipoCobertura,
        casco: f.casco,
        cascoValor: f.cascoValor,
        franquia: f.franquia,
        appMorte: f.appMorte,
        appInvalidez: f.appInval,
        dmh: f.dmh,
        rcfDm: f.rcfDm,
        rcfDc: f.rcfDc,
        carroReserva: f.carroReserva,
        assist24: f.assist24,
        modalidade: f.modalidade,
        percentualAjuste: f.percentualAjuste,
        franquiaPrimeiraOpcao: f.franquiaPrimeiraOpcao,
        franquiaSegundaOpcao: f.franquiaSegundaOpcao,
        danosMorais: f.danosMorais,
        despesasExtras: f.despesasExtras,
        maisAssistenciasSeguradora: f.maisAssistenciasSeguradora,
      });
      if (!r.success) {
        const novos: Record<string, string> = {};
        for (const issue of r.error.issues) {
          const campo = String(issue.path[0] ?? "");
          if (campo && !novos[campo]) novos[campo] = issue.message;
        }
        setErros(novos);
        return false;
      }
      setErros({});
      return true;
    }
    setErros({});
    return true;
  }

  return { erros, validarEtapa };
}
