// ============================================
// APP.JS — Aplicação Principal (v2)
// ============================================

const App = (() => {

  // ---------- STATE ----------
  let currentPage = 'home';
  let currentUser = null;
  let currentOSId = null;
  let editingOS = null;
  let origemRetiradaId = null;
  let currentServicosSubtab = 'servicos';
  let fotosAnexadas = [];
  let deferredPwaPrompt = null;

  function temPermissao(permissao) {
    if (!currentUser) return false;
    const uClean = (currentUser.usuario || '').trim().toLowerCase();
    if (uClean === 'suprabikemarketing@gmail.com' || uClean === 'admin' || currentUser.role === 'admin' || currentUser.role === 'role_admin') return true;
    const cargo = Storage.getCargoById(currentUser.role);
    if (!cargo) return false;
    return cargo.permissoes && cargo.permissoes.includes(permissao);
  }

  // ---------- INIT ----------

  function init() {
    Storage.initialize();
    applyTheme();

    // Registra Service Worker para PWA (offline & instalável)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('Service Worker PWA registrado com sucesso:', reg.scope);
            // Verifica atualizações no servidor (ex: Vercel)
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showToast('Nova versão disponível! Atualizando aplicativo...', 'info');
                    setTimeout(() => window.location.reload(), 1200);
                  }
                };
              }
            };
          })
          .catch(err => console.warn('Erro ao registrar Service Worker PWA:', err));
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Captura prompt nativo de instalação PWA (Android / Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
    });

    // Conecta ao Supabase Realtime para atualizações instantâneas em tempo real sem F5
    if (typeof SupabaseConfig !== 'undefined' && SupabaseConfig.initRealtime) {
      SupabaseConfig.initRealtime((table, payload) => {
        if (typeof Storage.syncFromSupabase === 'function') {
          Storage.syncFromSupabase().then(() => {
            currentUser = Storage.getUsuarioLogado();
            if (currentUser) {
              renderDashboard();
              renderCurrentList();
            }
          });
        }
      });
    }

    // Always sync from Supabase on startup so all devices get fresh data (delayed to make app load instantly)
    setTimeout(() => {
      if (typeof Storage.syncFromSupabase === 'function') {
        Storage.syncFromSupabase().then(() => {
          // Re-read user after sync in case users were updated from cloud
          currentUser = Storage.getUsuarioLogado();
          if (currentUser) {
            renderDashboard();
            renderCurrentList();
          }
        }).catch(err => console.warn('Sync from Supabase failed:', err));
      }
    }, 200);

    currentUser = Storage.getUsuarioLogado();

    if (currentUser) {
      showMainLayout();
      navigateTo('home');
    } else {
      showLoginScreen();
    }

    bindGlobalEvents();
    initPullToRefresh();
  }

  function bindGlobalEvents() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) navigateTo(page);
      });
    });

    document.getElementById('modal-overlay').addEventListener('click', closeModal);

    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    if (btnLogoutAdmin) {
      btnLogoutAdmin.addEventListener('click', () => {
        if (confirm('Deseja realmente sair da sua conta?')) {
          handleLogout();
        }
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Deseja realmente sair da sua conta?')) {
          handleLogout();
        }
      });
    }

    const btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin) btnAdmin.addEventListener('click', () => navigateTo('admin'));

    const btnPwaInstall = document.getElementById('btn-pwa-install-menu');
    if (btnPwaInstall) {
      btnPwaInstall.addEventListener('click', () => {
        if (deferredPwaPrompt) {
          deferredPwaPrompt.prompt();
          deferredPwaPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
              showToast('Aplicativo adicionado à Tela de Início!', 'success');
            }
            deferredPwaPrompt = null;
          });
        } else {
          openModalInstrucoesPWAiOS();
        }
      });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        renderCurrentList();
      }, 300));
    }

    const searchConcluidos = document.getElementById('search-concluidos-input');
    if (searchConcluidos) {
      searchConcluidos.addEventListener('input', Utils.debounce((e) => {
        renderCurrentList();
      }, 300));
    }

    const searchPDFs = document.getElementById('search-pdfs-input');
    if (searchPDFs) {
      searchPDFs.addEventListener('input', Utils.debounce((e) => {
        renderListaPDFs();
      }, 300));
    }

    // Home navigation links
    const btnHomeNovoOrcamento = document.getElementById('home-btn-novo-orcamento');
    if (btnHomeNovoOrcamento) {
      btnHomeNovoOrcamento.addEventListener('click', () => {
        isVisitaTecnicaForm = false;
        navigateTo('nova-os');
      });
    }

    const btnHomeOrdemRetirada = document.getElementById('home-btn-ordem-retirada');
    if (btnHomeOrdemRetirada) {
      btnHomeOrdemRetirada.addEventListener('click', () => openModalNovaOrdemRetirada());
    }

    const btnHomeVisitaTecnica = document.getElementById('home-btn-visita-tecnica');
    if (btnHomeVisitaTecnica) {
      btnHomeVisitaTecnica.addEventListener('click', () => openModalNovaVisitaTecnica());
    }

    const cardHomeSemana = document.getElementById('home-card-estatisticas-semana');
    if (cardHomeSemana) {
      cardHomeSemana.addEventListener('click', () => navigateTo('servicos'));
    }

    const cardHomePendentes = document.getElementById('home-card-pendentes');
    if (cardHomePendentes) {
      cardHomePendentes.addEventListener('click', () => navigateTo('servicos'));
    }

    // Sub-abas de Serviços (SERVIÇOS / RETIRADA)
    const subtabServicos = document.getElementById('subtab-servicos');
    const subtabRetirada = document.getElementById('subtab-retirada');

    if (subtabServicos && subtabRetirada) {
      subtabServicos.addEventListener('click', () => {
        currentServicosSubtab = 'servicos';
        subtabServicos.classList.add('active');
        subtabRetirada.classList.remove('active');
        subtabServicos.style.background = '#ffffff';
        subtabServicos.style.color = '#0f172a';
        subtabServicos.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
        subtabRetirada.style.background = 'transparent';
        subtabRetirada.style.color = '#64748b';
        subtabRetirada.style.boxShadow = 'none';
        renderListaOS('aguardando');
      });

      subtabRetirada.addEventListener('click', () => {
        currentServicosSubtab = 'retirada';
        subtabRetirada.classList.add('active');
        subtabServicos.classList.remove('active');
        subtabRetirada.style.background = '#ffffff';
        subtabRetirada.style.color = '#0f172a';
        subtabRetirada.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
        subtabServicos.style.background = 'transparent';
        subtabServicos.style.color = '#64748b';
        subtabServicos.style.boxShadow = 'none';
        renderListaOS('aguardando');
      });
    }



    // Delivery date & time handlers
    const checkEntrega = document.getElementById('os-check-data-entrega');
    const containerEntrega = document.getElementById('container-data-entrega');
    const inputEntrega = document.getElementById('os-data-entrega');
    const inputHoraEntrega = document.getElementById('os-hora-entrega');
    const displayDiaSemana = document.getElementById('display-dia-semana-entrega');

    function updateDisplayEntrega() {
      if (!inputEntrega) return;
      const dataVal = inputEntrega.value;
      const horaVal = inputHoraEntrega ? inputHoraEntrega.value : '';
      if (dataVal) {
        const info = Utils.formatarDataEntrega(dataVal, horaVal);
        if (info) {
          displayDiaSemana.textContent = `📅 ${info.textoCompleto}`;
          displayDiaSemana.style.display = 'block';
        } else {
          displayDiaSemana.style.display = 'none';
        }
      } else {
        displayDiaSemana.style.display = 'none';
      }
    }

    if (checkEntrega) {
      checkEntrega.addEventListener('change', (e) => {
        if (e.target.checked) {
          containerEntrega.style.display = 'block';
          if (!inputEntrega.value) {
            inputEntrega.value = new Date().toISOString().split('T')[0];
          }
          updateDisplayEntrega();
        } else {
          containerEntrega.style.display = 'none';
          inputEntrega.value = '';
          if (inputHoraEntrega) inputHoraEntrega.value = '';
          displayDiaSemana.style.display = 'none';
        }
      });
    }

    if (inputEntrega) inputEntrega.addEventListener('change', updateDisplayEntrega);
    if (inputHoraEntrega) inputHoraEntrega.addEventListener('change', updateDisplayEntrega);

    // Home stats sub-cards navigation
    const btnStatAFazer = document.getElementById('home-stat-afazer');
    if (btnStatAFazer) btnStatAFazer.addEventListener('click', () => navigateTo('servicos'));

    const btnStatAndamento = document.getElementById('home-stat-andamento');
    if (btnStatAndamento) btnStatAndamento.addEventListener('click', () => navigateTo('andamento'));

    const btnStatConcluidos = document.getElementById('home-stat-concluidos');
    if (btnStatConcluidos) btnStatConcluidos.addEventListener('click', () => navigateTo('concluidos'));

    // Photo attachments handlers (Camera & Gallery)
    const checkFotos = document.getElementById('os-check-fotos');
    const containerFotos = document.getElementById('container-fotos');
    const btnAddCamera = document.getElementById('btn-add-foto-camera');
    const inputCamera = document.getElementById('os-input-foto-camera');
    const btnAddGaleria = document.getElementById('btn-add-foto-galeria');
    const inputGaleria = document.getElementById('os-input-foto-galeria');

    if (checkFotos) {
      checkFotos.addEventListener('change', (e) => {
        if (e.target.checked) {
          containerFotos.style.display = 'block';
        } else {
          containerFotos.style.display = 'none';
          fotosAnexadas = [];
          renderFotosGrid();
        }
      });
    }

    async function processarFotosUpload(files, inputElement) {
      if (!files.length) return;
      const espacoDisponivel = 5 - fotosAnexadas.length;
      if (espacoDisponivel <= 0) {
        showToast('Limite máximo de 5 fotos atingido!', 'warning');
        if (inputElement) inputElement.value = '';
        return;
      }

      const filesParaProcessar = files.slice(0, espacoDisponivel);
      if (files.length > espacoDisponivel) {
        showToast(`Processando apenas ${espacoDisponivel} foto(s) para respeitar o limite máximo de 5.`, 'info');
      } else {
        showToast('Processando e comprimindo foto(s)...', 'info');
      }

      for (const file of filesParaProcessar) {
        try {
          const base64Comprimida = await Utils.comprimirFotoBase64(file, 900, 0.65);
          fotosAnexadas.push(base64Comprimida);
        } catch (err) {
          console.error('Erro ao comprimir foto:', err);
        }
      }
      if (inputElement) inputElement.value = '';
      renderFotosGrid();
      showToast('Foto(s) anexada(s) com sucesso!', 'success');
    }

    if (btnAddCamera && inputCamera) {
      btnAddCamera.addEventListener('click', () => {
        if (fotosAnexadas.length >= 5) {
          showToast('Limite máximo de 5 fotos por orçamento!', 'warning');
          return;
        }
        inputCamera.click();
      });
      inputCamera.addEventListener('change', (e) => processarFotosUpload(Array.from(e.target.files), inputCamera));
    }

    if (btnAddGaleria && inputGaleria) {
      btnAddGaleria.addEventListener('click', () => {
        if (fotosAnexadas.length >= 5) {
          showToast('Limite máximo de 5 fotos por orçamento!', 'warning');
          return;
        }
        inputGaleria.click();
      });
      inputGaleria.addEventListener('change', (e) => processarFotosUpload(Array.from(e.target.files), inputGaleria));
    }

    // Payment status & partial entry handler
    const selectStatusPagamento = document.getElementById('os-status-pagamento');
    const inputValorEntrada = document.getElementById('os-valor-entrada');
    if (selectStatusPagamento) {
      selectStatusPagamento.addEventListener('change', atualizarCalculoPagamentoParcial);
    }
    if (inputValorEntrada) {
      inputValorEntrada.addEventListener('input', atualizarCalculoPagamentoParcial);
    }

    // Initialize WhatsApp template editor controls
    initWhatsAppTemplateEditor();
  }

  function atualizarCalculoPagamentoParcial() {
    const statusSelect = document.getElementById('os-status-pagamento');
    const container = document.getElementById('container-pagamento-parcial');
    const inputEntrada = document.getElementById('os-valor-entrada');
    const displayRestante = document.getElementById('display-valor-restante');
    if (!statusSelect || !container || !inputEntrada || !displayRestante) return;

    if (statusSelect.value === 'parcial') {
      container.style.display = 'block';
      let total = 0;
      document.querySelectorAll('.servico-valor').forEach(input => { total += parseFloat(input.value) || 0; });
      const valorEntrada = parseFloat(inputEntrada.value) || 0;
      const restante = Math.max(0, total - valorEntrada);
      displayRestante.textContent = Utils.formatarMoeda(restante);
    } else {
      container.style.display = 'none';
    }
  }

  function renderFotosGrid() {
    const grid = document.getElementById('os-fotos-grid');
    const contador = document.getElementById('os-fotos-contador');
    const btnAddFoto = document.getElementById('btn-add-foto');
    if (!grid) return;

    if (contador) {
      contador.textContent = `${fotosAnexadas.length}/5 foto${fotosAnexadas.length !== 1 ? 's' : ''} anexada${fotosAnexadas.length !== 1 ? 's' : ''}`;
    }

    if (btnAddFoto) {
      if (fotosAnexadas.length >= 5) {
        btnAddFoto.style.opacity = '0.5';
        btnAddFoto.style.pointerEvents = 'none';
      } else {
        btnAddFoto.style.opacity = '1';
        btnAddFoto.style.pointerEvents = 'auto';
      }
    }

    grid.innerHTML = fotosAnexadas.map((src, index) => `
      <div class="foto-thumb-wrapper">
        <img src="${src}" class="foto-thumb-img" alt="Foto ${index + 1}">
        <button type="button" class="foto-thumb-btn-remove" data-index="${index}">✕</button>
      </div>
    `).join('');

    grid.querySelectorAll('.foto-thumb-btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        fotosAnexadas.splice(idx, 1);
        renderFotosGrid();
      });
    });
  }

  // ---------- AUTH ----------

  let loginTentativas = 0;
  let loginBloqueadoAte = null;

  async function handleLogin(e) {
    e.preventDefault();
    const usuario = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Rate Limiting: Impede força bruta
    if (loginBloqueadoAte && Date.now() < loginBloqueadoAte) {
      const segundosRestantes = Math.ceil((loginBloqueadoAte - Date.now()) / 1000);
      errorEl.textContent = `Muitas tentativas incorretas. Acesso bloqueado por mais ${segundosRestantes} segundos.`;
      errorEl.classList.add('show');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Entrando...';
    }

    try {
      // Tenta autenticar localmente primeiro
      let user = Storage.autenticar(usuario, senha);

      // Se falhar e Supabase estiver conectado, tenta sincronizar e tentar novamente
      if (!user && typeof Storage.syncFromSupabase === 'function') {
        try {
          await Storage.syncFromSupabase();
          user = Storage.autenticar(usuario, senha);
        } catch (err) {
          console.warn('Erro ao sincronizar durante o login:', err);
        }
      }

      if (user) {
        loginTentativas = 0;
        loginBloqueadoAte = null;
        currentUser = user;
        Storage.setUsuarioLogado(user);
        errorEl.classList.remove('show');
        showMainLayout();
        navigateTo('home');
        
        // Sincroniza o restante dos dados em segundo plano após o login bem-sucedido
        if (typeof Storage.syncFromSupabase === 'function') {
          Storage.syncFromSupabase().then(() => {
            renderDashboard();
            renderCurrentList();
          });
        }
      } else {
        loginTentativas++;
        if (loginTentativas >= 5) {
          loginBloqueadoAte = Date.now() + (5 * 60 * 1000); // Bloqueio por 5 minutos
          errorEl.textContent = 'Muitas tentativas de login incorretas. Acesso bloqueado temporariamente por 5 minutos por segurança.';
        } else {
          const restantes = 5 - loginTentativas;
          errorEl.textContent = `Usuário ou senha incorretos. (${restantes} tentativa(s) restante(s))`;
        }
        errorEl.classList.add('show');
      }
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Ocorreu um erro ao fazer login';
      errorEl.classList.add('show');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
          Entrar
        `;
      }
    }
  }

  function handleLogout() {
    Storage.logout();
    currentUser = null;
    showLoginScreen();
  }

  // ---------- NAVIGATION ----------

  function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-layout').classList.remove('active');
    document.getElementById('login-usuario').value = '';
    document.getElementById('login-senha').value = '';
  }

  function showMainLayout() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-layout').classList.add('active');
    updateHeaderUser();
    updateNavVisibility();
  }

  function navigateTo(page) {
    if (page === 'nova-os' && !temPermissao('criar_os')) {
      showToast('Acesso restrito!', 'error');
      navigateTo('home');
      return;
    }
    if ((page === 'admin' || page.startsWith('admin-')) && !temPermissao('configuracoes')) {
      showToast('Acesso restrito!', 'error');
      navigateTo('home');
      return;
    }

    currentPage = page;
    document.getElementById('btn-back').style.display = 'none';

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    // Update header
    updateHeaderTitle(page);

    // Show/hide admin / logout buttons in header
    updateHeaderButtons();

    // Render page
    switch (page) {
      case 'home':
        renderDashboard();
        updateNavBadges();
        break;
      case 'nova-os':
        renderNovaOS();
        updateNavBadges();
        break;
      case 'servicos':
      case 'andamento':
      case 'concluidos':
        renderCurrentList();
        break;
      case 'pdfs':
        renderListaPDFs();
        updateNavBadges();
        break;
      case 'admin':
        renderAdmin();
        updateNavBadges();
        break;
      case 'admin-usuarios':
      case 'admin-cargos':
      case 'admin-campos':
      case 'admin-opcoes':
      case 'admin-whatsapp':
        renderAdminSubpage(page.replace('admin-', ''));
        updateNavBadges();
        break;
    }
  }

  // ---------- HOME DASHBOARD ----------

  function updateDashboard() {
    renderDashboard();
  }

  function renderDashboard() {
    if (!currentUser) return;
    
    const welcomeTitle = document.getElementById('home-welcome-title');
    if (welcomeTitle) {
      welcomeTitle.textContent = `Olá, ${currentUser.nome.split(' ')[0]}!`;
    }

    const btnHomeNovoOrcamento = document.getElementById('home-btn-novo-orcamento');
    if (btnHomeNovoOrcamento) {
      btnHomeNovoOrcamento.style.display = temPermissao('criar_os') ? 'flex' : 'none';
    }

    const ordens = Storage.getOrdens();
    
    // Contagem de Estatísticas da Semana Atual
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const ordensDaSemana = ordens.filter(o => {
      if (!o.criadoEm) return false;
      const dataCriacao = new Date(o.criadoEm);
      return dataCriacao >= startOfWeek && dataCriacao <= endOfWeek;
    });

    const semanaAguardando = ordensDaSemana.filter(o => o.status === 'aguardando').length;
    const semanaAndamento = ordensDaSemana.filter(o => o.status === 'em_andamento').length;
    const semanaConcluido = ordensDaSemana.filter(o => o.status === 'concluido').length;

    const elSemAguardando = document.getElementById('home-semana-aguardando');
    if (elSemAguardando) elSemAguardando.textContent = semanaAguardando;

    const elSemAndamento = document.getElementById('home-semana-andamento');
    if (elSemAndamento) elSemAndamento.textContent = semanaAndamento;

    const elSemConcluido = document.getElementById('home-semana-concluido');
    if (elSemConcluido) elSemConcluido.textContent = semanaConcluido;

    // Status counts gerais
    const countAguardando = ordens.filter(o => o.status === 'aguardando').length;
    const countAndamento = ordens.filter(o => o.status === 'em_andamento').length;

    // Pendentes gerais = aguardando + em_andamento
    const pendentesCount = countAguardando + countAndamento;
    const countPendentesEl = document.getElementById('home-count-pendentes');
    if (countPendentesEl) countPendentesEl.textContent = pendentesCount;

    // Renderiza a Bandeja de Histórico da Home
    renderTrayHistorico(currentTrayTab);
    initTrayHistoricoEvents();
  }

  let currentTrayTab = 'servicos';

  function renderTrayHistorico(activeTab = 'servicos') {
    currentTrayTab = activeTab;
    const container = document.getElementById('tray-content-list');
    if (!container) return;

    const allActive = Storage.getOrdens();
    const activeServicos = allActive.filter(o => o.status === 'aguardando' || o.status === 'em_andamento');
    const activeConcluidos = allActive.filter(o => o.status === 'concluido');
    const ordensApagadas = Storage.getOrdensApagadas();

    // Update counts
    const elCntServ = document.getElementById('tray-count-servicos');
    if (elCntServ) elCntServ.textContent = activeServicos.length;

    const elCntConc = document.getElementById('tray-count-concluidos');
    if (elCntConc) elCntConc.textContent = activeConcluidos.length;

    const elCntApag = document.getElementById('tray-count-apagados');
    if (elCntApag) elCntApag.textContent = ordensApagadas.length;

    // Filter by search query
    const searchInput = document.getElementById('tray-search-input');
    const qClean = searchInput && searchInput.value ? Utils.removerAcentos(searchInput.value.trim().toLowerCase()) : '';

    let listToRender = [];
    if (activeTab === 'servicos') {
      listToRender = activeServicos;
    } else if (activeTab === 'concluidos') {
      listToRender = activeConcluidos;
    } else if (activeTab === 'apagados') {
      listToRender = ordensApagadas;
    }

    if (qClean) {
      listToRender = listToRender.filter(o =>
        Utils.removerAcentos(o.id || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteNome || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteTelefone || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.modeloVeiculo || '').toLowerCase().includes(qClean)
      );
    }

    listToRender.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm || 0) - new Date(a.atualizadoEm || a.criadoEm || 0));

    if (listToRender.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:24px 10px; color:var(--text-tertiary); font-size:var(--font-xs);">
        Nenhuma Ordem de Serviço encontrada nesta sub-aba.
      </div>`;
      return;
    }

    const html = listToRender.map(o => {
      const isApagado = !!o.deletado;
      let statusBadge = '';
      if (isApagado) {
        statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:700;">APAGADA</span>`;
      } else {
        statusBadge = `<span class="badge badge-status" data-status="${o.status}">${Utils.traduzirStatus(o.status)}</span>`;
      }

      let actionsTrayHtml = '';
      if (isApagado) {
        actionsTrayHtml = `
          <button class="btn btn-secondary btn-xs btn-tray-restaurar" data-id="${o.id}" style="font-weight:700; background:rgba(34,197,94,0.15); border-color:rgba(34,197,94,0.3); color:#22c55e;">
            🔄 Restaurar
          </button>
          <button class="btn btn-danger btn-xs btn-tray-excluir-perm" data-id="${o.id}" style="font-weight:700;">
            🗑️ Excluir Definitivamente
          </button>`;
      } else {
        actionsTrayHtml = `
          <button class="btn btn-secondary btn-xs btn-tray-detalhes" data-id="${o.id}" style="font-weight:700;">
            👁️ Ver Detalhes
          </button>`;
        if (o.status === 'concluido') {
          actionsTrayHtml += `
            <button class="btn btn-primary btn-xs btn-tray-pdf" data-id="${o.id}" style="font-weight:700; background:#2563eb; border-color:#2563eb;">
              📑 PDF
            </button>`;
        }
      }

      const infoSub = isApagado 
        ? `Apagado em: ${Utils.formatarDataHora(o.deletadoEm)} por ${o.deletadoPor || 'Sistema'}`
        : `${o.modeloVeiculo || 'Veículo'} • Data: ${Utils.formatarData(o.dataServico)}`;

      return `
        <div style="background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:10px 14px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:var(--font-xs); font-weight:800; color:var(--accent);">${o.id}</span>
            ${statusBadge}
          </div>
          <div style="font-size:var(--font-sm); font-weight:700; color:var(--text-primary);">${Utils.escapeHtml(o.clienteNome || 'Cliente')}</div>
          <div style="font-size:9px; color:var(--text-tertiary);">${Utils.escapeHtml(infoSub)}</div>
          <div style="display:flex; justify-flex-end; gap:6px; margin-top:4px;">
            ${actionsTrayHtml}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.btn-tray-detalhes').forEach(btn => {
      btn.addEventListener('click', () => openOSDetail(btn.dataset.id));
    });

    container.querySelectorAll('.btn-tray-pdf').forEach(btn => {
      btn.addEventListener('click', () => Utils.gerarPDFOrdemServico(btn.dataset.id));
    });

    container.querySelectorAll('.btn-tray-restaurar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (confirm(`Deseja restaurar a Ordem de Serviço ${id} de volta ao sistema?`)) {
          Storage.restaurarOrdem(id, currentUser ? currentUser.nome : 'Sistema');
          showToast(`OS ${id} restaurada com sucesso!`, 'success');
          updateDashboard();
          renderTrayHistorico(currentTrayTab);
        }
      });
    });

    container.querySelectorAll('.btn-tray-excluir-perm').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR DEFINITIVAMENTE a Ordem de Serviço ${id}?\n\nEsta ação NÃO poderá ser desfeita!`)) {
          Storage.deleteOrdemPermanente(id);
          showToast(`OS ${id} excluída permanentemente.`, 'info');
          renderTrayHistorico(currentTrayTab);
        }
      });
    });
  }

  function initTrayHistoricoEvents() {
    const tabs = document.querySelectorAll('[data-tray-tab]');
    tabs.forEach(tabBtn => {
      tabBtn.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
        currentTrayTab = tabBtn.dataset.trayTab;
        renderTrayHistorico(currentTrayTab);
      };
    });

    const searchInput = document.getElementById('tray-search-input');
    if (searchInput) {
      searchInput.oninput = () => {
        renderTrayHistorico(currentTrayTab);
      };
    }
  }

  function updateHeaderTitle(page) {
    if (page === 'admin' || page.startsWith('admin-')) {
      document.getElementById('header-title').textContent = 'Configurações';
      return;
    }
    const titles = {
      'home': 'Início',
      'nova-os': 'Novo Orçamento',
      'servicos': 'Serviços',
      'andamento': 'Em Andamento',
      'concluidos': 'Concluídos',
      'admin': 'Configurações',
      'os-detail': 'Detalhes da OS'
    };
    document.getElementById('header-title').textContent = titles[page] || 'Boa Gestão';
  }

  function updateHeaderUser() {
    if (!currentUser) return;
    document.getElementById('header-user-name').textContent = currentUser.nome.split(' ')[0];
    const cargo = Storage.getCargoById(currentUser.role);
    const cargoNome = cargo ? cargo.nome : Utils.traduzirRole(currentUser.role);
    document.getElementById('header-user-role').textContent = cargoNome;

    const avatarEl = document.getElementById('header-user-avatar');
    if (avatarEl) {
      if (currentUser.fotoPerfil) {
        avatarEl.innerHTML = `<img src="${currentUser.fotoPerfil}" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1.5px solid var(--accent); margin-right:4px;">`;
      } else {
        avatarEl.innerHTML = `<span class="role-dot"></span>`;
      }
    }
  }

  function updateHeaderButtons() {
    const btnAdmin = document.getElementById('btn-admin');
    const btnLogout = document.getElementById('btn-logout');
    
    if (currentUser) {
      const hasConfigPerm = temPermissao('configuracoes');
      const isConfigPage = (currentPage === 'admin' || currentPage.startsWith('admin-'));
      const isFormPage = (currentPage === 'nova-os' || currentPage.startsWith('editar') || currentPage.includes('os-'));

      if (btnAdmin) {
        btnAdmin.style.display = (hasConfigPerm && !isConfigPage && !isFormPage) ? 'flex' : 'none';
      }
      if (btnLogout) {
        btnLogout.style.display = (!hasConfigPerm) ? 'flex' : 'none';
      }
    } else {
      if (btnAdmin) btnAdmin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'none';
    }
  }

  function updateNavVisibility() {
    // Nova OS tab: baseada na permissão criar_os
    const novaOsNav = document.querySelector('.nav-item[data-page="nova-os"]');
    if (novaOsNav) {
      novaOsNav.style.display = temPermissao('criar_os') ? 'flex' : 'none';
    }
    updateHeaderButtons();
  }

  function renderCurrentList() {
    renderListaOS('aguardando');
    renderListaOS('em_andamento');
    renderListaOS('concluido');
    updateNavBadges();
  }

  let historicoExpandedSections = {};

  function getHistoricoGroupInfo(os) {
    const dateStr = os.horaFim || os.dataServico || os.criadoEm;
    const date = dateStr ? new Date(dateStr) : new Date();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 0) {
      return { key: 'hoje', label: 'Hoje', order: 1 };
    }
    if (diffDays === 1) {
      return { key: 'ontem', label: 'Ontem', order: 2 };
    }

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const mesNome = meses[date.getMonth()];
    const ano = date.getFullYear();
    const isCurrentMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

    if (isCurrentMonth) {
      return { key: `mes_${ano}_${date.getMonth()}`, label: `Este Mês (${mesNome})`, order: 3 };
    } else {
      const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
      const orderVal = 4 + diffMonths;
      return { key: `mes_${ano}_${date.getMonth()}`, label: `${mesNome} de ${ano}`, order: orderVal };
    }
  }

  // ---------- OS LIST (replaces kanban) ----------

  function renderListaOS(status) {
    const containerId = {
      'aguardando': 'list-servicos',
      'em_andamento': 'list-andamento',
      'concluido': 'list-concluidos'
    }[status];

    const countId = {
      'aguardando': 'count-servicos',
      'em_andamento': 'count-andamento',
      'concluido': 'count-concluidos'
    }[status];

    const container = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    if (!container) return;

    container.innerHTML = '';

    // Se for a aba 'aguardando' e estiver na sub-aba RETIRADA
    if (status === 'aguardando' && currentServicosSubtab === 'retirada') {
      let ordensRetirada = Storage.getOrdens().filter(o => (o.tipo === 'retirada' || o.status === 'retirada_pendente') && o.status !== 'convertida');

      const searchGeneral = document.getElementById('search-input');
      const rawQuery = searchGeneral ? searchGeneral.value.trim() : '';
      const qClean = Utils.removerAcentos(rawQuery);

      if (qClean) {
        ordensRetirada = ordensRetirada.filter(os =>
          Utils.removerAcentos(os.id || '').includes(qClean) ||
          Utils.removerAcentos(os.clienteNome || '').includes(qClean) ||
          Utils.removerAcentos(os.clienteTelefone || '').includes(qClean) ||
          Utils.removerAcentos(os.modeloVeiculo || '').includes(qClean)
        );
      }

      if (countEl) countEl.textContent = ordensRetirada.length;

      if (ordensRetirada.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="empty-state-title">Nenhuma ordem de retirada em espera</div>
            <div class="empty-state-text">${rawQuery ? 'Tente outro termo de busca' : 'Clique no botão "Ordem de Retirada" na Home para registrar.'}</div>
          </div>`;
        return;
      }

      let htmlResult = '';
      ordensRetirada.forEach(os => {
        const dataStr = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : '';
        htmlResult += `
          <div class="os-card os-card-retirada" data-id="${os.id}" style="cursor:pointer; margin-bottom:var(--space-md); border-left:4px solid #f59e0b; padding:var(--space-md); background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--glass-border); border-left:4px solid #f59e0b;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-xs);">
              <div>
                <div style="font-weight:800; font-size:var(--font-md); color:#f59e0b;">${os.id}</div>
                <div style="font-weight:800; font-size:15px; color:var(--text-primary); margin-top:2px;">${Utils.escapeHtml(os.clienteNome)}</div>
                <div style="font-size:var(--font-xs); color:var(--text-secondary); margin-top:2px;">
                  🛵 ${Utils.escapeHtml(os.modeloVeiculo || 'Veículo')} (${Utils.escapeHtml(os.corVeiculo || 'Cor')}) · 📅 ${dataStr}
                </div>
              </div>
              <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:10px; padding:3px 8px; font-weight:700;">Retirada em Espera</span>
            </div>

            <div style="font-size:var(--font-xs); color:var(--text-tertiary); margin-bottom:var(--space-sm); border-top:1px dashed rgba(255,255,255,0.06); padding-top:6px;">
              📝 ${Utils.escapeHtml(os.observacoes || 'Ordem de Retirada cadastrada')}
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
              <button class="btn btn-primary btn-sm btn-confirmar-retirada" data-id="${os.id}" style="background:#2563eb; border-color:#2563eb; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                ✅ Confirmar Serviço
              </button>
              <button class="btn btn-secondary btn-sm btn-pdf-retirada-card" data-id="${os.id}" style="font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                📄 Baixar PDF
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = htmlResult;

      container.querySelectorAll('.btn-confirmar-retirada').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          confirmarRetiradaParaServico(btn.dataset.id);
        });
      });

      container.querySelectorAll('.btn-pdf-retirada-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Utils.gerarPDFRetiradaDoc(btn.dataset.id);
        });
      });

      // Click on card body → edit retirada
      container.querySelectorAll('.os-card-retirada').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const os = Storage.getOrdemById(card.dataset.id);
          if (os) openModalNovaOrdemRetirada(os);
        });
      });

      return;
    }

    let ordens = Storage.getOrdensByStatus(status);
    if (status === 'aguardando') {
      ordens = ordens.filter(o => o.tipo !== 'retirada' && o.status !== 'retirada_pendente');
    }

    // Search filter
    const searchConcluidos = document.getElementById('search-concluidos-input');
    const searchGeneral = document.getElementById('search-input');
    const rawQuery = (status === 'concluido' && searchConcluidos && searchConcluidos.value.trim() ? searchConcluidos.value : (searchGeneral ? searchGeneral.value : '')).trim();
    const qClean = Utils.removerAcentos(rawQuery);
    
    if (qClean) {
      ordens = ordens.filter(os =>
        Utils.removerAcentos(os.id).includes(qClean) ||
        Utils.removerAcentos(os.clienteNome).includes(qClean) ||
        Utils.removerAcentos(os.clienteTelefone).includes(qClean) ||
        Utils.removerAcentos(os.modeloVeiculo).includes(qClean) ||
        Utils.removerAcentos(os.corVeiculo).includes(qClean) ||
        Utils.removerAcentos(os.mecanico).includes(qClean)
      );
    }

    // Sort: urgente first, then by date
    ordens.sort((a, b) => {
      if (a.prioridade === 'urgente' && b.prioridade !== 'urgente') return -1;
      if (b.prioridade === 'urgente' && a.prioridade !== 'urgente') return 1;
      const dataA = a.horaFim || a.dataServico || a.criadoEm;
      const dataB = b.horaFim || b.dataServico || b.criadoEm;
      return new Date(dataB) - new Date(dataA);
    });

    // Update counter
    if (countEl) countEl.textContent = ordens.length;

    // Update all nav badges
    updateNavBadges();

    if (ordens.length === 0) {
      const emptyTexts = {
        'aguardando': 'Nenhum serviço aguardando',
        'em_andamento': 'Nenhum serviço em andamento',
        'concluido': 'Nenhum serviço no histórico'
      };
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
          </div>
          <div class="empty-state-title">${emptyTexts[status]}</div>
          <div class="empty-state-text">${rawQuery ? 'Tente outro termo de busca' : ''}</div>
        </div>`;
      return;
    }

    // Render Especial para Concluídos (Histórico por Seção Temporal)
    if (status === 'concluido') {
      const groupsMap = {};
      ordens.forEach(os => {
        const groupInfo = getHistoricoGroupInfo(os);
        if (!groupsMap[groupInfo.key]) {
          groupsMap[groupInfo.key] = {
            key: groupInfo.key,
            label: groupInfo.label,
            order: groupInfo.order,
            ordens: []
          };
        }
        groupsMap[groupInfo.key].ordens.push(os);
      });

      const sortedGroups = Object.values(groupsMap).sort((a, b) => a.order - b.order);

      let htmlResult = '';
      sortedGroups.forEach(grp => {
        const isExpanded = !!historicoExpandedSections[grp.key];
        const visibleOrdens = isExpanded ? grp.ordens : grp.ordens.slice(0, 2);
        const hasMore = grp.ordens.length > 2;

        htmlResult += `
          <div class="historico-section" style="margin-bottom:var(--space-lg);">
            <div class="historico-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm); padding-bottom:6px; border-bottom:1px dashed rgba(255,255,255,0.08);">
              <div style="font-size:var(--font-xs); font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
                <span>📅 ${grp.label}</span>
                <span style="font-size:var(--font-xs); color:var(--text-tertiary); font-weight:500;">(${grp.ordens.length})</span>
              </div>
              ${hasMore ? `
                <button class="btn-toggle-historico-sec" data-key="${grp.key}" style="font-size:var(--font-xs); color:var(--accent); font-weight:700; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.25); padding:4px 10px; border-radius:var(--radius-full); cursor:pointer;">
                  ${isExpanded ? 'Recolher ⌃' : `Ver mais (+${grp.ordens.length - 2}) →`}
                </button>
              ` : ''}
            </div>
            <div class="kanban-list">
              ${visibleOrdens.map(os => renderOSCard(os)).join('')}
            </div>
          </div>
        `;
      });

      container.innerHTML = htmlResult;

      // Bind toggle click
      container.querySelectorAll('.btn-toggle-historico-sec').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const k = btn.dataset.key;
          historicoExpandedSections[k] = !historicoExpandedSections[k];
          renderListaOS('concluido');
        });
      });
    } else {
      container.innerHTML = ordens.map(os => renderOSCard(os)).join('');
    }

    // Bind clicks
    container.querySelectorAll('.os-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.os-card-action-btn')) return;
        openOSDetail(card.dataset.id);
      });
    });

    container.querySelectorAll('.btn-assumir').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); assumirServico(btn.dataset.id); });
    });

    container.querySelectorAll('.btn-delegar').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openModalDelegarServico(btn.dataset.id); });
    });

    container.querySelectorAll('.btn-concluir').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); concluirServico(btn.dataset.id); });
    });

    container.querySelectorAll('.btn-pdf-os-card').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); Utils.gerarPDFOrdemServico(btn.dataset.id); });
    });

    container.querySelectorAll('.btn-wa-os-card').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openModalEnviarWhatsApp(btn.dataset.id); });
    });
  }

  // ---------- GERENCIADOR DE PDFS ----------

  function renderListaPDFs() {
    const container = document.getElementById('list-pdfs');
    const countEl = document.getElementById('count-pdfs');
    if (!container) return;

    container.innerHTML = '';
    let ordens = Storage.getOrdensByStatus('concluido');

    // Search filter
    const searchPDFs = document.getElementById('search-pdfs-input');
    const rawQuery = searchPDFs && searchPDFs.value.trim() ? searchPDFs.value.trim() : '';
    const qClean = Utils.removerAcentos(rawQuery);

    if (qClean) {
      ordens = ordens.filter(os =>
        Utils.removerAcentos(os.id).includes(qClean) ||
        Utils.removerAcentos(os.clienteNome).includes(qClean) ||
        Utils.removerAcentos(os.clienteTelefone).includes(qClean) ||
        Utils.removerAcentos(os.modeloVeiculo).includes(qClean) ||
        Utils.removerAcentos(os.corVeiculo).includes(qClean) ||
        Utils.removerAcentos(os.mecanico).includes(qClean)
      );
    }

    // Sort: newest first
    ordens.sort((a, b) => {
      const dataA = a.horaFim || a.dataServico || a.criadoEm;
      const dataB = b.horaFim || b.dataServico || b.criadoEm;
      return new Date(dataB) - new Date(dataA);
    });

    if (countEl) countEl.textContent = ordens.length;

    if (ordens.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z"/></svg>
          </div>
          <div class="empty-state-title">Nenhum PDF disponível</div>
          <div class="empty-state-text">${rawQuery ? 'Tente outro termo de busca' : 'Finalize ordens de serviço para gerar os PDFs.'}</div>
        </div>`;
      return;
    }

    let htmlResult = '';
    ordens.forEach(os => {
      const dataStr = os.horaFim ? new Date(os.horaFim).toLocaleDateString('pt-BR') : (os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : '');
      const servicosStr = (os.servicos || []).map(s => s.descricao).join(', ') || 'Manutenção geral';
      
      htmlResult += `
        <div class="os-card" style="margin-bottom:var(--space-md); border-left:4px solid var(--accent); padding:var(--space-md); background:var(--bg-surface); border-radius:var(--radius-lg); border-top:1px solid var(--glass-border); border-right:1px solid var(--glass-border); border-bottom:1px solid var(--glass-border);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-xs);">
            <div>
              <div style="font-weight:800; font-size:var(--font-md); color:var(--text-primary);">${os.id} — ${Utils.escapeHtml(os.clienteNome)}</div>
              <div style="font-size:var(--font-xs); color:var(--text-secondary); margin-top:2px;">
                🛵 ${Utils.escapeHtml(os.modeloVeiculo || 'Veículo')} (${Utils.escapeHtml(os.corVeiculo || 'Cor')}) · 📅 ${dataStr}
              </div>
            </div>
            <span class="badge badge-success" style="font-size:10px; padding:3px 8px;">Concluído</span>
          </div>

          <div style="font-size:var(--font-xs); color:var(--text-tertiary); margin-bottom:var(--space-sm); border-top:1px dashed rgba(255,255,255,0.06); padding-top:6px;">
            🛠️ ${Utils.escapeHtml(servicosStr)}
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
            <button class="btn btn-primary btn-block btn-pdf-open" data-id="${os.id}" data-type="os" style="background:#2563eb; border-color:#2563eb; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:13px; border-radius:var(--radius-md); box-shadow:0 2px 6px rgba(37,99,235,0.3);">
              📋 Ordem de serviço
            </button>
            <button class="btn btn-primary btn-block btn-pdf-open" data-id="${os.id}" data-type="entrega" style="background:#22c55e; border-color:#22c55e; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; font-size:13px; border-radius:var(--radius-md); box-shadow:0 2px 6px rgba(34,197,94,0.3);">
              📄 Entrega
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = htmlResult;

    container.querySelectorAll('.btn-pdf-open').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModalEditorPDF(btn.dataset.id, btn.dataset.type);
      });
    });
  }

  function openModalEditorPDF(osId, targetType = 'os') {
    const os = Storage.getOrdemById(osId);
    if (!os) return;

    const opcoesModelo = Storage.getOpcaoByCampo('modelo');
    const itensModelo = opcoesModelo ? [...opcoesModelo.itens] : [];
    itensModelo.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));

    const opcoesCor = Storage.getOpcaoByCampo('cor');
    const itensCor = opcoesCor ? [...opcoesCor.itens] : [];
    itensCor.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));

    const usuarios = Storage.getUsuarios();
    const cargos = Storage.getCargos();

    let filteredUsers = [];
    if (targetType === 'retirada') {
      filteredUsers = usuarios.filter(u => {
        if (u.exibirNaDelegacao === false) return false;
        const cargo = cargos.find(c => c.id === u.role);
        const cargoNome = (cargo ? cargo.nome : (u.role || '')).toLowerCase();
        return u.role === 'role_motorista' || u.role === 'motorista' || cargoNome.includes('motorista');
      });
      if (filteredUsers.length === 0) {
        filteredUsers = usuarios.filter(u => u.exibirNaDelegacao !== false);
      }
    } else {
      filteredUsers = usuarios.filter(u => {
        if (u.exibirNaDelegacao === false) return false;
        const cargo = cargos.find(c => c.id === u.role);
        const cargoNome = (cargo ? cargo.nome : (u.role || '')).toLowerCase();
        return u.role === 'role_mecanico' || u.role === 'mecanico' || cargoNome.includes('mecanic') || cargoNome.includes('mecânic');
      });
      if (filteredUsers.length === 0) {
        filteredUsers = usuarios.filter(u => u.exibirNaDelegacao !== false);
      }
    }
    filteredUsers.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    const modelsHtml = itensModelo.map(m => `<option value="${m}" ${os.modeloVeiculo === m ? 'selected' : ''}>${m}</option>`).join('');
    const colorsHtml = itensCor.map(c => `<option value="${c}" ${os.corVeiculo === c ? 'selected' : ''}>${c}</option>`).join('');
    const techHtml = filteredUsers.map(t => `<option value="${t.nome}" ${os.mecanico === t.nome ? 'selected' : ''}>${t.nome}</option>`).join('');

    let modalTitle = `Editor — Ordem de Serviço (${os.id})`;
    let actionBtnText = '📑 Salvar & Baixar Ordem de Serviço (PDF)';
    let actionBtnColor = '#2563eb';

    if (targetType === 'retirada') {
      modalTitle = `Editor — Termo de Retirada (${os.id})`;
      actionBtnText = '📋 Salvar & Baixar Termo de Retirada (PDF)';
      actionBtnColor = '#f59e0b';
    } else if (targetType === 'entrega') {
      modalTitle = `Editor — Termo de Entrega (${os.id})`;
      actionBtnText = '📄 Salvar & Baixar Termo de Entrega (PDF)';
      actionBtnColor = '#22c55e';
    }

    const bodyHtml = `
      <form id="form-editor-pdf">
        <div class="section-divider" style="margin-top:0;">Dados do Cliente (PDF)</div>
        <div class="form-group">
          <label class="form-label required">Nome Completo</label>
          <input type="text" class="form-input" id="pdf-edit-nome" value="${Utils.escapeHtml(os.clienteNome || '')}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CPF</label>
            <input type="text" class="form-input" id="pdf-edit-cpf" value="${Utils.escapeHtml(os.clienteCpf || '')}" placeholder="000.000.000-00">
          </div>
          <div class="form-group">
            <label class="form-label required">Telefone</label>
            <input type="tel" class="form-input" id="pdf-edit-telefone" value="${Utils.escapeHtml(os.clienteTelefone || '')}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input type="text" class="form-input" id="pdf-edit-endereco" value="${Utils.escapeHtml(os.clienteEndereco || '')}">
        </div>

        <div class="section-divider">Dados do Veículo & Mecânico</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Modelo</label>
            <select class="form-select" id="pdf-edit-modelo">
              <option value="">Selecione...</option>
              ${modelsHtml}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cor</label>
            <select class="form-select" id="pdf-edit-cor">
              <option value="">Selecione...</option>
              ${colorsHtml}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${targetType === 'retirada' ? 'Motorista Responsável' : 'Técnico Responsável'}</label>
          <select class="form-select" id="pdf-edit-mecanico">
            <option value="">Selecione...</option>
            ${techHtml}
          </select>
        </div>

        <div class="section-divider">Configurações e Valores do Documento</div>
        <div class="form-group" style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" id="pdf-edit-garantia" ${os.temGarantia ? 'checked' : ''} style="width:18px; height:18px;">
          <label for="pdf-edit-garantia" style="font-weight:700; cursor:pointer;">Possui Garantia (Badge Verde)</label>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Taxa de Retirada (R$)</label>
            <input type="text" class="form-input" id="pdf-edit-taxa" value="${Utils.escapeHtml(os.valorRetirada || 'R$ 0,00')}">
          </div>
          <div class="form-group">
            <label class="form-label">Taxa de Entrega (R$)</label>
            <input type="text" class="form-input" id="pdf-edit-taxa-entrega" value="${Utils.escapeHtml(os.taxaEntrega || os.levar || 'R$ 0,00')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Itens Deixados pelo Cliente</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px;"><input type="checkbox" id="pdf-edit-chave" ${os.deixouChave ? 'checked' : ''}> Chaves</label>
              <input type="number" class="form-input mt-xs" id="pdf-edit-qtd-chave" value="${Utils.escapeHtml(os.qtdChave || '')}" placeholder="Qtd (ex: 2)" style="font-size:11px; padding:4px 8px;">
            </div>
            <div>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px;"><input type="checkbox" id="pdf-edit-controle" ${os.deixouControle ? 'checked' : ''}> Controles</label>
              <input type="number" class="form-input mt-xs" id="pdf-edit-qtd-controle" value="${Utils.escapeHtml(os.qtdControle || '')}" placeholder="Qtd (ex: 1)" style="font-size:11px; padding:4px 8px;">
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; grid-column:span 2;"><input type="checkbox" id="pdf-edit-carregador" ${os.deixouCarregador ? 'checked' : ''}> Carregador</label>
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; grid-column:span 2;"><input type="checkbox" id="pdf-edit-documento" ${os.deixouDocumento ? 'checked' : ''}> Documentos</label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${targetType === 'retirada' ? 'Relato do cliente' : 'Observações / Descrição da Manutenção'}</label>
          <textarea class="form-textarea" id="pdf-edit-obs" rows="3">${Utils.escapeHtml(os.observacoes || '')}</textarea>
        </div>

        <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--glass-border); padding-top:16px;">
          <button type="button" class="btn btn-primary btn-block" id="btn-pdf-save-download" style="background:${actionBtnColor}; border-color:${actionBtnColor}; color:#fff; font-weight:700; padding:12px; font-size:13px;">
            ${actionBtnText}
          </button>
          <button type="button" class="btn btn-secondary btn-block" id="btn-pdf-save-only" style="font-weight:700;">
            💾 Apenas Salvar Alterações
          </button>
        </div>
      </form>
    `;

    openModal(modalTitle, bodyHtml, null);

    const getFormUpdates = () => {
      const form = document.getElementById('form-editor-pdf');
      if (!form.checkValidity()) { form.reportValidity(); return null; }

      return {
        clienteNome: document.getElementById('pdf-edit-nome').value.trim(),
        clienteCpf: document.getElementById('pdf-edit-cpf').value.trim(),
        clienteTelefone: document.getElementById('pdf-edit-telefone').value.trim(),
        clienteEndereco: document.getElementById('pdf-edit-endereco').value.trim(),
        modeloVeiculo: document.getElementById('pdf-edit-modelo').value,
        corVeiculo: document.getElementById('pdf-edit-cor').value,
        mecanico: document.getElementById('pdf-edit-mecanico').value,
        temGarantia: document.getElementById('pdf-edit-garantia').checked,
        valorRetirada: document.getElementById('pdf-edit-taxa').value,
        taxaEntrega: document.getElementById('pdf-edit-taxa-entrega').value,
        deixouChave: document.getElementById('pdf-edit-chave').checked,
        qtdChave: document.getElementById('pdf-edit-qtd-chave').value,
        deixouControle: document.getElementById('pdf-edit-controle').checked,
        qtdControle: document.getElementById('pdf-edit-qtd-controle').value,
        deixouCarregador: document.getElementById('pdf-edit-carregador').checked,
        deixouDocumento: document.getElementById('pdf-edit-documento').checked,
        observacoes: document.getElementById('pdf-edit-obs').value
      };
    };

    const triggerDownload = () => {
      if (targetType === 'os') Utils.gerarPDFOrdemServico(osId);
      else if (targetType === 'retirada') Utils.gerarPDFRetiradaDoc(osId);
      else Utils.gerarPDFEntrega(osId);
    };

    const btnSaveOnly = document.getElementById('btn-pdf-save-only');
    if (btnSaveOnly) {
      btnSaveOnly.addEventListener('click', () => {
        const updates = getFormUpdates();
        if (!updates) return;
        Storage.updateOrdem(osId, updates);
        showToast('Dados salvos com sucesso!', 'success');
        renderListaPDFs();
        closeModal();
      });
    }

    const btnSaveDownload = document.getElementById('btn-pdf-save-download');
    if (btnSaveDownload) {
      btnSaveDownload.addEventListener('click', () => {
        const updates = getFormUpdates();
        if (!updates) return;
        Storage.updateOrdem(osId, updates);
        showToast('Dados salvos! Gerando PDF...', 'success');
        renderListaPDFs();
        closeModal();
        setTimeout(() => triggerDownload(), 300);
      });
    }
  }

  function openModalNovaOrdemRetirada(existingOS = null) {
    const opcoesModelo = Storage.getOpcaoByCampo('modelo');
    const itensModelo = opcoesModelo ? [...opcoesModelo.itens] : [];
    itensModelo.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));

    const opcoesCor = Storage.getOpcaoByCampo('cor');
    const itensCor = opcoesCor ? [...opcoesCor.itens] : [];
    itensCor.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));

    const usuarios = Storage.getUsuarios();
    const cargos = Storage.getCargos();
    let motoristas = usuarios.filter(u => {
      if (u.exibirNaDelegacao === false) return false;
      const cargo = cargos.find(c => c.id === u.role);
      const cargoNome = (cargo ? cargo.nome : (u.role || '')).toLowerCase();
      return u.role === 'role_motorista' || u.role === 'motorista' || cargoNome.includes('motorista');
    });
    if (motoristas.length === 0) {
      motoristas = usuarios.filter(u => u.exibirNaDelegacao !== false);
    }
    motoristas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    const modelsHtml = itensModelo.map(m => `<option value="${m}">${m}</option>`).join('');
    const colorsHtml = itensCor.map(c => `<option value="${c}">${c}</option>`).join('');
    const techHtml = motoristas.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');

    const bodyHtml = `
      <form id="form-nova-retirada">
        <div class="section-divider" style="margin-top:0;">Dados do Cliente</div>
        <div class="form-group">
          <label class="form-label required">Nome Completo</label>
          <input type="text" class="form-input" id="retirada-edit-nome" placeholder="Ex: João da Silva" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CPF</label>
            <input type="text" class="form-input" id="retirada-edit-cpf" placeholder="000.000.000-00">
          </div>
          <div class="form-group">
            <label class="form-label required">Telefone</label>
            <input type="tel" class="form-input" id="retirada-edit-telefone" placeholder="(00) 00000-0000" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input type="text" class="form-input" id="retirada-edit-endereco" placeholder="Rua, número, bairro, cidade">
        </div>

        <div class="section-divider">Dados do Veículo & Mecânico</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Modelo</label>
            <select class="form-select" id="retirada-edit-modelo">
              <option value="">Selecione...</option>
              ${modelsHtml}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cor</label>
            <select class="form-select" id="retirada-edit-cor">
              <option value="">Selecione...</option>
              ${colorsHtml}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Motorista Responsável</label>
          <select class="form-select" id="retirada-edit-mecanico">
            <option value="">Selecione...</option>
            ${techHtml}
          </select>
        </div>

        <div class="section-divider">Configurações e Valores do Documento</div>
        <div class="form-group" style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" id="retirada-edit-garantia" style="width:18px; height:18px;">
          <label for="retirada-edit-garantia" style="font-weight:700; cursor:pointer;">Possui Garantia (Badge Verde)</label>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Taxa de Retirada (R$)</label>
            <input type="text" class="form-input" id="retirada-edit-taxa" value="R$ 0,00">
          </div>
          <div class="form-group">
            <label class="form-label">Taxa de Entrega (R$)</label>
            <input type="text" class="form-input" id="retirada-edit-taxa-entrega" value="R$ 0,00">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Itens Deixados pelo Cliente</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px;"><input type="checkbox" id="retirada-edit-chave"> Chaves</label>
              <input type="number" class="form-input mt-xs" id="retirada-edit-qtd-chave" placeholder="Qtd (ex: 2)" style="font-size:11px; padding:4px 8px;">
            </div>
            <div>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px;"><input type="checkbox" id="retirada-edit-controle"> Controles</label>
              <input type="number" class="form-input mt-xs" id="retirada-edit-qtd-controle" placeholder="Qtd (ex: 1)" style="font-size:11px; padding:4px 8px;">
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; grid-column:span 2;"><input type="checkbox" id="retirada-edit-carregador"> Carregador</label>
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; grid-column:span 2;"><input type="checkbox" id="retirada-edit-documento"> Documentos</label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Relato do cliente</label>
          <textarea class="form-textarea" id="retirada-edit-obs" rows="3" placeholder="Descreva o relato do cliente sobre o veículo..."></textarea>
        </div>

        <div class="form-group" style="margin-top:16px; padding:12px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:10px; font-size:12px; color:var(--text-secondary); line-height:1.5;">
          <p style="margin-bottom:8px;">Declaro estar ciente e de acordo com a retirada do meu veículo pela Supra Bike para realização de inspeção técnica, diagnóstico e dos serviços de manutenção que se fizerem necessários.</p>
          <p style="margin-bottom:8px;">Autorizo a equipe técnica da Supra Bike a executar os procedimentos necessários para avaliação e manutenção do veículo, conforme as condições identificadas durante a análise.</p>
          <p style="font-weight:700; color:var(--text-primary); margin-bottom:0;">Ao prosseguir, confirmo que li, compreendi e aceito os termos acima.</p>
        </div>
      </form>
    `;

    openModal(existingOS ? `Editar ${existingOS.id}` : 'Nova Ordem de Retirada', bodyHtml, () => {
      const form = document.getElementById('form-nova-retirada');
      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const dados = {
        tipo: 'retirada',
        status: existingOS ? existingOS.status : 'retirada_pendente',
        clienteNome: document.getElementById('retirada-edit-nome').value.trim(),
        clienteCpf: document.getElementById('retirada-edit-cpf').value.trim(),
        clienteTelefone: document.getElementById('retirada-edit-telefone').value.trim(),
        clienteEndereco: document.getElementById('retirada-edit-endereco').value.trim(),
        modeloVeiculo: document.getElementById('retirada-edit-modelo').value,
        corVeiculo: document.getElementById('retirada-edit-cor').value,
        mecanico: document.getElementById('retirada-edit-mecanico').value,
        temGarantia: document.getElementById('retirada-edit-garantia').checked,
        valorRetirada: document.getElementById('retirada-edit-taxa').value,
        taxaEntrega: document.getElementById('retirada-edit-taxa-entrega').value,
        deixouChave: document.getElementById('retirada-edit-chave').checked,
        qtdChave: document.getElementById('retirada-edit-qtd-chave').value,
        deixouControle: document.getElementById('retirada-edit-controle').checked,
        qtdControle: document.getElementById('retirada-edit-qtd-controle').value,
        deixouCarregador: document.getElementById('retirada-edit-carregador').checked,
        deixouDocumento: document.getElementById('retirada-edit-documento').checked,
        observacoes: document.getElementById('retirada-edit-obs').value,
        atualizadoEm: new Date().toISOString()
      };

      if (existingOS) {
        Storage.updateOrdem(existingOS.id, dados);
        showToast(`Ordem ${existingOS.id} atualizada!`, 'success');
      } else {
        dados.servicos = [{ descricao: 'Ordem de Retirada', valor: 0 }];
        dados.valorTotal = 0;
        dados.formaPagamento = ['pendente'];
        dados.statusPagamento = 'pendente';
        dados.prioridade = 'normal';
        dados.atendente = currentUser ? currentUser.nome : 'Sistema';
        dados.criadoPor = currentUser ? currentUser.nome : 'Sistema';
        dados.criadoEm = new Date().toISOString();
        const saved = Storage.saveOrdem(dados);
        showToast(`Ordem de Retirada ${saved.id} registrada! Veja na aba Retirada em Serviços.`, 'success');
      }
      renderListaOS('aguardando');
      updateNavBadges();
      return true;
    });

    // Pre-fill fields if editing
    if (existingOS) {
      setTimeout(() => {
        const el = (id) => document.getElementById(id);
        if (el('retirada-edit-nome')) el('retirada-edit-nome').value = existingOS.clienteNome || '';
        if (el('retirada-edit-cpf')) el('retirada-edit-cpf').value = existingOS.clienteCpf || '';
        if (el('retirada-edit-telefone')) el('retirada-edit-telefone').value = existingOS.clienteTelefone || '';
        if (el('retirada-edit-endereco')) el('retirada-edit-endereco').value = existingOS.clienteEndereco || '';
        if (el('retirada-edit-modelo')) el('retirada-edit-modelo').value = existingOS.modeloVeiculo || '';
        if (el('retirada-edit-cor')) el('retirada-edit-cor').value = existingOS.corVeiculo || '';
        if (el('retirada-edit-mecanico')) el('retirada-edit-mecanico').value = existingOS.mecanico || '';
        if (el('retirada-edit-garantia')) el('retirada-edit-garantia').checked = !!existingOS.temGarantia;
        if (el('retirada-edit-taxa')) el('retirada-edit-taxa').value = existingOS.valorRetirada || 'R$ 0,00';
        if (el('retirada-edit-taxa-entrega')) el('retirada-edit-taxa-entrega').value = existingOS.taxaEntrega || 'R$ 0,00';
        if (el('retirada-edit-chave')) el('retirada-edit-chave').checked = !!existingOS.deixouChave;
        if (el('retirada-edit-qtd-chave')) el('retirada-edit-qtd-chave').value = existingOS.qtdChave || '';
        if (el('retirada-edit-controle')) el('retirada-edit-controle').checked = !!existingOS.deixouControle;
        if (el('retirada-edit-qtd-controle')) el('retirada-edit-qtd-controle').value = existingOS.qtdControle || '';
        if (el('retirada-edit-carregador')) el('retirada-edit-carregador').checked = !!existingOS.deixouCarregador;
        if (el('retirada-edit-documento')) el('retirada-edit-documento').checked = !!existingOS.deixouDocumento;
        if (el('retirada-edit-obs')) el('retirada-edit-obs').value = existingOS.observacoes || '';
      }, 50);
    }
  }

  function updateNavBadges() {
    const ordens = Storage.getOrdens();
    const normalAguardando = ordens.filter(o => o.status === 'aguardando' && o.tipo !== 'retirada' && o.status !== 'retirada_pendente').length;
    const retiradaAguardando = ordens.filter(o => (o.tipo === 'retirada' || o.status === 'retirada_pendente') && o.status !== 'convertida').length;
    const totalAguardando = normalAguardando + retiradaAguardando;

    const andamento = ordens.filter(o => o.status === 'em_andamento').length;
    const concluido = ordens.filter(o => o.status === 'concluido').length;

    setBadge('badge-servicos', totalAguardando);
    setBadge('badge-andamento', andamento);
    setBadge('badge-concluidos', concluido);

    // Update subtab badges inside Serviços page
    setSubtabBadge('subtab-retirada-badge', retiradaAguardando);
  }

  function setSubtabBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.style.display = 'inline-block';
    } else {
      el.style.display = 'none';
    }
  }

  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  function renderOSCard(os) {
    const isAdminMaster = currentUser && (currentUser.usuario === 'admin' || currentUser.role === 'role_admin' || currentUser.usuario === 'suprabikemarketing@gmail.com');
    const canAssumir = temPermissao('assumir_servico') && os.status === 'aguardando';
    const canConcluir = temPermissao('concluir_servico') && os.status === 'em_andamento';
    const canDelegar = temPermissao('delegar_servico') && os.status === 'aguardando';

    let fotosBadgeHtml = '';
    if (os.temFotos && Array.isArray(os.fotos) && os.fotos.length > 0) {
      fotosBadgeHtml = `<span class="badge" style="background:rgba(139,92,246,0.15); color:var(--accent); border:1px solid rgba(139,92,246,0.3); display:inline-flex; align-items:center; gap:4px; font-size:var(--font-xs); padding:2px 7px; border-radius:var(--radius-full); font-weight:700;">
        <img src="${os.fotos[0]}" style="width:14px; height:14px; border-radius:3px; object-fit:cover;">
        📷 ${os.fotos.length} foto${os.fotos.length > 1 ? 's' : ''}
      </span>`;
    }

    let actionsHtml = '';
    if (canAssumir) {
      actionsHtml += `<button class="btn btn-blue btn-xs os-card-action-btn btn-assumir" data-id="${os.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        Assumir
      </button>`;
    }
    if (canDelegar) {
      actionsHtml += `<button class="btn btn-blue btn-xs os-card-action-btn btn-delegar" data-id="${os.id}" style="background:var(--accent);border-color:var(--accent);color:#ffffff;margin-left:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>
        Delegar
      </button>`;
    }
    if (os.status === 'em_andamento') {
      actionsHtml += `<button class="btn btn-secondary btn-xs os-card-action-btn btn-pdf-os-card" data-id="${os.id}" title="Baixar Ordem de Serviço (PDF)" style="font-weight:700; margin-left:4px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        PDF
      </button>`;
    }
    if (canConcluir) {
      actionsHtml += `<button class="btn btn-success btn-xs os-card-action-btn btn-concluir" data-id="${os.id}" style="margin-left:4px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Concluir
      </button>`;
    }

    const valorMostrar = temPermissao('ver_valores_cliente') ? Utils.formatarMoeda(os.valorTotal) : 'Restrito 🔒';
    const pagamentoStr = temPermissao('ver_valores_cliente') ? Utils.traduzirPagamento(os.formaPagamento) : 'Restrito';

    let entregaHtml = '';
    if (os.temDataEntrega && os.dataEntrega) {
      const infoEntrega = Utils.formatarDataEntrega(os.dataEntrega, os.horaEntrega);
      if (infoEntrega) {
        entregaHtml = `<div class="os-card-entrega-row" style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.06); font-size:var(--font-xs); font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
          <span>DATA DE ENTREGA: ${infoEntrega.textoCompleto}</span>
        </div>`;
      }
    }

    let mecanicoHtml = '';
    if (os.mecanico) {
      const mec = Storage.getUsuarios().find(u => u.nome.trim().toLowerCase() === os.mecanico.trim().toLowerCase());
      const foto = mec ? mec.fotoPerfil : null;
      if (foto) {
        mecanicoHtml = `<span class="os-card-info-item" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          <img src="${foto}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1.5px solid var(--accent); box-shadow:0 0 6px rgba(139,92,246,0.3);">
          ${os.mecanico}
        </span>`;
      } else {
        mecanicoHtml = `<span class="os-card-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${os.mecanico}
        </span>`;
      }
    }

    return `
      <div class="os-card" data-id="${os.id}" data-status="${os.status}">
        <div class="os-card-header">
          <span class="os-card-code">${os.id}</span>
          <div class="os-card-badges">
            ${fotosBadgeHtml}
            ${os.prioridade === 'urgente' ? '<span class="badge badge-urgente">URGENTE</span>' : ''}
            <span class="badge badge-${os.statusPagamento}">${Utils.traduzirStatusPagamento(os.statusPagamento)}</span>
          </div>
        </div>
        <div class="os-card-cliente">${os.clienteNome}</div>
        <div class="os-card-info">
          <span class="os-card-info-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/></svg>
            ${os.modeloVeiculo || '—'}
          </span>
          <span class="os-card-info-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            ${Utils.formatarData(os.dataServico)}
          </span>
          ${mecanicoHtml}
        </div>
        ${entregaHtml}
        <div class="os-card-footer">
          <div>
            <span class="os-card-valor">${valorMostrar}</span>
            <span class="os-card-pagamento">${pagamentoStr}</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; text-align:right;">
            <span style="font-size:9px; color:var(--text-tertiary); font-weight:600; text-transform:uppercase; letter-spacing:0.3px;">Criado por: ${os.criadoPor || os.atendente || 'Sistema'}</span>
            <div class="os-card-actions">${actionsHtml}</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- AÇÕES DO SERVIÇO ----------

  function assumirServico(id) {
    const os = Storage.getOrdemById(id);
    if (!os || os.status !== 'aguardando') return;
    Storage.updateOrdem(id, { status: 'em_andamento', mecanico: currentUser.nome, horaInicio: new Date().toISOString() });
    Storage.addHistorico(id, 'Serviço Assumido', currentUser.nome);
    showToast('Serviço assumido!', 'success');
    renderListaOS('aguardando');
    renderListaOS('em_andamento');
    navigateTo('andamento');
  }

  function concluirServico(id) {
    const os = Storage.getOrdemById(id);
    if (!os || os.status !== 'em_andamento') return;
    const horaFim = new Date().toISOString();
    const tempoTotal = Utils.calcularTempoTotal(os.horaInicio, horaFim);
    Storage.updateOrdem(id, { status: 'concluido', horaFim, tempoTotal });
    Storage.addHistorico(id, `Serviço Concluído (${tempoTotal})`, currentUser.nome);
    showToast(`Serviço concluído! Tempo: ${tempoTotal}`, 'success');
    renderListaOS('em_andamento');
    renderListaOS('concluido');
    navigateTo('concluidos');
  }

  // ---------- NOVA OS ----------

  function confirmarRetiradaParaServico(retiradaId) {
    const osRetirada = Storage.getOrdemById(retiradaId);
    if (!osRetirada) return;
    navigateTo('nova-os');
    renderNovaOS(osRetirada, true);
  }

  let isVisitaTecnicaForm = false;

  function openNovaOS() {
    isVisitaTecnicaForm = false;
    editingOS = null;
    origemRetiradaId = null;
    navigateTo('nova-os');
  }

  function openModalNovaVisitaTecnica() {
    isVisitaTecnicaForm = true;
    editingOS = null;
    origemRetiradaId = null;
    navigateTo('nova-os');
    renderNovaOS(null, false, true);
  }

  function renderNovaOS(osData, isConversaoRetirada = false, isVisitaTecnica = false) {
    const form = document.getElementById('form-nova-os');
    const campos = Storage.getCamposAtivos();
    const opcoes = Storage.getOpcoes();

    if (isVisitaTecnica) isVisitaTecnicaForm = true;

    form.reset();
    document.getElementById('servico-items').innerHTML = '';
    if (isVisitaTecnicaForm) {
      document.getElementById('nova-os-title').textContent = 'Ordem de Serviço - Visita Técnica';
      document.getElementById('servico-items').innerHTML = `<div style="padding:10px; background:rgba(139,92,246,0.1); border:1px dashed #8b5cf6; border-radius:var(--radius-md); font-size:var(--font-xs); color:var(--text-primary); font-weight:700; text-align:center; margin-bottom:8px;">
        📋 Visita Técnica: A tabela de serviços fica em branco para preenchimento manual no documento impresso.
      </div>`;
    } else {
      addServicoItem();
    }

    const checkEntrega = document.getElementById('os-check-data-entrega');
    const containerEntrega = document.getElementById('container-data-entrega');
    const inputEntrega = document.getElementById('os-data-entrega');
    const inputHoraEntrega = document.getElementById('os-hora-entrega');
    const displayDiaSemana = document.getElementById('display-dia-semana-entrega');

    // Populate configurable selects
    populateOpcaoSelect('os-modelo', 'modelo', 'Selecione o modelo...');
    populateOpcaoSelect('os-cor', 'cor', 'Selecione a cor...');
    populateMotoristasSelect('os-motorista-entrega', osData ? (osData.motoristaEntrega || '') : '');

    // Reset payment checkboxes
    document.querySelectorAll('.payment-check').forEach(cb => cb.checked = false);

    // Reset partial payment fields
    const inputEntradaReset = document.getElementById('os-valor-entrada');
    if (inputEntradaReset) inputEntradaReset.value = '';
    document.getElementById('os-status-pagamento').value = 'pendente';
    atualizarCalculoPagamentoParcial();

    // Render custom fields
    renderCamposPersonalizados(campos);

    if (isConversaoRetirada && osData) {
      editingOS = null;
      origemRetiradaId = osData.id;
      document.getElementById('nova-os-title').textContent = `Nova OS (da Retirada ${osData.id})`;
      document.getElementById('os-cliente-nome').value = osData.clienteNome || '';
      document.getElementById('os-telefone').value = osData.clienteTelefone || '';
      const elCpf = document.getElementById('os-cpf');
      if (elCpf) elCpf.value = osData.clienteCpf || '';
      const elEndereco = document.getElementById('os-endereco');
      if (elEndereco) elEndereco.value = osData.clienteEndereco || '';
      document.getElementById('os-modelo').value = osData.modeloVeiculo || '';
      document.getElementById('os-cor').value = osData.corVeiculo || '';
      document.getElementById('os-observacoes').value = osData.observacoes || '';
      updateValorTotal();
    } else if (osData) {
      origemRetiradaId = null;
      editingOS = osData;
      document.getElementById('nova-os-title').textContent = `Editar ${osData.id}`;
      document.getElementById('os-cliente-nome').value = osData.clienteNome;
      document.getElementById('os-telefone').value = osData.clienteTelefone;
      const elCpf = document.getElementById('os-cpf');
      if (elCpf) elCpf.value = osData.clienteCpf || '';
      const elEndereco = document.getElementById('os-endereco');
      if (elEndereco) elEndereco.value = osData.clienteEndereco || '';
      document.getElementById('os-modelo').value = osData.modeloVeiculo || '';
      document.getElementById('os-cor').value = osData.corVeiculo || '';
      document.getElementById('os-status-pagamento').value = osData.statusPagamento || 'pendente';
      if (osData.statusPagamento === 'parcial' && inputEntradaReset) {
        inputEntradaReset.value = osData.valorEntrada || '';
      }
      atualizarCalculoPagamentoParcial();
      document.getElementById('os-prioridade').value = osData.prioridade;
      document.getElementById('os-observacoes').value = osData.observacoes || '';

      if (osData.temDataEntrega && osData.dataEntrega) {
        checkEntrega.checked = true;
        containerEntrega.style.display = 'block';
        inputEntrega.value = osData.dataEntrega;
        if (inputHoraEntrega) inputHoraEntrega.value = osData.horaEntrega || '';
        const info = Utils.formatarDataEntrega(osData.dataEntrega, osData.horaEntrega);
        if (info) {
          displayDiaSemana.textContent = `📅 ${info.textoCompleto}`;
          displayDiaSemana.style.display = 'block';
        }
      } else {
        checkEntrega.checked = false;
        containerEntrega.style.display = 'none';
        inputEntrega.value = new Date().toISOString().split('T')[0];
        if (inputHoraEntrega) inputHoraEntrega.value = '';
        displayDiaSemana.style.display = 'none';
      }

      const checkFotos = document.getElementById('os-check-fotos');
      const containerFotos = document.getElementById('container-fotos');

      if (osData.temFotos && Array.isArray(osData.fotos) && osData.fotos.length > 0) {
        if (checkFotos) checkFotos.checked = true;
        if (containerFotos) containerFotos.style.display = 'block';
        fotosAnexadas = [...osData.fotos];
      } else {
        if (checkFotos) checkFotos.checked = false;
        if (containerFotos) containerFotos.style.display = 'none';
        fotosAnexadas = [];
      }
      renderFotosGrid();

      // Restore payment checkboxes
      const formas = Array.isArray(osData.formaPagamento) ? osData.formaPagamento : [osData.formaPagamento];
      formas.forEach(f => {
        const cb = document.querySelector(`.payment-check[value="${f}"]`);
        if (cb) cb.checked = true;
      });

      // Restore services
      document.getElementById('servico-items').innerHTML = '';
      osData.servicos.forEach(s => addServicoItem(s.descricao, s.valor));

      // Restore custom fields
      if (osData.camposPersonalizados) {
        Object.entries(osData.camposPersonalizados).forEach(([campoId, data]) => {
          const el = document.getElementById(`campo-${campoId}`);
          if (el) {
            if (el.type === 'checkbox') {
              el.checked = data.valor;
              const qtyWrapper = document.getElementById(`campo-qty-${campoId}`);
              if (qtyWrapper) qtyWrapper.classList.toggle('hidden', !data.valor);
              const qtyInput = document.getElementById(`campo-qty-input-${campoId}`);
              if (qtyInput && data.quantidade !== undefined) qtyInput.value = data.quantidade;
            } else {
              el.value = data.valor || '';
            }
          }
        });
      }
      updateValorTotal();
    } else {
      document.getElementById('nova-os-title').textContent = 'Nova Ordem de Serviço';
    }

    form.onsubmit = handleSalvarOS;
    document.getElementById('btn-add-servico').onclick = () => addServicoItem();
  }

  function populateOpcaoSelect(selectId, campo, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const opcao = Storage.getOpcaoByCampo(campo);
    const itens = opcao ? [...opcao.itens] : [];
    itens.sort((a, b) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' }));

    if (select.tagName === 'SELECT') {
      select.innerHTML = `<option value="">${placeholder}</option>` +
        itens.map(item => `<option value="${item}">${item}</option>`).join('');
    }
  }

  function populateMotoristasSelect(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const usuarios = Storage.getUsuarios().filter(u => u.exibirNaDelegacao !== false);
    const motoristas = usuarios.filter(u => {
      const roleLower = (u.role || '').toLowerCase();
      const cargoObj = Storage.getCargoById(u.role);
      const cargoNomeLower = cargoObj ? cargoObj.nome.toLowerCase() : '';
      return roleLower.includes('motorista') || cargoNomeLower.includes('motorista');
    });

    select.innerHTML = '<option value="">Selecione o motorista (opcional)...</option>' +
      motoristas.map(u => `<option value="${u.nome}" ${u.nome === selectedValue ? 'selected' : ''}>${u.nome}</option>`).join('');
  }

  function renderCamposPersonalizados(campos) {
    const container = document.getElementById('campos-personalizados');
    if (!campos.length) {
      container.innerHTML = '';
      return;
    }

    // Group by section and prioritize Acessórios and Garantia
    const sections = {};
    campos.forEach(campo => {
      const sec = campo.secao || 'Outros';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(campo);
    });

    const priorityOrder = ['Acessórios', 'Garantia'];
    const sortedSecKeys = Object.keys(sections).sort((a, b) => {
      const idxA = priorityOrder.indexOf(a);
      const idxB = priorityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'pt-BR');
    });

    let html = '';
    sortedSecKeys.forEach(secName => {
      const secCampos = sections[secName];
      html += `
        <div class="collapsible-section">
          <div class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <span>${secName}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="collapse-icon"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="collapsible-body">
            ${secCampos.map(campo => renderCampoInput(campo)).join('')}
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  function renderCampoInput(campo) {
    if (campo.tipo === 'sim_nao') {
      return `
        <div class="form-toggle" onclick="this.querySelector('input').click()">
          <span class="form-toggle-label">${campo.nome}</span>
          <label class="toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" id="campo-${campo.id}" data-campo-id="${campo.id}" data-campo-tipo="${campo.tipo}">
            <span class="toggle-slider"></span>
          </label>
        </div>`;
    } else if (campo.tipo === 'sim_nao_quantidade') {
      return `
        <div class="toggle-quantity-wrapper">
          <div class="toggle-quantity-row" onclick="this.querySelector('input[type=checkbox]').click()">
            <span class="form-toggle-label">${campo.nome}</span>
            <label class="toggle-switch" onclick="event.stopPropagation()">
              <input type="checkbox" id="campo-${campo.id}" data-campo-id="${campo.id}" data-campo-tipo="${campo.tipo}"
                onchange="document.getElementById('campo-qty-${campo.id}').classList.toggle('hidden', !this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-quantity-input hidden" id="campo-qty-${campo.id}">
            <label>Quantidade:</label>
            <input type="number" class="form-input" id="campo-qty-input-${campo.id}" min="0" value="1" style="width:80px;min-height:38px;padding:8px;">
          </div>
        </div>`;
    } else {
      return `
        <div class="form-group">
          <label class="form-label">${campo.nome}</label>
          <input type="text" class="form-input" id="campo-${campo.id}" data-campo-id="${campo.id}" data-campo-tipo="texto" placeholder="Digite aqui...">
        </div>`;
    }
  }

  function addServicoItem(desc = '', valor = '') {
    const container = document.getElementById('servico-items');
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.innerHTML = `
      <input type="text" class="form-input servico-desc" placeholder="Descrição do serviço" value="${desc}" required>
      <input type="number" class="form-input servico-valor" placeholder="R$ 0,00" value="${valor}" step="0.01" min="0" required oninput="App.updateValorTotal()">
      <button type="button" class="btn-remove-servico" onclick="this.parentElement.remove(); App.updateValorTotal();">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>`;
    container.appendChild(div);
    updateValorTotal();
  }

  function updateValorTotal() {
    const items = document.querySelectorAll('.servico-valor');
    let total = 0;
    items.forEach(input => { total += parseFloat(input.value) || 0; });
    document.getElementById('valor-total').textContent = Utils.formatarMoeda(total);
    atualizarCalculoPagamentoParcial();
  }

  function handleSalvarOS(e) {
    e.preventDefault();

    // Collect services
    const servicos = [];
    document.querySelectorAll('.servico-item').forEach(item => {
      const desc = item.querySelector('.servico-desc').value.trim();
      const valor = parseFloat(item.querySelector('.servico-valor').value) || 0;
      if (desc) servicos.push({ descricao: desc, valor });
    });

    if (servicos.length === 0 && !isVisitaTecnicaForm) {
      showToast('Adicione pelo menos um serviço', 'error');
      return;
    }

    // Collect payment methods
    const formasPagamento = [];
    document.querySelectorAll('.payment-check:checked').forEach(cb => {
      formasPagamento.push(cb.value);
    });
    if (formasPagamento.length === 0) {
      showToast('Selecione pelo menos uma forma de pagamento', 'error');
      return;
    }

    const valorTotal = servicos.reduce((sum, s) => sum + s.valor, 0);

    // Partial payment logic
    const statusPagamento = document.getElementById('os-status-pagamento').value;
    let valorEntrada = 0;
    let valorRestante = 0;
    if (statusPagamento === 'parcial') {
      valorEntrada = parseFloat(document.getElementById('os-valor-entrada').value) || 0;
      valorRestante = Math.max(0, valorTotal - valorEntrada);
    } else if (statusPagamento === 'pago') {
      valorEntrada = valorTotal;
      valorRestante = 0;
    } else {
      valorEntrada = 0;
      valorRestante = valorTotal;
    }

    // Collect custom fields
    const camposPersonalizados = {};
    document.querySelectorAll('[data-campo-id]').forEach(el => {
      const campoId = el.dataset.campoId;
      const tipo = el.dataset.campoTipo;
      if (tipo === 'sim_nao') {
        camposPersonalizados[campoId] = { valor: el.checked };
      } else if (tipo === 'sim_nao_quantidade') {
        const qtyInput = document.getElementById(`campo-qty-input-${campoId}`);
        camposPersonalizados[campoId] = { valor: el.checked, quantidade: el.checked ? (parseInt(qtyInput?.value) || 0) : 0 };
      } else if (tipo === 'texto') {
        camposPersonalizados[campoId] = { valor: el.value.trim() };
      }
    });

    const temDataEntrega = document.getElementById('os-check-data-entrega').checked;
    const dataEntrega = temDataEntrega ? document.getElementById('os-data-entrega').value : null;
    const horaEntrega = temDataEntrega ? document.getElementById('os-hora-entrega').value : null;
    const elMotoristaEntrega = document.getElementById('os-motorista-entrega');
    const motoristaEntrega = (temDataEntrega && elMotoristaEntrega) ? elMotoristaEntrega.value : null;

    const checkFotos = document.getElementById('os-check-fotos');
    const temFotos = checkFotos ? checkFotos.checked : false;
    const fotos = temFotos ? [...fotosAnexadas] : [];

    const elEndereco = document.getElementById('os-endereco');
    const elCpf = document.getElementById('os-cpf');
    const osData = {
      tipo: isVisitaTecnicaForm ? 'visita_tecnica' : (editingOS ? (editingOS.tipo || 'os') : 'os'),
      clienteNome: document.getElementById('os-cliente-nome').value.trim(),
      clienteTelefone: document.getElementById('os-telefone').value.trim(),
      clienteCpf: elCpf ? elCpf.value.trim() : '',
      clienteEndereco: elEndereco ? elEndereco.value.trim() : '',
      modeloVeiculo: document.getElementById('os-modelo').value,
      corVeiculo: document.getElementById('os-cor').value,
      servicos,
      valorTotal,
      valorEntrada,
      valorRestante,
      formaPagamento: formasPagamento,
      statusPagamento,
      dataServico: editingOS ? editingOS.dataServico : new Date().toISOString().split('T')[0],
      temDataEntrega,
      dataEntrega,
      horaEntrega,
      motoristaEntrega,
      temFotos,
      fotos,
      prioridade: document.getElementById('os-prioridade').value,
      status: editingOS ? editingOS.status : 'aguardando',
      atendente: editingOS ? editingOS.atendente : currentUser.nome,
      mecanico: editingOS ? editingOS.mecanico : null,
      observacoes: document.getElementById('os-observacoes').value.trim(),
      camposPersonalizados,
      horaInicio: editingOS ? editingOS.horaInicio : null,
      horaFim: editingOS ? editingOS.horaFim : null,
      tempoTotal: editingOS ? editingOS.tempoTotal : null,
      criadoPor: editingOS ? editingOS.criadoPor : currentUser.nome,
      criadoEm: editingOS ? editingOS.criadoEm : new Date().toISOString(),
      editadoPor: editingOS ? currentUser.nome : null,
      editadoEm: editingOS ? new Date().toISOString() : null
    };

    if (editingOS) {
      Storage.updateOrdem(editingOS.id, osData);
      Storage.addHistorico(editingOS.id, 'OS editada', currentUser.nome);
      showToast(`OS ${editingOS.id} atualizada!`, 'success');
    } else {
      const saved = Storage.saveOrdem(osData);
      showToast(`OS ${saved.id} criada com sucesso!`, 'success');

      if (origemRetiradaId) {
        Storage.updateOrdem(origemRetiradaId, { status: 'convertida', atualizadoEm: new Date().toISOString() });
        showToast(`Retirada ${origemRetiradaId} convertida em Ordem de Serviço!`, 'info');
        origemRetiradaId = null;
      }
    }

    editingOS = null;
    currentServicosSubtab = 'servicos';
    navigateTo('servicos');
  }

  // ---------- OS DETAIL ----------

  function openOSDetail(id) {
    currentOSId = id;
    const os = Storage.getOrdemById(id);
    if (!os) return;

    currentPage = 'os-detail';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-os-detail').classList.add('active');
    updateHeaderTitle('os-detail');

    // Hide admin btn, show back
    document.getElementById('btn-admin').style.display = 'none';
    document.getElementById('btn-back').style.display = 'flex';
    document.getElementById('btn-back').onclick = () => {
      document.getElementById('btn-back').style.display = 'none';
      // Go back to the list that matches this OS status
      const pageMap = { 'aguardando': 'servicos', 'em_andamento': 'andamento', 'concluido': 'concluidos' };
      navigateTo(pageMap[os.status] || 'servicos');
    };

    renderOSDetail(os);
  }

  function renderOSDetail(os) {
    const container = document.getElementById('os-detail-content');
    const campos = Storage.getCampos();

    // Custom fields display
    let camposHtml = '';
    if (os.camposPersonalizados && Object.keys(os.camposPersonalizados).length > 0) {
      const entries = Object.entries(os.camposPersonalizados).map(([campoId, data]) => {
        const campo = campos.find(c => c.id === campoId);
        if (!campo) return '';
        let displayValue = '';
        if (campo.tipo === 'sim_nao') displayValue = data.valor ? 'Sim ✅' : 'Não ❌';
        else if (campo.tipo === 'sim_nao_quantidade') displayValue = data.valor ? `Sim ✅ (${data.quantidade || 0})` : 'Não ❌';
        else displayValue = data.valor || '—';
        return `<div class="os-detail-row"><span class="os-detail-label">${campo.nome}</span><span class="os-detail-value">${displayValue}</span></div>`;
      }).join('');

      if (entries) {
        camposHtml = `<div class="os-detail-section"><div class="os-detail-section-title">Campos Personalizados</div>${entries}</div>`;
      }
    }

    // Actions
    let actionsHtml = '';
    const isAdminMaster = currentUser && (currentUser.usuario === 'admin' || currentUser.role === 'role_admin' || currentUser.usuario === 'suprabikemarketing@gmail.com');
    const canAssumir = temPermissao('assumir_servico') && os.status === 'aguardando';
    const canConcluir = temPermissao('concluir_servico') && os.status === 'em_andamento';
    const canEditar = temPermissao('editar_os') && (os.status === 'aguardando' || isAdminMaster);
    const canExcluir = temPermissao('excluir_os') || isAdminMaster;
    const canWhatsApp = true; // Sempre ativo em todas as OS
    const canDelegar = temPermissao('delegar_servico') && os.status === 'aguardando';

    if (canAssumir) {
      actionsHtml += `<button class="btn btn-blue btn-block" id="btn-detail-assumir">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        Assumir Serviço</button>`;
    }
    if (canDelegar) {
      actionsHtml += `<button class="btn btn-blue btn-block" id="btn-detail-delegar" style="background:var(--accent);border-color:var(--accent)">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>
        Delegar Serviço</button>`;
    }
    if (canEditar) {
      actionsHtml += `<button class="btn btn-secondary btn-block" id="btn-detail-editar">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        Editar OS</button>`;
    }
    if (canConcluir) {
      actionsHtml += `<button class="btn btn-success btn-block" id="btn-detail-concluir">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Concluir Serviço</button>`;
    }
    if (os.status === 'em_andamento' || os.status === 'aguardando') {
      actionsHtml += `
        <button class="btn btn-primary btn-block" id="btn-detail-pdf-os-andamento" style="background:#2563eb; border-color:#2563eb; color:white; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
          📑 Baixar Ordem de Serviço (PDF)
        </button>`;
    }
    if (canWhatsApp) {
      actionsHtml += `<button class="btn btn-whatsapp btn-block" id="btn-detail-whatsapp" style="background:#25D366; border-color:#25D366; color:#fff; font-weight:700;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6-4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Enviar WhatsApp ao Cliente</button>`;
    }
    if (os.status === 'concluido') {
      actionsHtml += `
        <div style="margin-top:var(--space-sm); display:flex; flex-direction:column; gap:6px;">
          <button class="btn btn-primary btn-block" id="btn-detail-pdf-entrega" style="background:#22c55e; border-color:#22c55e; color:white; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
            📄 Baixar Termo de Entrega (PDF)
          </button>
          <button class="btn btn-primary btn-block" id="btn-detail-pdf-retirada" style="background:#f59e0b; border-color:#f59e0b; color:white; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
            📋 Baixar Termo de Retirada (PDF)
          </button>
          <button class="btn btn-primary btn-block" id="btn-detail-pdf-os" style="background:#2563eb; border-color:#2563eb; color:white; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
            📑 Baixar Ordem de Serviço (PDF)
          </button>
        </div>`;
    }
    if (canExcluir) {
      actionsHtml += `<button class="btn btn-danger btn-block btn-sm mt-md" id="btn-detail-excluir">Excluir OS</button>`;
    }

    const telMostrar = temPermissao('ver_valores_cliente') ? Utils.formatarTelefone(os.clienteTelefone) : '🔒 Restrito';
    const pagamentoStr = temPermissao('ver_valores_cliente') ? Utils.traduzirPagamento(os.formaPagamento) : '🔒 Restrito';
    const statusPgtoStr = temPermissao('ver_valores_cliente') ? `<span class="badge badge-${os.statusPagamento}">${Utils.traduzirStatusPagamento(os.statusPagamento)}</span>` : '🔒 Restrito';

    const ticketEditableClass = temPermissao('editar_os') ? 'os-ticket-editavel' : '';

    container.innerHTML = `
      <div class="os-detail-header">
        <div class="os-detail-code" data-status="${os.status}">${os.id}</div>
        <span class="badge badge-status" data-status="${os.status}">${Utils.traduzirStatus(os.status)}</span>
      </div>

      <!-- Notinha de Serviço Unificada -->
      <div class="os-ticket ${ticketEditableClass}" id="os-ticket-click">
        <div class="os-ticket-header">
          <div class="os-ticket-title">Notinha de Serviço</div>
          <div class="os-ticket-code-small">${os.id}</div>
        </div>
        
        <div class="os-ticket-section">
          <div class="os-ticket-row"><strong>Cliente:</strong> <span>${os.clienteNome}</span></div>
          <div class="os-ticket-row">
            <strong>Telefone:</strong> 
            <span style="display:inline-flex; align-items:center; gap:6px;">
              ${telMostrar}
              ${os.clienteTelefone ? `<button type="button" class="btn btn-whatsapp btn-xs" id="btn-ticket-wa-icon" style="padding:2px 8px; font-size:10px; font-weight:700; background:#25D366; border-color:#25D366; color:#fff; border-radius:12px; cursor:pointer;" title="Enviar WhatsApp ao Cliente">💬 WhatsApp</button>` : ''}
            </span>
          </div>
          <div class="os-ticket-row"><strong>Veículo:</strong> <span>${os.modeloVeiculo || '—'} (${os.corVeiculo || '—'})</span></div>
          ${os.temDataEntrega && os.dataEntrega ? `<div class="os-ticket-row" style="color:#38bdf8; font-weight:700;"><strong>Data de Entrega:</strong> <span>${Utils.formatarDataEntrega(os.dataEntrega, os.horaEntrega)?.textoCompleto || os.dataEntrega}</span></div>` : ''}
          ${os.motoristaEntrega ? `<div class="os-ticket-row" style="color:#a78bfa; font-weight:700;"><strong>Resp. pela Entrega:</strong> <span>🚚 ${os.motoristaEntrega}</span></div>` : ''}
        </div>
        
        <div class="os-ticket-divider"></div>
        
        <div class="os-ticket-section">
          <div class="os-ticket-subtitle">Serviços a Executar</div>
          <div class="os-ticket-servicos">
            ${os.servicos.map(s => `
              <div class="os-ticket-servico-item">
                <div class="os-ticket-servico-desc">${s.descricao}</div>
                <div class="os-ticket-servico-valor">${temPermissao('ver_valores_cliente') ? Utils.formatarMoeda(s.valor) : '🔒 Restrito'}</div>
              </div>
            `).join('')}
          </div>
          ${os.observacoes ? `
            <div class="os-ticket-observacoes" style="margin-top:12px; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:var(--radius-sm); border-left:3px solid var(--accent); font-size:var(--font-xs); color:var(--text-secondary); text-align:left; line-height:1.4;">
              <strong style="color:var(--text-primary); display:block; margin-bottom:2px; font-weight:700;">Observações:</strong>
              ${os.observacoes}
            </div>
          ` : ''}
          ${os.temFotos && Array.isArray(os.fotos) && os.fotos.length > 0 ? `
            <div class="os-ticket-fotos-section" style="margin-top:14px; text-align:left;">
              <strong style="color:var(--text-tertiary); font-size:var(--font-xs); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">📷 Fotos do Veículo (${os.fotos.length})</strong>
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
                ${os.fotos.map((src) => `
                  <img src="${src}" onclick="window.open('${src}', '_blank')" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:var(--radius-sm); border:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:transform 0.2s;" title="Clique para expandir">
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="os-ticket-divider"></div>
        
        <div class="os-ticket-footer-row">
          <div class="os-ticket-total">
            <span>Valor Total</span>
            <strong>${temPermissao('ver_valores_cliente') ? Utils.formatarMoeda(os.valorTotal) : '🔒 Restrito'}</strong>
          </div>
        </div>
        ${temPermissao('editar_os') ? `<div class="os-ticket-edit-badge">✏️ Toque em qualquer parte do cupom para editar</div>` : ''}
      </div>

      <div class="os-detail-section">
        <div class="os-detail-section-title">Informações Adicionais</div>
        <div class="os-detail-row"><span class="os-detail-label">Pagamento</span><span class="os-detail-value">${pagamentoStr}</span></div>
        <div class="os-detail-row"><span class="os-detail-label">Status Pgto</span><span class="os-detail-value">${statusPgtoStr}</span></div>
        <div class="os-detail-row"><span class="os-detail-label">Prioridade</span><span class="os-detail-value">${os.prioridade === 'urgente' ? '<span class="badge badge-urgente">Urgente</span>' : '<span class="badge badge-normal">Normal</span>'}</span></div>
        <div class="os-detail-row"><span class="os-detail-label">Data Agendada</span><span class="os-detail-value">${Utils.formatarData(os.dataServico)}</span></div>
        <div class="os-detail-row"><span class="os-detail-label">Criado por</span><span class="os-detail-value">${os.criadoPor || os.atendente || 'Sistema'}</span></div>
        ${os.editadoPor ? `<div class="os-detail-row"><span class="os-detail-label">Editado por</span><span class="os-detail-value">${os.editadoPor}</span></div>` : ''}
        ${os.mecanico ? `<div class="os-detail-row"><span class="os-detail-label">Mecânico</span><span class="os-detail-value">${os.mecanico}</span></div>` : ''}
        ${os.horaInicio ? `<div class="os-detail-row"><span class="os-detail-label">Início</span><span class="os-detail-value">${Utils.formatarDataHora(os.horaInicio)}</span></div>` : ''}
        ${os.horaFim ? `<div class="os-detail-row"><span class="os-detail-label">Fim</span><span class="os-detail-value">${Utils.formatarDataHora(os.horaFim)}</span></div>` : ''}
        ${os.tempoTotal ? `<div class="os-detail-row"><span class="os-detail-label">Tempo Total</span><span class="os-detail-value" style="color:var(--accent);font-weight:700">${os.tempoTotal}</span></div>` : ''}
      </div>

      ${os.observacoes ? `<div class="os-detail-section"><div class="os-detail-section-title">Observações</div><p style="font-size:var(--font-sm);color:var(--text-secondary);line-height:1.6">${os.observacoes}</p></div>` : ''}

      ${camposHtml}

      <div class="os-detail-section">
        <div class="os-detail-section-title">Histórico da OS</div>
        <div class="timeline">
          ${[...(os.historico || [])]
            .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
            .map(h => `
            <div class="timeline-item">
              <div class="timeline-item-time">${Utils.formatarDataHora(h.timestamp)}</div>
              <div class="timeline-item-text">${Utils.escapeHtml(h.acao)}</div>
              <div class="timeline-item-user">por ${Utils.escapeHtml(h.usuario || 'Sistema')}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="os-detail-actions">${actionsHtml}</div>
    `;

    // Bind actions
    const ticketClick = document.getElementById('os-ticket-click');
    if (ticketClick && temPermissao('editar_os')) {
      ticketClick.addEventListener('click', () => {
        document.getElementById('btn-back').style.display = 'none';
        editingOS = os;
        navigateTo('nova-os');
        renderNovaOS(os);
      });
    }

    const btnAssumir = document.getElementById('btn-detail-assumir');
    if (btnAssumir) btnAssumir.addEventListener('click', () => { assumirServico(os.id); openOSDetail(os.id); });

    const btnDelegar = document.getElementById('btn-detail-delegar');
    if (btnDelegar) btnDelegar.addEventListener('click', () => { openModalDelegarServico(os.id); });

    const btnConcluir = document.getElementById('btn-detail-concluir');
    if (btnConcluir) btnConcluir.addEventListener('click', () => { concluirServico(os.id); openOSDetail(os.id); });

    const btnEditar = document.getElementById('btn-detail-editar');
    if (btnEditar) btnEditar.addEventListener('click', () => {
      document.getElementById('btn-back').style.display = 'none';
      editingOS = os;
      navigateTo('nova-os');
      renderNovaOS(os);
    });

    const btnWhatsApp = document.getElementById('btn-detail-whatsapp');
    if (btnWhatsApp) btnWhatsApp.addEventListener('click', () => {
      openModalEnviarWhatsApp(os);
    });

    const btnTicketWa = document.getElementById('btn-ticket-wa-icon');
    if (btnTicketWa) btnTicketWa.addEventListener('click', (e) => {
      e.stopPropagation();
      openModalEnviarWhatsApp(os);
    });

    const btnPdfEntrega = document.getElementById('btn-detail-pdf-entrega');
    if (btnPdfEntrega) btnPdfEntrega.addEventListener('click', () => {
      Utils.gerarPDFEntrega(os);
    });

    const btnPdfRetirada = document.getElementById('btn-detail-pdf-retirada');
    if (btnPdfRetirada) btnPdfRetirada.addEventListener('click', () => {
      Utils.gerarPDFRetiradaDoc(os);
    });

    const btnPdfOS = document.getElementById('btn-detail-pdf-os');
    if (btnPdfOS) btnPdfOS.addEventListener('click', () => {
      Utils.gerarPDFOrdemServico(os);
    });

    const btnPdfAndamento = document.getElementById('btn-detail-pdf-os-andamento');
    if (btnPdfAndamento) btnPdfAndamento.addEventListener('click', () => {
      Utils.gerarPDFOrdemServico(os);
    });

    const btnExcluir = document.getElementById('btn-detail-excluir');
    if (btnExcluir) btnExcluir.addEventListener('click', () => {
      if (confirm(`Tem certeza que deseja apagar a Ordem de Serviço ${os.id}?\n\nEla será movida para a lixeira (Apagados) na página Início.`)) {
        const targetPage = {
          'aguardando': 'servicos',
          'em_andamento': 'andamento',
          'concluido': 'concluidos'
        }[os.status] || 'servicos';

        Storage.deleteOrdem(os.id, currentUser ? currentUser.nome : 'Sistema');
        showToast(`OS ${os.id} movida para a lixeira (Apagados)`, 'info');
        closeModal();
        document.getElementById('btn-back').style.display = 'none';
        navigateTo(targetPage);
        updateDashboard();
      }
    });
  }

  // ---------- ADMIN ----------

  // --- Tema Claro / Escuro ---
  function setTema(tema) {
    Storage.saveTema(tema);
    applyTheme(tema);
  }

  function toggleTemaSwitch() {
    const toggleCheckbox = document.getElementById('theme-checkbox-toggle');
    if (toggleCheckbox) {
      toggleCheckbox.click();
    }
  }

  function applyTheme(tema) {
    const activeTheme = tema || Storage.getTema();
    document.documentElement.setAttribute('data-theme', activeTheme);

    const toggleCheckbox = document.getElementById('theme-checkbox-toggle');
    const toggleLabel = document.getElementById('theme-switch-label');
    if (toggleCheckbox) {
      toggleCheckbox.checked = (activeTheme === 'dark');
    }
    if (toggleLabel) {
      toggleLabel.innerHTML = activeTheme === 'light' ? 'Tema Claro ☀️' : 'Tema Escuro 🌙';
    }
  }

  // --- Pull to Refresh Gesture ---
  function initPullToRefresh() {
    const contentArea = document.querySelector('.content-area');
    const indicator = document.getElementById('ptr-indicator');
    const spinner = indicator ? indicator.querySelector('.ptr-spinner circle') : null;
    const spinnerSvg = indicator ? indicator.querySelector('.ptr-spinner') : null;
    
    if (!contentArea || !indicator) return;

    let startY = 0;
    let startX = 0;
    let currentY = 0;
    let isTracking = false;
    const threshold = 90; // drag distance in px to trigger refresh

    function isAtScrollTop() {
      const scrollTop = contentArea.scrollTop;
      const windowScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      return scrollTop <= 0 && windowScrollTop <= 0;
    }

    contentArea.addEventListener('touchstart', (e) => {
      // Do not trigger if a modal or bottom-sheet is open/active
      const hasActiveModal = document.querySelector('.modal.active, .modal.show, .bottom-sheet.active, .bottom-sheet.show');
      if (hasActiveModal) {
        isTracking = false;
        return;
      }

      // Only track touch if we are at the absolute top of the content area and page scroll
      if (isAtScrollTop()) {
        startY = e.touches[0].pageY;
        startX = e.touches[0].pageX;
        currentY = startY;
        isTracking = true;
        
        // Reset spinner state
        if (spinnerSvg) {
          spinnerSvg.style.animation = 'none';
          spinnerSvg.style.transform = 'none';
        }
      } else {
        isTracking = false;
      }
    }, { passive: true });

    contentArea.addEventListener('touchmove', (e) => {
      if (!isTracking) return;

      // If at any point during tracking, we scroll away from the top, cancel tracking
      if (!isAtScrollTop()) {
        isTracking = false;
        indicator.style.transform = `translateX(-50%) translateY(0px) scale(0)`;
        indicator.style.opacity = '0';
        indicator.classList.remove('active');
        return;
      }

      currentY = e.touches[0].pageY;
      const currentX = e.touches[0].pageX;
      const dy = currentY - startY;
      const dx = currentX - startX;

      // Cancel tracking if horizontal swipe is dominant (e.g. swiping a card or changing tabs)
      if (Math.abs(dx) > Math.abs(dy)) {
        isTracking = false;
        indicator.style.transform = `translateX(-50%) translateY(0px) scale(0)`;
        indicator.style.opacity = '0';
        indicator.classList.remove('active');
        return;
      }

      // If dragging UP (scrolling down the content), cancel tracking
      if (dy < 0) {
        isTracking = false;
        indicator.style.transform = `translateX(-50%) translateY(0px) scale(0)`;
        indicator.style.opacity = '0';
        indicator.classList.remove('active');
        return;
      }

      if (dy > 0) {
        // Dragging down at the top!
        // Prevent default scrolling to handle refresh drag
        if (e.cancelable) e.preventDefault();

        // Calculate transition properties
        const dragDist = Math.min(130, dy); // cap drag visual
        const percent = Math.min(1, dragDist / threshold);
        
        // Move container down
        indicator.style.transform = `translateX(-50%) translateY(${dragDist / 2.5}px) scale(${percent})`;
        indicator.style.opacity = percent;
        indicator.classList.add('active');

        // Draw circle stroke
        if (spinner) {
          const dashoffset = 60 - (percent * 60);
          spinner.style.strokeDashoffset = dashoffset;
        }
      }
    }, { passive: false });

    contentArea.addEventListener('touchend', async () => {
      if (!isTracking) return;
      isTracking = false;

      const dy = currentY - startY;
      if (dy >= threshold && isAtScrollTop()) {
        // Trigger refresh!
        indicator.style.transform = `translateX(-50%) translateY(40px) scale(1)`;
        indicator.style.opacity = '1';
        
        if (spinnerSvg) {
          spinnerSvg.style.animation = 'ptr-spin 0.8s linear infinite';
        }

        try {
          if (typeof Storage.syncFromSupabase === 'function') {
            await Storage.syncFromSupabase();
          }
          // Refresh current page view and data
          renderCurrentList();
          renderDashboard();
        } catch (err) {
          console.error('Erro ao atualizar dados:', err);
        } finally {
          // Hide ptr indicator
          indicator.style.transform = `translateX(-50%) translateY(0px) scale(0)`;
          indicator.style.opacity = '0';
          setTimeout(() => {
            indicator.classList.remove('active');
          }, 200);
        }
      } else {
        // Cancel refresh
        indicator.style.transform = `translateX(-50%) translateY(0px) scale(0)`;
        indicator.style.opacity = '0';
        setTimeout(() => {
          indicator.classList.remove('active');
        }, 200);
      }
      
      startY = 0;
      startX = 0;
      currentY = 0;
    });
  }

  function applyAdminPagePermissions(pageEl) {
    if (!pageEl) return;
    const isAdminMaster = currentUser && (currentUser.usuario === 'admin' || currentUser.role === 'role_admin' || currentUser.usuario === 'suprabikemarketing@gmail.com');
    pageEl.classList.remove('is-admin-master', 'is-read-only-usuarios', 'is-read-only-cargos', 'is-read-only-campos', 'is-read-only-whatsapp');
    if (isAdminMaster) {
      pageEl.classList.add('is-admin-master');
    } else {
      pageEl.classList.add('is-read-only-usuarios');
      pageEl.classList.add('is-read-only-cargos');
      pageEl.classList.add('is-read-only-whatsapp');
      if (!temPermissao('editar_campos_personalizados')) {
        pageEl.classList.add('is-read-only-campos');
      }
    }
  }

  function renderAdmin() {
    applyTheme();
    const adminPageEl = document.getElementById('page-admin');
    applyAdminPagePermissions(adminPageEl);

    // Show back button to exit Configurações menu to servicos
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
      btnBack.style.display = 'flex';
      btnBack.onclick = () => {
        btnBack.style.display = 'none';
        navigateTo('servicos');
      };
    }
  }

  function renderAdminSubpage(category) {
    applyTheme();
    const subpageEl = document.getElementById(`page-admin-${category}`);
    applyAdminPagePermissions(subpageEl);

    // Show back button to return to Configurações main menu
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
      btnBack.style.display = 'flex';
      btnBack.onclick = () => {
        navigateTo('admin');
      };
    }

    switch (category) {
      case 'usuarios':
        renderUsuarios();
        break;
      case 'cargos':
        renderCargosAdmin();
        break;
      case 'campos':
        renderCamposAdmin();
        break;
      case 'opcoes':
        renderOpcoesAdmin();
        break;
      case 'whatsapp':
        renderTemplateWhatsAppAdmin();
        break;
    }
  }

  // --- Usuários ---
  function renderUsuarios() {
    const usuarios = Storage.getUsuarios();
    const cargos = Storage.getCargos();
    const container = document.getElementById('admin-usuarios-list');
    container.innerHTML = usuarios.map(u => {
      const cargo = cargos.find(c => c.id === u.role);
      const cargoNome = cargo ? cargo.nome : Utils.traduzirRole(u.role);
      const avatarHtml = u.fotoPerfil
        ? `<img src="${u.fotoPerfil}" class="user-avatar-img" alt="${u.nome}">`
        : `<div class="user-avatar-placeholder">${u.nome.charAt(0).toUpperCase()}</div>`;
      
      const internoBadge = u.isInterno ? `<span style="background:rgba(245,158,11,0.15);color:var(--amber);padding:2px 6px;border-radius:4px;font-size:var(--font-xs);font-weight:600;margin-left:4px;border:1px solid rgba(245,158,11,0.3);">🏷️ Interno</span>` : '';
      const delegacaoBadge = u.exibirNaDelegacao === false ? `<span style="background:rgba(239,68,68,0.15);color:var(--danger);padding:2px 6px;border-radius:4px;font-size:var(--font-xs);font-weight:600;margin-left:4px;border:1px solid rgba(239,68,68,0.3);">🙈 Oculto na Delegação</span>` : '';
      const userDisplay = u.isInterno ? 'Sem Login (Interno)' : `@${u.usuario}`;

      return `
        <div class="admin-item" style="display:flex; align-items:center; gap:12px;">
          ${avatarHtml}
          <div class="admin-item-info" style="flex:1;">
            <div class="admin-item-name" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
              <span>${u.nome}</span>
              ${internoBadge}
              ${delegacaoBadge}
            </div>
            <div class="admin-item-meta">${userDisplay} · <span class="role-badge" style="background:var(--accent-bg);color:var(--accent);padding:2px 6px;border-radius:4px;font-size:var(--font-xs);">${cargoNome}</span></div>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-secondary btn-xs btn-edit-user" data-id="${u.id}">Editar</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        openModalEditarUsuario(btn.dataset.id);
      });
    });
  }

  // --- Cargos & Permissões ---
  function renderCargosAdmin() {
    const cargos = Storage.getCargos();
    const container = document.getElementById('admin-cargos-list');

    container.innerHTML = cargos.map(c => {
      const permissoesLegiveis = c.permissoes.map(p => {
        const map = {
          criar_os: 'Criar OS',
          editar_os: 'Editar OS',
          assumir_servico: 'Assumir',
          concluir_servico: 'Concluir',
          ver_valores_cliente: 'Valores/Tel',
          enviar_whatsapp: 'WhatsApp',
          configuracoes: 'Acesso Config.',
          editar_campos_personalizados: 'Campos/Listas'
        };
        return map[p] || p;
      }).join(', ');

      return `
        <div class="admin-item">
          <div class="admin-item-info">
            <div class="admin-item-name">${c.nome}</div>
            <div class="admin-item-meta" style="white-space:normal;line-height:1.4;">Permissões: <span style="color:var(--text-secondary)">${permissoesLegiveis || 'Nenhuma'}</span></div>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-secondary btn-xs btn-edit-cargo" data-id="${c.id}">Editar</button>
            ${c.id !== 'role_admin' ? `<button class="btn btn-danger btn-xs btn-delete-cargo" data-id="${c.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            </button>` : ''}
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-delete-cargo').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Excluir este cargo? Usuários que o utilizam perderão as permissões.')) {
          Storage.deleteCargo(btn.dataset.id);
          showToast('Cargo excluído', 'info');
          renderCargosAdmin();
        }
      });
    });

    container.querySelectorAll('.btn-edit-cargo').forEach(btn => {
      btn.addEventListener('click', () => {
        openModalEditarCargo(btn.dataset.id);
      });
    });
  }

  // --- Opções / Listas Configuráveis ---
  function renderOpcoesAdmin() {
    const opcoes = Storage.getOpcoes();
    const container = document.getElementById('admin-opcoes-list');

    if (opcoes.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:var(--space-md)"><div class="empty-state-text">Nenhuma lista criada.<br>Crie listas para Cores, Modelos, Tipo de Veículo, etc.</div></div>`;
      return;
    }

    container.innerHTML = opcoes.map(opcao => `
      <div class="collapsible-section ${opcao.itens.length > 5 ? 'collapsed' : ''}">
        <div class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <div>
            <span class="collapsible-title">${opcao.nome}</span>
            <span class="collapsible-meta">Campo: ${opcao.campo} · ${opcao.itens.length} itens</span>
          </div>
          <div class="collapsible-actions" onclick="event.stopPropagation()">
            <button class="btn btn-blue btn-xs btn-edit-opcao" data-id="${opcao.id}" title="Editar nome da lista" style="margin-right:4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn btn-danger btn-xs btn-delete-opcao" data-id="${opcao.id}" title="Excluir lista">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="collapse-icon"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="collapsible-body">
          <div class="opcao-items">
            ${opcao.itens.map(item => `
              <div class="opcao-item" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:var(--font-sm); font-weight:500; color:var(--text-primary);">${item}</span>
                <div style="display:flex; align-items:center; gap:6px;">
                  <button class="btn-edit-opcao-item" data-opcao-id="${opcao.id}" data-item="${item}" title="Editar item" style="background:rgba(255,255,255,0.06); border:none; color:var(--text-primary); cursor:pointer; padding:6px 8px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  <button class="btn-remove-opcao-item" data-opcao-id="${opcao.id}" data-item="${item}" title="Excluir item" style="background:rgba(239,68,68,0.15); border:none; color:var(--danger); cursor:pointer; padding:6px 8px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </div>`).join('')}
          </div>
          <div class="opcao-add-row">
            <input type="text" class="form-input opcao-new-item-input" placeholder="Novo item..." data-opcao-id="${opcao.id}" style="min-height:40px;padding:8px 12px;flex:1;">
            <button class="btn btn-primary btn-xs btn-add-opcao-item" data-opcao-id="${opcao.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          </div>
        </div>
      </div>`).join('');

    // Bind edit list title
    container.querySelectorAll('.btn-edit-opcao').forEach(btn => {
      btn.addEventListener('click', () => {
        const op = Storage.getOpcaoById(btn.dataset.id);
        if (!op) return;
        const novoNome = prompt('Editar nome da lista:', op.nome);
        if (novoNome && novoNome.trim() && novoNome.trim() !== op.nome) {
          Storage.updateOpcao(op.id, { nome: novoNome.trim() });
          showToast('Lista renomeada!', 'success');
          renderOpcoesAdmin();
        }
      });
    });

    // Bind delete list
    container.querySelectorAll('.btn-delete-opcao').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Excluir esta lista?')) {
          Storage.deleteOpcao(btn.dataset.id);
          showToast('Lista excluída', 'info');
          renderOpcoesAdmin();
        }
      });
    });

    // Bind edit item
    container.querySelectorAll('.btn-edit-opcao-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemAntigo = btn.dataset.item;
        const novoItem = prompt('Editar item:', itemAntigo);
        if (novoItem && novoItem.trim() && novoItem.trim() !== itemAntigo) {
          Storage.updateItemOpcao(btn.dataset.opcaoId, itemAntigo, novoItem.trim());
          showToast('Item atualizado com sucesso!', 'success');
          renderOpcoesAdmin();
        }
      });
    });

    // Bind remove item
    container.querySelectorAll('.btn-remove-opcao-item').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.removeItemOpcao(btn.dataset.opcaoId, btn.dataset.item);
        renderOpcoesAdmin();
      });
    });

    // Bind add item
    container.querySelectorAll('.btn-add-opcao-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = container.querySelector(`.opcao-new-item-input[data-opcao-id="${btn.dataset.opcaoId}"]`);
        const val = input.value.trim();
        if (val) {
          Storage.addItemOpcao(btn.dataset.opcaoId, val);
          input.value = '';
          renderOpcoesAdmin();
        }
      });
    });

    // Enter to add
    container.querySelectorAll('.opcao-new-item-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val) {
            Storage.addItemOpcao(input.dataset.opcaoId, val);
            input.value = '';
            renderOpcoesAdmin();
          }
        }
      });
    });
  }

  // --- Campos Personalizados ---
  function renderCamposAdmin() {
    const campos = Storage.getCampos();
    const container = document.getElementById('admin-campos-list');

    if (campos.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:var(--space-md)"><div class="empty-state-text">Nenhum campo personalizado criado</div></div>`;
      return;
    }

    // Group by section
    const sections = {};
    campos.forEach(c => {
      const sec = c.secao || 'Sem Seção';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(c);
    });

    container.innerHTML = Object.entries(sections).map(([secName, secCampos]) => `
      <div class="collapsible-section">
        <div class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span>${secName} <small style="color:var(--text-tertiary)">(${secCampos.length})</small></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="collapse-icon"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="collapsible-body">
          ${secCampos.map(c => `
            <div class="admin-item">
              <div class="admin-item-info">
                <div class="admin-item-name">${c.nome}</div>
                <div class="admin-item-meta">${c.tipo === 'sim_nao' ? 'Sim/Não' : c.tipo === 'sim_nao_quantidade' ? 'Sim/Não + Qtd' : 'Texto'} · ${c.ativo ? '✅ Ativo' : '❌ Inativo'}</div>
              </div>
              <div class="admin-item-actions">
                <button class="btn btn-blue btn-xs btn-edit-campo" data-id="${c.id}" title="Editar nome do campo">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn btn-secondary btn-xs btn-toggle-campo" data-id="${c.id}">${c.ativo ? 'Desativar' : 'Ativar'}</button>
                <button class="btn btn-danger btn-xs btn-delete-campo" data-id="${c.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                </button>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('');

    container.querySelectorAll('.btn-edit-campo').forEach(btn => {
      btn.addEventListener('click', () => {
        openModalEditarCampo(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-toggle-campo').forEach(btn => {
      btn.addEventListener('click', () => { Storage.toggleCampo(btn.dataset.id); renderCamposAdmin(); });
    });
    container.querySelectorAll('.btn-delete-campo').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Excluir este campo?')) { Storage.deleteCampo(btn.dataset.id); showToast('Campo excluído', 'info'); renderCamposAdmin(); }
      });
    });
  }

  // --- WhatsApp Templates & Multiple Messages Management ---
  const WHATSAPP_VARS = [
    { token: '@{nome_cliente}', label: 'nome_cliente', desc: 'Nome do Cliente' },
    { token: '@{veiculo}', label: 'veiculo', desc: 'Modelo e Cor do Veículo' },
    { token: '@{lista_servicos}', label: 'lista_servicos', desc: 'Lista dos Serviços' },
    { token: '@{valor_total}', label: 'valor_total', desc: 'Valor Total' },
    { token: '@{forma_pagamento}', label: 'forma_pagamento', desc: 'Forma de Pagamento' },
    { token: '@{status_pagamento}', label: 'status_pagamento', desc: 'Status do Pagamento' },
    { token: '@{data}', label: 'data', desc: 'Data do Atendimento' },
    { token: '@{hora}', label: 'hora', desc: 'Hora do Atendimento' }
  ];

  function renderTemplateWhatsAppAdmin() {
    const container = document.getElementById('admin-whatsapp-templates-list');
    const btnNovo = document.getElementById('btn-nova-mensagem-wa');
    if (!container) return;

    const templates = Storage.getTemplatesWhatsApp();

    if (btnNovo) {
      btnNovo.onclick = () => openModalEditarTemplateWhatsApp(null);
    }

    if (templates.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:var(--space-md)"><div class="empty-state-text">Nenhum modelo cadastrado.</div></div>`;
      return;
    }

    container.innerHTML = templates.map(t => {
      const preview = (t.mensagem || '').replace(/\n/g, ' ').substring(0, 100) + ((t.mensagem || '').length > 100 ? '...' : '');
      const padraoBadge = t.padrao 
        ? `<span style="background:rgba(16,185,129,0.15); color:var(--success); border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:var(--radius-full); font-size:11px; font-weight:700;">⭐ Padrão</span>`
        : '';

      return `
        <div class="admin-item" style="display:flex; flex-direction:column; gap:8px; padding:12px; margin-bottom:10px; background:var(--bg-surface); border:1px solid var(--glass-border); border-radius:var(--radius-md);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700; font-size:var(--font-sm); color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>💬 ${t.titulo}</span>
              ${padraoBadge}
            </div>
            <div style="display:flex; gap:6px;">
              ${!t.padrao ? `<button class="btn btn-secondary btn-xs btn-set-default-wa" data-id="${t.id}" title="Tornar Padrão">Tornar Padrão</button>` : ''}
              <button class="btn btn-blue btn-xs btn-edit-wa" data-id="${t.id}">Editar</button>
              ${templates.length > 1 ? `<button class="btn btn-danger btn-xs btn-delete-wa" data-id="${t.id}">Excluir</button>` : ''}
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.4; white-space:pre-wrap; background:rgba(0,0,0,0.15); padding:8px; border-radius:var(--radius-sm); font-family:sans-serif; max-height:80px; overflow-y:auto;">${preview}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-wa').forEach(btn => {
      btn.onclick = () => {
        const t = Storage.getTemplateWhatsAppById(btn.dataset.id);
        if (t) openModalEditarTemplateWhatsApp(t);
      };
    });

    container.querySelectorAll('.btn-set-default-wa').forEach(btn => {
      btn.onclick = () => {
        const t = Storage.getTemplateWhatsAppById(btn.dataset.id);
        if (t) {
          Storage.saveTemplateWhatsApp({ ...t, padrao: true });
          showToast(`"${t.titulo}" definido como mensagem padrão!`, 'success');
          renderTemplateWhatsAppAdmin();
        }
      };
    });

    container.querySelectorAll('.btn-delete-wa').forEach(btn => {
      btn.onclick = () => {
        const t = Storage.getTemplateWhatsAppById(btn.dataset.id);
        if (t && confirm(`Excluir a mensagem "${t.titulo}"?`)) {
          Storage.deleteTemplateWhatsApp(t.id);
          showToast('Mensagem excluída', 'info');
          renderTemplateWhatsAppAdmin();
        }
      };
    });
  }

  function insertVarAtCursor(textarea, varToken) {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, startPos);
    const textAfter = textarea.value.substring(endPos, textarea.value.length);

    let insertStart = startPos;
    if (textBefore.endsWith('@')) {
      insertStart = startPos - 1;
    } else {
      const match = textBefore.match(/@[\w]*$/);
      if (match) {
        insertStart = startPos - match[0].length;
      }
    }

    const cleanBefore = textarea.value.substring(0, insertStart);
    textarea.value = cleanBefore + varToken + textAfter;
    
    const newCursorPos = insertStart + varToken.length;
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }

  function openModalEditarTemplateWhatsApp(templateData) {
    const isEdit = !!templateData;
    const title = isEdit ? `Editar Mensagem: ${templateData.titulo}` : 'Nova Mensagem do WhatsApp';

    const bodyHtml = `
      <form id="form-modal-wa-template">
        <div class="form-group">
          <label class="form-label required">Título do Modelo</label>
          <input type="text" class="form-input" id="wa-tpl-titulo" required placeholder="Ex: Aviso de Retirada, Orçamento Pronto" value="${isEdit ? templateData.titulo : ''}">
        </div>

        <div class="form-group">
          <label class="form-label required">Texto da Mensagem</label>
          <label class="form-label" style="font-size:var(--font-xs); color:var(--text-tertiary); margin-bottom:4px; display:block;">
            Clique nos botões ou digite <strong>@</strong> para inserir variáveis
          </label>

          <div id="wa-modal-vars-chips" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
            ${WHATSAPP_VARS.map(v => `<button type="button" class="chip-var" data-var="${v.token}" style="padding:4px 8px; font-size:0.7rem; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.3); border-radius:var(--radius-full); color:var(--accent); cursor:pointer;">+ ${v.token}</button>`).join('')}
          </div>

          <div style="position:relative;">
            <textarea class="form-textarea" id="wa-tpl-mensagem" rows="8" required style="font-family:monospace; font-size:var(--font-xs); line-height:1.4; width:100%; resize:vertical; padding:10px;">${isEdit ? templateData.mensagem : ''}</textarea>
            <div id="wa-modal-autocomplete-dropdown" style="display:none; position:absolute; left:10px; bottom:20px; z-index:300; background:var(--bg-tertiary); border:1px solid var(--accent); border-radius:var(--radius-md); box-shadow:var(--shadow-lg); width:calc(100% - 20px); max-height:220px; overflow-y:auto;"></div>
          </div>
        </div>

        <div class="form-toggle" style="margin-top:12px; background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <span class="form-toggle-label" style="font-size:var(--font-sm); font-weight:600;">Definir como mensagem padrão</span>
          <label class="toggle-switch">
            <input type="checkbox" id="wa-tpl-padrao" ${isEdit && templateData.padrao ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </form>
    `;

    openModal(title, bodyHtml, () => {
      const form = document.getElementById('form-modal-wa-template');
      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const titulo = document.getElementById('wa-tpl-titulo').value.trim();
      const mensagem = document.getElementById('wa-tpl-mensagem').value;
      const padrao = document.getElementById('wa-tpl-padrao').checked;

      Storage.saveTemplateWhatsApp({
        id: isEdit ? templateData.id : null,
        titulo,
        mensagem,
        padrao
      });

      showToast(isEdit ? 'Modelo atualizado!' : 'Modelo de WhatsApp criado!', 'success');
      renderTemplateWhatsAppAdmin();
      return true;
    });

    setTimeout(() => {
      const textarea = document.getElementById('wa-tpl-mensagem');
      const dropdown = document.getElementById('wa-modal-autocomplete-dropdown');
      const chipsContainer = document.getElementById('wa-modal-vars-chips');

      if (!textarea) return;

      if (chipsContainer) {
        chipsContainer.querySelectorAll('.chip-var').forEach(btn => {
          btn.onclick = (e) => {
            e.preventDefault();
            insertVarAtCursor(textarea, btn.dataset.var);
          };
        });
      }

      function hideDropdown() {
        if (dropdown) dropdown.style.display = 'none';
      }

      function showAutocomplete(filterText) {
        if (!dropdown) return;
        const filtered = WHATSAPP_VARS.filter(v => 
          v.label.toLowerCase().includes(filterText.toLowerCase()) || 
          v.token.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) { hideDropdown(); return; }

        dropdown.innerHTML = filtered.map((v, i) => `
          <div class="wa-autocomplete-item" data-var="${v.token}" style="padding:10px 14px; cursor:pointer; font-size:var(--font-sm); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; ${i === 0 ? 'background:rgba(139,92,246,0.15);' : ''}">
            <span style="font-weight:700; color:var(--accent); font-family:monospace;">@{${v.label}}</span>
            <span style="font-size:var(--font-xs); color:var(--text-tertiary);">${v.desc}</span>
          </div>
        `).join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.wa-autocomplete-item').forEach(item => {
          item.onmousedown = (e) => {
            e.preventDefault();
            insertVarAtCursor(textarea, item.dataset.var);
            hideDropdown();
          };
        });
      }

      textarea.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
          if (e.key === 'Escape') hideDropdown();
          return;
        }
        const cursorPos = textarea.selectionStart;
        const textUpToCursor = textarea.value.substring(0, cursorPos);
        const match = textUpToCursor.match(/@([\w]*)$/);
        if (match) {
          showAutocomplete(match[1]);
        } else {
          hideDropdown();
        }
      });

      textarea.addEventListener('blur', () => { setTimeout(hideDropdown, 200); });
    }, 100);
  }

  function openModalEnviarWhatsApp(osInput) {
    const os = (typeof osInput === 'string' || typeof osInput === 'number') ? Storage.getOrdemById(osInput) : osInput;
    if (!os) return;
    const templates = Storage.getTemplatesWhatsApp();
    if (!templates.length) {
      showToast('Nenhum modelo de WhatsApp encontrado!', 'error');
      return;
    }

    const defaultTpl = templates.find(t => t.padrao) || templates[0];
    const optionsHtml = templates.map(t => `<option value="${t.id}" ${t.id === defaultTpl.id ? 'selected' : ''}>${t.titulo}${t.padrao ? ' (Padrão)' : ''}</option>`).join('');

    const initialMsg = Utils.gerarMensagemWhatsApp(os, defaultTpl.mensagem);

    const bodyHtml = `
      <form id="form-enviar-wa">
        <p style="font-size:var(--font-xs); color:var(--text-secondary); margin-bottom:12px;">
          Selecione o modelo de mensagem desejado para enviar ao cliente <strong>${os.clienteNome || 'Cliente'}</strong>.
        </p>

        <div class="form-group">
          <label class="form-label required">Modelo de Mensagem Pronta</label>
          <select class="form-select" id="modal-wa-select-template" required>
            ${optionsHtml}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Prévia do Texto (editável antes de enviar)</label>
          <textarea class="form-textarea" id="modal-wa-text-preview" rows="9" style="font-family:sans-serif; font-size:var(--font-xs); line-height:1.4; width:100%; resize:vertical; padding:10px;">${initialMsg}</textarea>
        </div>
      </form>
    `;

    openModal('Enviar WhatsApp ao Cliente', bodyHtml, () => {
      const textFinal = document.getElementById('modal-wa-text-preview').value;
      const link = Utils.gerarLinkWhatsApp(os.clienteTelefone, textFinal);
      window.open(link, '_blank');
      return true;
    });

    setTimeout(() => {
      const selectTpl = document.getElementById('modal-wa-select-template');
      const textPreview = document.getElementById('modal-wa-text-preview');

      if (selectTpl && textPreview) {
        selectTpl.addEventListener('change', (e) => {
          const chosenTpl = templates.find(t => t.id === e.target.value);
          if (chosenTpl) {
            textPreview.value = Utils.gerarMensagemWhatsApp(os, chosenTpl.mensagem);
          }
        });
      }
    }, 100);
  }

  function initWhatsAppTemplateEditor() {
    renderTemplateWhatsAppAdmin();
  }

  // ---------- MODALS ----------

  // ---------- MODALS ----------

  function openModalNovoUsuario() {
    const cargos = Storage.getCargos();
    const optionsHtml = cargos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    let fotoPerfilTemp = null;

    openModal('Novo Funcionário / Usuário', `
      <form id="form-novo-usuario">
        <div class="form-group" style="text-align:center; margin-bottom:16px;">
          <div id="new-user-avatar-preview" style="width:64px; height:64px; border-radius:50%; background:var(--accent-bg); color:var(--accent); display:flex; align-items:center; justify-content:center; margin:0 auto 8px; border:2px dashed var(--accent); font-weight:700; font-size:1.5rem; overflow:hidden;">📷</div>
          <label for="new-user-foto" class="btn btn-secondary btn-xs" style="cursor:pointer; display:inline-block;">Selecionar Foto de Perfil</label>
          <input type="file" id="new-user-foto" accept="image/*" style="display:none">
        </div>

        <div class="form-group">
          <label class="form-label required">Nome Completo</label>
          <input type="text" class="form-input" id="new-user-nome" required placeholder="Ex: João Silva">
        </div>

        <div class="form-toggle" style="margin-bottom:12px; background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="form-toggle-label" style="font-size:var(--font-sm); font-weight:600; display:block;">Funcionário Interno</span>
            <span style="font-size:11px; color:var(--text-tertiary);">Não necessita de login e senha</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="new-user-is-interno">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="form-toggle" style="margin-bottom:16px; background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="form-toggle-label" style="font-size:var(--font-sm); font-weight:600; display:block;">Aparecer na lista de delegar?</span>
            <span style="font-size:11px; color:var(--text-tertiary);">Exibir ao atribuir serviços na oficina</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="new-user-exibir-delegacao" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="container-user-credentials">
          <div class="form-group">
            <label class="form-label required" id="label-user-usuario">Usuário (login)</label>
            <input type="text" class="form-input" id="new-user-usuario" placeholder="Ex: joao">
          </div>
          <div class="form-group">
            <label class="form-label required" id="label-user-senha">Senha</label>
            <div style="position: relative;">
              <input type="text" class="form-input" id="new-user-senha" placeholder="Mínimo 4 caracteres" minlength="4" style="padding-right: 40px;">
              <button type="button" onclick="const input = document.getElementById('new-user-senha'); input.type = input.type === 'password' ? 'text' : 'password';" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-size: 14px;">👁️</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label required">Tipo de Acesso (Cargo)</label>
          <select class="form-select" id="new-user-role" required>
            <option value="">Selecione o cargo...</option>
            ${optionsHtml}
          </select>
        </div>
      </form>`, () => {
      const form = document.getElementById('form-novo-usuario');
      const isInterno = document.getElementById('new-user-is-interno').checked;
      const exibirNaDelegacao = document.getElementById('new-user-exibir-delegacao').checked;

      const inputUsuario = document.getElementById('new-user-usuario');
      const inputSenha = document.getElementById('new-user-senha');

      if (!isInterno) {
        inputUsuario.setAttribute('required', 'true');
        inputSenha.setAttribute('required', 'true');
      } else {
        inputUsuario.removeAttribute('required');
        inputSenha.removeAttribute('required');
      }

      if (!form.checkValidity()) { form.reportValidity(); return false; }
      
      const nome = document.getElementById('new-user-nome').value.trim();
      let usuario = inputUsuario.value.trim().toLowerCase();
      const senha = inputSenha.value;
      const role = document.getElementById('new-user-role').value;

      if (!isInterno && usuario) {
        if (Storage.getUsuarios().find(u => u.usuario === usuario)) { 
          showToast('Usuário já existe!', 'error'); 
          return false; 
        }
      }

      Storage.saveUsuario({ 
        nome, 
        usuario, 
        senha, 
        role, 
        isInterno, 
        exibirNaDelegacao, 
        fotoPerfil: fotoPerfilTemp 
      });

      showToast(`Funcionário ${nome} cadastrado com sucesso!`, 'success');
      renderUsuarios();
      return true;
    });

    setTimeout(() => {
      const checkInterno = document.getElementById('new-user-is-interno');
      const containerCreds = document.getElementById('container-user-credentials');
      if (checkInterno && containerCreds) {
        checkInterno.addEventListener('change', (e) => {
          if (e.target.checked) {
            containerCreds.style.display = 'none';
          } else {
            containerCreds.style.display = 'block';
          }
        });
      }

      const inputFoto = document.getElementById('new-user-foto');
      const preview = document.getElementById('new-user-avatar-preview');
      if (inputFoto) {
        inputFoto.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            fotoPerfilTemp = await Utils.comprimirFotoBase64(file, 300, 0.7);
            if (preview) {
              preview.innerHTML = `<img src="${fotoPerfilTemp}" style="width:100%; height:100%; object-fit:cover;">`;
            }
          } catch (err) {
            console.error('Erro ao carregar foto de perfil:', err);
          }
        });
      }
    }, 100);
  }

  function openModalEditarUsuario(userId) {
    const user = Storage.getUsuarioById(userId);
    if (!user) return;
    const cargos = Storage.getCargos();
    const optionsHtml = cargos.map(c => `<option value="${c.id}" ${user.role === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
    const isMasterAdmin = user.usuario === 'admin' || user.usuario === 'suprabikemarketing@gmail.com';
    const isLoginDisabled = isMasterAdmin ? 'disabled' : '';
    let fotoPerfilTemp = user.fotoPerfil || null;

    const avatarInitialHtml = fotoPerfilTemp 
      ? `<img src="${fotoPerfilTemp}" style="width:100%; height:100%; object-fit:cover;">` 
      : user.nome.charAt(0).toUpperCase();

    openModal(`Editar Usuário: ${user.nome}`, `
      <form id="form-editar-usuario">
        <div class="form-group" style="text-align:center; margin-bottom:16px;">
          <div id="edit-user-avatar-preview" style="width:64px; height:64px; border-radius:50%; background:var(--accent-bg); color:var(--accent); display:flex; align-items:center; justify-content:center; margin:0 auto 8px; border:2px solid var(--accent); font-weight:700; font-size:1.5rem; overflow:hidden;">${avatarInitialHtml}</div>
          <label for="edit-user-foto" class="btn btn-secondary btn-xs" style="cursor:pointer; display:inline-block;">Alterar Foto de Perfil</label>
          <input type="file" id="edit-user-foto" accept="image/*" style="display:none">
        </div>

        <div class="form-group">
          <label class="form-label required">Nome Completo</label>
          <input type="text" class="form-input" id="edit-user-nome" required placeholder="Ex: João Silva" value="${user.nome}">
        </div>

        ${!isMasterAdmin ? `
        <div class="form-toggle" style="margin-bottom:12px; background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="form-toggle-label" style="font-size:var(--font-sm); font-weight:600; display:block;">Funcionário Interno</span>
            <span style="font-size:11px; color:var(--text-tertiary);">Não necessita de login e senha</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="edit-user-is-interno" ${user.isInterno ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>` : ''}

        <div class="form-toggle" style="margin-bottom:16px; background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="form-toggle-label" style="font-size:var(--font-sm); font-weight:600; display:block;">Aparecer na lista de delegar?</span>
            <span style="font-size:11px; color:var(--text-tertiary);">Exibir ao atribuir serviços na oficina</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="edit-user-exibir-delegacao" ${user.exibirNaDelegacao !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="container-edit-user-credentials" style="${user.isInterno ? 'display:none;' : ''}">
          <div class="form-group">
            <label class="form-label required">Usuário (login)</label>
            <input type="text" class="form-input" id="edit-user-usuario" placeholder="Ex: joao" value="${user.usuario || ''}" ${isLoginDisabled}>
          </div>
          <div class="form-group">
            <label class="form-label required">Senha</label>
            <div style="position: relative;">
              <input type="text" class="form-input" id="edit-user-senha" placeholder="Mínimo 4 caracteres" minlength="4" value="${user.senha || ''}" style="padding-right: 40px;">
              <button type="button" onclick="const input = document.getElementById('edit-user-senha'); input.type = input.type === 'password' ? 'text' : 'password';" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-size: 14px;">👁️</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label required">Tipo de Acesso (Cargo)</label>
          <select class="form-select" id="edit-user-role" required ${isLoginDisabled}>
            ${optionsHtml}
          </select>
        </div>

        ${!isMasterAdmin ? `
        <div class="form-group" style="margin-top: 24px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 16px;">
          <button type="button" class="btn btn-danger btn-block" id="btn-delete-user-modal" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            Excluir Usuário
          </button>
        </div>` : ''}
      </form>
    `, () => {
      const form = document.getElementById('form-editar-usuario');
      const checkInterno = document.getElementById('edit-user-is-interno');
      const isInterno = checkInterno ? checkInterno.checked : false;
      const exibirNaDelegacao = document.getElementById('edit-user-exibir-delegacao').checked;

      const inputUsuario = document.getElementById('edit-user-usuario');
      const inputSenha = document.getElementById('edit-user-senha');

      if (!isInterno && !isMasterAdmin) {
        if (inputUsuario) inputUsuario.setAttribute('required', 'true');
        if (inputSenha) inputSenha.setAttribute('required', 'true');
      } else {
        if (inputUsuario) inputUsuario.removeAttribute('required');
        if (inputSenha) inputSenha.removeAttribute('required');
      }

      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const nome = document.getElementById('edit-user-nome').value.trim();
      const role = document.getElementById('edit-user-role').value;
      const usuario = inputUsuario ? inputUsuario.value.trim().toLowerCase() : user.usuario;

      if (!isInterno && usuario !== user.usuario && !isMasterAdmin) {
        if (Storage.getUsuarios().find(u => u.usuario === usuario)) {
          showToast('Este nome de usuário já está em uso!', 'error');
          return false;
        }
      }

      const updates = { 
        nome, 
        fotoPerfil: fotoPerfilTemp,
        isInterno,
        exibirNaDelegacao
      };

      if (!isMasterAdmin) {
        if (!isInterno) {
          updates.usuario = usuario;
        }
        updates.role = role;
      }

      const novaSenha = inputSenha ? inputSenha.value : null;
      if (novaSenha !== null && !isInterno) {
        updates.senha = novaSenha;
      }

      Storage.updateUsuario(userId, updates);
      showToast(`Usuário ${nome} atualizado!`, 'success');
      renderUsuarios();
      
      if (currentUser && currentUser.id === userId) {
        const updatedUser = Storage.getUsuarioById(userId);
        Storage.setUsuarioLogado(updatedUser);
        currentUser = updatedUser;
        updateHeaderUser();
      }

      return true;
    });

    setTimeout(() => {
      const checkInterno = document.getElementById('edit-user-is-interno');
      const containerCreds = document.getElementById('container-edit-user-credentials');
      if (checkInterno && containerCreds) {
        checkInterno.addEventListener('change', (e) => {
          if (e.target.checked) {
            containerCreds.style.display = 'none';
          } else {
            containerCreds.style.display = 'block';
          }
        });
      }

      const inputFoto = document.getElementById('edit-user-foto');
      const preview = document.getElementById('edit-user-avatar-preview');
      if (inputFoto) {
        inputFoto.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            fotoPerfilTemp = await Utils.comprimirFotoBase64(file, 300, 0.7);
            if (preview) {
              preview.innerHTML = `<img src="${fotoPerfilTemp}" style="width:100%; height:100%; object-fit:cover;">`;
            }
          } catch (err) {
            console.error('Erro ao carregar foto de perfil:', err);
          }
        });
      }

      const btnDelete = document.getElementById('btn-delete-user-modal');
      if (btnDelete) {
        btnDelete.addEventListener('click', () => {
          if (confirm(`Deseja realmente excluir o usuário ${user.nome}?`)) {
            Storage.deleteUsuario(userId);
            showToast('Usuário excluído', 'info');
            closeModal();
            renderUsuarios();
          }
        });
      }
    }, 100);
  }

  function openModalDelegarServico(osId) {
    const usuarios = Storage.getUsuarios();
    const cargos = Storage.getCargos();

    // Filtra apenas mecânicos visíveis para delegação de serviços
    let mecanicos = usuarios.filter(u => {
      if (u.exibirNaDelegacao === false) return false;
      const cargo = cargos.find(c => c.id === u.role);
      const cargoNome = (cargo ? cargo.nome : (u.role || '')).toLowerCase();
      return u.role === 'role_mecanico' || u.role === 'mecanico' || cargoNome.includes('mecanic') || cargoNome.includes('mecânic');
    });

    if (mecanicos.length === 0) {
      mecanicos = usuarios.filter(u => u.exibirNaDelegacao !== false);
    }

    mecanicos.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    const optionsHtml = mecanicos.map(t => {
      const cargo = cargos.find(c => c.id === t.role);
      const cargoNome = cargo ? cargo.nome : Utils.traduzirRole(t.role);
      return `<option value="${t.nome}">${t.nome} (${cargoNome})</option>`;
    }).join('');

    openModal('Delegar Serviço', `
      <form id="form-delegar-servico">
        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md);">Selecione o funcionário responsável pela execução deste serviço. A OS passará automaticamente para o status <strong>Em Andamento</strong>.</p>
        <div class="form-group">
          <label class="form-label required">Funcionário Responsável</label>
          <select class="form-select" id="delegar-mecanico-select" required>
            <option value="">Selecione...</option>
            ${optionsHtml}
          </select>
        </div>
      </form>
    `, () => {
      const form = document.getElementById('form-delegar-servico');
      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const mecanicoNome = document.getElementById('delegar-mecanico-select').value;
      Storage.updateOrdem(osId, {
        status: 'em_andamento',
        mecanico: mecanicoNome,
        horaInicio: new Date().toISOString()
      });
      Storage.addHistorico(osId, `Serviço delegado para ${mecanicoNome}`, currentUser.nome);
      showToast(`Serviço delegado para ${mecanicoNome}!`, 'success');
      renderListaOS('aguardando');
      renderListaOS('em_andamento');
      navigateTo('andamento');
      return true;
    });
  }

  function openModalInstrucoesPWAiOS() {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const bodyHtml = `
      <div style="text-align:center; padding: 10px 0;">
        <img src="logo.svg" alt="Boa Gestão" style="width:64px; height:64px; margin-bottom:12px; border-radius:var(--radius-md);">
        <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-primary); margin-bottom:8px;">Instalar o Boa Gestão</h3>
        <p style="font-size:var(--font-xs); color:var(--text-secondary); margin-bottom:16px; line-height:1.5;">
          Adicione o aplicativo diretamente à tela de início do seu celular para acesso rápido e offline:
        </p>

        <div style="text-align:left; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:14px; display:flex; flex-direction:column; gap:12px; font-size:var(--font-xs);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="background:var(--accent-bg); color:var(--accent); font-weight:800; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">1</span>
            <span>No navegador (${isIOS ? 'Safari' : 'Chrome'}), toque no ícone <strong>Compartilhar 📤</strong> ou no menu <strong>⋮</strong>.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="background:var(--accent-bg); color:var(--accent); font-weight:800; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">2</span>
            <span>Role as opções e selecione <strong>"Adicionar à Tela de Início" ➕</strong>.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="background:var(--accent-bg); color:var(--accent); font-weight:800; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">3</span>
            <span>Confirme tocando em <strong>Adicionar</strong> no canto superior direito.</span>
          </div>
        </div>
      </div>
    `;

    openModal('Instalar Aplicativo', bodyHtml, null);
  }

  function openModalTermosEPolitica() {
    const bodyHtml = `
      <div style="font-size:var(--font-xs); color:var(--text-secondary); line-height:1.5; max-height:360px; overflow-y:auto; padding-right:6px;">
        <h4 style="font-size:var(--font-sm); font-weight:700; color:var(--text-primary); margin-bottom:6px;">1. Termos de Uso do Sistema</h4>
        <p style="margin-bottom:12px;">
          O aplicativo <strong>Boa Gestão</strong> é uma plataforma operacional desenvolvida pela Wisionarium para gerenciamento de Ordens de Serviço, controle de atendimento e fluxo de trabalho em oficina. O acesso é restrito a usuários e funcionários devidamente autorizados.
        </p>

        <h4 style="font-size:var(--font-sm); font-weight:700; color:var(--text-primary); margin-bottom:6px;">2. Política de Privacidade & LGPD</h4>
        <p style="margin-bottom:8px;">
          Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</strong>, estabelecemos:
        </p>
        <ul style="list-style:disc; padding-left:18px; margin-bottom:12px; display:flex; flex-direction:column; gap:4px;">
          <li><strong>Minimização de Dados:</strong> Coletamos apenas os dados estritamente necessários para a prestação do serviço (Nome do cliente, telefone de contato, modelo e cor do veículo).</li>
          <li><strong>Finalidade Legal:</strong> Os dados cadastrados destinam-se exclusivamente ao cumprimento e execução do contrato de serviço firmado entre a oficina e o cliente.</li>
          <li><strong>Segurança:</strong> Todas as comunicações utilizam criptografia HTTPS em trânsito e armazenamento seguro em repouso no Supabase Postgres.</li>
          <li><strong>Direitos dos Titulares:</strong> O cliente ou usuário pode solicitar a correção, exportação ou exclusão definitiva de seus dados a qualquer momento via solicitação ao responsável administrativo.</li>
        </ul>

        <div style="background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.25); border-radius:var(--radius-sm); padding:10px; text-align:center; color:var(--accent); font-weight:600; margin-top:8px;">
          Desenvolvido por Wisionarium • Conforme LGPD
        </div>
      </div>
    `;

    openModal('Termos de Uso & Privacidade (LGPD)', bodyHtml, null);
  }

  function openModalNovoCargo() {
    openModalCargoForm('Novo Cargo', null, (nome, permissoesSelected) => {
      Storage.saveCargo({
        nome,
        permissoes: permissoesSelected
      });
      showToast('Cargo criado com sucesso!', 'success');
      renderCargosAdmin();
    });
  }

  function openModalEditarCargo(id) {
    const cargo = Storage.getCargoById(id);
    if (!cargo) return;
    openModalCargoForm(`Editar Cargo: ${cargo.nome}`, cargo, (nome, permissoesSelected) => {
      Storage.updateCargo(id, {
        nome,
        permissoes: permissoesSelected
      });
      showToast('Cargo atualizado!', 'success');
      renderCargosAdmin();
    });
  }

  function openModalCargoForm(title, cargoData, onSave) {
    const todasPermissoes = [
      { id: 'criar_os', nome: 'Criar novas Ordens de Serviço' },
      { id: 'editar_os', nome: 'Editar Ordens de Serviço (antes do início)' },
      { id: 'assumir_servico', nome: 'Assumir serviços aguardando execução' },
      { id: 'concluir_servico', nome: 'Concluir serviços em andamento' },
      { id: 'delegar_servico', nome: 'Delegar serviços para outros funcionários' },
      { id: 'ver_valores_cliente', nome: 'Ver preços dos serviços e telefone do cliente' },
      { id: 'enviar_whatsapp', nome: 'Enviar link de WhatsApp ao cliente' },
      { id: 'configuracoes', nome: 'Acesso total às Configurações (Admin)' },
      { id: 'editar_campos_personalizados', nome: 'Editar Listas de Opções & Campos Personalizados' }
    ];

    const isChecked = (permId) => {
      if (!cargoData) return false;
      return cargoData.permissoes.includes(permId);
    };

    const inputsHtml = todasPermissoes.map(p => `
      <div class="form-toggle" style="margin-bottom:var(--space-xs);" onclick="this.querySelector('input').click()">
        <span class="form-toggle-label" style="font-size:var(--font-sm);">${p.nome}</span>
        <label class="toggle-switch" onclick="event.stopPropagation()">
          <input type="checkbox" class="cargo-perm-checkbox" value="${p.id}" ${isChecked(p.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');

    const bodyHtml = `
      <form id="form-cargo-modal">
        <div class="form-group">
          <label class="form-label required">Nome do Cargo</label>
          <input type="text" class="form-input" id="cargo-modal-nome" required placeholder="Ex: Auxiliar Técnico, Gerente" value="${cargoData ? cargoData.nome : ''}">
        </div>
        <label class="form-label">Permissões de Acesso</label>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${inputsHtml}
        </div>
      </form>
    `;

    openModal(title, bodyHtml, () => {
      const form = document.getElementById('form-cargo-modal');
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      
      const nome = document.getElementById('cargo-modal-nome').value.trim();
      const permissoesSelected = [];
      document.querySelectorAll('.cargo-perm-checkbox:checked').forEach(cb => {
        permissoesSelected.push(cb.value);
      });

      onSave(nome, permissoesSelected);
      return true;
    });
  }

  function openModalNovoCampo() {
    openModal('Novo Campo Personalizado', `
      <form id="form-novo-campo">
        <div class="form-group"><label class="form-label required">Seção / Grupo</label><input type="text" class="form-input" id="new-campo-secao" required placeholder="Ex: Checklist, Acessórios, Garantia"></div>
        <div class="form-group"><label class="form-label required">Nome do Campo</label><input type="text" class="form-input" id="new-campo-nome" required placeholder="Ex: Cliente deixou carregador?"></div>
        <div class="form-group"><label class="form-label required">Tipo</label><select class="form-select" id="new-campo-tipo" required><option value="sim_nao_quantidade">Sim / Não + Quantidade</option><option value="sim_nao">Sim / Não</option><option value="texto">Texto Livre</option></select></div>
      </form>`, () => {
      const form = document.getElementById('form-novo-campo');
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      Storage.saveCampo({
        nome: document.getElementById('new-campo-nome').value.trim(),
        tipo: document.getElementById('new-campo-tipo').value,
        secao: document.getElementById('new-campo-secao').value.trim()
      });
      showToast('Campo criado!', 'success');
      renderCamposAdmin();
      return true;
    });
  }

  function openModalEditarCampo(campoId) {
    const campos = Storage.getCampos();
    const c = campos.find(x => x.id === campoId);
    if (!c) return;

    openModal('Editar Campo Personalizado', `
      <form id="form-edit-campo">
        <div class="form-group">
          <label class="form-label required">Seção / Grupo</label>
          <input type="text" class="form-input" id="edit-campo-secao" value="${Utils.escapeHtml(c.secao || 'Outros')}" required placeholder="Ex: Checklist, Acessórios, Garantia">
        </div>
        <div class="form-group">
          <label class="form-label required">Nome do Campo</label>
          <input type="text" class="form-input" id="edit-campo-nome" value="${Utils.escapeHtml(c.nome)}" required placeholder="Ex: Deixou chave?">
        </div>
        <div class="form-group">
          <label class="form-label required">Tipo</label>
          <select class="form-select" id="edit-campo-tipo" required>
            <option value="sim_nao_quantidade" ${c.tipo === 'sim_nao_quantidade' ? 'selected' : ''}>Sim / Não + Quantidade</option>
            <option value="sim_nao" ${c.tipo === 'sim_nao' ? 'selected' : ''}>Sim / Não</option>
            <option value="texto" ${c.tipo === 'texto' ? 'selected' : ''}>Texto Livre</option>
          </select>
        </div>
      </form>`, () => {
      const form = document.getElementById('form-edit-campo');
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      Storage.updateCampo(c.id, {
        nome: document.getElementById('edit-campo-nome').value.trim(),
        tipo: document.getElementById('edit-campo-tipo').value,
        secao: document.getElementById('edit-campo-secao').value.trim()
      });
      showToast('Campo atualizado!', 'success');
      renderCamposAdmin();
      return true;
    });
  }

  function openModalNovaOpcao() {
    openModal('Nova Lista de Opções', `
      <form id="form-nova-opcao">
        <div class="form-group"><label class="form-label required">Nome da Lista</label><input type="text" class="form-input" id="new-opcao-nome" required placeholder="Ex: Cores, Modelos"></div>
        <div class="form-group"><label class="form-label required">Campo do Formulário</label>
          <select class="form-select" id="new-opcao-campo" required>
            <option value="">Selecione...</option>
            <option value="modelo">Modelo</option>
            <option value="cor">Cor</option>
          </select>
          <div class="form-hint">Define qual campo do formulário da OS usará esta lista</div>
        </div>
      </form>`, () => {
      const form = document.getElementById('form-nova-opcao');
      if (!form.checkValidity()) { form.reportValidity(); return false; }
      const campo = document.getElementById('new-opcao-campo').value;
      if (Storage.getOpcaoByCampo(campo)) { showToast('Já existe uma lista para este campo!', 'error'); return false; }
      Storage.saveOpcao({
        nome: document.getElementById('new-opcao-nome').value.trim(),
        campo,
        itens: []
      });
      showToast('Lista criada! Agora adicione os itens.', 'success');
      renderOpcoesAdmin();
      return true;
    });
  }

  function openModal(title, bodyHtml, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const sheet = document.getElementById('bottom-sheet');
    document.getElementById('bottom-sheet-title').textContent = title;
    document.getElementById('bottom-sheet-body').innerHTML = bodyHtml;
    overlay.classList.add('active');
    sheet.classList.add('active');

    document.getElementById('bottom-sheet-confirm').onclick = () => {
      if (onConfirm) {
        const result = onConfirm();
        if (result !== false) closeModal();
      } else {
        closeModal();
      }
    };
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('bottom-sheet').classList.remove('active');
  }

  // ---------- TOAST ----------

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  return {
    init,
    navigateTo,
    setTema,
    applyTheme,
    toggleTemaSwitch,
    updateValorTotal,
    openModalNovoUsuario,
    openModalNovoCargo,
    openModalNovoCampo,
    openModalEditarCampo,
    openModalNovaVisitaTecnica,
    openModalNovaOpcao,
    openModalTermosEPolitica
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
