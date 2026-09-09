// ============================================
// STORAGE.JS — Camada de Dados (localStorage)
// ============================================

const Storage = (() => {

  const KEYS = {
    ORDENS: 'os_ordens',
    USUARIOS: 'os_usuarios',
    CAMPOS: 'os_campos_personalizados',
    OPCOES: 'os_opcoes_listas',
    CARGOS: 'os_cargos',
    SESSAO: 'os_sessao',
    TEMPLATE_WHATSAPP: 'os_template_whatsapp',
    TEMPLATES_WHATSAPP: 'os_templates_whatsapp',
    TEMA: 'os_theme',
    INITIALIZED: 'os_initialized',
    ERRO_SYNC: 'os_last_sync_error'
  };

  const DEFAULT_TEMPLATES_WHATSAPP = [
    {
      id: 'tpl_padrao_retirada',
      titulo: 'Veículo Pronto para Retirada',
      mensagem: `Olá, @{nome_cliente}! Tudo bem?\n\nInformamos que o seu veículo está pronto para retirada!\n\nServiços realizados:\n@{lista_servicos}\n\nValor total: @{valor_total}\nPagamento: @{forma_pagamento} (@{status_pagamento})\n\nData: @{data}\nHora: @{hora}\n\nVeículo: @{veiculo}\n\nAgradecemos a preferência e ficamos à disposição!`,
      padrao: true
    },
    {
      id: 'tpl_orcamento_pronto',
      titulo: 'Aviso de Orçamento Disponível',
      mensagem: `Olá, @{nome_cliente}! Tudo bem?\n\nO orçamento para o seu veículo (@{veiculo}) foi concluído.\n\nServiços previstos:\n@{lista_servicos}\n\nValor total estimado: @{valor_total}\n\nPor favor, nos confirme a aprovação para iniciarmos a execução!`,
      padrao: false
    },
    {
      id: 'tpl_agradecimento',
      titulo: 'Agradecimento e Garantia',
      mensagem: `Olá, @{nome_cliente}! Passando para agradecer pela preferência!\n\nSeu veículo (@{veiculo}) já foi entregue. Caso tenha qualquer dúvida ou necessite de ajuste, conte conosco.\n\nTenha um ótimo dia!`,
      padrao: false
    }
  ];

  const DEFAULT_TEMPLATE_WHATSAPP = DEFAULT_TEMPLATES_WHATSAPP[0].mensagem;

  /**
   * Inicializa o storage com dados padrão
   */
  function initialize() {
    // Migração para trocar o administrador master e limpar logins antigos
    if (localStorage.getItem('os_admin_migrated_v2') !== 'true') {
      const newAdminUser = {
        id: 'admin_master_suprabike',
        nome: 'Administrador Master',
        usuario: 'suprabikemarketing@gmail.com',
        senha: 'Suprabike123!',
        role: 'role_admin',
        criadoEm: new Date().toISOString()
      };
      localStorage.setItem(KEYS.USUARIOS, JSON.stringify([newAdminUser]));
      localStorage.setItem('os_admin_migrated_v2', 'true');
      localStorage.removeItem(KEYS.SESSAO); // Desloga sessão antiga

      // Apenas garante que o admin master esteja no Supabase
      if (typeof SupabaseConfig !== 'undefined' && SupabaseConfig.isConnected()) {
        syncToSupabase(KEYS.USUARIOS, newAdminUser);
      }
    }

    // Migração para apagar todas as ordens de serviço/orçamentos existentes localmente na migração inicial
    if (localStorage.getItem('os_clean_orders_v2') !== 'true') {
      localStorage.setItem(KEYS.ORDENS, JSON.stringify([]));
      localStorage.setItem('os_clean_orders_v2', 'true');
    }

    if (localStorage.getItem(KEYS.INITIALIZED)) return;

    // Criar os cargos padrões iniciais do sistema
    const cargosIniciais = [
      {
        id: 'role_admin',
        nome: 'Admin Master',
        permissoes: ['criar_os', 'editar_os', 'assumir_servico', 'concluir_servico', 'ver_valores_cliente', 'enviar_whatsapp', 'configuracoes', 'delegar_servico', 'editar_campos_personalizados'],
        criadoEm: new Date().toISOString()
      },
      {
        id: 'role_atendente',
        nome: 'Atendente',
        permissoes: ['criar_os', 'editar_os', 'ver_valores_cliente', 'enviar_whatsapp', 'delegar_servico'],
        criadoEm: new Date().toISOString()
      },
      {
        id: 'role_mecanico',
        nome: 'Mecânico',
        permissoes: ['assumir_servico', 'concluir_servico', 'enviar_whatsapp'],
        criadoEm: new Date().toISOString()
      },
      {
        id: 'role_motorista',
        nome: 'Motorista',
        permissoes: ['assumir_servico', 'concluir_servico', 'enviar_whatsapp'],
        criadoEm: new Date().toISOString()
      }
    ];
    localStorage.setItem(KEYS.CARGOS, JSON.stringify(cargosIniciais));

    // Criar admin padrão
    const adminUser = {
      id: 'admin_master_suprabike',
      nome: 'Administrador Master',
      usuario: 'suprabikemarketing@gmail.com',
      senha: Utils.hashSenha('Suprabike123!'),
      role: 'role_admin', // Vinculado ao cargo Admin Master
      criadoEm: new Date().toISOString()
    };

    localStorage.setItem(KEYS.USUARIOS, JSON.stringify([adminUser]));
    localStorage.setItem(KEYS.ORDENS, JSON.stringify([]));

    // Pré-cadastrar campos personalizados de exemplo (Checklist básico na seção Outros)
    const camposIniciais = [
      { id: 'campo_deixou_chave', nome: 'Deixou chave?', tipo: 'sim_nao_quantidade', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() },
      { id: 'campo_deixou_carregador', nome: 'Deixou carregador?', tipo: 'sim_nao', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() },
      { id: 'campo_deixou_nfc', nome: 'Deixou Cartão NFC', tipo: 'sim_nao', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() }
    ];
    localStorage.setItem(KEYS.CAMPOS, JSON.stringify(camposIniciais));

    // Pré-cadastrar listas de Modelos e Cores
    const opcoesIniciais = [
      {
        id: 'opcao_modelo',
        nome: 'Modelos de Veículos',
        campo: 'modelo',
        itens: ['Scooter Jet', 'Scooter Savage', 'Bicicleta Caloi E-Vibe', 'Triciclo Cargo L1'],
        ativo: true,
        criadoEm: new Date().toISOString()
      },
      {
        id: 'opcao_cor',
        nome: 'Cores',
        campo: 'cor',
        itens: ['Preto', 'Branco', 'Vermelha', 'Azul', 'Cinza'],
        ativo: true,
        criadoEm: new Date().toISOString()
      }
    ];
    localStorage.setItem(KEYS.OPCOES, JSON.stringify(opcoesIniciais));
    localStorage.setItem(KEYS.INITIALIZED, 'true');
  }

  // ---------- SUPABASE CLOUD SYNC ----------

  // ---------- SYNC RESILIENTE ----------
  // Faz upsert removendo automaticamente colunas que ainda não existem no
  // banco (erro PGRST204), para o app não voltar a falhar silencioso quando
  // uma coluna nova for adicionada no código antes do SQL rodar no Supabase.
  async function upsertResiliente(client, tabela, payload, extraOpts) {
    const tentativa = { ...payload };
    for (let i = 0; i < 10; i++) {
      const { error } = await client.from(tabela).upsert(tentativa, extraOpts || undefined);
      if (!error) {
        return { ok: true, removidas: Object.keys(payload).filter(k => !(k in tentativa)) };
      }
      const msg = error.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/);
      if (error.code === 'PGRST204' && match && match[1] in tentativa) {
        delete tentativa[match[1]];
        continue;
      }
      return { ok: false, error };
    }
    return { ok: false, error: { message: 'Limite de tentativas de upsert atingido' } };
  }

  function getUltimoErroSync() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.ERRO_SYNC)) || null;
    } catch {
      return null;
    }
  }

  // Registra a falha, persiste para a UI ler depois e avisa via evento
  // (o app.js escuta 'supabase:sync-error' e mostra um toast — nunca silencioso).
  function notificarErroSync(tabela, mensagem) {
    const registro = { tabela, mensagem: String(mensagem || 'Erro desconhecido'), em: new Date().toISOString() };
    try {
      localStorage.setItem(KEYS.ERRO_SYNC, JSON.stringify(registro));
    } catch (e) {}
    console.warn(`Sincronização Supabase falhou (${tabela}):`, registro.mensagem);
    try {
      window.dispatchEvent(new CustomEvent('supabase:sync-error', { detail: registro }));
    } catch (e) {}
  }

  function limparErroSync() {
    try { localStorage.removeItem(KEYS.ERRO_SYNC); } catch (e) {}
  }

  async function syncFromSupabase() {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client) return;

    try {
      // 1. Ordens
      const { data: ordens } = await client.from('ordens_servico').select('*');
      if (ordens) {
        const supabaseMap = new Map();
        ordens.forEach(o => {
          let tipoFinal = o.tipo;
          if (!tipoFinal) {
            const hasRetiradaServ = Array.isArray(o.servicos) && o.servicos.some(s => s && s.descricao && s.descricao.toLowerCase().includes('retirada'));
            if (o.status !== 'aguardando' && (o.status === 'convertida' || o.relato_cliente || (o.id && o.id.startsWith('RET-')) || hasRetiradaServ)) {
              tipoFinal = 'retirada';
            } else {
              tipoFinal = 'os';
            }
          }

          const customMeta = typeof o.campos_personalizados === 'object' && o.campos_personalizados ? o.campos_personalizados : {};

          supabaseMap.set(o.id, {
            id: o.id,
            tipo: tipoFinal,
            relatoCliente: o.relato_cliente || customMeta.relatoCliente || '',
            clienteNome: o.cliente_nome,
            clienteTelefone: o.cliente_telefone,
            clienteCpf: o.cliente_cpf || '',
            clienteEndereco: o.cliente_endereco || '',
            modeloVeiculo: o.modelo_veiculo,
            corVeiculo: o.cor_veiculo,
            servicos: o.servicos || [],
            valorTotal: Number(o.valor_total || 0),
            valorEntrada: Number(o.valor_entrada || 0),
            valorRestante: Number(o.valor_restante || 0),
            formaPagamento: o.forma_pagamento || [],
            statusPagamento: o.status_pagamento,
            status: o.status,
            prioridade: o.prioridade,
            observacoes: o.observacoes,
            dataServico: o.data_servico,
            temDataEntrega: o.tem_data_entrega,
            dataEntrega: o.data_entrega,
            horaEntrega: o.hora_entrega,
            motoristaEntrega: o.motorista_entrega || customMeta.motoristaEntrega || null,
            statusEntrega: customMeta.statusEntrega || null,
            osCriadaId: customMeta.osCriadaId || null,
            deixouChave: !!customMeta.deixouChave,
            qtdChave: customMeta.qtdChave || 0,
            deixouControle: !!customMeta.deixouControle,
            qtdControle: customMeta.qtdControle || 0,
            deixouCarregador: !!customMeta.deixouCarregador,
            qtdCarregador: customMeta.qtdCarregador || 0,
            deixouDocumento: !!customMeta.deixouDocumento,
            qtdDocumento: customMeta.qtdDocumento || 0,
            deixouCartaoNFC: !!customMeta.deixouCartaoNFC,
            qtdCartaoNFC: customMeta.qtdCartaoNFC || 0,
            avarias: customMeta.avarias || o.avarias || {},
            obsAvarias: customMeta.obsAvarias || o.obsAvarias || '',
            fotosVeiculo: customMeta.fotosVeiculo || o.fotosVeiculo || [],
            tiposAtendimento: customMeta.tiposAtendimento || o.tiposAtendimento || [],
            temFotos: o.tem_fotos,
            fotos: o.fotos || [],
            camposPersonalizados: customMeta,
            atendente: o.atendente,
            criadoPor: o.criado_por || o.atendente || 'Sistema',
            mecanico: o.mecanico,
            editadoPor: o.editado_por,
            editadoEm: o.editado_em,
            horaInicio: o.hora_inicio,
            horaFim: o.hora_fim,
            tempoTotal: o.tempo_total,
            historico: o.historico || [],
            criadoEm: o.criado_em,
            deletado: !!o.deletado,
            deletadoEm: o.deletado_em || null,
            deletadoPor: o.deletado_por || null,
            assinaturaCliente: o.assinatura_cliente || customMeta.assinaturaCliente || null,
            dataAssinatura: o.data_assinatura || customMeta.dataAssinatura || null,
            assinanteNome: o.assinante_nome || customMeta.assinanteNome || null,
            assinaturaMotorista: o.assinatura_motorista || customMeta.assinaturaMotorista || null,
            dataAssinaturaMotorista: o.data_assinatura_motorista || customMeta.dataAssinaturaMotorista || null,
            assinanteMotoristaNome: o.assinante_motorista_nome || customMeta.assinanteMotoristaNome || null,
            assinaturaEntrega: o.assinatura_entrega || customMeta.assinaturaEntrega || null,
            dataAssinaturaEntrega: o.data_assinatura_entrega || customMeta.dataAssinaturaEntrega || null,
            assinanteEntregaNome: o.assinante_entrega_nome || customMeta.assinanteEntregaNome || null
          });
        });

        // Carrega a lista de IDs excluídos permanentemente (nunca devem voltar)
        let deletedPermIds = [];
        try {
          deletedPermIds = JSON.parse(localStorage.getItem('os_deleted_permanently_ids') || '[]');
        } catch(e) { deletedPermIds = []; }

        // Remove do mapa remoto qualquer ID marcado como excluído permanentemente localmente
        deletedPermIds.forEach(delId => supabaseMap.delete(delId));

        // Preserva TODOS os itens locais ainda não no Supabase ou que possuem alterações pendentes
        const localOrdens = getData(KEYS.ORDENS) || [];
        localOrdens.forEach(localO => {
          if (localO && localO.id && !deletedPermIds.includes(localO.id)) {
            const remoteO = supabaseMap.get(localO.id);
            if (!remoteO) {
              // Item local que ainda não sincronizou com o Supabase -> Preserva no mapa!
              supabaseMap.set(localO.id, localO);
            } else {
              // Item existe remotamente -> faz merge seguro para não perder estados locais
              const mergedO = { ...remoteO, ...localO };
              if (remoteO.status && !localO.status) mergedO.status = remoteO.status;
              if (localO.deletado) mergedO.deletado = true;
              supabaseMap.set(localO.id, mergedO);
            }
          }
        });

        // Registra também como deletedPermIds qualquer ID excluído pelo usuário
        localOrdens.forEach(localO => {
          if (localO && localO.id && localO.deletado && !deletedPermIds.includes(localO.id)) {
            deletedPermIds.push(localO.id);
            supabaseMap.delete(localO.id);
          }
        });
        try {
          localStorage.setItem('os_deleted_permanently_ids', JSON.stringify(deletedPermIds));
        } catch(e) {}

        const merged = Array.from(supabaseMap.values());
        localStorage.setItem(KEYS.ORDENS, JSON.stringify(merged));
      }

      // 2. Usuarios
      const { data: usuarios } = await client.from('usuarios').select('*');
      if (usuarios && usuarios.length > 0) {
        const formattedUsers = usuarios.map(u => ({
          id: u.id,
          nome: u.nome,
          usuario: u.usuario,
          senha: u.senha,
          role: u.role,
          isInterno: !!u.is_interno,
          exibirNaDelegacao: u.exibir_na_delegacao ?? true,
          fotoPerfil: u.foto_perfil || null,
          criadoEm: u.criado_em
        }));
        localStorage.setItem(KEYS.USUARIOS, JSON.stringify(formattedUsers));
      }

      // 3. Cargos
      const { data: cargos } = await client.from('cargos').select('*');
      if (cargos && cargos.length > 0) {
        const formattedCargos = cargos.map(c => ({
          id: c.id,
          nome: c.nome,
          permissoes: c.permissoes || [],
          criadoEm: c.criado_em
        }));
        localStorage.setItem(KEYS.CARGOS, JSON.stringify(formattedCargos));
      }

      // 4. Opcoes
      const { data: opcoes } = await client.from('opcoes_listas').select('*');
      if (opcoes && opcoes.length > 0) {
        const formattedOpcoes = opcoes.map(o => ({
          id: o.id,
          nome: o.nome,
          campo: o.campo,
          itens: o.itens || [],
          ativo: o.ativo ?? true,
          criadoEm: o.criado_em
        }));
        localStorage.setItem(KEYS.OPCOES, JSON.stringify(formattedOpcoes));
      }

      // 5. Campos
      const { data: campos } = await client.from('campos_personalizados').select('*');
      if (campos && campos.length > 0) {
        const formattedCampos = campos.map(cp => ({
          id: cp.id,
          nome: cp.nome,
          tipo: cp.tipo,
          secao: cp.secao,
          ativo: cp.ativo ?? true,
          criadoEm: cp.criado_em
        }));
        localStorage.setItem(KEYS.CAMPOS, JSON.stringify(formattedCampos));
      }

      // 6. Template WA (Busca limpa sem gerar erro 406 caso a chave ainda não exista)
      const { data: configs } = await client.from('configuracoes').select('*').in('chave', ['templates_whatsapp', 'template_whatsapp']);
      if (configs && configs.length > 0) {
        const multiConfig = configs.find(c => c.chave === 'templates_whatsapp');
        const singleConfig = configs.find(c => c.chave === 'template_whatsapp');

        if (multiConfig && multiConfig.valor) {
          try {
            const parsed = JSON.parse(multiConfig.valor);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localStorage.setItem(KEYS.TEMPLATES_WHATSAPP, JSON.stringify(parsed));
            }
          } catch (e) {
            console.warn('Erro ao ler templates_whatsapp:', e);
          }
        } else if (singleConfig && singleConfig.valor) {
          localStorage.setItem(KEYS.TEMPLATE_WHATSAPP, singleConfig.valor);
        }
      }
      // Leitura da nuvem OK = conexão saudável, limpa eventual erro antigo
      limparErroSync();
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
  }

  async function syncToSupabase(key, dataItem, silencioso = false) {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return false;
    const client = SupabaseConfig.getClient();
    if (!client || !dataItem) return false;

    // Acumula falhas e só avisa a UI se não for chamada silenciosa (backfill resume no fim)
    let houveFalha = false;
    const falhou = (tabela, mensagem) => {
      houveFalha = true;
      if (silencioso) {
        console.warn(`Sincronização Supabase falhou (${tabela}):`, mensagem);
      } else {
        notificarErroSync(tabela, mensagem);
      }
    };

    try {
      if (key === KEYS.ORDENS) {
        const o = dataItem;
        const camposPersonalizados = {
          ...(o.camposPersonalizados || {}),
          deixouChave: !!o.deixouChave,
          qtdChave: o.qtdChave || 0,
          deixouControle: !!o.deixouControle,
          qtdControle: o.qtdControle || 0,
          deixouCarregador: !!o.deixouCarregador,
          qtdCarregador: o.qtdCarregador || 0,
          deixouDocumento: !!o.deixouDocumento,
          qtdDocumento: o.qtdDocumento || 0,
          deixouCartaoNFC: !!o.deixouCartaoNFC,
          qtdCartaoNFC: o.qtdCartaoNFC || 0,
          osCriadaId: o.osCriadaId || null,
          statusEntrega: o.statusEntrega || null,
          motoristaEntrega: o.motoristaEntrega || null,
          assinaturaEntrega: o.assinaturaEntrega || null,
          dataAssinaturaEntrega: o.dataAssinaturaEntrega || null,
          assinanteEntregaNome: o.assinanteEntregaNome || null,
          assinaturaMotorista: o.assinaturaMotorista || null,
          dataAssinaturaMotorista: o.dataAssinaturaMotorista || null,
          assinanteMotoristaNome: o.assinanteMotoristaNome || null,
          relatoCliente: o.relatoCliente || null,
          avarias: o.avarias || null,
          obsAvarias: o.obsAvarias || null,
          fotosVeiculo: o.fotosVeiculo || null,
          tiposAtendimento: o.tiposAtendimento || null
        };

        const payload = {
          id: o.id,
          tipo: o.tipo || 'os',
          relato_cliente: o.relatoCliente || null,
          cliente_nome: o.clienteNome || 'Cliente',
          cliente_telefone: o.clienteTelefone || '',
          cliente_cpf: o.clienteCpf || '',
          cliente_endereco: o.clienteEndereco || '',
          modelo_veiculo: o.modeloVeiculo || '',
          cor_veiculo: o.corVeiculo || '',
          servicos: o.servicos || [],
          valor_total: o.valorTotal || 0,
          valor_entrada: o.valorEntrada || 0,
          valor_restante: o.valorRestante || 0,
          forma_pagamento: o.formaPagamento || [],
          status_pagamento: o.statusPagamento || 'pendente',
          status: o.status || 'aguardando',
          prioridade: o.prioridade || 'normal',
          observacoes: o.observacoes || '',
          data_servico: o.dataServico || new Date().toISOString().split('T')[0],
          tem_data_entrega: !!o.temDataEntrega,
          data_entrega: o.dataEntrega || null,
          hora_entrega: o.horaEntrega || null,
          tem_fotos: !!o.temFotos,
          fotos: o.fotos || [],
          campos_personalizados: camposPersonalizados,
          atendente: o.atendente || '',
          criado_por: o.criadoPor || o.atendente || 'Sistema',
          mecanico: o.mecanico || null,
          editado_por: o.editadoPor || null,
          editado_em: o.editadoEm || null,
          hora_inicio: o.horaInicio || null,
          hora_fim: o.horaFim || null,
          tempo_total: o.tempoTotal || null,
          historico: o.historico || [],
          deletado: !!o.deletado,
          deletado_em: o.deletadoEm || null,
          deletado_por: o.deletadoPor || null,
          assinatura_cliente: o.assinaturaCliente || null,
          data_assinatura: o.dataAssinatura || null,
          assinante_nome: o.assinanteNome || null,
          assinatura_motorista: o.assinaturaMotorista || null,
          data_assinatura_motorista: o.dataAssinaturaMotorista || null,
          assinante_motorista_nome: o.assinanteMotoristaNome || null,
          assinatura_entrega: o.assinaturaEntrega || null,
          data_assinatura_entrega: o.dataAssinaturaEntrega || null,
          assinante_entrega_nome: o.assinanteEntregaNome || null
        };
        if (o.criadoEm) payload.criado_em = o.criadoEm;
        const resOrdem = await upsertResiliente(client, 'ordens_servico', payload);
        if (!resOrdem.ok) {
          falhou('ordens_servico', resOrdem.error.message);
        } else if (resOrdem.removidas && resOrdem.removidas.length) {
          console.warn('Colunas ignoradas no sync (ainda não existem no banco):', resOrdem.removidas.join(', '));
        }
      } else if (key === KEYS.USUARIOS) {
        const u = dataItem;
        const payload = {
          id: u.id,
          nome: u.nome,
          usuario: u.usuario,
          senha: u.senha,
          role: u.role
        };
        if (u.isInterno !== undefined) payload.is_interno = !!u.isInterno;
        if (u.exibirNaDelegacao !== undefined) payload.exibir_na_delegacao = u.exibirNaDelegacao !== false;
        if (u.fotoPerfil) payload.foto_perfil = u.fotoPerfil;
        if (u.criadoEm) payload.criado_em = u.criadoEm;
        const resUser = await upsertResiliente(client, 'usuarios', payload, { onConflict: 'id', ignoreDuplicates: false });
        if (!resUser.ok) falhou('usuarios', resUser.error.message);
      } else if (key === KEYS.CARGOS) {
        const c = dataItem;
        const payload = {
          id: c.id,
          nome: c.nome,
          permissoes: c.permissoes || []
        };
        if (c.criadoEm) payload.criado_em = c.criadoEm;
        const resCargo = await upsertResiliente(client, 'cargos', payload);
        if (!resCargo.ok) falhou('cargos', resCargo.error.message);
      } else if (key === KEYS.OPCOES) {
        const op = dataItem;
        const payload = {
          id: op.id,
          nome: op.nome,
          campo: op.campo,
          itens: op.itens || [],
          ativo: op.ativo ?? true
        };
        if (op.criadoEm) payload.criado_em = op.criadoEm;
        const resOp = await upsertResiliente(client, 'opcoes_listas', payload, { onConflict: 'campo' });
        if (!resOp.ok) falhou('opcoes_listas', resOp.error.message);
      } else if (key === KEYS.CAMPOS) {
        const cp = dataItem;
        const payload = {
          id: cp.id,
          nome: cp.nome,
          tipo: cp.tipo,
          secao: cp.secao,
          ativo: cp.ativo ?? true
        };
        if (cp.criadoEm) payload.criado_em = cp.criadoEm;
        const resCampo = await upsertResiliente(client, 'campos_personalizados', payload);
        if (!resCampo.ok) falhou('campos_personalizados', resCampo.error.message);
      } else if (key === KEYS.TEMPLATES_WHATSAPP) {
        const resTpl = await upsertResiliente(client, 'configuracoes', {
          chave: 'templates_whatsapp',
          valor: JSON.stringify(dataItem),
          atualizado_em: new Date().toISOString()
        });
        if (!resTpl.ok) falhou('configuracoes', resTpl.error.message);
      }
      return !houveFalha;
    } catch (e) {
      console.warn('Erro ao salvar no Supabase:', e);
      if (!silencioso) notificarErroSync('supabase', e.message || e);
      return false;
    }
  }

  // Envia para a nuvem as OS locais que ainda não existem lá (ex: criadas
  // enquanto o sync estava quebrado). Chamado no login/startup e no botão
  // "Sincronizar agora". Retorna {enviados, falhas} para a UI informar.
  async function enviarPendentesParaNuvem() {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) {
      return { enviados: 0, falhas: 0, erro: 'sem conexão' };
    }
    const client = SupabaseConfig.getClient();
    if (!client) return { enviados: 0, falhas: 0, erro: 'sem conexão' };

    try {
      const { data: remotas, error } = await client.from('ordens_servico').select('id');
      if (error) {
        notificarErroSync('ordens_servico', error.message);
        return { enviados: 0, falhas: 0, erro: error.message };
      }
      const idsRemotos = new Set((remotas || []).map(r => r.id));
      const pendentes = getAllOrdens().filter(o => o && o.id && !o.deletado && !idsRemotos.has(o.id));

      let enviados = 0, falhas = 0;
      for (const o of pendentes) {
        const ok = await syncToSupabase(KEYS.ORDENS, o, true);
        if (ok) enviados++; else falhas++;
      }

      if (falhas > 0) {
        notificarErroSync('ordens_servico', `${falhas} registro(s) não subiram para a nuvem. Verifique sua conexão.`);
      } else if (enviados > 0) {
        limparErroSync();
      }
      return { enviados, falhas };
    } catch (e) {
      console.warn('Erro no backfill de pendentes:', e);
      return { enviados: 0, falhas: 0, erro: (e && e.message) || e };
    }
  }

  async function deleteFromSupabase(table, id) {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client || !id) return;
    try {
      await client.from(table).delete().eq('id', id);
      console.log(`✅ Registro ${id} deletado do Supabase (${table})`);
    } catch (e) {
      console.warn(`Erro ao deletar ${id} do Supabase (${table}):`, e);
      notificarErroSync(table, (e && e.message) || e);
    }
  }

  async function sincronizarTudoComSupabase() {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client) return;

    try {
      // FIRST: Pull cloud data to get correct IDs and avoid 409 conflicts
      await syncFromSupabase();

      // THEN: Push local data that may not be in cloud yet
      const cargos = getData(KEYS.CARGOS);
      for (const c of cargos) { await syncToSupabase(KEYS.CARGOS, c); }

      const usuarios = getData(KEYS.USUARIOS);
      for (const u of usuarios) { await syncToSupabase(KEYS.USUARIOS, u); }

      const opcoes = getData(KEYS.OPCOES);
      for (const op of opcoes) { await syncToSupabase(KEYS.OPCOES, op); }

      const campos = getData(KEYS.CAMPOS);
      for (const cp of campos) { await syncToSupabase(KEYS.CAMPOS, cp); }

      const ordens = getData(KEYS.ORDENS);
      for (const o of ordens) { await syncToSupabase(KEYS.ORDENS, o); }
    } catch (err) {
      console.warn('Erro durante upload inicial para o Supabase:', err);
    }
  }

  // ---------- HELPERS ----------

  function getData(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ---------- ORDENS DE SERVIÇO ----------

  function getAllOrdens() {
    const ordens = getData(KEYS.ORDENS) || [];
    let updated = false;
    ordens.forEach(os => {
      if (!os.historico) os.historico = [];
      if (os.historico.length === 0) {
        os.historico.push({
          acao: 'OS Criada',
          usuario: os.criadoPor || os.atendente || 'Sistema',
          timestamp: os.criadoEm || new Date().toISOString()
        });
        updated = true;
      }
      if (os.mecanico && !os.historico.some(h => (h.acao || '').includes('Assumido') || (h.acao || '').includes('delegado'))) {
        os.historico.push({
          acao: 'Serviço Assumido',
          usuario: os.mecanico,
          timestamp: os.horaInicio || os.criadoEm || new Date().toISOString()
        });
        updated = true;
      }
    });
    if (updated) {
      setData(KEYS.ORDENS, ordens);
    }
    return ordens;
  }

  function getOrdens() {
    return getAllOrdens().filter(os => !os.deletado);
  }

  function getOrdensApagadas() {
    return getAllOrdens().filter(os => !!os.deletado);
  }

  function getOrdemById(id) {
    return getAllOrdens().find(os => os.id === id) || null;
  }

  function saveOrdem(ordem) {
    const ordens = getAllOrdens();
    if (!ordem.id) {
      ordem.id = Utils.gerarCodigoOS(ordens);
    }
    ordem.criadoEm = ordem.criadoEm || new Date().toISOString();
    ordem.atualizadoEm = new Date().toISOString();
    ordem.historico = ordem.historico || [];
    ordem.deletado = false;

    if (!ordem.historico.some(h => h.acao === 'OS Criada')) {
      ordem.historico.push({
        acao: 'OS Criada',
        usuario: ordem.criadoPor || ordem.atendente || 'Sistema',
        timestamp: ordem.criadoEm
      });
    }

    if (ordem.mecanico && !ordem.historico.some(h => (h.acao || '').includes('Assumido') || (h.acao || '').includes('delegado'))) {
      ordem.historico.push({
        acao: 'Serviço Assumido',
        usuario: ordem.mecanico,
        timestamp: ordem.horaInicio || new Date().toISOString()
      });
    }

    const idx = ordens.findIndex(o => o.id === ordem.id);
    if (idx !== -1) {
      ordens[idx] = { ...ordens[idx], ...ordem };
    } else {
      ordens.push(ordem);
    }

    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordem);
    return ordem;
  }

  function updateOrdem(id, updates) {
    const ordens = getAllOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return null;
    const oldMecanico = ordens[idx].mecanico;

    ordens[idx] = { ...ordens[idx], ...updates, atualizadoEm: new Date().toISOString() };
    if (!ordens[idx].historico) ordens[idx].historico = [];

    if (updates.mecanico && updates.mecanico !== oldMecanico) {
      const jaExiste = ordens[idx].historico.some(h => (h.acao || '').includes('Assumido') && h.usuario === updates.mecanico);
      if (!jaExiste) {
        ordens[idx].historico.push({
          acao: 'Serviço Assumido',
          usuario: updates.mecanico,
          timestamp: updates.horaInicio || new Date().toISOString()
        });
      }
    }

    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordens[idx]);
    return ordens[idx];
  }

  function addHistorico(id, acao, usuario) {
    const ordens = getAllOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return;
    if (!ordens[idx].historico) ordens[idx].historico = [];
    
    // Evita duplicata exata de ação imediata
    const last = ordens[idx].historico[ordens[idx].historico.length - 1];
    if (!last || last.acao !== acao || last.usuario !== usuario) {
      ordens[idx].historico.push({ acao, usuario, timestamp: new Date().toISOString() });
    }
    
    ordens[idx].atualizadoEm = new Date().toISOString();
    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordens[idx]);
  }

  function deleteOrdem(id, usuarioLogado = null) {
    const ordens = getAllOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return;
    const userNome = usuarioLogado || (typeof currentUser !== 'undefined' && currentUser ? currentUser.nome : 'Sistema');
    ordens[idx].deletado = true;
    ordens[idx].deletadoEm = new Date().toISOString();
    ordens[idx].deletadoPor = userNome;
    if (!ordens[idx].historico) ordens[idx].historico = [];
    ordens[idx].historico.push({
      acao: 'OS Apagada (enviada para a lixeira)',
      usuario: userNome,
      timestamp: ordens[idx].deletadoEm
    });
    setData(KEYS.ORDENS, ordens);

    // Registra ID para não ser ressuscitado
    try {
      let deletedPermIds = JSON.parse(localStorage.getItem('os_deleted_permanently_ids') || '[]');
      if (!deletedPermIds.includes(id)) {
        deletedPermIds.push(id);
        localStorage.setItem('os_deleted_permanently_ids', JSON.stringify(deletedPermIds));
      }
    } catch(e) {}

    syncToSupabase(KEYS.ORDENS, ordens[idx]);
    deleteFromSupabase('ordens_servico', id);
  }

  function restaurarOrdem(id, usuarioLogado = null) {
    const ordens = getAllOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return;
    const userNome = usuarioLogado || (typeof currentUser !== 'undefined' && currentUser ? currentUser.nome : 'Sistema');
    ordens[idx].deletado = false;
    delete ordens[idx].deletadoEm;
    delete ordens[idx].deletadoPor;
    if (!ordens[idx].historico) ordens[idx].historico = [];
    ordens[idx].historico.push({
      acao: 'OS Restaurada da lixeira',
      usuario: userNome,
      timestamp: new Date().toISOString()
    });
    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordens[idx]);
  }

  function deleteOrdemPermanente(id) {
    const ordens = getAllOrdens().filter(os => os.id !== id);
    setData(KEYS.ORDENS, ordens);

    // Registra o ID como excluído permanentemente para não ser ressuscitado pelo sync
    try {
      let deletedPermIds = JSON.parse(localStorage.getItem('os_deleted_permanently_ids') || '[]');
      if (!deletedPermIds.includes(id)) {
        deletedPermIds.push(id);
        localStorage.setItem('os_deleted_permanently_ids', JSON.stringify(deletedPermIds));
      }
    } catch(e) {}

    deleteFromSupabase('ordens_servico', id);
  }

  function getOrdensByStatus(status) {
    return getOrdens().filter(os => os.status === status);
  }

  // ---------- USUÁRIOS ----------

  function getUsuarios() {
    return getData(KEYS.USUARIOS);
  }

  function getUsuarioById(id) {
    return getUsuarios().find(u => u.id === id) || null;
  }

  function saveUsuario(usuario) {
    const usuarios = getUsuarios();
    usuario.id = usuario.id || Utils.gerarId();
    usuario.isInterno = !!usuario.isInterno;
    usuario.exibirNaDelegacao = usuario.exibirNaDelegacao !== false;
    if (usuario.isInterno) {
      if (!usuario.usuario || !usuario.usuario.trim()) {
        usuario.usuario = 'interno_' + usuario.id;
      }
      usuario.senha = usuario.senha || '';
    }
    usuario.criadoEm = new Date().toISOString();
    usuarios.push(usuario);
    setData(KEYS.USUARIOS, usuarios);
    syncToSupabase(KEYS.USUARIOS, usuario);
    return usuario;
  }

  function updateUsuario(id, updates) {
    const usuarios = getUsuarios();
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx === -1) return null;
    const updated = { ...usuarios[idx], ...updates };
    if (updated.isInterno) {
      if (!updated.usuario || !updated.usuario.trim()) {
        updated.usuario = 'interno_' + updated.id;
      }
      updated.senha = updated.senha || '';
    }
    usuarios[idx] = updated;
    setData(KEYS.USUARIOS, usuarios);
    syncToSupabase(KEYS.USUARIOS, usuarios[idx]);
    return usuarios[idx];
  }

  function deleteUsuario(id) {
    const usuarios = getUsuarios().filter(u => u.id !== id);
    setData(KEYS.USUARIOS, usuarios);
    deleteFromSupabase('usuarios', id);
  }

  function autenticar(usuario, senha) {
    const hash = Utils.hashSenha(senha);
    const uClean = (usuario || '').trim().toLowerCase();
    return getUsuarios().find(u => 
      !u.isInterno &&
      (u.usuario.toLowerCase() === uClean || (u.email && u.email.toLowerCase() === uClean)) &&
      (u.senha === hash || u.senha === senha)
    ) || null;
  }

  // ---------- SESSÃO ----------

  function setUsuarioLogado(user) {
    const sessionUser = { ...user };
    delete sessionUser.senha;
    localStorage.setItem(KEYS.SESSAO, JSON.stringify(sessionUser));
  }

  function getUsuarioLogado() {
    try {
      const sess = JSON.parse(localStorage.getItem(KEYS.SESSAO));
      if (!sess || !sess.id) return null;
      const user = getUsuarioById(sess.id);
      return user || sess;
    } catch {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(KEYS.SESSAO);
  }

  // ---------- CAMPOS PERSONALIZADOS ----------

  const ESSENTIAL_CAMPOS = [
    { id: 'campo_deixou_chave', nome: 'Deixou chave?', tipo: 'sim_nao_quantidade', secao: 'Acessórios', ativo: true },
    { id: 'campo_deixou_carregador', nome: 'Deixou carregador?', tipo: 'sim_nao_quantidade', secao: 'Acessórios', ativo: true },
    { id: 'campo_deixou_nfc', nome: 'Deixou Cartão NFC?', tipo: 'sim_nao_quantidade', secao: 'Acessórios', ativo: true },
    { id: 'campo_deixou_controle', nome: 'Deixou controle?', tipo: 'sim_nao_quantidade', secao: 'Acessórios', ativo: true },
    { id: 'campo_esta_na_garantia', nome: 'Esta na garantia?', tipo: 'sim_nao', secao: 'Garantia', ativo: true }
  ];

  function getCampos() {
    let list = getData(KEYS.CAMPOS) || [];
    const seen = new Set();
    const unique = [];
    let hasChanges = false;

    // Garante que os campos essenciais existam e estejam na seção correta
    ESSENTIAL_CAMPOS.forEach(ess => {
      const essClean = ess.nome.toLowerCase().replace(/[^a-z]/g, '');
      const found = list.find(c => (c.nome || '').toLowerCase().replace(/[^a-z]/g, '').includes(essClean));
      if (!found) {
        list.push({ ...ess, criadoEm: new Date().toISOString() });
        hasChanges = true;
      } else {
        if (found.secao !== ess.secao) {
          found.secao = ess.secao;
          hasChanges = true;
        }
        if (ess.tipo === 'sim_nao_quantidade' && found.tipo !== 'sim_nao_quantidade') {
          found.tipo = 'sim_nao_quantidade';
          hasChanges = true;
        }
      }
    });

    list.forEach(c => {
      const key = `${c.nome.trim().toLowerCase()}_${(c.secao || 'Outros').trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      } else {
        hasChanges = true;
        if (typeof SupabaseConfig !== 'undefined' && SupabaseConfig.isConnected()) {
          deleteFromSupabase('campos_personalizados', c.id);
        }
      }
    });

    if (hasChanges) {
      setData(KEYS.CAMPOS, unique);
    }

    return unique;
  }

  function getCamposAtivos() {
    return getCampos().filter(c => c.ativo);
  }

  function saveCampo(campo) {
    const campos = getCampos();
    campo.id = campo.id || 'campo_' + Utils.gerarId();
    campo.ativo = true;
    campo.criadoEm = new Date().toISOString();
    campos.push(campo);
    setData(KEYS.CAMPOS, campos);
    syncToSupabase(KEYS.CAMPOS, campo);
    return campo;
  }

  function updateCampo(id, updates) {
    const campos = getCampos();
    const idx = campos.findIndex(c => c.id === id);
    if (idx === -1) return null;
    campos[idx] = { ...campos[idx], ...updates };
    setData(KEYS.CAMPOS, campos);
    syncToSupabase(KEYS.CAMPOS, campos[idx]);
    return campos[idx];
  }

  function deleteCampo(id) {
    const campos = getCampos().filter(c => c.id !== id);
    setData(KEYS.CAMPOS, campos);
    deleteFromSupabase('campos_personalizados', id);
  }

  function toggleCampo(id) {
    const campos = getCampos();
    const idx = campos.findIndex(c => c.id === id);
    if (idx === -1) return;
    campos[idx].ativo = !campos[idx].ativo;
    setData(KEYS.CAMPOS, campos);
    syncToSupabase(KEYS.CAMPOS, campos[idx]);
    return campos[idx];
  }

  // ---------- OPÇÕES / LISTAS CONFIGURÁVEIS ----------

  function getOpcoes() {
    const list = getData(KEYS.OPCOES);
    if (Array.isArray(list)) {
      list.forEach(op => {
        if (Array.isArray(op.itens)) {
          op.itens.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));
        }
      });
    }
    return list;
  }

  function getOpcaoById(id) {
    return getOpcoes().find(o => o.id === id) || null;
  }

  function getOpcaoByCampo(campo) {
    return getOpcoes().find(o => o.campo === campo) || null;
  }

  function saveOpcao(opcao) {
    const opcoes = getOpcoes();
    opcao.id = opcao.id || 'opcao_' + Utils.gerarId();
    opcao.itens = opcao.itens || [];
    opcao.ativo = true;
    opcao.criadoEm = new Date().toISOString();
    opcoes.push(opcao);
    setData(KEYS.OPCOES, opcoes);
    syncToSupabase(KEYS.OPCOES, opcao);
    return opcao;
  }

  function updateOpcao(id, updates) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === id);
    if (idx === -1) return null;
    opcoes[idx] = { ...opcoes[idx], ...updates };
    setData(KEYS.OPCOES, opcoes);
    syncToSupabase(KEYS.OPCOES, opcoes[idx]);
    return opcoes[idx];
  }

  function deleteOpcao(id) {
    const opcoes = getOpcoes().filter(o => o.id !== id);
    setData(KEYS.OPCOES, opcoes);
    deleteFromSupabase('opcoes_listas', id);
  }

  function addItemOpcao(opcaoId, item) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === opcaoId);
    if (idx === -1) return;
    if (!opcoes[idx].itens.includes(item)) {
      opcoes[idx].itens.push(item);
    }
    setData(KEYS.OPCOES, opcoes);
    syncToSupabase(KEYS.OPCOES, opcoes[idx]);
    return opcoes[idx];
  }

  function removeItemOpcao(opcaoId, item) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === opcaoId);
    if (idx === -1) return;
    opcoes[idx].itens = opcoes[idx].itens.filter(i => i !== item);
    setData(KEYS.OPCOES, opcoes);
    syncToSupabase(KEYS.OPCOES, opcoes[idx]);
    return opcoes[idx];
  }

  function updateItemOpcao(opcaoId, oldItem, newItem) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === opcaoId);
    if (idx === -1) return;
    const itemIdx = opcoes[idx].itens.indexOf(oldItem);
    if (itemIdx !== -1 && newItem && newItem.trim()) {
      opcoes[idx].itens[itemIdx] = newItem.trim();
    }
    setData(KEYS.OPCOES, opcoes);
    syncToSupabase(KEYS.OPCOES, opcoes[idx]);
    return opcoes[idx];
  }

  // ---------- CARGOS / PERMISSÕES ----------

  function getCargos() {
    const cargos = getData(KEYS.CARGOS) || [];
    if (!cargos.some(c => c.id === 'role_motorista' || (c.nome && c.nome.toLowerCase() === 'motorista'))) {
      cargos.push({
        id: 'role_motorista',
        nome: 'Motorista',
        permissoes: ['assumir_servico', 'concluir_servico'],
        criadoEm: new Date().toISOString()
      });
      setData(KEYS.CARGOS, cargos);
    }
    return cargos;
  }

  function getCargoById(id) {
    if (!id) return null;
    const cargos = getCargos();
    const cleanId = String(id).trim().toLowerCase();
    const withoutPrefix = cleanId.replace(/^role_/, '');

    return cargos.find(c => {
      const cIdClean = (c.id || '').trim().toLowerCase();
      const cNameClean = (c.nome || '').trim().toLowerCase();
      return cIdClean === cleanId ||
             cIdClean.replace(/^role_/, '') === withoutPrefix ||
             cNameClean === cleanId ||
             cNameClean === withoutPrefix;
    }) || null;
  }

  function saveCargo(cargo) {
    const cargos = getCargos();
    cargo.id = cargo.id || 'role_' + Utils.gerarId();
    cargo.permissoes = cargo.permissoes || [];
    cargo.criadoEm = new Date().toISOString();
    cargos.push(cargo);
    setData(KEYS.CARGOS, cargos);
    syncToSupabase(KEYS.CARGOS, cargo);
    return cargo;
  }

  function updateCargo(id, updates) {
    const cargos = getCargos();
    const idx = cargos.findIndex(c => c.id === id);
    if (idx === -1) return null;
    cargos[idx] = { ...cargos[idx], ...updates };
    setData(KEYS.CARGOS, cargos);
    syncToSupabase(KEYS.CARGOS, cargos[idx]);
    return cargos[idx];
  }

  function deleteCargo(id) {
    // Não permitir deletar o cargo de admin padrão para segurança do sistema
    if (id === 'role_admin') return;
    const cargos = getCargos().filter(c => c.id !== id);
    setData(KEYS.CARGOS, cargos);
    deleteFromSupabase('cargos', id);
  }

  function getTemplatesWhatsApp() {
    const data = getData(KEYS.TEMPLATES_WHATSAPP);
    if (Array.isArray(data) && data.length > 0) return data;
    const oldTpl = localStorage.getItem(KEYS.TEMPLATE_WHATSAPP);
    if (oldTpl && oldTpl !== DEFAULT_TEMPLATE_WHATSAPP) {
      const migrated = [
        { ...DEFAULT_TEMPLATES_WHATSAPP[0], mensagem: oldTpl },
        ...DEFAULT_TEMPLATES_WHATSAPP.slice(1)
      ];
      setData(KEYS.TEMPLATES_WHATSAPP, migrated);
      return migrated;
    }
    setData(KEYS.TEMPLATES_WHATSAPP, DEFAULT_TEMPLATES_WHATSAPP);
    return DEFAULT_TEMPLATES_WHATSAPP;
  }

  function getTemplateWhatsAppById(id) {
    const templates = getTemplatesWhatsApp();
    return templates.find(t => t.id === id) || templates[0] || null;
  }

  function saveTemplateWhatsApp(template) {
    const templates = getTemplatesWhatsApp();
    if (!template.id) {
      template.id = 'tpl_' + Utils.gerarId();
    }
    if (template.padrao) {
      templates.forEach(t => t.padrao = false);
    }
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx !== -1) {
      templates[idx] = { ...templates[idx], ...template };
    } else {
      templates.push(template);
    }
    setData(KEYS.TEMPLATES_WHATSAPP, templates);
    syncToSupabase(KEYS.TEMPLATES_WHATSAPP, templates);
    return templates;
  }

  function deleteTemplateWhatsApp(id) {
    let templates = getTemplatesWhatsApp();
    if (templates.length <= 1) return templates;
    templates = templates.filter(t => t.id !== id);
    if (!templates.some(t => t.padrao)) {
      templates[0].padrao = true;
    }
    setData(KEYS.TEMPLATES_WHATSAPP, templates);
    syncToSupabase(KEYS.TEMPLATES_WHATSAPP, templates);
    return templates;
  }

  function getTemplateWhatsApp() {
    const templates = getTemplatesWhatsApp();
    const padrao = templates.find(t => t.padrao) || templates[0];
    return padrao ? padrao.mensagem : DEFAULT_TEMPLATE_WHATSAPP;
  }

  function getTema() {
    return localStorage.getItem(KEYS.TEMA) || 'light';
  }

  function saveTema(tema) {
    localStorage.setItem(KEYS.TEMA, tema);
  }

  return {
    initialize,
    sincronizarTudoComSupabase,
    DEFAULT_TEMPLATE_WHATSAPP,
    DEFAULT_TEMPLATES_WHATSAPP,
    getTemplateWhatsApp,
    getTemplatesWhatsApp,
    getTemplateWhatsAppById,
    saveTemplateWhatsApp,
    deleteTemplateWhatsApp,
    getTema,
    saveTema,
    // Ordens
    getAllOrdens,
    getOrdens,
    getOrdensApagadas,
    getOrdemById,
    saveOrdem,
    updateOrdem,
    addHistorico,
    deleteOrdem,
    restaurarOrdem,
    deleteOrdemPermanente,
    getOrdensByStatus,
    // Usuários
    getUsuarios,
    getUsuarioById,
    saveUsuario,
    updateUsuario,
    deleteUsuario,
    autenticar,
    // Sessão
    setUsuarioLogado,
    getUsuarioLogado,
    logout,
    // Campos
    getCampos,
    getCamposAtivos,
    saveCampo,
    updateCampo,
    deleteCampo,
    toggleCampo,
    // Opções
    getOpcoes,
    getOpcaoById,
    getOpcaoByCampo,
    saveOpcao,
    updateOpcao,
    deleteOpcao,
    addItemOpcao,
    removeItemOpcao,
    updateItemOpcao,
    // Cargos
    getCargos,
    getCargoById,
    saveCargo,
    updateCargo,
    deleteCargo,
    // Sync
    syncFromSupabase,
    sincronizarTudoComSupabase,
    enviarPendentesParaNuvem,
    getUltimoErroSync,
    limparErroSync
  };
})();
