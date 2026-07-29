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
    TEMA: 'os_theme',
    INITIALIZED: 'os_initialized'
  };

  const DEFAULT_TEMPLATE_WHATSAPP = `Olá, @{nome_cliente}! Tudo bem?

Informamos que o seu veículo está pronto para retirada!

Serviços realizados:
@{lista_servicos}

Valor total: @{valor_total}
Pagamento: @{forma_pagamento} (@{status_pagamento})

Data: @{data}
Hora: @{hora}

Veículo: @{veiculo}

Agradecemos a preferência e ficamos à disposição!`;

  /**
   * Inicializa o storage com dados padrão
   */
  function initialize() {
    // Migração para trocar o administrador master e limpar logins antigos
    if (localStorage.getItem('os_admin_migrated_v2') !== 'true') {
      const newAdminUser = {
        id: Utils.gerarId(),
        nome: 'Administrador Master',
        usuario: 'suprabikemarketing@gmail.com',
        senha: 'Suprabike123!',
        role: 'role_admin',
        criadoEm: new Date().toISOString()
      };
      localStorage.setItem(KEYS.USUARIOS, JSON.stringify([newAdminUser]));
      localStorage.setItem('os_admin_migrated_v2', 'true');
      localStorage.removeItem(KEYS.SESSAO); // Desloga sessão antiga

      // Se o Supabase estiver conectado, limpa a tabela remota e insere o novo master
      if (typeof SupabaseConfig !== 'undefined' && SupabaseConfig.isConnected()) {
        const client = SupabaseConfig.getClient();
        if (client) {
          client.from('usuarios').delete().neq('id', '').then(() => {
            syncToSupabase(KEYS.USUARIOS, newAdminUser);
          });
        }
      }
    }

    // Migração para apagar todas as ordens de serviço/orçamentos existentes do banco de dados e local
    if (localStorage.getItem('os_clean_orders_v2') !== 'true') {
      localStorage.setItem(KEYS.ORDENS, JSON.stringify([]));
      localStorage.setItem('os_clean_orders_v2', 'true');
      if (typeof SupabaseConfig !== 'undefined' && SupabaseConfig.isConnected()) {
        const client = SupabaseConfig.getClient();
        if (client) {
          client.from('ordens_servico').delete().neq('id', '').then(() => {
            console.log('✅ Ordens de serviço antigas limpas do Supabase com sucesso.');
          });
        }
      }
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
        permissoes: ['assumir_servico', 'concluir_servico'],
        criadoEm: new Date().toISOString()
      }
    ];
    localStorage.setItem(KEYS.CARGOS, JSON.stringify(cargosIniciais));

    // Criar admin padrão
    const adminUser = {
      id: Utils.gerarId(),
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
      { id: 'campo_' + Utils.gerarId(), nome: 'Deixou chave?', tipo: 'sim_nao_quantidade', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() },
      { id: 'campo_' + Utils.gerarId(), nome: 'Deixou carregador?', tipo: 'sim_nao', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() },
      { id: 'campo_' + Utils.gerarId(), nome: 'Deixou Cartão NFC', tipo: 'sim_nao', secao: 'Outros', ativo: true, criadoEm: new Date().toISOString() }
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
    
    // Tenta sincronizar do Supabase no arranque se configurado
    sincronizarTudoComSupabase().then(() => syncFromSupabase());
  }

  // ---------- SUPABASE CLOUD SYNC ----------

  async function syncFromSupabase() {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client) return;

    try {
      // 1. Ordens
      const { data: ordens } = await client.from('ordens_servico').select('*');
      if (ordens) {
        const formatted = ordens.map(o => ({
          id: o.id,
          clienteNome: o.cliente_nome,
          clienteTelefone: o.cliente_telefone,
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
          temFotos: o.tem_fotos,
          fotos: o.fotos || [],
          camposPersonalizados: o.campos_personalizados || {},
          atendente: o.atendente,
          mecanico: o.mecanico,
          editadoPor: o.editado_por,
          editadoEm: o.editado_em,
          horaInicio: o.hora_inicio,
          horaFim: o.hora_fim,
          tempoTotal: o.tempo_total,
          historico: o.historico || [],
          criadoEm: o.criado_em
        }));
        localStorage.setItem(KEYS.ORDENS, JSON.stringify(formatted));
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

      // 6. Template WA
      const { data: config } = await client.from('configuracoes').select('*').eq('chave', 'template_whatsapp').single();
      if (config && config.valor) {
        localStorage.setItem(KEYS.TEMPLATE_WHATSAPP, config.valor);
      }
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
  }

  async function syncToSupabase(key, dataItem) {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client || !dataItem) return;

    try {
      if (key === KEYS.ORDENS) {
        const o = dataItem;
        const payload = {
          id: o.id,
          cliente_nome: o.clienteNome || 'Cliente',
          cliente_telefone: o.clienteTelefone || '',
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
          campos_personalizados: o.camposPersonalizados || {},
          atendente: o.atendente || '',
          mecanico: o.mecanico || null,
          editado_por: o.editadoPor || null,
          editado_em: o.editadoEm || null,
          hora_inicio: o.horaInicio || null,
          hora_fim: o.horaFim || null,
          tempo_total: o.tempoTotal || null,
          historico: o.historico || []
        };
        if (o.criadoEm) payload.criado_em = o.criadoEm;
        await client.from('ordens_servico').upsert(payload);
      } else if (key === KEYS.USUARIOS) {
        const u = dataItem;
        const payload = {
          id: u.id,
          nome: u.nome,
          usuario: u.usuario,
          senha: u.senha,
          role: u.role
        };
        if (u.fotoPerfil) payload.foto_perfil = u.fotoPerfil;
        if (u.criadoEm) payload.criado_em = u.criadoEm;
        await client.from('usuarios').upsert(payload);
      } else if (key === KEYS.CARGOS) {
        const c = dataItem;
        const payload = {
          id: c.id,
          nome: c.nome,
          permissoes: c.permissoes || []
        };
        if (c.criadoEm) payload.criado_em = c.criadoEm;
        await client.from('cargos').upsert(payload);
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
        await client.from('opcoes_listas').upsert(payload, { onConflict: 'campo' });
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
        await client.from('campos_personalizados').upsert(payload);
      }
    } catch (e) {
      console.warn('Erro ao salvar no Supabase:', e);
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
    }
  }

  async function sincronizarTudoComSupabase() {
    if (typeof SupabaseConfig === 'undefined' || !SupabaseConfig.isConnected()) return;
    const client = SupabaseConfig.getClient();
    if (!client) return;

    try {
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

  function getOrdens() {
    return getData(KEYS.ORDENS);
  }

  function getOrdemById(id) {
    return getOrdens().find(os => os.id === id) || null;
  }

  function saveOrdem(ordem) {
    const ordens = getOrdens();
    if (!ordem.id) {
      ordem.id = Utils.gerarCodigoOS(ordens);
    }
    ordem.criadoEm = ordem.criadoEm || new Date().toISOString();
    ordem.atualizadoEm = new Date().toISOString();
    ordem.historico = ordem.historico || [];
    ordem.historico.push({
      acao: 'OS Criada',
      usuario: ordem.atendente,
      timestamp: new Date().toISOString()
    });
    ordens.push(ordem);
    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordem);
    return ordem;
  }

  function updateOrdem(id, updates) {
    const ordens = getOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return null;
    ordens[idx] = { ...ordens[idx], ...updates, atualizadoEm: new Date().toISOString() };
    setData(KEYS.ORDENS, ordens);
    syncToSupabase(KEYS.ORDENS, ordens[idx]);
    return ordens[idx];
  }

  function addHistorico(id, acao, usuario) {
    const ordens = getOrdens();
    const idx = ordens.findIndex(os => os.id === id);
    if (idx === -1) return;
    if (!ordens[idx].historico) ordens[idx].historico = [];
    ordens[idx].historico.push({ acao, usuario, timestamp: new Date().toISOString() });
    ordens[idx].atualizadoEm = new Date().toISOString();
    setData(KEYS.ORDENS, ordens);
  }

  function deleteOrdem(id) {
    const ordens = getOrdens().filter(os => os.id !== id);
    setData(KEYS.ORDENS, ordens);
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
    usuarios[idx] = { ...usuarios[idx], ...updates };
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

  function getCampos() {
    return getData(KEYS.CAMPOS);
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
    return campo;
  }

  function updateCampo(id, updates) {
    const campos = getCampos();
    const idx = campos.findIndex(c => c.id === id);
    if (idx === -1) return null;
    campos[idx] = { ...campos[idx], ...updates };
    setData(KEYS.CAMPOS, campos);
    return campos[idx];
  }

  function deleteCampo(id) {
    const campos = getCampos().filter(c => c.id !== id);
    setData(KEYS.CAMPOS, campos);
  }

  function toggleCampo(id) {
    const campos = getCampos();
    const idx = campos.findIndex(c => c.id === id);
    if (idx === -1) return;
    campos[idx].ativo = !campos[idx].ativo;
    setData(KEYS.CAMPOS, campos);
    return campos[idx];
  }

  // ---------- OPÇÕES / LISTAS CONFIGURÁVEIS ----------

  function getOpcoes() {
    return getData(KEYS.OPCOES);
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
    return opcao;
  }

  function updateOpcao(id, updates) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === id);
    if (idx === -1) return null;
    opcoes[idx] = { ...opcoes[idx], ...updates };
    setData(KEYS.OPCOES, opcoes);
    return opcoes[idx];
  }

  function deleteOpcao(id) {
    const opcoes = getOpcoes().filter(o => o.id !== id);
    setData(KEYS.OPCOES, opcoes);
  }

  function addItemOpcao(opcaoId, item) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === opcaoId);
    if (idx === -1) return;
    if (!opcoes[idx].itens.includes(item)) {
      opcoes[idx].itens.push(item);
    }
    setData(KEYS.OPCOES, opcoes);
    return opcoes[idx];
  }

  function removeItemOpcao(opcaoId, item) {
    const opcoes = getOpcoes();
    const idx = opcoes.findIndex(o => o.id === opcaoId);
    if (idx === -1) return;
    opcoes[idx].itens = opcoes[idx].itens.filter(i => i !== item);
    setData(KEYS.OPCOES, opcoes);
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
    return opcoes[idx];
  }

  // ---------- CARGOS / PERMISSÕES ----------

  function getCargos() {
    return getData(KEYS.CARGOS);
  }

  function getCargoById(id) {
    return getCargos().find(c => c.id === id) || null;
  }

  function saveCargo(cargo) {
    const cargos = getCargos();
    cargo.id = cargo.id || 'role_' + Utils.gerarId();
    cargo.permissoes = cargo.permissoes || [];
    cargo.criadoEm = new Date().toISOString();
    cargos.push(cargo);
    setData(KEYS.CARGOS, cargos);
    return cargo;
  }

  function updateCargo(id, updates) {
    const cargos = getCargos();
    const idx = cargos.findIndex(c => c.id === id);
    if (idx === -1) return null;
    cargos[idx] = { ...cargos[idx], ...updates };
    setData(KEYS.CARGOS, cargos);
    return cargos[idx];
  }

  function deleteCargo(id) {
    // Não permitir deletar o cargo de admin padrão para segurança do sistema
    if (id === 'role_admin') return;
    const cargos = getCargos().filter(c => c.id !== id);
    setData(KEYS.CARGOS, cargos);
  }

  function getTemplateWhatsApp() {
    return localStorage.getItem(KEYS.TEMPLATE_WHATSAPP) || DEFAULT_TEMPLATE_WHATSAPP;
  }

  function saveTemplateWhatsApp(template) {
    localStorage.setItem(KEYS.TEMPLATE_WHATSAPP, template);
  }

  function getTema() {
    return localStorage.getItem(KEYS.TEMA) || 'dark';
  }

  function saveTema(tema) {
    localStorage.setItem(KEYS.TEMA, tema);
  }

  return {
    initialize,
    sincronizarTudoComSupabase,
    DEFAULT_TEMPLATE_WHATSAPP,
    getTemplateWhatsApp,
    saveTemplateWhatsApp,
    getTema,
    saveTema,
    // Ordens
    getOrdens,
    getOrdemById,
    saveOrdem,
    updateOrdem,
    addHistorico,
    deleteOrdem,
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
    deleteCargo
  };
})();
