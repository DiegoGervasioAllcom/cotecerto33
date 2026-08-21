export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      acesso_emissoes: {
        Row: {
          ativado_em: string | null;
          criado_em: string;
          criado_por: string;
          empresa_id: string;
          envio_confirmado_em: string | null;
          id: string;
          numero: number;
          outbox_id: string;
          profile_id: string;
          status: string;
        };
        Insert: {
          ativado_em?: string | null;
          criado_em?: string;
          criado_por: string;
          empresa_id: string;
          envio_confirmado_em?: string | null;
          id?: string;
          numero: number;
          outbox_id: string;
          profile_id: string;
          status?: string;
        };
        Update: {
          ativado_em?: string | null;
          criado_em?: string;
          criado_por?: string;
          empresa_id?: string;
          envio_confirmado_em?: string | null;
          id?: string;
          numero?: number;
          outbox_id?: string;
          profile_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acesso_emissoes_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acesso_emissoes_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "acesso_emissoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acesso_emissoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "acesso_emissoes_outbox_id_fkey";
            columns: ["outbox_id"];
            isOneToOne: true;
            referencedRelation: "email_outbox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acesso_emissoes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acesso_emissoes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      areas: {
        Row: {
          chave: string;
          disponivel: boolean;
          label: string;
          ordem: number;
          rota: string | null;
        };
        Insert: {
          chave: string;
          disponivel?: boolean;
          label: string;
          ordem: number;
          rota?: string | null;
        };
        Update: {
          chave?: string;
          disponivel?: boolean;
          label?: string;
          ordem?: number;
          rota?: string | null;
        };
        Relationships: [];
      };
      campanhas_elite: {
        Row: {
          ativa: boolean;
          criado_em: string;
          faixas: Json;
          id: string;
          nome: string;
          periodo: string | null;
          tipo: string;
        };
        Insert: {
          ativa?: boolean;
          criado_em?: string;
          faixas: Json;
          id?: string;
          nome: string;
          periodo?: string | null;
          tipo: string;
        };
        Update: {
          ativa?: boolean;
          criado_em?: string;
          faixas?: Json;
          id?: string;
          nome?: string;
          periodo?: string | null;
          tipo?: string;
        };
        Relationships: [];
      };
      canais: {
        Row: {
          ativo: boolean;
          criado_em: string;
          empresa_id: string | null;
          exibir_funil: boolean;
          id: string;
          nome: string;
          ordem: number;
          tipo: string;
        };
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          empresa_id?: string | null;
          exibir_funil?: boolean;
          id?: string;
          nome: string;
          ordem?: number;
          tipo: string;
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          empresa_id?: string | null;
          exibir_funil?: boolean;
          id?: string;
          nome?: string;
          ordem?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "canais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "canais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      cargo_areas: {
        Row: {
          area_chave: string;
          cargo_id: string;
        };
        Insert: {
          area_chave: string;
          cargo_id: string;
        };
        Update: {
          area_chave?: string;
          cargo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cargo_areas_area_chave_fkey";
            columns: ["area_chave"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["chave"];
          },
          {
            foreignKeyName: "cargo_areas_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
        ];
      };
      cargos: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          descricao: string | null;
          id: string;
          nome: string;
          preset: boolean;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id: string;
          nome: string;
          preset?: boolean;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          preset?: boolean;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          criado_em: string;
          documento: string | null;
          email: string | null;
          empresa_id: string | null;
          id: string;
          nome: string;
          telefone: string | null;
        };
        Insert: {
          criado_em?: string;
          documento?: string | null;
          email?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome: string;
          telefone?: string | null;
        };
        Update: {
          criado_em?: string;
          documento?: string | null;
          email?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome?: string;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clientes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      clt_config: {
        Row: {
          atualizado_em: string;
          fator_novas: Json;
          fator_novas_num: Json;
          fator_remalho: Json;
          fator_remalho_num: Json;
          id: string;
          progressiva: Json;
          progressiva_num: Json;
          regras: Json;
          seguradora_adic: Json;
          seguradora_planos: Json;
        };
        Insert: {
          atualizado_em?: string;
          fator_novas?: Json;
          fator_novas_num?: Json;
          fator_remalho?: Json;
          fator_remalho_num?: Json;
          id?: string;
          progressiva?: Json;
          progressiva_num?: Json;
          regras?: Json;
          seguradora_adic?: Json;
          seguradora_planos?: Json;
        };
        Update: {
          atualizado_em?: string;
          fator_novas?: Json;
          fator_novas_num?: Json;
          fator_remalho?: Json;
          fator_remalho_num?: Json;
          id?: string;
          progressiva?: Json;
          progressiva_num?: Json;
          regras?: Json;
          seguradora_adic?: Json;
          seguradora_planos?: Json;
        };
        Relationships: [];
      };
      comissao_lancamentos: {
        Row: {
          beneficiario_id: string | null;
          competencia: string | null;
          criado_em: string;
          criado_por: string | null;
          descricao: string;
          empresa_id: string | null;
          id: string;
          origem: string;
          papel: string | null;
          proposta_id: string | null;
          referencia: string | null;
          regra: Json | null;
          seguradora: string | null;
          tipo: string;
          valor: number;
          vendedor_id: string;
        };
        Insert: {
          beneficiario_id?: string | null;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          descricao: string;
          empresa_id?: string | null;
          id?: string;
          origem?: string;
          papel?: string | null;
          proposta_id?: string | null;
          referencia?: string | null;
          regra?: Json | null;
          seguradora?: string | null;
          tipo: string;
          valor: number;
          vendedor_id: string;
        };
        Update: {
          beneficiario_id?: string | null;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          empresa_id?: string | null;
          id?: string;
          origem?: string;
          papel?: string | null;
          proposta_id?: string | null;
          referencia?: string | null;
          regra?: Json | null;
          seguradora?: string | null;
          tipo?: string;
          valor?: number;
          vendedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comissao_lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
        ];
      };
      comissao_origem_config: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
          descricao: string | null;
          origem: string;
          pct: number;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          descricao?: string | null;
          origem: string;
          pct: number;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          descricao?: string | null;
          origem?: string;
          pct?: number;
        };
        Relationships: [];
      };
      comissao_regras: {
        Row: {
          atualizado_em: string;
          descricao: string | null;
          id: string;
          papel: string;
          parametros: Json;
        };
        Insert: {
          atualizado_em?: string;
          descricao?: string | null;
          id?: string;
          papel: string;
          parametros?: Json;
        };
        Update: {
          atualizado_em?: string;
          descricao?: string | null;
          id?: string;
          papel?: string;
          parametros?: Json;
        };
        Relationships: [];
      };
      configuracoes_gerais: {
        Row: {
          aprovacao_dupla_comissao: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
          auditoria_comissoes: boolean;
          exigir_motivo_estorno: boolean;
          id: string;
          meta_franquia: number;
          meta_vendedor: number;
          notif_renovacao_vencer: boolean;
          notif_resumo_diario: boolean;
          notif_sla_estourado: boolean;
          notif_venda_nao_paga: boolean;
        };
        Insert: {
          aprovacao_dupla_comissao?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          auditoria_comissoes?: boolean;
          exigir_motivo_estorno?: boolean;
          id?: string;
          meta_franquia?: number;
          meta_vendedor?: number;
          notif_renovacao_vencer?: boolean;
          notif_resumo_diario?: boolean;
          notif_sla_estourado?: boolean;
          notif_venda_nao_paga?: boolean;
        };
        Update: {
          aprovacao_dupla_comissao?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          auditoria_comissoes?: boolean;
          exigir_motivo_estorno?: boolean;
          id?: string;
          meta_franquia?: number;
          meta_vendedor?: number;
          notif_renovacao_vencer?: boolean;
          notif_resumo_diario?: boolean;
          notif_sla_estourado?: boolean;
          notif_venda_nao_paga?: boolean;
        };
        Relationships: [];
      };
      consultas_placa: {
        Row: {
          ano_fabricacao: string | null;
          ano_modelo: string | null;
          categoria: string | null;
          chassi: string | null;
          codigo_retorno: string | null;
          combustivel: string | null;
          consultado_por: string | null;
          cotacao_id: string | null;
          criado_em: string;
          empresa_id: string | null;
          erro: string | null;
          fipe_codigo: string | null;
          fipe_valor: number | null;
          id: string;
          local_fabricacao: string | null;
          marca: string | null;
          mensagem_retorno: string | null;
          modelo: string | null;
          motor: string | null;
          origem: string | null;
          payload: Json | null;
          placa: string;
          raw_xml: string | null;
          sucesso: boolean;
          tipo_carroceria: string | null;
          versao: string | null;
        };
        Insert: {
          ano_fabricacao?: string | null;
          ano_modelo?: string | null;
          categoria?: string | null;
          chassi?: string | null;
          codigo_retorno?: string | null;
          combustivel?: string | null;
          consultado_por?: string | null;
          cotacao_id?: string | null;
          criado_em?: string;
          empresa_id?: string | null;
          erro?: string | null;
          fipe_codigo?: string | null;
          fipe_valor?: number | null;
          id?: string;
          local_fabricacao?: string | null;
          marca?: string | null;
          mensagem_retorno?: string | null;
          modelo?: string | null;
          motor?: string | null;
          origem?: string | null;
          payload?: Json | null;
          placa: string;
          raw_xml?: string | null;
          sucesso?: boolean;
          tipo_carroceria?: string | null;
          versao?: string | null;
        };
        Update: {
          ano_fabricacao?: string | null;
          ano_modelo?: string | null;
          categoria?: string | null;
          chassi?: string | null;
          codigo_retorno?: string | null;
          combustivel?: string | null;
          consultado_por?: string | null;
          cotacao_id?: string | null;
          criado_em?: string;
          empresa_id?: string | null;
          erro?: string | null;
          fipe_codigo?: string | null;
          fipe_valor?: number | null;
          id?: string;
          local_fabricacao?: string | null;
          marca?: string | null;
          mensagem_retorno?: string | null;
          modelo?: string | null;
          motor?: string | null;
          origem?: string | null;
          payload?: Json | null;
          placa?: string;
          raw_xml?: string | null;
          sucesso?: boolean;
          tipo_carroceria?: string | null;
          versao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consultas_placa_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultas_placa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultas_placa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      convites: {
        Row: {
          cargo_id: string | null;
          codigo: string;
          criado_em: string;
          criado_por: string;
          escopo: string;
          expira_em: string;
          id: string;
          nome: string;
          perfil: string | null;
          token: string;
          trilha: string;
          usado_em: string | null;
          usado_por: string | null;
          vinc_empresa_id: string | null;
          vinc_tipo: string;
        };
        Insert: {
          cargo_id?: string | null;
          codigo: string;
          criado_em?: string;
          criado_por: string;
          escopo: string;
          expira_em: string;
          id?: string;
          nome: string;
          perfil?: string | null;
          token: string;
          trilha: string;
          usado_em?: string | null;
          usado_por?: string | null;
          vinc_empresa_id?: string | null;
          vinc_tipo: string;
        };
        Update: {
          cargo_id?: string | null;
          codigo?: string;
          criado_em?: string;
          criado_por?: string;
          escopo?: string;
          expira_em?: string;
          id?: string;
          nome?: string;
          perfil?: string | null;
          token?: string;
          trilha?: string;
          usado_em?: string | null;
          usado_por?: string | null;
          vinc_empresa_id?: string | null;
          vinc_tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convites_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "convites_usado_por_fkey";
            columns: ["usado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_usado_por_fkey";
            columns: ["usado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "convites_vinc_empresa_id_fkey";
            columns: ["vinc_empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_vinc_empresa_id_fkey";
            columns: ["vinc_empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      cotacao_coberturas: {
        Row: {
          app_invalidez: string | null;
          app_morte: string | null;
          assist_24: string | null;
          carro_reserva: string | null;
          casco: string | null;
          casco_valor: string | null;
          comissoes: Json;
          condicoes_especiais: Json;
          cotacao_id: string;
          danos_morais: string | null;
          descontos_agravos: Json;
          despesas_extras: string | null;
          franquia_primeira_opcao: string | null;
          franquia_segunda_opcao: string | null;
          mais_assistencias: boolean | null;
          mais_assistencias_seguradora: string | null;
          modalidade: string | null;
          pequenos_reparos: boolean | null;
          percentual_ajuste: string | null;
          rcf_dc: string | null;
          rcf_dm: string | null;
          tipo_cobertura: string | null;
          vidros: boolean | null;
        };
        Insert: {
          app_invalidez?: string | null;
          app_morte?: string | null;
          assist_24?: string | null;
          carro_reserva?: string | null;
          casco?: string | null;
          casco_valor?: string | null;
          comissoes?: Json;
          condicoes_especiais?: Json;
          cotacao_id: string;
          danos_morais?: string | null;
          descontos_agravos?: Json;
          despesas_extras?: string | null;
          franquia_primeira_opcao?: string | null;
          franquia_segunda_opcao?: string | null;
          mais_assistencias?: boolean | null;
          mais_assistencias_seguradora?: string | null;
          modalidade?: string | null;
          pequenos_reparos?: boolean | null;
          percentual_ajuste?: string | null;
          rcf_dc?: string | null;
          rcf_dm?: string | null;
          tipo_cobertura?: string | null;
          vidros?: boolean | null;
        };
        Update: {
          app_invalidez?: string | null;
          app_morte?: string | null;
          assist_24?: string | null;
          carro_reserva?: string | null;
          casco?: string | null;
          casco_valor?: string | null;
          comissoes?: Json;
          condicoes_especiais?: Json;
          cotacao_id?: string;
          danos_morais?: string | null;
          descontos_agravos?: Json;
          despesas_extras?: string | null;
          franquia_primeira_opcao?: string | null;
          franquia_segunda_opcao?: string | null;
          mais_assistencias?: boolean | null;
          mais_assistencias_seguradora?: string | null;
          modalidade?: string | null;
          pequenos_reparos?: boolean | null;
          percentual_ajuste?: string | null;
          rcf_dc?: string | null;
          rcf_dm?: string | null;
          tipo_cobertura?: string | null;
          vidros?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_coberturas_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_perfil: {
        Row: {
          cep_pernoite: string | null;
          cond_cpf: string | null;
          cond_estado_civil: string | null;
          cond_nasc: string | null;
          cond_nome: string | null;
          cond_nome_social: string | null;
          cond_relacao: string | null;
          cond_sexo: string | null;
          cond_tempo_habilitacao: string | null;
          condutor_mesmo: boolean | null;
          cotacao_id: string;
          jovens_18_25: boolean | null;
          jovens_18_25_detalhes: Json;
          profissao_principal_condutor: string | null;
          proprietario_cnpj: string | null;
          proprietario_cpf: string | null;
          proprietario_estado_civil: string | null;
          proprietario_nascimento: string | null;
          proprietario_nome: string | null;
          proprietario_nome_social: string | null;
          proprietario_sexo: string | null;
          proprietario_tipo_pessoa: string | null;
          ramo_atividade: string | null;
          relacao_com_proprietario: string | null;
          seg_proprietario: boolean;
          seguro_corretor_proximo: boolean | null;
          tipo_atividade_empresa: string | null;
          tipo_garagem: string | null;
          tipo_residencia: string | null;
        };
        Insert: {
          cep_pernoite?: string | null;
          cond_cpf?: string | null;
          cond_estado_civil?: string | null;
          cond_nasc?: string | null;
          cond_nome?: string | null;
          cond_nome_social?: string | null;
          cond_relacao?: string | null;
          cond_sexo?: string | null;
          cond_tempo_habilitacao?: string | null;
          condutor_mesmo?: boolean | null;
          cotacao_id: string;
          jovens_18_25?: boolean | null;
          jovens_18_25_detalhes?: Json;
          profissao_principal_condutor?: string | null;
          proprietario_cnpj?: string | null;
          proprietario_cpf?: string | null;
          proprietario_estado_civil?: string | null;
          proprietario_nascimento?: string | null;
          proprietario_nome?: string | null;
          proprietario_nome_social?: string | null;
          proprietario_sexo?: string | null;
          proprietario_tipo_pessoa?: string | null;
          ramo_atividade?: string | null;
          relacao_com_proprietario?: string | null;
          seg_proprietario?: boolean;
          seguro_corretor_proximo?: boolean | null;
          tipo_atividade_empresa?: string | null;
          tipo_garagem?: string | null;
          tipo_residencia?: string | null;
        };
        Update: {
          cep_pernoite?: string | null;
          cond_cpf?: string | null;
          cond_estado_civil?: string | null;
          cond_nasc?: string | null;
          cond_nome?: string | null;
          cond_nome_social?: string | null;
          cond_relacao?: string | null;
          cond_sexo?: string | null;
          cond_tempo_habilitacao?: string | null;
          condutor_mesmo?: boolean | null;
          cotacao_id?: string;
          jovens_18_25?: boolean | null;
          jovens_18_25_detalhes?: Json;
          profissao_principal_condutor?: string | null;
          proprietario_cnpj?: string | null;
          proprietario_cpf?: string | null;
          proprietario_estado_civil?: string | null;
          proprietario_nascimento?: string | null;
          proprietario_nome?: string | null;
          proprietario_nome_social?: string | null;
          proprietario_sexo?: string | null;
          proprietario_tipo_pessoa?: string | null;
          ramo_atividade?: string | null;
          relacao_com_proprietario?: string | null;
          seg_proprietario?: boolean;
          seguro_corretor_proximo?: boolean | null;
          tipo_atividade_empresa?: string | null;
          tipo_garagem?: string | null;
          tipo_residencia?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_perfil_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_premios: {
        Row: {
          cobertura: string | null;
          cotacao_id: string;
          criado_em: string;
          id: string;
          premio: number;
          seguradora: string;
          selecionada: boolean | null;
        };
        Insert: {
          cobertura?: string | null;
          cotacao_id: string;
          criado_em?: string;
          id?: string;
          premio?: number;
          seguradora: string;
          selecionada?: boolean | null;
        };
        Update: {
          cobertura?: string | null;
          cotacao_id?: string;
          criado_em?: string;
          id?: string;
          premio?: number;
          seguradora?: string;
          selecionada?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_premios_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_segurado: {
        Row: {
          bairro: string | null;
          celular: string | null;
          cep: string | null;
          cidade: string | null;
          cotacao_id: string;
          cpf_cnpj: string | null;
          email: string | null;
          estado_civil: string | null;
          logradouro: string | null;
          nascimento: string | null;
          nome: string | null;
          nome_social: string | null;
          numero: string | null;
          pessoa: string | null;
          sexo: string | null;
          sms_optin: boolean | null;
          tel_res: string | null;
          uf: string | null;
        };
        Insert: {
          bairro?: string | null;
          celular?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cotacao_id: string;
          cpf_cnpj?: string | null;
          email?: string | null;
          estado_civil?: string | null;
          logradouro?: string | null;
          nascimento?: string | null;
          nome?: string | null;
          nome_social?: string | null;
          numero?: string | null;
          pessoa?: string | null;
          sexo?: string | null;
          sms_optin?: boolean | null;
          tel_res?: string | null;
          uf?: string | null;
        };
        Update: {
          bairro?: string | null;
          celular?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cotacao_id?: string;
          cpf_cnpj?: string | null;
          email?: string | null;
          estado_civil?: string | null;
          logradouro?: string | null;
          nascimento?: string | null;
          nome?: string | null;
          nome_social?: string | null;
          numero?: string | null;
          pessoa?: string | null;
          sexo?: string | null;
          sms_optin?: boolean | null;
          tel_res?: string | null;
          uf?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_segurado_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_seguro: {
        Row: {
          apolice_atual: string | null;
          campanha: string | null;
          categoria: string | null;
          ci_atual: string | null;
          cia_atual: string | null;
          classe_bonus: string | null;
          cobertura_anterior: string | null;
          cotacao_id: string;
          fim_vigencia_anterior: string | null;
          grupo_producao: string | null;
          inicio_vigencia_anterior: string | null;
          observacoes: string | null;
          ramo: string | null;
          seguradoras_sel: string[] | null;
          status_apolice_anterior: string | null;
          sucursal_anterior: string | null;
          tipo_calculo: string | null;
          tipo_cobertura: string | null;
          tipo_seguro: string | null;
          vig_fim: string | null;
          vig_ini: string | null;
        };
        Insert: {
          apolice_atual?: string | null;
          campanha?: string | null;
          categoria?: string | null;
          ci_atual?: string | null;
          cia_atual?: string | null;
          classe_bonus?: string | null;
          cobertura_anterior?: string | null;
          cotacao_id: string;
          fim_vigencia_anterior?: string | null;
          grupo_producao?: string | null;
          inicio_vigencia_anterior?: string | null;
          observacoes?: string | null;
          ramo?: string | null;
          seguradoras_sel?: string[] | null;
          status_apolice_anterior?: string | null;
          sucursal_anterior?: string | null;
          tipo_calculo?: string | null;
          tipo_cobertura?: string | null;
          tipo_seguro?: string | null;
          vig_fim?: string | null;
          vig_ini?: string | null;
        };
        Update: {
          apolice_atual?: string | null;
          campanha?: string | null;
          categoria?: string | null;
          ci_atual?: string | null;
          cia_atual?: string | null;
          classe_bonus?: string | null;
          cobertura_anterior?: string | null;
          cotacao_id?: string;
          fim_vigencia_anterior?: string | null;
          grupo_producao?: string | null;
          inicio_vigencia_anterior?: string | null;
          observacoes?: string | null;
          ramo?: string | null;
          seguradoras_sel?: string[] | null;
          status_apolice_anterior?: string | null;
          sucursal_anterior?: string | null;
          tipo_calculo?: string | null;
          tipo_cobertura?: string | null;
          tipo_seguro?: string | null;
          vig_fim?: string | null;
          vig_ini?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_seguro_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_transmissoes: {
        Row: {
          capturado_em: string | null;
          cotacao_id: string;
          criado_em: string;
          forma_pagamento: string | null;
          id: string;
          mensagem: string | null;
          motivo: string | null;
          numero_cotacao_portal: string | null;
          parcelas: string | null;
          premio: number | null;
          produto: string | null;
          produto_id: string | null;
          proposta_id: string | null;
          seguradora: string | null;
          status: string;
        };
        Insert: {
          capturado_em?: string | null;
          cotacao_id: string;
          criado_em?: string;
          forma_pagamento?: string | null;
          id?: string;
          mensagem?: string | null;
          motivo?: string | null;
          numero_cotacao_portal?: string | null;
          parcelas?: string | null;
          premio?: number | null;
          produto?: string | null;
          produto_id?: string | null;
          proposta_id?: string | null;
          seguradora?: string | null;
          status?: string;
        };
        Update: {
          capturado_em?: string | null;
          cotacao_id?: string;
          criado_em?: string;
          forma_pagamento?: string | null;
          id?: string;
          mensagem?: string | null;
          motivo?: string | null;
          numero_cotacao_portal?: string | null;
          parcelas?: string | null;
          premio?: number | null;
          produto?: string | null;
          produto_id?: string | null;
          proposta_id?: string | null;
          seguradora?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_transmissoes_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cotacao_transmissoes_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacao_veiculo: {
        Row: {
          acessorios: boolean | null;
          acessorios_detalhes: Json;
          alienado: boolean | null;
          ano_fab: string | null;
          ano_modelo: string | null;
          antifurto: string | null;
          antifurto_detalhes: Json;
          banco: string | null;
          blindagem: boolean | null;
          categoria_taxi: string | null;
          cep_circulacao: string | null;
          chassi: string | null;
          chassi_remarcado: boolean | null;
          cobertura_blindagem: string | null;
          cobertura_kit_gas: boolean | null;
          com_franquia_blindagem: boolean | null;
          com_franquia_kit_gas: boolean | null;
          combustivel: string | null;
          condutores_que_utilizam: string | null;
          cor: string | null;
          cotacao_id: string;
          data_saida_concessionaria: string | null;
          equipamentos: boolean | null;
          fipe_valor: string | null;
          hdi_seguros_basico: boolean | null;
          isencao_imposto: string | null;
          kit_acessorios: boolean | null;
          kit_gas: boolean | null;
          km_mensal: string | null;
          leilao: string | null;
          marca_codigo: string | null;
          marca_nome: string | null;
          modelo_codigo: string | null;
          modelo_nome: string | null;
          odometro: string | null;
          opcionais: boolean | null;
          pcd_cnh_especial: boolean | null;
          placa: string | null;
          possui_antifurto_porto: boolean | null;
          renavam: string | null;
          tipo_cambio: string | null;
          tipo_uso: string | null;
          uso_comercial_dois_dias: boolean | null;
          uso_estudo: string | null;
          uso_trabalho: string | null;
          utilizacao_locadora: string | null;
          valor_adaptacao_pcd: string | null;
          valor_blindagem: string | null;
          valor_kit_gas: string | null;
          zero_km: boolean | null;
        };
        Insert: {
          acessorios?: boolean | null;
          acessorios_detalhes?: Json;
          alienado?: boolean | null;
          ano_fab?: string | null;
          ano_modelo?: string | null;
          antifurto?: string | null;
          antifurto_detalhes?: Json;
          banco?: string | null;
          blindagem?: boolean | null;
          categoria_taxi?: string | null;
          cep_circulacao?: string | null;
          chassi?: string | null;
          chassi_remarcado?: boolean | null;
          cobertura_blindagem?: string | null;
          cobertura_kit_gas?: boolean | null;
          com_franquia_blindagem?: boolean | null;
          com_franquia_kit_gas?: boolean | null;
          combustivel?: string | null;
          condutores_que_utilizam?: string | null;
          cor?: string | null;
          cotacao_id: string;
          data_saida_concessionaria?: string | null;
          equipamentos?: boolean | null;
          fipe_valor?: string | null;
          hdi_seguros_basico?: boolean | null;
          isencao_imposto?: string | null;
          kit_acessorios?: boolean | null;
          kit_gas?: boolean | null;
          km_mensal?: string | null;
          leilao?: string | null;
          marca_codigo?: string | null;
          marca_nome?: string | null;
          modelo_codigo?: string | null;
          modelo_nome?: string | null;
          odometro?: string | null;
          opcionais?: boolean | null;
          pcd_cnh_especial?: boolean | null;
          placa?: string | null;
          possui_antifurto_porto?: boolean | null;
          renavam?: string | null;
          tipo_cambio?: string | null;
          tipo_uso?: string | null;
          uso_comercial_dois_dias?: boolean | null;
          uso_estudo?: string | null;
          uso_trabalho?: string | null;
          utilizacao_locadora?: string | null;
          valor_adaptacao_pcd?: string | null;
          valor_blindagem?: string | null;
          valor_kit_gas?: string | null;
          zero_km?: boolean | null;
        };
        Update: {
          acessorios?: boolean | null;
          acessorios_detalhes?: Json;
          alienado?: boolean | null;
          ano_fab?: string | null;
          ano_modelo?: string | null;
          antifurto?: string | null;
          antifurto_detalhes?: Json;
          banco?: string | null;
          blindagem?: boolean | null;
          categoria_taxi?: string | null;
          cep_circulacao?: string | null;
          chassi?: string | null;
          chassi_remarcado?: boolean | null;
          cobertura_blindagem?: string | null;
          cobertura_kit_gas?: boolean | null;
          com_franquia_blindagem?: boolean | null;
          com_franquia_kit_gas?: boolean | null;
          combustivel?: string | null;
          condutores_que_utilizam?: string | null;
          cor?: string | null;
          cotacao_id?: string;
          data_saida_concessionaria?: string | null;
          equipamentos?: boolean | null;
          fipe_valor?: string | null;
          hdi_seguros_basico?: boolean | null;
          isencao_imposto?: string | null;
          kit_acessorios?: boolean | null;
          kit_gas?: boolean | null;
          km_mensal?: string | null;
          leilao?: string | null;
          marca_codigo?: string | null;
          marca_nome?: string | null;
          modelo_codigo?: string | null;
          modelo_nome?: string | null;
          odometro?: string | null;
          opcionais?: boolean | null;
          pcd_cnh_especial?: boolean | null;
          placa?: string | null;
          possui_antifurto_porto?: boolean | null;
          renavam?: string | null;
          tipo_cambio?: string | null;
          tipo_uso?: string | null;
          uso_comercial_dois_dias?: boolean | null;
          uso_estudo?: string | null;
          uso_trabalho?: string | null;
          utilizacao_locadora?: string | null;
          valor_adaptacao_pcd?: string | null;
          valor_blindagem?: string | null;
          valor_kit_gas?: string | null;
          zero_km?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacao_veiculo_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotacoes: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          destino_perda: string | null;
          destino_perda_sugerido: string | null;
          empresa_id: string;
          id: string;
          lead_id: string | null;
          motivo_perda: string | null;
          numero: number;
          observacao_perda: string | null;
          perdida_em: string | null;
          quiver_enviado_em: string | null;
          quiver_mensagem: string | null;
          quiver_resultado_raw: Json | null;
          ramo: string;
          responsavel_id: string | null;
          status: Database["public"]["Enums"]["cotacao_status"];
          step_atual: number;
          submotivo_perda: string | null;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          destino_perda?: string | null;
          destino_perda_sugerido?: string | null;
          empresa_id: string;
          id?: string;
          lead_id?: string | null;
          motivo_perda?: string | null;
          numero?: number;
          observacao_perda?: string | null;
          perdida_em?: string | null;
          quiver_enviado_em?: string | null;
          quiver_mensagem?: string | null;
          quiver_resultado_raw?: Json | null;
          ramo?: string;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["cotacao_status"];
          step_atual?: number;
          submotivo_perda?: string | null;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          destino_perda?: string | null;
          destino_perda_sugerido?: string | null;
          empresa_id?: string;
          id?: string;
          lead_id?: string | null;
          motivo_perda?: string | null;
          numero?: number;
          observacao_perda?: string | null;
          perdida_em?: string | null;
          quiver_enviado_em?: string | null;
          quiver_mensagem?: string | null;
          quiver_resultado_raw?: Json | null;
          ramo?: string;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["cotacao_status"];
          step_atual?: number;
          submotivo_perda?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cotacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "cotacoes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      desconto_politicas: {
        Row: {
          atualizado_em: string;
          condicoes: string | null;
          id: string;
          modelo: string;
          pct_maximo: number;
          seguradora_id: string;
        };
        Insert: {
          atualizado_em?: string;
          condicoes?: string | null;
          id?: string;
          modelo: string;
          pct_maximo: number;
          seguradora_id: string;
        };
        Update: {
          atualizado_em?: string;
          condicoes?: string | null;
          id?: string;
          modelo?: string;
          pct_maximo?: number;
          seguradora_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desconto_politicas_seguradora_id_fkey";
            columns: ["seguradora_id"];
            isOneToOne: false;
            referencedRelation: "seguradoras";
            referencedColumns: ["id"];
          },
        ];
      };
      desconto_solicitacoes: {
        Row: {
          cotacao_id: string;
          criado_em: string;
          id: string;
          nivel_atual: string | null;
          pct_concedido: number | null;
          pct_pedido: number;
          resolvido_em: string | null;
          seguradora_id: string;
          solicitante_id: string;
          status: string;
        };
        Insert: {
          cotacao_id: string;
          criado_em?: string;
          id?: string;
          nivel_atual?: string | null;
          pct_concedido?: number | null;
          pct_pedido: number;
          resolvido_em?: string | null;
          seguradora_id: string;
          solicitante_id: string;
          status?: string;
        };
        Update: {
          cotacao_id?: string;
          criado_em?: string;
          id?: string;
          nivel_atual?: string | null;
          pct_concedido?: number | null;
          pct_pedido?: number;
          resolvido_em?: string | null;
          seguradora_id?: string;
          solicitante_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desconto_solicitacoes_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desconto_solicitacoes_nivel_atual_fkey";
            columns: ["nivel_atual"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desconto_solicitacoes_nivel_atual_fkey";
            columns: ["nivel_atual"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "desconto_solicitacoes_seguradora_id_fkey";
            columns: ["seguradora_id"];
            isOneToOne: false;
            referencedRelation: "seguradoras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desconto_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desconto_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      desconto_trilha: {
        Row: {
          acao: string;
          autor_id: string | null;
          criado_em: string;
          id: string;
          observacao: string | null;
          pct: number | null;
          solicitacao_id: string;
        };
        Insert: {
          acao: string;
          autor_id?: string | null;
          criado_em?: string;
          id?: string;
          observacao?: string | null;
          pct?: number | null;
          solicitacao_id: string;
        };
        Update: {
          acao?: string;
          autor_id?: string | null;
          criado_em?: string;
          id?: string;
          observacao?: string | null;
          pct?: number | null;
          solicitacao_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desconto_trilha_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desconto_trilha_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "desconto_trilha_solicitacao_id_fkey";
            columns: ["solicitacao_id"];
            isOneToOne: false;
            referencedRelation: "desconto_solicitacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      desligamento_solicitacoes: {
        Row: {
          alvo_profile_id: string;
          created_at: string;
          id: string;
          motivo: string;
          observacao: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          solicitante_id: string;
          status: string;
        };
        Insert: {
          alvo_profile_id: string;
          created_at?: string;
          id?: string;
          motivo: string;
          observacao?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          solicitante_id: string;
          status?: string;
        };
        Update: {
          alvo_profile_id?: string;
          created_at?: string;
          id?: string;
          motivo?: string;
          observacao?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          solicitante_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desligamento_solicitacoes_alvo_profile_id_fkey";
            columns: ["alvo_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desligamento_solicitacoes_alvo_profile_id_fkey";
            columns: ["alvo_profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "desligamento_solicitacoes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desligamento_solicitacoes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "desligamento_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desligamento_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      diretor_propostas: {
        Row: {
          acao: string;
          alvo_id: string;
          confirmado_por: string | null;
          criado_em: string;
          id: string;
          proposto_por: string;
          resolvido_em: string | null;
          status: string;
        };
        Insert: {
          acao: string;
          alvo_id: string;
          confirmado_por?: string | null;
          criado_em?: string;
          id?: string;
          proposto_por: string;
          resolvido_em?: string | null;
          status?: string;
        };
        Update: {
          acao?: string;
          alvo_id?: string;
          confirmado_por?: string | null;
          criado_em?: string;
          id?: string;
          proposto_por?: string;
          resolvido_em?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diretor_propostas_alvo_id_fkey";
            columns: ["alvo_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diretor_propostas_alvo_id_fkey";
            columns: ["alvo_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "diretor_propostas_confirmado_por_fkey";
            columns: ["confirmado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diretor_propostas_confirmado_por_fkey";
            columns: ["confirmado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "diretor_propostas_proposto_por_fkey";
            columns: ["proposto_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diretor_propostas_proposto_por_fkey";
            columns: ["proposto_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      distribuicao_config: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          automatico_on: boolean;
          criterios: Json;
          id: string;
          modo: string;
          sla_segundos: number;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          automatico_on?: boolean;
          criterios?: Json;
          id?: string;
          modo?: string;
          sla_segundos?: number;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          automatico_on?: boolean;
          criterios?: Json;
          id?: string;
          modo?: string;
          sla_segundos?: number;
        };
        Relationships: [];
      };
      email_outbox: {
        Row: {
          criado_em: string;
          criado_por: string;
          destinatario: string;
          empresa_id: string;
          enviado_em: string | null;
          id: string;
          lease_token: string | null;
          payload: Json;
          processando_em: string | null;
          provider_id: string | null;
          status: string;
          tentativas: number;
          tipo: string;
          ultimo_erro: string | null;
        };
        Insert: {
          criado_em?: string;
          criado_por: string;
          destinatario: string;
          empresa_id: string;
          enviado_em?: string | null;
          id?: string;
          lease_token?: string | null;
          payload?: Json;
          processando_em?: string | null;
          provider_id?: string | null;
          status?: string;
          tentativas?: number;
          tipo: string;
          ultimo_erro?: string | null;
        };
        Update: {
          criado_em?: string;
          criado_por?: string;
          destinatario?: string;
          empresa_id?: string;
          enviado_em?: string | null;
          id?: string;
          lease_token?: string | null;
          payload?: Json;
          processando_em?: string | null;
          provider_id?: string | null;
          status?: string;
          tentativas?: number;
          tipo?: string;
          ultimo_erro?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_outbox_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      empresas: {
        Row: {
          aprovada_em: string | null;
          bonus_campanha: number | null;
          celular: string | null;
          cidade: string | null;
          contato_emergencia: string | null;
          convite_id: string | null;
          created_at: string;
          criado_por: string | null;
          dados_bancarios: string | null;
          dados_cadastro: Json;
          data_nascimento: string | null;
          dia_pagamento: number | null;
          documento: string;
          email: string | null;
          endereco: string | null;
          escopo_manual: string | null;
          faixa_elite_pct: number | null;
          faixa_elite_valor: number | null;
          id: string;
          isenta: boolean | null;
          leads_dia: number | null;
          modelo_id: string | null;
          nome: string;
          pendencia_em: string | null;
          pendencia_motivo: string | null;
          perc_comissao: number | null;
          perc_equipe: number | null;
          pix_chave: string | null;
          reclassificacao_motivo: string | null;
          reclassificado_em: string | null;
          recusa_motivo: string | null;
          recusada_em: string | null;
          rg: string | null;
          royalties_fpp: number | null;
          socio_cpf: string | null;
          socio_nome: string | null;
          socio_rg: string | null;
          status: Database["public"]["Enums"]["empresa_status"];
          telefone: string | null;
          telefone_recado: string | null;
          tipo: Database["public"]["Enums"]["empresa_tipo"];
          uf: string | null;
        };
        Insert: {
          aprovada_em?: string | null;
          bonus_campanha?: number | null;
          celular?: string | null;
          cidade?: string | null;
          contato_emergencia?: string | null;
          convite_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          dados_bancarios?: string | null;
          dados_cadastro?: Json;
          data_nascimento?: string | null;
          dia_pagamento?: number | null;
          documento: string;
          email?: string | null;
          endereco?: string | null;
          escopo_manual?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          id?: string;
          isenta?: boolean | null;
          leads_dia?: number | null;
          modelo_id?: string | null;
          nome: string;
          pendencia_em?: string | null;
          pendencia_motivo?: string | null;
          perc_comissao?: number | null;
          perc_equipe?: number | null;
          pix_chave?: string | null;
          reclassificacao_motivo?: string | null;
          reclassificado_em?: string | null;
          recusa_motivo?: string | null;
          recusada_em?: string | null;
          rg?: string | null;
          royalties_fpp?: number | null;
          socio_cpf?: string | null;
          socio_nome?: string | null;
          socio_rg?: string | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          telefone?: string | null;
          telefone_recado?: string | null;
          tipo: Database["public"]["Enums"]["empresa_tipo"];
          uf?: string | null;
        };
        Update: {
          aprovada_em?: string | null;
          bonus_campanha?: number | null;
          celular?: string | null;
          cidade?: string | null;
          contato_emergencia?: string | null;
          convite_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          dados_bancarios?: string | null;
          dados_cadastro?: Json;
          data_nascimento?: string | null;
          dia_pagamento?: number | null;
          documento?: string;
          email?: string | null;
          endereco?: string | null;
          escopo_manual?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          id?: string;
          isenta?: boolean | null;
          leads_dia?: number | null;
          modelo_id?: string | null;
          nome?: string;
          pendencia_em?: string | null;
          pendencia_motivo?: string | null;
          perc_comissao?: number | null;
          perc_equipe?: number | null;
          pix_chave?: string | null;
          reclassificacao_motivo?: string | null;
          reclassificado_em?: string | null;
          recusa_motivo?: string | null;
          recusada_em?: string | null;
          rg?: string | null;
          royalties_fpp?: number | null;
          socio_cpf?: string | null;
          socio_nome?: string | null;
          socio_rg?: string | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          telefone?: string | null;
          telefone_recado?: string | null;
          tipo?: Database["public"]["Enums"]["empresa_tipo"];
          uf?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "empresas_convite_id_fkey";
            columns: ["convite_id"];
            isOneToOne: false;
            referencedRelation: "convites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "empresas_modelo_id_fkey";
            columns: ["modelo_id"];
            isOneToOne: false;
            referencedRelation: "modelos_franquia";
            referencedColumns: ["id"];
          },
        ];
      };
      full_comissao_complementos: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          bonus_campanha: string | null;
          comissao_renovacao_pct: number;
          comissao_venda_pct: number;
          empresa_id: string;
          meta_padrao_equipe: string | null;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          bonus_campanha?: string | null;
          comissao_renovacao_pct: number;
          comissao_venda_pct: number;
          empresa_id: string;
          meta_padrao_equipe?: string | null;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          bonus_campanha?: string | null;
          comissao_renovacao_pct?: number;
          comissao_venda_pct?: number;
          empresa_id?: string;
          meta_padrao_equipe?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "full_comissao_complementos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_comissao_complementos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      full_master_historico: {
        Row: {
          acao: string;
          criado_em: string;
          criado_por: string | null;
          full_profile_id: string;
          id: string;
          master_anterior_id: string | null;
          master_novo_id: string | null;
          motivo: string;
        };
        Insert: {
          acao: string;
          criado_em?: string;
          criado_por?: string | null;
          full_profile_id: string;
          id?: string;
          master_anterior_id?: string | null;
          master_novo_id?: string | null;
          motivo: string;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          criado_por?: string | null;
          full_profile_id?: string;
          id?: string;
          master_anterior_id?: string | null;
          master_novo_id?: string | null;
          motivo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "full_master_historico_full_profile_id_fkey";
            columns: ["full_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_master_historico_full_profile_id_fkey";
            columns: ["full_profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "full_master_historico_master_anterior_id_fkey";
            columns: ["master_anterior_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_master_historico_master_anterior_id_fkey";
            columns: ["master_anterior_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "full_master_historico_master_novo_id_fkey";
            columns: ["master_novo_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_master_historico_master_novo_id_fkey";
            columns: ["master_novo_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      full_vendedor_config: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          comissao_renovacao_pct: number | null;
          comissao_venda_pct: number | null;
          empresa_id: string;
          personalizado: boolean;
          profile_id: string;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          comissao_renovacao_pct?: number | null;
          comissao_venda_pct?: number | null;
          empresa_id: string;
          personalizado?: boolean;
          profile_id: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          comissao_renovacao_pct?: number | null;
          comissao_venda_pct?: number | null;
          empresa_id?: string;
          personalizado?: boolean;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "full_vendedor_config_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_vendedor_config_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "full_vendedor_config_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_vendedor_config_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      full_vendedor_historico: {
        Row: {
          acao: string;
          criado_em: string;
          criado_por: string | null;
          detalhes: Json;
          empresa_id: string;
          id: string;
          motivo: string | null;
          vendedor_id: string;
        };
        Insert: {
          acao: string;
          criado_em?: string;
          criado_por?: string | null;
          detalhes?: Json;
          empresa_id: string;
          id?: string;
          motivo?: string | null;
          vendedor_id: string;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          criado_por?: string | null;
          detalhes?: Json;
          empresa_id?: string;
          id?: string;
          motivo?: string | null;
          vendedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "full_vendedor_historico_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_vendedor_historico_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "full_vendedor_historico_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "full_vendedor_historico_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      historico_alteracoes: {
        Row: {
          area: string;
          autor_id: string | null;
          autor_nome: string;
          de_para: Json | null;
          empresa_id: string | null;
          id: string;
          o_que: string;
          quando: string;
        };
        Insert: {
          area: string;
          autor_id?: string | null;
          autor_nome: string;
          de_para?: Json | null;
          empresa_id?: string | null;
          id?: string;
          o_que: string;
          quando?: string;
        };
        Update: {
          area?: string;
          autor_id?: string | null;
          autor_nome?: string;
          de_para?: Json | null;
          empresa_id?: string | null;
          id?: string;
          o_que?: string;
          quando?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historico_alteracoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historico_alteracoes_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "historico_alteracoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historico_alteracoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      integracoes: {
        Row: {
          atualizado_em: string;
          descricao: string | null;
          id: string;
          nome: string;
          ordem: number;
          status: string;
        };
        Insert: {
          atualizado_em?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          ordem?: number;
          status?: string;
        };
        Update: {
          atualizado_em?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          ordem?: number;
          status?: string;
        };
        Relationships: [];
      };
      lead_eventos: {
        Row: {
          ator_id: string | null;
          criado_em: string;
          descricao: string | null;
          id: string;
          lead_id: string;
          meta: Json;
          tipo: string;
          titulo: string;
        };
        Insert: {
          ator_id?: string | null;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          lead_id: string;
          meta?: Json;
          tipo: string;
          titulo: string;
        };
        Update: {
          ator_id?: string | null;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          lead_id?: string;
          meta?: Json;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_eventos_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          arquivado: boolean;
          arquivado_em: string | null;
          atualizado_em: string;
          bloqueado: boolean;
          bloqueado_em: string | null;
          bloqueado_por: string | null;
          canal_id: string | null;
          cliente_id: string | null;
          contato: string | null;
          criado_em: string;
          dados: Json | null;
          destino_perda_final: string | null;
          destino_perda_sugerido: string | null;
          distribuido_em: string | null;
          em_avaliacao_matriz: boolean;
          empresa_id: string | null;
          id: string;
          motivo_bloqueio: string | null;
          motivo_perda: string | null;
          nome: string;
          observacao_perda: string | null;
          origem: string | null;
          perdida_em: string | null;
          renovacao_proposta_id: string | null;
          responsavel_id: string | null;
          sla_estourado_em: string | null;
          status_pipeline: Database["public"]["Enums"]["lead_status"];
          submotivo_perda: string | null;
          ultimo_atendimento_em: string | null;
          valor: number | null;
        };
        Insert: {
          arquivado?: boolean;
          arquivado_em?: string | null;
          atualizado_em?: string;
          bloqueado?: boolean;
          bloqueado_em?: string | null;
          bloqueado_por?: string | null;
          canal_id?: string | null;
          cliente_id?: string | null;
          contato?: string | null;
          criado_em?: string;
          dados?: Json | null;
          destino_perda_final?: string | null;
          destino_perda_sugerido?: string | null;
          distribuido_em?: string | null;
          em_avaliacao_matriz?: boolean;
          empresa_id?: string | null;
          id?: string;
          motivo_bloqueio?: string | null;
          motivo_perda?: string | null;
          nome?: string;
          observacao_perda?: string | null;
          origem?: string | null;
          perdida_em?: string | null;
          renovacao_proposta_id?: string | null;
          responsavel_id?: string | null;
          sla_estourado_em?: string | null;
          status_pipeline?: Database["public"]["Enums"]["lead_status"];
          submotivo_perda?: string | null;
          ultimo_atendimento_em?: string | null;
          valor?: number | null;
        };
        Update: {
          arquivado?: boolean;
          arquivado_em?: string | null;
          atualizado_em?: string;
          bloqueado?: boolean;
          bloqueado_em?: string | null;
          bloqueado_por?: string | null;
          canal_id?: string | null;
          cliente_id?: string | null;
          contato?: string | null;
          criado_em?: string;
          dados?: Json | null;
          destino_perda_final?: string | null;
          destino_perda_sugerido?: string | null;
          distribuido_em?: string | null;
          em_avaliacao_matriz?: boolean;
          empresa_id?: string | null;
          id?: string;
          motivo_bloqueio?: string | null;
          motivo_perda?: string | null;
          nome?: string;
          observacao_perda?: string | null;
          origem?: string | null;
          perdida_em?: string | null;
          renovacao_proposta_id?: string | null;
          responsavel_id?: string | null;
          sla_estourado_em?: string | null;
          status_pipeline?: Database["public"]["Enums"]["lead_status"];
          submotivo_perda?: string | null;
          ultimo_atendimento_em?: string | null;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_canal_id_fkey";
            columns: ["canal_id"];
            isOneToOne: false;
            referencedRelation: "canais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "leads_renovacao_proposta_id_fkey";
            columns: ["renovacao_proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
        ];
      };
      login_audit: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          ip: string | null;
          motivo_falha: string | null;
          sucesso: boolean;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          ip?: string | null;
          motivo_falha?: string | null;
          sucesso: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          ip?: string | null;
          motivo_falha?: string | null;
          sucesso?: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      mensagens_prontas: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          categoria: string | null;
          conteudo: string;
          criado_em: string;
          dia: number | null;
          escopo: Database["public"]["Enums"]["msg_escopo"];
          id: string;
          objetivo: string | null;
          owner_id: string | null;
          titulo: string;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string | null;
          conteudo: string;
          criado_em?: string;
          dia?: number | null;
          escopo?: Database["public"]["Enums"]["msg_escopo"];
          id?: string;
          objetivo?: string | null;
          owner_id?: string | null;
          titulo: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string | null;
          conteudo?: string;
          criado_em?: string;
          dia?: number | null;
          escopo?: Database["public"]["Enums"]["msg_escopo"];
          id?: string;
          objetivo?: string | null;
          owner_id?: string | null;
          titulo?: string;
        };
        Relationships: [];
      };
      metas: {
        Row: {
          ano: number;
          criado_em: string;
          escopo: Database["public"]["Enums"]["meta_escopo"];
          id: string;
          mes: number;
          meta_faturamento: number;
          meta_vendas: number;
          ref_id: string;
        };
        Insert: {
          ano: number;
          criado_em?: string;
          escopo: Database["public"]["Enums"]["meta_escopo"];
          id?: string;
          mes: number;
          meta_faturamento?: number;
          meta_vendas?: number;
          ref_id: string;
        };
        Update: {
          ano?: number;
          criado_em?: string;
          escopo?: Database["public"]["Enums"]["meta_escopo"];
          id?: string;
          mes?: number;
          meta_faturamento?: number;
          meta_vendas?: number;
          ref_id?: string;
        };
        Relationships: [];
      };
      modelo_master_config: {
        Row: {
          atualizado_em: string;
          base_calc: string;
          comissao_grupo: string;
          elite: Json;
          id: string;
          pagamento: string;
          royalties: string;
        };
        Insert: {
          atualizado_em?: string;
          base_calc?: string;
          comissao_grupo?: string;
          elite?: Json;
          id?: string;
          pagamento?: string;
          royalties?: string;
        };
        Update: {
          atualizado_em?: string;
          base_calc?: string;
          comissao_grupo?: string;
          elite?: Json;
          id?: string;
          pagamento?: string;
          royalties?: string;
        };
        Relationships: [];
      };
      modelo_supervisor_config: {
        Row: {
          atualizado_em: string;
          base_calc: string;
          comissao_grupo: string;
          id: string;
          pagamento: string;
          royalties: string;
        };
        Insert: {
          atualizado_em?: string;
          base_calc?: string;
          comissao_grupo?: string;
          id?: string;
          pagamento?: string;
          royalties?: string;
        };
        Update: {
          atualizado_em?: string;
          base_calc?: string;
          comissao_grupo?: string;
          id?: string;
          pagamento?: string;
          royalties?: string;
        };
        Relationships: [];
      };
      modelos_franquia: {
        Row: {
          ativo: boolean;
          criado_em: string;
          descricao: string | null;
          id: string;
          modalidade: string | null;
          nome: string;
          ordem: number;
          params: Json;
          perc_comissao_padrao: number;
          tipo: Database["public"]["Enums"]["modelo_tipo"];
        };
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          modalidade?: string | null;
          nome: string;
          ordem?: number;
          params?: Json;
          perc_comissao_padrao?: number;
          tipo?: Database["public"]["Enums"]["modelo_tipo"];
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          modalidade?: string | null;
          nome?: string;
          ordem?: number;
          params?: Json;
          perc_comissao_padrao?: number;
          tipo?: Database["public"]["Enums"]["modelo_tipo"];
        };
        Relationships: [];
      };
      movida_distribuicao_auditoria: {
        Row: {
          alias_normalizado: string | null;
          ator_id: string | null;
          criado_em: string;
          detalhes: Json;
          empresa_id: string | null;
          id: number;
          lead_id: string | null;
          loja_id: string | null;
          loja_informada: string | null;
          resultado: string;
          vendedor_id: string | null;
        };
        Insert: {
          alias_normalizado?: string | null;
          ator_id?: string | null;
          criado_em?: string;
          detalhes?: Json;
          empresa_id?: string | null;
          id?: never;
          lead_id?: string | null;
          loja_id?: string | null;
          loja_informada?: string | null;
          resultado: string;
          vendedor_id?: string | null;
        };
        Update: {
          alias_normalizado?: string | null;
          ator_id?: string | null;
          criado_em?: string;
          detalhes?: Json;
          empresa_id?: string | null;
          id?: never;
          lead_id?: string | null;
          loja_id?: string | null;
          loja_informada?: string | null;
          resultado?: string;
          vendedor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movida_distribuicao_auditoria_ator_id_fkey";
            columns: ["ator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_ator_id_fkey";
            columns: ["ator_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "movida_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_distribuicao_auditoria_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      movida_loja_aliases: {
        Row: {
          alias: string;
          alias_normalizado: string | null;
          criado_em: string;
          id: string;
          loja_id: string;
        };
        Insert: {
          alias: string;
          alias_normalizado?: string | null;
          criado_em?: string;
          id?: string;
          loja_id: string;
        };
        Update: {
          alias?: string;
          alias_normalizado?: string | null;
          criado_em?: string;
          id?: string;
          loja_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movida_loja_aliases_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "movida_lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      movida_loja_vendedores: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          limite_diario: number | null;
          loja_id: string;
          peso: number;
          vendedor_id: string;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          limite_diario?: number | null;
          loja_id: string;
          peso?: number;
          vendedor_id: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          limite_diario?: number | null;
          loja_id?: string;
          peso?: number;
          vendedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movida_loja_vendedores_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "movida_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_loja_vendedores_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_loja_vendedores_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      movida_lojas: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          exigir_online: boolean;
          id: string;
          nome: string;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          exigir_online?: boolean;
          id?: string;
          nome: string;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          exigir_online?: boolean;
          id?: string;
          nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movida_lojas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movida_lojas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      oportunidades: {
        Row: {
          comissao_paga: boolean;
          comissao_paga_em: string | null;
          comissao_valor: number;
          criado_em: string;
          empresa_id: string;
          estagio_id: string | null;
          id: string;
          lead_id: string | null;
          observacao: string | null;
          responsavel_id: string | null;
          valor: number | null;
        };
        Insert: {
          comissao_paga?: boolean;
          comissao_paga_em?: string | null;
          comissao_valor?: number;
          criado_em?: string;
          empresa_id: string;
          estagio_id?: string | null;
          id?: string;
          lead_id?: string | null;
          observacao?: string | null;
          responsavel_id?: string | null;
          valor?: number | null;
        };
        Update: {
          comissao_paga?: boolean;
          comissao_paga_em?: string | null;
          comissao_valor?: number;
          criado_em?: string;
          empresa_id?: string;
          estagio_id?: string | null;
          id?: string;
          lead_id?: string | null;
          observacao?: string | null;
          responsavel_id?: string | null;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "oportunidades_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "oportunidades_estagio_id_fkey";
            columns: ["estagio_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      perda_motivos: {
        Row: {
          ativo: boolean;
          id: number;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativo?: boolean;
          id?: number;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativo?: boolean;
          id?: number;
          nome?: string;
          ordem?: number;
        };
        Relationships: [];
      };
      perda_submotivos: {
        Row: {
          ativo: boolean;
          destino_sugerido: string;
          id: number;
          motivo_id: number;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativo?: boolean;
          destino_sugerido: string;
          id?: number;
          motivo_id: number;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativo?: boolean;
          destino_sugerido?: string;
          id?: number;
          motivo_id?: number;
          nome?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "perda_submotivos_motivo_id_fkey";
            columns: ["motivo_id"];
            isOneToOne: false;
            referencedRelation: "perda_motivos";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_stages: {
        Row: {
          cor: string | null;
          id: string;
          nome: string;
          ordem: number;
        };
        Insert: {
          cor?: string | null;
          id?: string;
          nome: string;
          ordem: number;
        };
        Update: {
          cor?: string | null;
          id?: string;
          nome?: string;
          ordem?: number;
        };
        Relationships: [];
      };
      planos: {
        Row: {
          ativo: boolean;
          codigo: string | null;
          created_at: string;
          descricao: string | null;
          id: string;
          nome: string;
          ordem: number;
          seguradora_id: string;
        };
        Insert: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          ordem?: number;
          seguradora_id: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          ordem?: number;
          seguradora_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planos_seguradora_id_fkey";
            columns: ["seguradora_id"];
            isOneToOne: false;
            referencedRelation: "seguradoras";
            referencedColumns: ["id"];
          },
        ];
      };
      premiacao_campanhas: {
        Row: {
          ativa: boolean;
          competencia: string | null;
          criado_em: string;
          criado_por: string | null;
          descricao: string | null;
          id: string;
          nome: string;
          seguradora_id: string | null;
        };
        Insert: {
          ativa?: boolean;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string | null;
          id?: string;
          nome: string;
          seguradora_id?: string | null;
        };
        Update: {
          ativa?: boolean;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string | null;
          id?: string;
          nome?: string;
          seguradora_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "premiacao_campanhas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premiacao_campanhas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "premiacao_campanhas_seguradora_id_fkey";
            columns: ["seguradora_id"];
            isOneToOne: false;
            referencedRelation: "seguradoras";
            referencedColumns: ["id"];
          },
        ];
      };
      premiacao_lancamentos: {
        Row: {
          campanha_id: string;
          competencia: string | null;
          criado_em: string;
          criado_por: string | null;
          empresa_id: string | null;
          id: string;
          observacao: string | null;
          pago_em: string | null;
          status: string;
          valor: number;
          vendedor_id: string;
        };
        Insert: {
          campanha_id: string;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          empresa_id?: string | null;
          id?: string;
          observacao?: string | null;
          pago_em?: string | null;
          status?: string;
          valor: number;
          vendedor_id: string;
        };
        Update: {
          campanha_id?: string;
          competencia?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          empresa_id?: string | null;
          id?: string;
          observacao?: string | null;
          pago_em?: string | null;
          status?: string;
          valor?: number;
          vendedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premiacao_lancamentos_campanha_id_fkey";
            columns: ["campanha_id"];
            isOneToOne: false;
            referencedRelation: "premiacao_campanhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premiacao_lancamentos_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      presence_eventos: {
        Row: {
          criado_em: string;
          id: string;
          meta: Json | null;
          tipo: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          meta?: Json | null;
          tipo: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          meta?: Json | null;
          tipo?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      produtos: {
        Row: {
          ativo: boolean;
          fixo: boolean;
          id: string;
          nome: string;
          ordem: number;
          tem_jornada: boolean;
        };
        Insert: {
          ativo?: boolean;
          fixo?: boolean;
          id: string;
          nome: string;
          ordem?: number;
          tem_jornada?: boolean;
        };
        Update: {
          ativo?: boolean;
          fixo?: boolean;
          id?: string;
          nome?: string;
          ordem?: number;
          tem_jornada?: boolean;
        };
        Relationships: [];
      };
      produtos_padrao: {
        Row: {
          bloco: string;
          produto_id: string;
        };
        Insert: {
          bloco: string;
          produto_id: string;
        };
        Update: {
          bloco?: string;
          produto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produtos_padrao_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_areas: {
        Row: {
          area_chave: string;
          profile_id: string;
        };
        Insert: {
          area_chave: string;
          profile_id: string;
        };
        Update: {
          area_chave?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_areas_area_chave_fkey";
            columns: ["area_chave"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["chave"];
          },
          {
            foreignKeyName: "profile_areas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_areas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profile_canais: {
        Row: {
          canal_id: string;
          profile_id: string;
        };
        Insert: {
          canal_id: string;
          profile_id: string;
        };
        Update: {
          canal_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_canais_canal_id_fkey";
            columns: ["canal_id"];
            isOneToOne: false;
            referencedRelation: "canais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_canais_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_canais_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profile_produtos: {
        Row: {
          produto_id: string;
          profile_id: string;
        };
        Insert: {
          produto_id: string;
          profile_id: string;
        };
        Update: {
          produto_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_produtos_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_produtos_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_produtos_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          aprovada_em: string | null;
          avatar_url: string | null;
          bonus_campanha: number | null;
          cargo_id: string | null;
          comissao_modelo: number | null;
          cpf: string | null;
          created_at: string;
          data_nascimento: string | null;
          desligado_em: string | null;
          desligado_motivo: string | null;
          dia_pagamento: number | null;
          dias_acesso: string[] | null;
          diretor: boolean;
          email: string;
          email_pessoal: string | null;
          empresa_id: string | null;
          equipe: string | null;
          estado_civil: string | null;
          faixa_elite_pct: number | null;
          faixa_elite_valor: number | null;
          funcao: string | null;
          hora_fim: string | null;
          hora_inicio: string | null;
          id: string;
          leads_dia: number | null;
          nome: string;
          performance_calculado_em: string | null;
          performance_motivo: Json | null;
          performance_revisado_em: string | null;
          performance_revisado_por: string | null;
          performance_revisao_motivo: string | null;
          performance_status: string | null;
          periodo_fim: string | null;
          periodo_inicio: string | null;
          royalties: number | null;
          salario_base: number | null;
          sexo: string | null;
          sobrenome: string | null;
          status: Database["public"]["Enums"]["empresa_status"];
          superior_id: string | null;
          telefone: string | null;
          telefone_comercial: string | null;
          telefone_residencial: string | null;
        };
        Insert: {
          aprovada_em?: string | null;
          avatar_url?: string | null;
          bonus_campanha?: number | null;
          cargo_id?: string | null;
          comissao_modelo?: number | null;
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          desligado_em?: string | null;
          desligado_motivo?: string | null;
          dia_pagamento?: number | null;
          dias_acesso?: string[] | null;
          diretor?: boolean;
          email?: string;
          email_pessoal?: string | null;
          empresa_id?: string | null;
          equipe?: string | null;
          estado_civil?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          funcao?: string | null;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id: string;
          leads_dia?: number | null;
          nome?: string;
          performance_calculado_em?: string | null;
          performance_motivo?: Json | null;
          performance_revisado_em?: string | null;
          performance_revisado_por?: string | null;
          performance_revisao_motivo?: string | null;
          performance_status?: string | null;
          periodo_fim?: string | null;
          periodo_inicio?: string | null;
          royalties?: number | null;
          salario_base?: number | null;
          sexo?: string | null;
          sobrenome?: string | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          superior_id?: string | null;
          telefone?: string | null;
          telefone_comercial?: string | null;
          telefone_residencial?: string | null;
        };
        Update: {
          aprovada_em?: string | null;
          avatar_url?: string | null;
          bonus_campanha?: number | null;
          cargo_id?: string | null;
          comissao_modelo?: number | null;
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          desligado_em?: string | null;
          desligado_motivo?: string | null;
          dia_pagamento?: number | null;
          dias_acesso?: string[] | null;
          diretor?: boolean;
          email?: string;
          email_pessoal?: string | null;
          empresa_id?: string | null;
          equipe?: string | null;
          estado_civil?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          funcao?: string | null;
          hora_fim?: string | null;
          hora_inicio?: string | null;
          id?: string;
          leads_dia?: number | null;
          nome?: string;
          performance_calculado_em?: string | null;
          performance_motivo?: Json | null;
          performance_revisado_em?: string | null;
          performance_revisado_por?: string | null;
          performance_revisao_motivo?: string | null;
          performance_status?: string | null;
          periodo_fim?: string | null;
          periodo_inicio?: string | null;
          royalties?: number | null;
          salario_base?: number | null;
          sexo?: string | null;
          sobrenome?: string | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          superior_id?: string | null;
          telefone?: string | null;
          telefone_comercial?: string | null;
          telefone_residencial?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "profiles_performance_revisado_por_fkey";
            columns: ["performance_revisado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_performance_revisado_por_fkey";
            columns: ["performance_revisado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "profiles_superior_id_fkey";
            columns: ["superior_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_superior_id_fkey";
            columns: ["superior_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      proposta_versoes: {
        Row: {
          criado_em: string;
          criado_por: string | null;
          forma_pagamento: string | null;
          id: string;
          nota: string;
          parcelas: number | null;
          premio: number | null;
          proposta_id: string;
          versao: number;
        };
        Insert: {
          criado_em?: string;
          criado_por?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          nota: string;
          parcelas?: number | null;
          premio?: number | null;
          proposta_id: string;
          versao: number;
        };
        Update: {
          criado_em?: string;
          criado_por?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          nota?: string;
          parcelas?: number | null;
          premio?: number | null;
          proposta_id?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
        ];
      };
      propostas: {
        Row: {
          aceita_em: string | null;
          apolice_numero: string | null;
          atualizado_em: string;
          baixa_em: string | null;
          cancelada_em: string | null;
          cancelamento_motivo: string | null;
          comissao_pct: number | null;
          comissao_valor: number | null;
          cotacao_id: string | null;
          criado_em: string;
          emitida_em: string | null;
          empresa_id: string;
          forma_pagamento: string | null;
          id: string;
          lead_id: string | null;
          negociacao_status: string;
          numero: string | null;
          oportunidade_id: string | null;
          pago_em: string | null;
          prazo_resposta: string | null;
          premio: number | null;
          responsavel_id: string | null;
          seguradora: string | null;
          status: string;
          tipo_venda: string | null;
          transmissao_mensagem: string | null;
          transmissao_motivo: string | null;
          transmissao_obs: string | null;
          transmissao_status: string | null;
          transmitida_em: string | null;
          valor: number | null;
          vencimento: string | null;
        };
        Insert: {
          aceita_em?: string | null;
          apolice_numero?: string | null;
          atualizado_em?: string;
          baixa_em?: string | null;
          cancelada_em?: string | null;
          cancelamento_motivo?: string | null;
          comissao_pct?: number | null;
          comissao_valor?: number | null;
          cotacao_id?: string | null;
          criado_em?: string;
          emitida_em?: string | null;
          empresa_id: string;
          forma_pagamento?: string | null;
          id?: string;
          lead_id?: string | null;
          negociacao_status?: string;
          numero?: string | null;
          oportunidade_id?: string | null;
          pago_em?: string | null;
          prazo_resposta?: string | null;
          premio?: number | null;
          responsavel_id?: string | null;
          seguradora?: string | null;
          status?: string;
          tipo_venda?: string | null;
          transmissao_mensagem?: string | null;
          transmissao_motivo?: string | null;
          transmissao_obs?: string | null;
          transmissao_status?: string | null;
          transmitida_em?: string | null;
          valor?: number | null;
          vencimento?: string | null;
        };
        Update: {
          aceita_em?: string | null;
          apolice_numero?: string | null;
          atualizado_em?: string;
          baixa_em?: string | null;
          cancelada_em?: string | null;
          cancelamento_motivo?: string | null;
          comissao_pct?: number | null;
          comissao_valor?: number | null;
          cotacao_id?: string | null;
          criado_em?: string;
          emitida_em?: string | null;
          empresa_id?: string;
          forma_pagamento?: string | null;
          id?: string;
          lead_id?: string | null;
          negociacao_status?: string;
          numero?: string | null;
          oportunidade_id?: string | null;
          pago_em?: string | null;
          prazo_resposta?: string | null;
          premio?: number | null;
          responsavel_id?: string | null;
          seguradora?: string | null;
          status?: string;
          tipo_venda?: string | null;
          transmissao_mensagem?: string | null;
          transmissao_motivo?: string | null;
          transmissao_obs?: string | null;
          transmissao_status?: string | null;
          transmitida_em?: string | null;
          valor?: number | null;
          vencimento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "propostas_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "cotacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "propostas_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_oportunidade_id_fkey";
            columns: ["oportunidade_id"];
            isOneToOne: false;
            referencedRelation: "oportunidades";
            referencedColumns: ["id"];
          },
        ];
      };
      regua_performance_config: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          bloco: string;
          cancelamentos_limite: number;
          conv_atencao_pct: number;
          conv_travado_pct: number;
          dias_atencao: number;
          dias_travado: number;
          janela_dias: number;
          notifica_supervisor: boolean;
          pausa_leads_ativa: boolean;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          bloco: string;
          cancelamentos_limite?: number;
          conv_atencao_pct?: number;
          conv_travado_pct?: number;
          dias_atencao?: number;
          dias_travado?: number;
          janela_dias?: number;
          notifica_supervisor?: boolean;
          pausa_leads_ativa?: boolean;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          bloco?: string;
          cancelamentos_limite?: number;
          conv_atencao_pct?: number;
          conv_travado_pct?: number;
          dias_atencao?: number;
          dias_travado?: number;
          janela_dias?: number;
          notifica_supervisor?: boolean;
          pausa_leads_ativa?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "regua_performance_config_atualizado_por_fkey";
            columns: ["atualizado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regua_performance_config_atualizado_por_fkey";
            columns: ["atualizado_por"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
      };
      respostas_padrao: {
        Row: {
          ativo: boolean;
          criado_em: string;
          id: string;
          seguradora_id: string | null;
          texto: string;
          titulo: string;
        };
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          id?: string;
          seguradora_id?: string | null;
          texto: string;
          titulo: string;
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          id?: string;
          seguradora_id?: string | null;
          texto?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "respostas_padrao_seguradora_id_fkey";
            columns: ["seguradora_id"];
            isOneToOne: false;
            referencedRelation: "seguradoras";
            referencedColumns: ["id"];
          },
        ];
      };
      seguradoras: {
        Row: {
          ativo: boolean;
          codigo: string | null;
          created_at: string;
          id: string;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          id?: string;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          id?: string;
          nome?: string;
          ordem?: number;
        };
        Relationships: [];
      };
      sla_empresa_config: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          empresa_id: string;
          sla_segundos: number;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          empresa_id: string;
          sla_segundos: number;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          empresa_id?: string;
          sla_segundos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sla_empresa_config_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sla_empresa_config_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      user_presence: {
        Row: {
          atualizado_em: string;
          entrou_em: string | null;
          last_seen_at: string;
          saiu_em: string | null;
          status: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          atualizado_em?: string;
          entrou_em?: string | null;
          last_seen_at?: string;
          saiu_em?: string | null;
          status?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          atualizado_em?: string;
          entrou_em?: string | null;
          last_seen_at?: string;
          saiu_em?: string | null;
          status?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["perfil"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["perfil"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["perfil"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_comissao_por_competencia: {
        Row: {
          beneficiario_id: string | null;
          competencia: string | null;
          empresa_id: string | null;
          qtd_creditos: number | null;
          qtd_debitos: number | null;
          saldo: number | null;
          total_creditos: number | null;
          total_debitos: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "comissao_lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_beneficiario_id_fkey";
            columns: ["beneficiario_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissao_lancamentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      v_franquia_kpis: {
        Row: {
          cidade: string | null;
          comissao_mes: number | null;
          em_aberto: number | null;
          empresa_id: string | null;
          faturamento_mes: number | null;
          leads_mes: number | null;
          meta_faturamento: number | null;
          meta_vendas: number | null;
          modelo_id: string | null;
          nome: string | null;
          perc_comissao_efetiva: number | null;
          perdidos_mes: number | null;
          status: Database["public"]["Enums"]["empresa_status"] | null;
          uf: string | null;
          vendas_mes: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "empresas_modelo_id_fkey";
            columns: ["modelo_id"];
            isOneToOne: false;
            referencedRelation: "modelos_franquia";
            referencedColumns: ["id"];
          },
        ];
      };
      v_user_presence: {
        Row: {
          entrou_em: string | null;
          last_seen_at: string | null;
          saiu_em: string | null;
          status_efetivo: string | null;
          status_reportado: string | null;
          user_id: string | null;
        };
        Insert: {
          entrou_em?: string | null;
          last_seen_at?: string | null;
          saiu_em?: string | null;
          status_efetivo?: never;
          status_reportado?: string | null;
          user_id?: string | null;
        };
        Update: {
          entrou_em?: string | null;
          last_seen_at?: string | null;
          saiu_em?: string | null;
          status_efetivo?: never;
          status_reportado?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      v_vendedor_kpis: {
        Row: {
          comissao_mes: number | null;
          em_negociacao: number | null;
          email: string | null;
          empresa_id: string | null;
          empresa_nome: string | null;
          faturamento_mes: number | null;
          leads_mes: number | null;
          meta_vendas: number | null;
          nome: string | null;
          status: Database["public"]["Enums"]["empresa_status"] | null;
          user_id: string | null;
          vendas_mes: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
        ];
      };
      vendedor_conta_corrente_saldo: {
        Row: {
          qtd_creditos: number | null;
          qtd_debitos: number | null;
          saldo: number | null;
          total_creditos: number | null;
          total_debitos: number | null;
          ultimo_lancamento: string | null;
          vendedor_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _aplicar_desconto_premio: {
        Args: { p_cotacao_id: string; p_pct: number; p_seguradora_id: string };
        Returns: undefined;
      };
      abrir_convite: { Args: { p_token: string }; Returns: Json };
      aceitar_desconto: { Args: { p_id: string }; Returns: undefined };
      admin_atualizar_usuario: {
        Args: { p_empresa_id: string; p_nome: string; p_user_id: string };
        Returns: undefined;
      };
      admin_set_usuario_status: {
        Args: { p_ativo: boolean; p_motivo?: string; p_user_id: string };
        Returns: undefined;
      };
      aprovar_acesso: {
        Args: {
          p_areas?: string[];
          p_canais?: string[];
          p_cargo_id?: string;
          p_empresa_id: string;
          p_motivo?: string;
          p_perfil: Database["public"]["Enums"]["perfil"];
          p_produtos?: string[];
          p_reclassificado?: boolean;
          p_superior_id?: string;
        };
        Returns: undefined;
      };
      aprovar_acesso_com_boas_vindas: {
        Args: {
          p_areas?: string[];
          p_canais?: string[];
          p_cargo_id?: string;
          p_empresa_id: string;
          p_motivo?: string;
          p_perfil: Database["public"]["Enums"]["perfil"];
          p_produtos?: string[];
          p_reclassificado?: boolean;
          p_superior_id?: string;
        };
        Returns: string;
      };
      aprovar_desconto: {
        Args: { p_id: string; p_pct_concedido: number };
        Returns: undefined;
      };
      aprovar_empresa: { Args: { p_empresa_id: string }; Returns: undefined };
      arquivar_lead: { Args: { p_lead: string }; Returns: undefined };
      assumir_lead: { Args: { p_lead_id: string }; Returns: string };
      ativar_acesso_apos_criar_senha: {
        Args: { p_emissao_id: string; p_versao: number };
        Returns: string;
      };
      avaliar_perda_lead: {
        Args: { p_decisao: string; p_lead_id: string; p_observacao?: string };
        Returns: undefined;
      };
      bloquear_lead: {
        Args: { p_lead: string; p_motivo: string };
        Returns: undefined;
      };
      bloquear_request_usuario_inativo: { Args: never; Returns: undefined };
      cadastrar_franquia_admin: {
        Args: { p: Json; p_user: string };
        Returns: string;
      };
      cancelar_apolice: {
        Args: { p_motivo?: string; p_proposta_id: string };
        Returns: undefined;
      };
      cancelar_desconto: { Args: { p_id: string }; Returns: undefined };
      classificar_perda_cotacao: {
        Args: {
          p_cotacao_id: string;
          p_motivo: string;
          p_observacao?: string;
          p_submotivo: string;
        };
        Returns: undefined;
      };
      confirmar_alteracao_diretor: {
        Args: { p_aprovar: boolean; p_proposta_id: string; p_senha: string };
        Returns: undefined;
      };
      consumir_convite: {
        Args: { p_token: string; p_user_id: string };
        Returns: boolean;
      };
      contar_pendentes_seguradora_visao_geral: {
        Args: { p_fim: string; p_inicio: string };
        Returns: number;
      };
      contrapropor_desconto: {
        Args: { p_id: string; p_obs?: string; p_pct_novo: number };
        Returns: undefined;
      };
      criar_convite: {
        Args: {
          p_cargo_id?: string;
          p_escopo: string;
          p_nome: string;
          p_perfil?: string;
          p_trilha: string;
          p_validade_dias?: number;
          p_vinc_empresa_id?: string;
          p_vinc_tipo?: string;
        };
        Returns: {
          codigo: string;
          expira_em: string;
          id: string;
          token: string;
        }[];
      };
      criar_leads_renovacao: { Args: never; Returns: Json };
      criar_pendente_manual: {
        Args: {
          p_celular?: string;
          p_cidade?: string;
          p_criado_por: string;
          p_documento: string;
          p_email?: string;
          p_escopo?: string;
          p_nome: string;
          p_tipo: string;
          p_uf?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      definir_negociacao_status: {
        Args: { p_proposta_id: string; p_status: string };
        Returns: {
          id: string;
          negociacao_status: string;
        }[];
      };
      definir_prazo_resposta: {
        Args: { p_prazo?: string; p_proposta_id: string };
        Returns: {
          id: string;
          prazo_resposta: string;
        }[];
      };
      desarquivar_lead: { Args: { p_lead: string }; Returns: undefined };
      desbloquear_lead: { Args: { p_lead: string }; Returns: undefined };
      distribuir_fila_pendente: { Args: never; Returns: number };
      distribuir_lead_movida: {
        Args: { p_ator_id?: string; p_lead_id: string };
        Returns: boolean;
      };
      empresas_visiveis: {
        Args: { _user_id: string };
        Returns: {
          empresa_id: string;
        }[];
      };
      enfileirar_boas_vindas: {
        Args: { p_empresa_id: string };
        Returns: string;
      };
      escalar_desconto: { Args: { p_id: string }; Returns: undefined };
      esta_pendente_seguradora: {
        Args: {
          p_cancelada_em: string;
          p_emitida_em: string;
          p_transmitida_em: string;
        };
        Returns: boolean;
      };
      excluir_cadastro_rede: {
        Args: { p_motivo: string; p_user_id: string };
        Returns: undefined;
      };
      expirar_leads_nao_atendidos: {
        Args: { p_janela_seg?: number };
        Returns: number;
      };
      fechar_campanha_elite: {
        Args: { p_ano: number; p_trimestre: number };
        Returns: Json;
      };
      fechar_comissao_competencia: {
        Args: { p_competencia: string };
        Returns: Json;
      };
      finalizar_email_outbox: {
        Args: {
          p_erro?: string;
          p_lease_token: string;
          p_outbox_id: string;
          p_provider_id?: string;
          p_resultado: string;
        };
        Returns: undefined;
      };
      fn_areas_do_usuario: {
        Args: { _user_id: string };
        Returns: {
          area_chave: string;
        }[];
      };
      fn_bloco_performance: { Args: { p_empresa_id: string }; Returns: string };
      fn_cadastrar_vendedor_full: {
        Args: {
          p_canais?: string[];
          p_celular?: string;
          p_comissao_renovacao_pct?: number;
          p_comissao_venda_pct?: number;
          p_cpf?: string;
          p_criado_por: string;
          p_email: string;
          p_equipe?: string;
          p_leads_dia?: number;
          p_nome: string;
          p_produtos?: string[];
          p_user_id: string;
        };
        Returns: string;
      };
      fn_calcular_performance_pessoa: {
        Args: { p_bloco: string; p_profile_id: string };
        Returns: Json;
      };
      fn_comissao_clt: {
        Args: { p_competencia: string; p_vendedor: string };
        Returns: {
          competencia: string;
          fator_aplicado: number;
          fator_novas: number;
          fator_remanejo: number;
          pct_faixa: number;
          producao_novas: number;
          producao_remanejo: number;
          producao_total: number;
          regra: Json;
          valor_base: number;
          valor_elite: number;
          valor_final: number;
          vendedor_id: string;
        }[];
      };
      fn_competencia: { Args: { ts: string }; Returns: string };
      fn_competencias_trimestre: {
        Args: { p_ano: number; p_trimestre: number };
        Returns: string[];
      };
      fn_configurar_vendedor_full: {
        Args: {
          p_canais?: string[];
          p_comissao_renovacao_pct?: number;
          p_comissao_venda_pct?: number;
          p_equipe?: string;
          p_leads_dia?: number;
          p_produtos?: string[];
          p_vendedor_id: string;
        };
        Returns: {
          atualizado_em: string;
          atualizado_por: string | null;
          comissao_renovacao_pct: number | null;
          comissao_venda_pct: number | null;
          empresa_id: string;
          personalizado: boolean;
          profile_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "full_vendedor_config";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fn_confirmar_senha_diretor: { Args: { _senha: string }; Returns: boolean };
      fn_convite_codigo: { Args: never; Returns: string };
      fn_dentro_alcada_desconto: {
        Args: { p_aprovador: string; p_pct: number; p_seguradora: string };
        Returns: boolean;
      };
      fn_desligar_vendedor_full: {
        Args: { p_motivo: string; p_vendedor_id: string };
        Returns: undefined;
      };
      fn_destino_pedido: { Args: { _empresa_id: string }; Returns: string };
      fn_eh_diretor: { Args: { _user_id: string }; Returns: boolean };
      fn_empresa_matriz: {
        Args: never;
        Returns: {
          empresa_id: string;
        }[];
      };
      fn_excluir_resposta_padrao: {
        Args: { p_id: string; p_senha: string };
        Returns: undefined;
      };
      fn_fila_franquia_id: { Args: { _empresa_id: string }; Returns: string };
      fn_full_dona_vendedor: {
        Args: { p_full_id: string; p_vendedor_id: string };
        Returns: boolean;
      };
      fn_master_valido_para_full: {
        Args: { p_full_profile_id: string; p_master_profile_id: string };
        Returns: boolean;
      };
      fn_modelo_alcada_desconto: {
        Args: { p_profile_id: string };
        Returns: string;
      };
      fn_origem_lead: { Args: { p_canal_id: string }; Returns: string };
      fn_pct_comissao_efetivo: {
        Args: { p_empresa_id: string };
        Returns: {
          fonte: string;
          pct: number;
        }[];
      };
      fn_pct_comissao_por_origem: {
        Args: { p_canal_id: string; p_empresa_id: string };
        Returns: {
          fonte: string;
          pct: number;
        }[];
      };
      fn_pode_aprovar_pedido: {
        Args: { _empresa_id: string; _uid: string };
        Returns: boolean;
      };
      fn_pode_criar_pendente_manual: {
        Args: { _uid?: string };
        Returns: boolean;
      };
      fn_pode_ver_solicitacao_desconto: {
        Args: { p_solicitante: string };
        Returns: boolean;
      };
      fn_produtos_padrao: { Args: { _bloco: string }; Returns: string[] };
      fn_profile_acesso_por_empresa: {
        Args: { p_empresa_id: string };
        Returns: string;
      };
      fn_rede_subordinados: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
        }[];
      };
      fn_registrar_alteracao: {
        Args: {
          _area: string;
          _de_para?: Json;
          _empresa_id?: string;
          _o_que: string;
          _senha: string;
        };
        Returns: string;
      };
      fn_registrar_alteracao_franquia: {
        Args: {
          p_area: string;
          p_de_para?: Json;
          p_empresa_id: string;
          p_o_que: string;
        };
        Returns: string;
      };
      fn_reincluir_vendedor_full: {
        Args: { p_motivo: string; p_vendedor_id: string };
        Returns: undefined;
      };
      fn_revisar_reativar_performance: {
        Args: { p_motivo?: string; p_profile_id: string };
        Returns: undefined;
      };
      fn_salvar_clt_config: {
        Args: {
          p_fator_novas: Json;
          p_fator_remalho: Json;
          p_progressiva: Json;
          p_regras: Json;
          p_seguradora_adic: Json;
          p_seguradora_planos: Json;
          p_senha: string;
        };
        Returns: undefined;
      };
      fn_salvar_comissao_origem: {
        Args: {
          p_ativo?: boolean;
          p_descricao?: string;
          p_origem: string;
          p_pct: number;
        };
        Returns: {
          ativo: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
          descricao: string | null;
          origem: string;
          pct: number;
        };
        SetofOptions: {
          from: "*";
          to: "comissao_origem_config";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fn_salvar_complementos_full: {
        Args: {
          p_bonus_campanha: string;
          p_comissao_renovacao_pct: number;
          p_comissao_venda_pct: number;
          p_empresa_id: string;
          p_meta_padrao_equipe: string;
        };
        Returns: {
          atualizado_em: string;
          atualizado_por: string | null;
          bonus_campanha: string | null;
          comissao_renovacao_pct: number;
          comissao_venda_pct: number;
          empresa_id: string;
          meta_padrao_equipe: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "full_comissao_complementos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fn_salvar_desconto_politicas: {
        Args: { p_delete: Json; p_senha: string; p_upsert: Json };
        Returns: undefined;
      };
      fn_salvar_modelo_master: {
        Args: {
          p_base_calc: string;
          p_comissao_grupo: string;
          p_elite: Json;
          p_pagamento: string;
          p_royalties: string;
          p_senha: string;
        };
        Returns: undefined;
      };
      fn_salvar_modelo_supervisor: {
        Args: {
          p_base_calc: string;
          p_comissao_grupo: string;
          p_pagamento: string;
          p_royalties: string;
          p_senha: string;
        };
        Returns: undefined;
      };
      fn_salvar_modelos_franquia: {
        Args: { p_modelos: Json; p_senha: string };
        Returns: undefined;
      };
      fn_salvar_produtos_catalogo: {
        Args: { p_novo_nome?: string; p_produtos?: Json; p_senha: string };
        Returns: undefined;
      };
      fn_salvar_produtos_padrao: {
        Args: { p_bloco: string; p_produto_ids: Json; p_senha: string };
        Returns: undefined;
      };
      fn_salvar_regua_performance: {
        Args: {
          p_bloco: string;
          p_cancelamentos_limite: number;
          p_conv_atencao_pct: number;
          p_conv_travado_pct: number;
          p_dias_atencao: number;
          p_dias_travado: number;
          p_janela_dias: number;
          p_notifica_supervisor: boolean;
          p_pausa_leads_ativa: boolean;
          p_senha: string;
        };
        Returns: undefined;
      };
      fn_salvar_regua_performance_full: {
        Args: {
          p_cancelamentos_limite: number;
          p_conv_atencao_pct: number;
          p_conv_travado_pct: number;
          p_dias_atencao: number;
          p_dias_travado: number;
          p_empresa_id: string;
          p_janela_dias: number;
          p_pausa_leads_ativa: boolean;
        };
        Returns: undefined;
      };
      fn_salvar_resposta_padrao: {
        Args: {
          p_ativo: boolean;
          p_id?: string;
          p_seguradora_id?: string;
          p_senha: string;
          p_texto: string;
          p_titulo: string;
        };
        Returns: string;
      };
      fn_salvar_rota_movida: {
        Args: {
          p_alias: string;
          p_ativa?: boolean;
          p_empresa_id: string;
          p_exigir_online?: boolean;
          p_loja_id: string;
          p_nome: string;
        };
        Returns: string;
      };
      fn_salvar_sla_empresa: {
        Args: { p_empresa_id: string; p_sla_segundos: number };
        Returns: {
          atualizado_em: string;
          atualizado_por: string | null;
          empresa_id: string;
          sla_segundos: number;
        };
        SetofOptions: {
          from: "*";
          to: "sla_empresa_config";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fn_sla_aplicavel_lead: { Args: { p_lead_id: string }; Returns: number };
      fn_sla_efetivo: { Args: { p_empresa_id: string }; Returns: number };
      fn_tem_area: {
        Args: { _area: string; _user_id: string };
        Returns: boolean;
      };
      fn_tipo_declarado_email: {
        Args: { p_empresa_id: string };
        Returns: string;
      };
      fn_trimestre: { Args: { p_competencia: string }; Returns: number };
      fn_vincular_master_full: {
        Args: {
          p_full_profile_id: string;
          p_master_profile_id: string;
          p_motivo: string;
        };
        Returns: undefined;
      };
      franquias_abaixo_meta_visao_geral: {
        Args: { p_fim: string; p_inicio: string };
        Returns: number;
      };
      funis_por_canal_visao_geral: {
        Args: { p_fim: string; p_inicio: string };
        Returns: {
          canal_id: string;
          canal_nome: string;
          contatos: number;
          cotacoes: number;
          indicacoes: number;
          negociacoes: number;
          ordem: number;
          pendentes: number;
          transmissoes: number;
          vendas_emitidas: number;
        }[];
      };
      has_role: {
        Args: { _role: Database["public"]["Enums"]["perfil"]; _user_id: string };
        Returns: boolean;
      };
      ingerir_lead_externo: {
        Args: {
          old_record?: Json;
          record: Json;
          schema?: string;
          table?: string;
          type?: string;
        };
        Returns: {
          criado: boolean;
          lead_id: string;
        }[];
      };
      iniciar_atendimento: { Args: { p_lead_id: string }; Returns: undefined };
      iniciar_renovacao: { Args: { p_proposta_id: string }; Returns: string };
      jsonb_clt_regras_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_comissao_regras_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_criterios_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_faixas_bonus_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_faixas_pct_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_fator_faixas_ok: { Args: { j: Json }; Returns: boolean };
      jsonb_is_pair_array: { Args: { j: Json }; Returns: boolean };
      lancar_ajuste_comissao: {
        Args: {
          p_descricao: string;
          p_tipo: string;
          p_valor: number;
          p_vendedor: string;
        };
        Returns: string;
      };
      listar_franquias_paginada: {
        Args: { p_limite?: number; p_offset?: number };
        Returns: {
          cidade: string;
          comissao_mes: number;
          em_aberto: number;
          empresa_id: string;
          faturamento_mes: number;
          leads_mes: number;
          meta_faturamento: number;
          meta_vendas: number;
          nome: string;
          perc_comissao_efetiva: number;
          perdidos_mes: number;
          responsavel_nome: string;
          status: Database["public"]["Enums"]["empresa_status"];
          total_count: number;
          uf: string;
          vendas_mes: number;
        }[];
      };
      marcar_apolice_emitida: {
        Args: {
          p_apolice: string;
          p_comissao_pct?: number;
          p_forma_pagamento?: string;
          p_proposta_id: string;
          p_tipo_venda?: string;
        };
        Returns: undefined;
      };
      marcar_email_outbox_enviando: {
        Args: { p_outbox_id: string };
        Returns: Json;
      };
      marcar_pagamento: {
        Args: { p_pago?: boolean; p_proposta_id: string };
        Returns: undefined;
      };
      negar_desconto: {
        Args: { p_id: string; p_obs?: string };
        Returns: undefined;
      };
      normalizar_alias_loja_movida: {
        Args: { p_valor: string };
        Returns: string;
      };
      normalizar_periodo_visao_geral: {
        Args: {
          p_fim?: string;
          p_inicio?: string;
          p_periodo: string;
          p_referencia?: string;
        };
        Returns: {
          fim: string;
          inicio: string;
        }[];
      };
      obter_contrato_link_acesso: {
        Args: { p_lease_token: string; p_outbox_id: string };
        Returns: Json;
      };
      presence_set: {
        Args: { p_status: string; p_user_agent?: string };
        Returns: undefined;
      };
      propor_alteracao_diretor: {
        Args: { p_acao: string; p_alvo_id: string; p_senha: string };
        Returns: string;
      };
      proposta_pendente_seguradora: {
        Args: { p_proposta_id: string };
        Returns: boolean;
      };
      puxar_lead_de_volta: { Args: { p_lead: string }; Returns: undefined };
      recalcular_regua_performance: { Args: never; Returns: Json };
      recusar_empresa: {
        Args: { motivo?: string; p_empresa_id: string };
        Returns: string;
      };
      redistribuir_lead: {
        Args: { p_empresa: string; p_lead: string; p_responsavel?: string };
        Returns: undefined;
      };
      reenviar_link_acesso: { Args: { p_empresa_id: string }; Returns: string };
      registrar_premios_quiver: {
        Args: { p_cotacao_id: string; p_payload: Json };
        Returns: undefined;
      };
      registrar_resultado_transmissao_quiver: {
        Args: {
          p_capturado_em?: string;
          p_mensagem?: string;
          p_motivo?: string;
          p_numero_cotacao?: string;
          p_tentativa_id: string;
          p_transmitido: boolean;
        };
        Returns: undefined;
      };
      registrar_tentativa_login: {
        Args: {
          p_email: string;
          p_motivo?: string;
          p_sucesso: boolean;
          p_user_agent?: string;
        };
        Returns: string;
      };
      registrar_venda: {
        Args: { lead_id: string; observacao?: string; valor: number };
        Returns: string;
      };
      registrar_versao_proposta: {
        Args: {
          p_forma_pagamento: string;
          p_nota: string;
          p_parcelas: number;
          p_premio: number;
          p_proposta_id: string;
        };
        Returns: {
          id: string;
          versao: number;
        }[];
      };
      reprocessar_leads_movida_pendentes: {
        Args: { p_limite?: number; p_loja_id: string };
        Returns: {
          distribuidos: number;
          pendentes: number;
          processados: number;
        }[];
      };
      resolver_desligamento: {
        Args: { p_aprovar: boolean; p_id: string; p_observacao?: string };
        Returns: undefined;
      };
      saldo_comissao_visao_geral: {
        Args: { p_fim: string; p_inicio: string };
        Returns: {
          quantidade: number;
          saldo: number;
        }[];
      };
      salvar_cotacao_rascunho: {
        Args: { p_cotacao_id: string; p_origem?: string; p_payload: Json };
        Returns: string;
      };
      solicitar_desconto: {
        Args: {
          p_cotacao_id: string;
          p_pct_pedido: number;
          p_seguradora_id: string;
        };
        Returns: string;
      };
      solicitar_desligamento: {
        Args: { p_alvo_profile_id: string; p_motivo: string };
        Returns: string;
      };
      solicitar_pendencia_acesso: {
        Args: { p_empresa_id: string; p_pendencia: string };
        Returns: string;
      };
      transmitir_proposta: {
        Args: { p_obs?: string; p_proposta_id: string };
        Returns: undefined;
      };
      usuario_ativo: { Args: { _user_id: string }; Returns: boolean };
      usuario_explicitamente_desligado: {
        Args: { _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      cotacao_status:
        | "rascunho"
        | "calculada"
        | "proposta"
        | "aceita"
        | "perdida"
        | "enviada_quiver"
        | "erro_quiver";
      empresa_status: "pendente" | "aprovada" | "recusada" | "suspensa";
      empresa_tipo: "pj" | "pf" | "matriz";
      lead_status:
        | "novo"
        | "contato"
        | "qualificado"
        | "cotacao"
        | "proposta"
        | "negociacao"
        | "ganho"
        | "perdido"
        | "tarefa_hoje"
        | "qualificando"
        | "cotando"
        | "proposta_enviada"
        | "em_negociacao"
        | "fechado";
      meta_escopo: "empresa" | "usuario";
      modelo_tipo: "franqueada" | "clt";
      msg_escopo: "global" | "pessoal";
      perfil:
        "matriz" | "master" | "vendedor" | "franqueado" | "supervisor" | "coordenador" | "interno";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cotacao_status: [
        "rascunho",
        "calculada",
        "proposta",
        "aceita",
        "perdida",
        "enviada_quiver",
        "erro_quiver",
      ],
      empresa_status: ["pendente", "aprovada", "recusada", "suspensa"],
      empresa_tipo: ["pj", "pf", "matriz"],
      lead_status: [
        "novo",
        "contato",
        "qualificado",
        "cotacao",
        "proposta",
        "negociacao",
        "ganho",
        "perdido",
        "tarefa_hoje",
        "qualificando",
        "cotando",
        "proposta_enviada",
        "em_negociacao",
        "fechado",
      ],
      meta_escopo: ["empresa", "usuario"],
      modelo_tipo: ["franqueada", "clt"],
      msg_escopo: ["global", "pessoal"],
      perfil: [
        "matriz",
        "master",
        "vendedor",
        "franqueado",
        "supervisor",
        "coordenador",
        "interno",
      ],
    },
  },
} as const;
