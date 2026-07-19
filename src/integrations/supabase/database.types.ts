export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      clientes: {
        Row: {
          criado_em: string;
          documento: string | null;
          email: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          telefone: string | null;
        };
        Insert: {
          criado_em?: string;
          documento?: string | null;
          email?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          telefone?: string | null;
        };
        Update: {
          criado_em?: string;
          documento?: string | null;
          email?: string | null;
          empresa_id?: string;
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
      cotacao_coberturas: {
        Row: {
          app_invalidez: string | null;
          app_morte: string | null;
          assist_24: string | null;
          carro_reserva: string | null;
          casco: string | null;
          casco_valor: string | null;
          cotacao_id: string;
          dmh: string | null;
          franquia: string | null;
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
          cotacao_id: string;
          dmh?: string | null;
          franquia?: string | null;
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
          cotacao_id?: string;
          dmh?: string | null;
          franquia?: string | null;
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
          cond_sexo: string | null;
          condutor_mesmo: boolean | null;
          cotacao_id: string;
          garagem_esc: boolean | null;
          garagem_resid: boolean | null;
          garagem_trab: boolean | null;
          jovens_18_25: boolean | null;
          profissao: string | null;
        };
        Insert: {
          cep_pernoite?: string | null;
          cond_cpf?: string | null;
          cond_estado_civil?: string | null;
          cond_nasc?: string | null;
          cond_nome?: string | null;
          cond_sexo?: string | null;
          condutor_mesmo?: boolean | null;
          cotacao_id: string;
          garagem_esc?: boolean | null;
          garagem_resid?: boolean | null;
          garagem_trab?: boolean | null;
          jovens_18_25?: boolean | null;
          profissao?: string | null;
        };
        Update: {
          cep_pernoite?: string | null;
          cond_cpf?: string | null;
          cond_estado_civil?: string | null;
          cond_nasc?: string | null;
          cond_nome?: string | null;
          cond_sexo?: string | null;
          condutor_mesmo?: boolean | null;
          cotacao_id?: string;
          garagem_esc?: boolean | null;
          garagem_resid?: boolean | null;
          garagem_trab?: boolean | null;
          jovens_18_25?: boolean | null;
          profissao?: string | null;
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
          cotacao_id: string;
          grupo_producao: string | null;
          observacoes: string | null;
          ramo: string | null;
          seguradoras_sel: string[] | null;
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
          cotacao_id: string;
          grupo_producao?: string | null;
          observacoes?: string | null;
          ramo?: string | null;
          seguradoras_sel?: string[] | null;
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
          cotacao_id?: string;
          grupo_producao?: string | null;
          observacoes?: string | null;
          ramo?: string | null;
          seguradoras_sel?: string[] | null;
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
      cotacao_veiculo: {
        Row: {
          alienado: boolean | null;
          ano_fab: string | null;
          ano_modelo: string | null;
          banco: string | null;
          blindado: boolean | null;
          chassi: string | null;
          combustivel: string | null;
          cor: string | null;
          cotacao_id: string;
          fipe_valor: string | null;
          km_mensal: string | null;
          marca_codigo: string | null;
          marca_nome: string | null;
          modelo_codigo: string | null;
          modelo_nome: string | null;
          placa: string | null;
          renavam: string | null;
          uso_comercial: string | null;
          zero_km: boolean | null;
        };
        Insert: {
          alienado?: boolean | null;
          ano_fab?: string | null;
          ano_modelo?: string | null;
          banco?: string | null;
          blindado?: boolean | null;
          chassi?: string | null;
          combustivel?: string | null;
          cor?: string | null;
          cotacao_id: string;
          fipe_valor?: string | null;
          km_mensal?: string | null;
          marca_codigo?: string | null;
          marca_nome?: string | null;
          modelo_codigo?: string | null;
          modelo_nome?: string | null;
          placa?: string | null;
          renavam?: string | null;
          uso_comercial?: string | null;
          zero_km?: boolean | null;
        };
        Update: {
          alienado?: boolean | null;
          ano_fab?: string | null;
          ano_modelo?: string | null;
          banco?: string | null;
          blindado?: boolean | null;
          chassi?: string | null;
          combustivel?: string | null;
          cor?: string | null;
          cotacao_id?: string;
          fipe_valor?: string | null;
          km_mensal?: string | null;
          marca_codigo?: string | null;
          marca_nome?: string | null;
          modelo_codigo?: string | null;
          modelo_nome?: string | null;
          placa?: string | null;
          renavam?: string | null;
          uso_comercial?: string | null;
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
      empresas: {
        Row: {
          aprovada_em: string | null;
          celular: string | null;
          cidade: string | null;
          contato_emergencia: string | null;
          created_at: string;
          dados_bancarios: string | null;
          dados_cadastro: Json;
          data_nascimento: string | null;
          documento: string;
          email: string | null;
          endereco: string | null;
          id: string;
          isenta: boolean | null;
          leads_dia: number | null;
          modelo_id: string | null;
          nome: string;
          parent_id: string | null;
          perc_comissao: number | null;
          perc_equipe: number | null;
          pix_chave: string | null;
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
          celular?: string | null;
          cidade?: string | null;
          contato_emergencia?: string | null;
          created_at?: string;
          dados_bancarios?: string | null;
          dados_cadastro?: Json;
          data_nascimento?: string | null;
          documento: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          isenta?: boolean | null;
          leads_dia?: number | null;
          modelo_id?: string | null;
          nome: string;
          parent_id?: string | null;
          perc_comissao?: number | null;
          perc_equipe?: number | null;
          pix_chave?: string | null;
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
          celular?: string | null;
          cidade?: string | null;
          contato_emergencia?: string | null;
          created_at?: string;
          dados_bancarios?: string | null;
          dados_cadastro?: Json;
          data_nascimento?: string | null;
          documento?: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          isenta?: boolean | null;
          leads_dia?: number | null;
          modelo_id?: string | null;
          nome?: string;
          parent_id?: string | null;
          perc_comissao?: number | null;
          perc_equipe?: number | null;
          pix_chave?: string | null;
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
            foreignKeyName: "empresas_modelo_id_fkey";
            columns: ["modelo_id"];
            isOneToOne: false;
            referencedRelation: "modelos_franquia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresas_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empresas_parent_id_fkey";
            columns: ["parent_id"];
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
          status_pipeline?: Database["public"]["Enums"]["lead_status"];
          submotivo_perda?: string | null;
          ultimo_atendimento_em?: string | null;
          valor?: number | null;
        };
        Relationships: [
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
      profiles: {
        Row: {
          aprovada_em: string | null;
          avatar_url: string | null;
          bonus_campanha: number | null;
          comissao_modelo: number | null;
          created_at: string;
          desligado_em: string | null;
          desligado_motivo: string | null;
          dia_pagamento: number | null;
          email: string;
          empresa_id: string | null;
          equipe: string | null;
          faixa_elite_pct: number | null;
          faixa_elite_valor: number | null;
          id: string;
          leads_dia: number | null;
          nome: string;
          royalties: number | null;
          salario_base: number | null;
          status: Database["public"]["Enums"]["empresa_status"];
          superior_id: string | null;
          telefone: string | null;
        };
        Insert: {
          aprovada_em?: string | null;
          avatar_url?: string | null;
          bonus_campanha?: number | null;
          comissao_modelo?: number | null;
          created_at?: string;
          desligado_em?: string | null;
          desligado_motivo?: string | null;
          dia_pagamento?: number | null;
          email?: string;
          empresa_id?: string | null;
          equipe?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          id: string;
          leads_dia?: number | null;
          nome?: string;
          royalties?: number | null;
          salario_base?: number | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          superior_id?: string | null;
          telefone?: string | null;
        };
        Update: {
          aprovada_em?: string | null;
          avatar_url?: string | null;
          bonus_campanha?: number | null;
          comissao_modelo?: number | null;
          created_at?: string;
          desligado_em?: string | null;
          desligado_motivo?: string | null;
          dia_pagamento?: number | null;
          email?: string;
          empresa_id?: string | null;
          equipe?: string | null;
          faixa_elite_pct?: number | null;
          faixa_elite_valor?: number | null;
          id?: string;
          leads_dia?: number | null;
          nome?: string;
          royalties?: number | null;
          salario_base?: number | null;
          status?: Database["public"]["Enums"]["empresa_status"];
          superior_id?: string | null;
          telefone?: string | null;
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
          numero: string | null;
          oportunidade_id: string | null;
          pago_em: string | null;
          premio: number | null;
          responsavel_id: string | null;
          seguradora: string | null;
          status: string;
          tipo_venda: string | null;
          transmissao_obs: string | null;
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
          numero?: string | null;
          oportunidade_id?: string | null;
          pago_em?: string | null;
          premio?: number | null;
          responsavel_id?: string | null;
          seguradora?: string | null;
          status?: string;
          tipo_venda?: string | null;
          transmissao_obs?: string | null;
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
          numero?: string | null;
          oportunidade_id?: string | null;
          pago_em?: string | null;
          premio?: number | null;
          responsavel_id?: string | null;
          seguradora?: string | null;
          status?: string;
          tipo_venda?: string | null;
          transmissao_obs?: string | null;
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
      vendedor_solicitacoes: {
        Row: {
          celular: string | null;
          cpf: string | null;
          created_at: string;
          email: string | null;
          empresa_id: string | null;
          id: string;
          nome: string;
          observacao: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          solicitante_id: string;
          status: string;
        };
        Insert: {
          celular?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome: string;
          observacao?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          solicitante_id: string;
          status?: string;
        };
        Update: {
          celular?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome?: string;
          observacao?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          solicitante_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendedor_solicitacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendedor_solicitacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "v_franquia_kpis";
            referencedColumns: ["empresa_id"];
          },
          {
            foreignKeyName: "vendedor_solicitacoes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendedor_solicitacoes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "vendedor_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendedor_solicitacoes_solicitante_id_fkey";
            columns: ["solicitante_id"];
            isOneToOne: false;
            referencedRelation: "v_vendedor_kpis";
            referencedColumns: ["user_id"];
          },
        ];
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
      aceitar_desconto: { Args: { p_id: string }; Returns: undefined };
      admin_atualizar_usuario: {
        Args: { p_empresa_id: string; p_nome: string; p_user_id: string };
        Returns: undefined;
      };
      admin_set_usuario_status: {
        Args: { p_ativo: boolean; p_motivo?: string; p_user_id: string };
        Returns: undefined;
      };
      aprovar_desconto: {
        Args: { p_id: string; p_pct_concedido: number };
        Returns: undefined;
      };
      aprovar_empresa: { Args: { p_empresa_id: string }; Returns: undefined };
      arquivar_lead: { Args: { p_lead: string }; Returns: undefined };
      assumir_lead: { Args: { p_lead_id: string }; Returns: string };
      avaliar_perda_lead: {
        Args: { p_decisao: string; p_lead_id: string; p_observacao?: string };
        Returns: undefined;
      };
      bloquear_lead: {
        Args: { p_lead: string; p_motivo: string };
        Returns: undefined;
      };
      cadastrar_franquia: { Args: { p: Json }; Returns: string };
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
      contrapropor_desconto: {
        Args: { p_id: string; p_obs?: string; p_pct_novo: number };
        Returns: undefined;
      };
      criar_leads_renovacao: { Args: never; Returns: Json };
      desarquivar_lead: { Args: { p_lead: string }; Returns: undefined };
      desbloquear_lead: { Args: { p_lead: string }; Returns: undefined };
      desligar_usuario: {
        Args: { motivo?: string; user_id: string };
        Returns: undefined;
      };
      distribuir_fila_pendente: { Args: never; Returns: number };
      empresas_visiveis: {
        Args: { _user_id: string };
        Returns: {
          empresa_id: string;
        }[];
      };
      escalar_desconto: { Args: { p_id: string }; Returns: undefined };
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
      fn_dentro_alcada_desconto: {
        Args: { p_aprovador: string; p_pct: number; p_seguradora: string };
        Returns: boolean;
      };
      fn_modelo_alcada_desconto: {
        Args: { p_profile_id: string };
        Returns: string;
      };
      fn_pct_comissao_efetivo: {
        Args: { p_empresa_id: string };
        Returns: {
          fonte: string;
          pct: number;
        }[];
      };
      fn_pode_ver_solicitacao_desconto: {
        Args: { p_solicitante: string };
        Returns: boolean;
      };
      fn_rede_subordinados: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
        }[];
      };
      fn_trimestre: { Args: { p_competencia: string }; Returns: number };
      has_role: {
        Args: { _role: Database["public"]["Enums"]["perfil"]; _user_id: string };
        Returns: boolean;
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
      marcar_pagamento: {
        Args: { p_pago?: boolean; p_proposta_id: string };
        Returns: undefined;
      };
      negar_desconto: {
        Args: { p_id: string; p_obs?: string };
        Returns: undefined;
      };
      presence_set: {
        Args: { p_status: string; p_user_agent?: string };
        Returns: undefined;
      };
      puxar_lead_de_volta: { Args: { p_lead: string }; Returns: undefined };
      recusar_empresa: {
        Args: { motivo?: string; p_empresa_id: string };
        Returns: undefined;
      };
      redistribuir_lead: {
        Args: { p_empresa: string; p_lead: string; p_responsavel?: string };
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
      resolver_solicitacao_vendedor: {
        Args: { p_aprovar: boolean; p_id: string; p_observacao?: string };
        Returns: undefined;
      };
      salvar_cotacao_rascunho: {
        Args: { p_cotacao_id: string; p_payload: Json };
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
      solicitar_vendedor: {
        Args: {
          p_celular?: string;
          p_cpf?: string;
          p_email?: string;
          p_nome: string;
        };
        Returns: string;
      };
      transmitir_proposta: {
        Args: { p_obs?: string; p_proposta_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      cotacao_status: "rascunho" | "calculada" | "proposta" | "aceita" | "perdida";
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
      perfil: "matriz" | "master" | "vendedor" | "franqueado" | "supervisor";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      cotacao_status: ["rascunho", "calculada", "proposta", "aceita", "perdida"],
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
      perfil: ["matriz", "master", "vendedor", "franqueado", "supervisor"],
    },
  },
} as const;
