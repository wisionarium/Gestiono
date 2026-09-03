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
  let currentMotoristaRetSubtab = 'pendentes';
  let currentMotoristaEntSubtab = 'pendentes';
  let currentServicosSubtab = 'servicos';
  let currentConcluidosSubtab = 'servicos';
  let formSalvoComSucesso = false;
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

  function isMotoristaUser() {
    if (!currentUser) return false;
    const roleLower = (currentUser.role || '').toLowerCase();
    const cargoObj = Storage.getCargoById(currentUser.role);
    const cargoNomeLower = cargoObj ? cargoObj.nome.toLowerCase() : '';
    return roleLower.includes('motorista') || cargoNomeLower.includes('motorista');
  }

  function isNovaOSFormDirty() {
    if (currentPage !== 'nova-os') return false;
    const nome = document.getElementById('os-cliente-nome')?.value.trim();
    const tel = document.getElementById('os-telefone')?.value.trim();
    const obs = document.getElementById('os-observacoes')?.value.trim();
    const servs = document.querySelectorAll('.servico-item');
    if (nome || tel || obs || servs.length > 0 || editingOS) {
      return true;
    }
    return false;
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
              updateNavBadges();
              renderDashboard();
              renderCurrentList();
              if (typeof currentPage !== 'undefined' && currentPage === 'os-detail' && currentOSId) {
                const updatedOS = Storage.getOrdemById(currentOSId);
                if (updatedOS) renderOSDetail(updatedOS);
              }
              if (typeof currentPage !== 'undefined' && currentPage === 'admin' && typeof renderAdmin === 'function') {
                renderAdmin();
              }
              if (typeof currentPage !== 'undefined' && currentPage === 'pdfs' && typeof renderListaPDFs === 'function') {
                renderListaPDFs();
              }
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
      if (isMotoristaUser()) {
        navigateTo('motorista-retiradas');
      } else {
        navigateTo('home');
      }
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

    const searchMotRet = document.getElementById('search-motorista-retiradas');
    if (searchMotRet) {
      searchMotRet.addEventListener('input', Utils.debounce(() => {
        renderMotoristaRetiradas();
      }, 300));
    }

    const searchMotEnt = document.getElementById('search-motorista-entregas');
    if (searchMotEnt) {
      searchMotEnt.addEventListener('input', Utils.debounce(() => {
        renderMotoristaEntregas();
      }, 300));
    }

    // Sub-abas Motorista (Pendentes / Concluídas)
    const btnRetPend = document.getElementById('motorista-ret-subtab-pendentes');
    const btnRetConc = document.getElementById('motorista-ret-subtab-concluidas');
    if (btnRetPend && btnRetConc) {
      btnRetPend.addEventListener('click', () => {
        currentMotoristaRetSubtab = 'pendentes';
        btnRetPend.classList.add('active');
        btnRetPend.style.background = '#ffffff';
        btnRetPend.style.color = '#0f172a';
        btnRetPend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
        btnRetConc.classList.remove('active');
        btnRetConc.style.background = 'transparent';
        btnRetConc.style.color = '#64748b';
        btnRetConc.style.boxShadow = 'none';
        renderMotoristaRetiradas();
      });
      btnRetConc.addEventListener('click', () => {
        currentMotoristaRetSubtab = 'concluidas';
        btnRetConc.classList.add('active');
        btnRetConc.style.background = '#ffffff';
        btnRetConc.style.color = '#0f172a';
        btnRetConc.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
        btnRetPend.classList.remove('active');
        btnRetPend.style.background = 'transparent';
        btnRetPend.style.color = '#64748b';
        btnRetPend.style.boxShadow = 'none';
        renderMotoristaRetiradas();
      });
    }

    // Sub-abas Concluídos (Serviços / Retiradas / Entregas)
    const btnConcServ = document.getElementById('concluidos-subtab-servicos');
    const btnConcRet = document.getElementById('concluidos-subtab-retiradas');
    const btnConcEnt = document.getElementById('concluidos-subtab-entregas');
    if (btnConcServ && btnConcRet && btnConcEnt) {
      const setConcSubtabActive = (activeBtn, tabKey) => {
        currentConcluidosSubtab = tabKey;
        [btnConcServ, btnConcRet, btnConcEnt].forEach(btn => {
          if (btn === activeBtn) {
            btn.classList.add('active');
            btn.style.background = '#ffffff';
            btn.style.color = '#0f172a';
            btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
          } else {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.boxShadow = 'none';
          }
        });
        renderListaOS('concluido');
      };
      btnConcServ.addEventListener('click', () => setConcSubtabActive(btnConcServ, 'servicos'));
      btnConcRet.addEventListener('click', () => setConcSubtabActive(btnConcRet, 'retiradas'));
      btnConcEnt.addEventListener('click', () => setConcSubtabActive(btnConcEnt, 'entregas'));
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

    // Se for motorista (ex: Timóteo), direciona direto para a visão de Retiradas
    if (isMotoristaUser()) {
      setTimeout(() => {
        navigateTo('motorista-retiradas');
      }, 100);
    }
  }

  function navigateTo(page) {
    const isMotorista = isMotoristaUser();

    // Restrição estrita de navegação para o perfil de Motorista (Timóteo)
    if (isMotorista && page !== 'motorista-retiradas') {
      navigateTo('motorista-retiradas');
      return;
    }

    // Alerta de confirmação ao tentar sair de um Orçamento com dados preenchidos
    if (currentPage === 'nova-os' && page !== 'nova-os' && isNovaOSFormDirty() && !formSalvoComSucesso) {
      if (!confirm('⚠️ Você possui alterações não salvas no orçamento.\n\nDeseja realmente sair e descartar as informações?')) {
        return;
      }
    }
    formSalvoComSucesso = false;

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
      case 'motorista-retiradas':
        renderMotoristaRetiradas();
        updateNavBadges();
        break;
      case 'motorista-entregas':
        renderMotoristaEntregas();
        updateNavBadges();
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
    const headerToggle = document.getElementById('tray-header-toggle');
    const bodyContent = document.getElementById('tray-body-content');
    const chevron = document.getElementById('tray-chevron');

    if (headerToggle && bodyContent) {
      headerToggle.onclick = () => {
        const isHidden = bodyContent.style.display === 'none' || !bodyContent.style.display;
        bodyContent.style.display = isHidden ? 'block' : 'none';
        if (chevron) {
          chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      };
    }

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
      'os-detail': 'Detalhes da OS',
      'motorista-retiradas': 'Retiradas de Veículos',
      'motorista-entregas': 'Entregas de Veículos'
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
    const isMotorista = isMotoristaUser();

    document.querySelectorAll('.nav-item').forEach(item => {
      const page = item.dataset.page;
      if (isMotorista) {
        if (page === 'motorista-retiradas') {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      } else {
        if (page === 'nova-os') {
          item.style.display = temPermissao('criar_os') ? 'flex' : 'none';
        } else {
          item.style.display = 'flex';
        }
      }
    });

    updateHeaderButtons();
  }

  function renderCurrentList() {
    if (currentPage === 'motorista-retiradas') {
      renderMotoristaRetiradas();
      updateNavBadges();
      return;
    }
    if (currentPage === 'motorista-entregas') {
      renderMotoristaEntregas();
      updateNavBadges();
      return;
    }
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

    let ordens = Storage.getOrdensByStatus(status);
    if (status === 'aguardando') {
      ordens = ordens.filter(o => o.status === 'aguardando' && o.status !== 'retirada_pendente');
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

    // Render Especial para Concluídos (Histórico por Sub-abas & Seção Temporal)
    if (status === 'concluido') {
      const todasOrdens = Storage.getOrdens().filter(o => !o.deletado);
      const cServicos = todasOrdens.filter(o => o.status === 'concluido' && o.tipo !== 'retirada');
      const cRetiradas = todasOrdens.filter(o => o.status === 'convertida' || o.status === 'coletado' || (o.tipo === 'retirada' && o.status === 'concluido'));
      const cEntregas = todasOrdens.filter(o => o.status === 'entregue' || o.statusEntrega === 'entregue');

      const elConcServ = document.getElementById('count-conc-servicos');
      if (elConcServ) elConcServ.textContent = cServicos.length;
      const elConcRet = document.getElementById('count-conc-retiradas');
      if (elConcRet) elConcRet.textContent = cRetiradas.length;
      const elConcEnt = document.getElementById('count-conc-entregas');
      if (elConcEnt) elConcEnt.textContent = cEntregas.length;

      let listConcluidosToRender = cServicos;
      if (currentConcluidosSubtab === 'retiradas') listConcluidosToRender = cRetiradas;
      if (currentConcluidosSubtab === 'entregas') listConcluidosToRender = cEntregas;

      if (countEl) countEl.textContent = listConcluidosToRender.length;

      if (listConcluidosToRender.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:10px;">📋</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">Nenhum item concluído nesta categoria</div>
            <div style="font-size:13px; color:var(--text-tertiary);">Os itens finalizados aparecerão aqui para consulta.</div>
          </div>
        `;
        return;
      }

      const groupsMap = {};
      listConcluidosToRender.forEach(os => {
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
              ${visibleOrdens.map(os => {
                let cardHtml = renderOSCard(os);
                if (currentConcluidosSubtab === 'servicos' && os.status === 'concluido' && os.status !== 'entregue' && os.statusEntrega !== 'pendente') {
                  cardHtml = cardHtml.replace('</div>\n      </div>', `
                    <div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:10px;">
                      <button type="button" class="btn btn-secondary btn-sm btn-agendar-entrega-card" data-id="${os.id}" style="width:100%; font-weight:700; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#10b981; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">
                        📦 Agendar Entrega ao Cliente
                      </button>
                    </div>
                  </div>\n      </div>`);
                } else if (os.statusEntrega === 'pendente') {
                  cardHtml = cardHtml.replace('</div>\n      </div>', `
                    <div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:10px; text-align:center;">
                      <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:800; padding:6px 12px; border-radius:8px;">📦 Entrega Agendada (${os.motoristaEntrega || 'Motorista'})</span>
                    </div>
                  </div>\n      </div>`);
                }
                return cardHtml;
              }).join('')}
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

      container.querySelectorAll('.btn-agendar-entrega-card').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          openModalAgendarEntrega(btn.dataset.id);
        };
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

    container.querySelectorAll('.btn-coletar-assinatura').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openModalColetarAssinatura(btn.dataset.id); });
    });
  }

  // ---------- RENDERS EXCLUSIVOS DO MOTORISTA ----------

  function renderMotoristaRetiradas() {
    const container = document.getElementById('list-motorista-retiradas');
    if (!container) return;

    const ordens = Storage.getOrdens();
    const todasRetiradas = ordens.filter(o => {
      if (o.deletado) return false;
      const isRetiradaType = o.tipo === 'retirada' || (o.id && o.id.startsWith('RET-')) || o.status === 'retirada_pendente';
      const hasRetiradaServico = Array.isArray(o.servicos) && o.servicos.some(s => s && s.descricao && s.descricao.toLowerCase().includes('retirada'));
      return isRetiradaType || hasRetiradaServico;
    });

    const pendentes = todasRetiradas.filter(o => o.status !== 'convertida' && o.status !== 'coletado' && o.status !== 'entregue' && o.status !== 'concluido');
    const concluidas = todasRetiradas.filter(o => o.status === 'convertida' || o.status === 'coletado');

    const countPend = document.getElementById('count-mot-ret-pendentes');
    if (countPend) countPend.textContent = pendentes.length;
    const countConc = document.getElementById('count-mot-ret-concluidas');
    if (countConc) countConc.textContent = concluidas.length;
    const countHeader = document.getElementById('count-motorista-retiradas');
    if (countHeader) countHeader.textContent = pendentes.length;

    setBadge('badge-motorista-retiradas', pendentes.length);

    const searchInput = document.getElementById('search-motorista-retiradas');
    const qClean = searchInput && searchInput.value ? Utils.removerAcentos(searchInput.value.trim().toLowerCase()) : '';

    let listToRender = currentMotoristaRetSubtab === 'concluidas' ? concluidas : pendentes;

    if (qClean) {
      listToRender = listToRender.filter(o =>
        Utils.removerAcentos(o.id || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteNome || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteEndereco || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.modeloVeiculo || '').toLowerCase().includes(qClean)
      );
    }

    if (listToRender.length === 0) {
      if (currentMotoristaRetSubtab === 'concluidas') {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:10px;">✅</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">Nenhuma retirada concluída ainda</div>
            <div style="font-size:13px; color:var(--text-tertiary);">As retiradas finalizadas aparecerão nesta aba para sua consulta.</div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:10px;">🚚</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">Nenhuma retirada pendente no momento</div>
            <div style="font-size:13px; color:var(--text-tertiary);">Todas as coletas de veículos estão em dia. Quando houver novos agendamentos, eles aparecerão aqui.</div>
          </div>
        `;
      }
      return;
    }

    let html = '';
    listToRender.forEach(os => {
      const isConcluida = os.status === 'convertida' || os.status === 'coletado';
      const statusLabel = isConcluida 
        ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:11px; padding:4px 8px; font-weight:700; border:1px solid rgba(34,197,94,0.4);">✅ Coletado</span>`
        : (os.assinaturaCliente ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:11px; padding:4px 8px; font-weight:700; border:1px solid rgba(34,197,94,0.4);">✅ Assinado</span>` : `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px; padding:4px 8px; font-weight:700;">⚠️ Aguardando</span>`);

      const borderCol = isConcluida ? '#22c55e' : '#f59e0b';

      html += `
        <div class="os-card" style="border-left:4px solid ${borderCol}; background:var(--bg-surface); padding:16px; border-radius:14px; border-top:1px solid var(--glass-border); border-right:1px solid var(--glass-border); border-bottom:1px solid var(--glass-border);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <div style="font-weight:800; font-size:1.1rem; color:${borderCol};">${os.id}</div>
              <div style="font-weight:800; font-size:16px; color:var(--text-primary); margin-top:2px;">👤 ${Utils.escapeHtml(os.clienteNome)}</div>
              ${os.clienteTelefone ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">📞 ${Utils.formatarTelefone(os.clienteTelefone)}</div>` : ''}
              ${os.clienteEndereco ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">📍 ${Utils.escapeHtml(os.clienteEndereco)}</div>` : ''}
              <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                🛵 <strong>${Utils.escapeHtml(os.modeloVeiculo || 'Veículo')}</strong> (${Utils.escapeHtml(os.corVeiculo || 'Cor')})
              </div>
            </div>
            <div style="text-align:right;">
              ${statusLabel}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
            <button type="button" class="btn btn-secondary btn-sm btn-coletar-assinatura-retirada" data-id="${os.id}" style="font-weight:700; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
              ✍️ ${os.assinaturaCliente ? 'Reassinar' : 'Assinar Cliente'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-fotos-retirada-card" data-id="${os.id}" style="font-weight:700; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
              📷 Fotos ${os.temFotos && os.fotos.length ? `(${os.fotos.length})` : ''}
            </button>
            ${isConcluida ? `
              <div style="grid-column:span 2; display:flex; flex-direction:column; gap:8px;">
                <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#15803d; font-weight:700; text-align:center; padding:10px; border-radius:8px; font-size:13px;">
                  ✅ Retirada Concluída (Coletado)
                </div>
                ${!isMotoristaUser() ? `
                  <button type="button" class="btn btn-primary btn-sm btn-converter-retirada-os" data-id="${os.id}" style="background:#8b5cf6; border-color:#8b5cf6; color:#fff; font-weight:700; padding:12px; font-size:13px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:8px;">
                    📋 Criar OS para Mecânicos
                  </button>
                ` : ''}
              </div>
            ` : `
              <button type="button" class="btn btn-primary btn-sm btn-confirmar-retirada" data-id="${os.id}" style="background:#2563eb; border-color:#2563eb; color:#fff; font-weight:700; grid-column:span 2; padding:12px; font-size:13px;">
                ✅ Concluir Retirada (Coletado)
              </button>
              ${!isMotoristaUser() ? `
                <button type="button" class="btn btn-secondary btn-sm btn-converter-retirada-os" data-id="${os.id}" style="font-weight:700; grid-column:span 2; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; color:#8b5cf6; border-color:rgba(139,92,246,0.3);">
                  📋 Criar OS para Mecânicos
                </button>
              ` : ''}
            `}
          </div>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-coletar-assinatura-retirada').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const os = Storage.getOrdemById(btn.dataset.id);
        if (os) openModalAssinaturaRetirada(os, false, false);
      };
    });

  // ---------- RENDERS UNIFICADOS DE LOGÍSTICA (RETIRADAS & ENTREGAS) ----------

  function renderMotoristaRetiradas() {
    const container = document.getElementById('list-motorista-retiradas');
    if (!container) return;

    const ordens = Storage.getOrdens().filter(o => !o.deletado);

    // Retiradas: coletas no cliente
    const retiradasPendentes = ordens.filter(o => {
      const isRetiradaType = o.tipo === 'retirada' || (o.id && o.id.startsWith('RET-')) || o.status === 'retirada_pendente';
      const hasRetiradaServ = Array.isArray(o.servicos) && o.servicos.some(s => s && s.descricao && s.descricao.toLowerCase().includes('retirada'));
      return (isRetiradaType || hasRetiradaServ) && o.status !== 'convertida' && o.status !== 'coletado' && o.status !== 'entregue' && o.status !== 'concluido';
    });

    // Entregas: devoluções ao cliente
    const entregasPendentes = ordens.filter(o => {
      return (o.tipo === 'entrega' || o.statusEntrega === 'pendente' || (o.temDataEntrega && o.status === 'concluido')) && o.status !== 'entregue' && o.statusEntrega !== 'entregue';
    });

    // Unificado
    const pendentes = [...retiradasPendentes, ...entregasPendentes];

    const retiradasConcluidas = ordens.filter(o => o.status === 'convertida' || o.status === 'coletado');
    const entregasConcluidas = ordens.filter(o => o.status === 'entregue' || o.statusEntrega === 'entregue');
    const concluidas = [...retiradasConcluidas, ...entregasConcluidas];

    const countPend = document.getElementById('count-mot-ret-pendentes');
    if (countPend) countPend.textContent = pendentes.length;
    const countConc = document.getElementById('count-mot-ret-concluidas');
    if (countConc) countConc.textContent = concluidas.length;
    const countHeader = document.getElementById('count-motorista-retiradas');
    if (countHeader) countHeader.textContent = pendentes.length;

    setBadge('badge-motorista-retiradas', pendentes.length);

    const searchInput = document.getElementById('search-motorista-retiradas');
    const qClean = searchInput && searchInput.value ? Utils.removerAcentos(searchInput.value.trim().toLowerCase()) : '';

    let listToRender = currentMotoristaRetSubtab === 'concluidas' ? concluidas : pendentes;

    if (qClean) {
      listToRender = listToRender.filter(o =>
        Utils.removerAcentos(o.id || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteNome || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.clienteEndereco || '').toLowerCase().includes(qClean) ||
        Utils.removerAcentos(o.modeloVeiculo || '').toLowerCase().includes(qClean)
      );
    }

    if (listToRender.length === 0) {
      if (currentMotoristaRetSubtab === 'concluidas') {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:10px;">✅</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">Nenhuma retirada ou entrega concluída ainda</div>
            <div style="font-size:13px; color:var(--text-tertiary);">O histórico de coletas e devoluções finalizadas aparecerá aqui.</div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:10px;">🚚</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:4px;">Nenhuma tarefa de logística pendente</div>
            <div style="font-size:13px; color:var(--text-tertiary);">Coletas e entregas agendadas aparecerão aqui em tempo real.</div>
          </div>
        `;
      }
      return;
    }

    let html = '';
    listToRender.forEach(os => {
      const isEntregaItem = os.tipo === 'entrega' || os.statusEntrega === 'pendente' || os.status === 'entregue' || (os.temDataEntrega && os.status === 'concluido');
      const isConcluida = os.status === 'convertida' || os.status === 'coletado' || os.status === 'entregue' || os.statusEntrega === 'entregue';
      const borderCol = isConcluida ? '#22c55e' : (isEntregaItem ? '#10b981' : '#f59e0b');

      const itemBadge = isEntregaItem
        ? `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:800; padding:4px 8px; border:1px solid rgba(16,185,129,0.3);">📦 ENTREGA</span>`
        : `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:800; padding:4px 8px; border:1px solid rgba(245,158,11,0.3);">🚚 RETIRADA</span>`;

      // Check if an OS was already generated for this Retirada
      const osGerada = os.osCriadaId || (Storage.getOrdens().find(o => !o.deletado && o.origemRetiradaId === os.id));
      const osCriadaCode = osGerada ? (typeof osGerada === 'object' ? osGerada.id : osGerada) : null;

      html += `
        <div class="os-card" style="border-left:4px solid ${borderCol}; background:var(--bg-surface); padding:16px; border-radius:14px; border-top:1px solid var(--glass-border); border-right:1px solid var(--glass-border); border-bottom:1px solid var(--glass-border);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-weight:800; font-size:1.1rem; color:${borderCol};">${os.id}</span>
                ${itemBadge}
              </div>
              <div style="font-weight:800; font-size:16px; color:var(--text-primary); margin-top:2px;">👤 ${Utils.escapeHtml(os.clienteNome)}</div>
              ${os.clienteTelefone ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">📞 ${Utils.formatarTelefone(os.clienteTelefone)}</div>` : ''}
              ${os.clienteEndereco ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">📍 ${Utils.escapeHtml(os.clienteEndereco)}</div>` : ''}
              <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                🛵 <strong>${Utils.escapeHtml(os.modeloVeiculo || 'Veículo')}</strong> (${Utils.escapeHtml(os.corVeiculo || 'Cor')})
              </div>
            </div>
            <div style="text-align:right;">
              ${isConcluida ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:11px; padding:4px 8px; font-weight:700; border:1px solid rgba(34,197,94,0.4);">✅ Concluído</span>` : (os.assinaturaCliente || os.assinaturaEntrega ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:11px; padding:4px 8px; font-weight:700; border:1px solid rgba(34,197,94,0.4);">✅ Assinado</span>` : `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px; padding:4px 8px; font-weight:700;">⚠️ Aguardando</span>`)}
            </div>
          </div>

          <div style="margin-top:10px; padding:10px; background:var(--bg-surface-secondary); border-radius:10px; border:1px solid var(--glass-border);">
            <div style="font-size:12px; font-weight:800; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
              <span>🎒 Itens Entregues pelo Cliente:</span>
              <span style="font-size:10px; color:var(--text-tertiary); font-weight:500;">(Checklist de Coleta)</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="chk-item-retirada" data-id="${os.id}" data-field="deixouChave" ${os.deixouChave ? 'checked' : ''} ${isConcluida ? 'disabled' : ''}>
                🔑 Chaves
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="chk-item-retirada" data-id="${os.id}" data-field="deixouControle" ${os.deixouControle ? 'checked' : ''} ${isConcluida ? 'disabled' : ''}>
                🎮 Controles
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="chk-item-retirada" data-id="${os.id}" data-field="deixouCarregador" ${os.deixouCarregador ? 'checked' : ''} ${isConcluida ? 'disabled' : ''}>
                🔌 Carregador
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="chk-item-retirada" data-id="${os.id}" data-field="deixouDocumento" ${os.deixouDocumento ? 'checked' : ''} ${isConcluida ? 'disabled' : ''}>
                📄 Documentos
              </label>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
            <button type="button" class="btn btn-secondary btn-sm btn-coletar-assinatura-retirada" data-id="${os.id}" data-entrega="${isEntregaItem ? '1' : '0'}" style="font-weight:700; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
              ✍️ ${(os.assinaturaCliente || os.assinaturaEntrega) ? 'Reassinar' : 'Assinar Cliente'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-fotos-retirada-card" data-id="${os.id}" style="font-weight:700; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;">
              📷 Fotos ${os.temFotos && os.fotos.length ? `(${os.fotos.length})` : ''}
            </button>

            ${isConcluida ? `
              <div style="grid-column:span 2; display:flex; flex-direction:column; gap:8px;">
                <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#15803d; font-weight:700; text-align:center; padding:10px; border-radius:8px; font-size:13px;">
                  ✅ ${isEntregaItem ? 'Entrega Concluída (Entregue)' : 'Retirada Concluída (Coletado)'}
                </div>
                ${(!isEntregaItem && !isMotoristaUser()) ? (
                  osCriadaCode ? `
                    <div style="background:rgba(139,92,246,0.12); color:#8b5cf6; font-weight:800; text-align:center; padding:10px; border-radius:8px; font-size:13px; border:1px solid rgba(139,92,246,0.3);">
                      ✅ Orçamento / OS Criado (${osCriadaCode})
                    </div>
                  ` : `
                    <button type="button" class="btn btn-primary btn-sm btn-converter-retirada-os" data-id="${os.id}" style="background:#8b5cf6; border-color:#8b5cf6; color:#fff; font-weight:700; padding:12px; font-size:13px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:8px;">
                      📋 Criar OS para Mecânicos
                    </button>
                  `
                ) : ''}
              </div>
            ` : `
              <button type="button" class="btn btn-primary btn-sm btn-confirmar-retirada" data-id="${os.id}" data-entrega="${isEntregaItem ? '1' : '0'}" style="background:${isEntregaItem ? '#10b981' : '#2563eb'}; border-color:${isEntregaItem ? '#10b981' : '#2563eb'}; color:#fff; font-weight:700; grid-column:span 2; padding:12px; font-size:13px;">
                ✅ ${isEntregaItem ? 'Concluir Entrega (Entregue)' : 'Concluir Retirada (Coletado)'}
              </button>
            `}
          </div>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.chk-item-retirada').forEach(chk => {
      chk.onchange = (e) => {
        e.stopPropagation();
        const id = chk.dataset.id;
        const field = chk.dataset.field;
        const isChecked = chk.checked;
        Storage.updateOrdem(id, { [field]: isChecked, atualizadoEm: new Date().toISOString() });
        showToast(`Item ${isChecked ? 'marcado' : 'desmarcado'} com sucesso!`, 'info');
      };
    });

    container.querySelectorAll('.btn-coletar-assinatura-retirada').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const os = Storage.getOrdemById(btn.dataset.id);
        const isEnt = btn.dataset.entrega === '1';
        if (os) openModalAssinaturaRetirada(os, false, isEnt);
      };
    });

    container.querySelectorAll('.btn-fotos-retirada-card').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const os = Storage.getOrdemById(btn.dataset.id);
        if (os) openModalFotosRetirada(os);
      };
    });

    container.querySelectorAll('.btn-confirmar-retirada').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const isEnt = btn.dataset.entrega === '1';
        if (isEnt) {
          confirmarEntregaMotorista(btn.dataset.id);
        } else {
          confirmarRetiradaParaServico(btn.dataset.id);
        }
      };
    });

    container.querySelectorAll('.btn-converter-retirada-os').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const osData = Storage.getOrdemById(btn.dataset.id);
        if (osData) {
          navigateTo('nova-os');
          renderNovaOS(osData, true);
        }
      };
    });
  }

  function confirmarEntregaMotorista(id) {
    const os = Storage.getOrdemById(id);
    if (!os) return;
    Storage.updateOrdem(id, { status: 'entregue', statusEntrega: 'entregue', dataEntregaRealizada: new Date().toISOString() });
    Storage.addHistorico(id, 'Entrega Concluída ao Cliente', currentUser ? currentUser.nome : 'Motorista');
    showToast(`Entrega da OS ${id} concluída com sucesso!`, 'success');
    renderMotoristaRetiradas();
    updateNavBadges();
  }

    container.querySelectorAll('.btn-coletar-assinatura-entrega').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const os = Storage.getOrdemById(btn.dataset.id);
        if (os) openModalAssinaturaRetirada(os, false, true);
      };
    });

    container.querySelectorAll('.btn-fotos-retirada-card').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const os = Storage.getOrdemById(btn.dataset.id);
        if (os) openModalFotosRetirada(os);
      };
    });

    container.querySelectorAll('.btn-confirmar-entrega-motorista').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        confirmarEntregaMotorista(btn.dataset.id);
      };
    });
  }

  function confirmarEntregaMotorista(id) {
    const os = Storage.getOrdemById(id);
    if (!os) return;
    Storage.updateOrdem(id, {
      status: 'entregue',
      statusPagamento: 'pago',
      entregueEm: new Date().toISOString(),
      entreguePor: currentUser ? currentUser.nome : 'Motorista'
    });
    showToast(`Entrega da OS ${id} concluída com sucesso!`, 'success');
    renderMotoristaEntregas();
    updateNavBadges();
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
          <label class="form-label required">Endereço</label>
          <input type="text" class="form-input" id="retirada-edit-endereco" placeholder="Rua, número, bairro, cidade" required>
        </div>

        <div class="section-divider">Dados do Veículo & Mecânico</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Modelo</label>
            <select class="form-select" id="retirada-edit-modelo" required>
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

        <div class="form-group">
          <label class="form-label">Taxa de Retirada (R$)</label>
          <input type="text" class="form-input" id="retirada-edit-taxa" value="R$ 0,00">
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

        ${existingOS ? `
          <div style="margin-top:14px; padding-top:10px; border-top:1px dashed var(--glass-border);">
            <button type="button" class="btn btn-danger btn-block" id="btn-modal-retirada-excluir" style="background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.3); color:#ef4444; font-weight:700; padding:10px;">
              🗑️ Excluir Ordem de Retirada (${existingOS.id})
            </button>
          </div>
        ` : ''}
      </form>
    `;

    openModal(existingOS ? `Editar ${existingOS.id}` : 'Nova Ordem de Retirada', bodyHtml, () => {
      const form = document.getElementById('form-nova-retirada');
      if (!form.checkValidity()) { form.reportValidity(); return false; }

      const endVal = (document.getElementById('retirada-edit-endereco')?.value || '').trim();
      const modVal = (document.getElementById('retirada-edit-modelo')?.value || '').trim();
      if (!endVal || !modVal) {
        showToast('⚠️ Por favor, informe o Endereço e o Modelo do Veículo!', 'error');
        if (!endVal) document.getElementById('retirada-edit-endereco').focus();
        else if (!modVal) document.getElementById('retirada-edit-modelo').focus();
        return false;
      }

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
        valorRetirada: Utils.formatarMoedaDigitada(document.getElementById('retirada-edit-taxa').value),
        taxaEntrega: 'R$ 0,00',
        deixouChave: existingOS ? existingOS.deixouChave : false,
        qtdChave: existingOS ? existingOS.qtdChave : 0,
        deixouControle: existingOS ? existingOS.deixouControle : false,
        qtdControle: existingOS ? existingOS.qtdControle : 0,
        deixouCarregador: existingOS ? existingOS.deixouCarregador : false,
        deixouDocumento: existingOS ? existingOS.deixouDocumento : false,
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

    // Bind smart left-to-right currency mask for Taxa de Retirada
    setTimeout(() => {
      const elTaxa = document.getElementById('retirada-edit-taxa');
      if (elTaxa) Utils.aplicarMascaraMoedaInput(elTaxa);

      // Toggle handlers for quantity boxes (Chaves & Controles)
      const cbChave = document.getElementById('retirada-edit-chave');
      const boxChave = document.getElementById('container-qtd-chave');
      if (cbChave && boxChave) {
        cbChave.addEventListener('change', () => {
          boxChave.style.display = cbChave.checked ? 'block' : 'none';
        });
      }

      const cbControle = document.getElementById('retirada-edit-controle');
      const boxControle = document.getElementById('container-qtd-controle');
      if (cbControle && boxControle) {
        cbControle.addEventListener('change', () => {
          boxControle.style.display = cbControle.checked ? 'block' : 'none';
        });
      }
    }, 50);

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
        if (el('retirada-edit-taxa')) el('retirada-edit-taxa').value = Utils.formatarMoedaDigitada(existingOS.valorRetirada || '0');
        if (el('retirada-edit-chave')) {
          el('retirada-edit-chave').checked = !!existingOS.deixouChave;
          const boxChave = document.getElementById('container-qtd-chave');
          if (boxChave) boxChave.style.display = existingOS.deixouChave ? 'block' : 'none';
        }
        if (el('retirada-edit-qtd-chave')) el('retirada-edit-qtd-chave').value = existingOS.qtdChave || 1;
        if (el('retirada-edit-controle')) {
          el('retirada-edit-controle').checked = !!existingOS.deixouControle;
          const boxControle = document.getElementById('container-qtd-controle');
          if (boxControle) boxControle.style.display = existingOS.deixouControle ? 'block' : 'none';
        }
        if (el('retirada-edit-qtd-controle')) el('retirada-edit-qtd-controle').value = existingOS.qtdControle || 1;
        if (el('retirada-edit-carregador')) el('retirada-edit-carregador').checked = !!existingOS.deixouCarregador;
        if (el('retirada-edit-documento')) el('retirada-edit-documento').checked = !!existingOS.deixouDocumento;
        if (el('retirada-edit-obs')) el('retirada-edit-obs').value = existingOS.observacoes || '';

        const btnExcluirModal = el('btn-modal-retirada-excluir');
        if (btnExcluirModal && existingOS) {
          btnExcluirModal.onclick = () => {
            if (confirm(`Tem certeza que deseja excluir a Ordem de Retirada ${existingOS.id}?`)) {
              Storage.deleteOrdem(existingOS.id, currentUser ? currentUser.nome : 'Sistema');
              showToast(`Ordem ${existingOS.id} excluída com sucesso!`, 'info');
              closeModal();
              renderListaOS('aguardando');
              updateDashboard();
            }
          };
        }
      }, 50);
    }
  }

  function updateNavBadges() {
    const ordens = Storage.getOrdens();

    const motoristaRetiradasCount = ordens.filter(o => {
      if (o.deletado) return false;
      if (o.status === 'entregue' || o.status === 'concluido' || o.status === 'convertida' || o.status === 'coletado') return false;
      const isRetiradaType = o.tipo === 'retirada' || (o.id && o.id.startsWith('RET-')) || o.status === 'retirada_pendente';
      const hasRetiradaServico = Array.isArray(o.servicos) && o.servicos.some(s => s && s.descricao && s.descricao.toLowerCase().includes('retirada'));
      return isRetiradaType || hasRetiradaServico;
    }).length;

    const motoristaEntregasCount = ordens.filter(o => {
      if (o.deletado) return false;
      return (o.status === 'concluido' || o.temDataEntrega) && o.status !== 'entregue';
    }).length;

    const normalAguardando = ordens.filter(o => {
      if (o.deletado) return false;
      return o.status === 'aguardando' && o.status !== 'retirada_pendente';
    }).length;

    const andamento = ordens.filter(o => !o.deletado && o.status === 'em_andamento').length;
    const concluido = ordens.filter(o => !o.deletado && o.status === 'concluido').length;

    setBadge('badge-servicos', normalAguardando);
    setBadge('badge-andamento', andamento);
    setBadge('badge-concluidos', concluido);
    setBadge('badge-motorista-retiradas', motoristaRetiradasCount);
    setBadge('badge-motorista-entregas', motoristaEntregasCount);

    setSubtabBadge('subtab-retirada-badge', motoristaRetiradasCount);
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
    const canExcluir = temPermissao('configuracoes') || temPermissao('excluir_os');

    let fotosBadgeHtml = '';
    if (os.temFotos && Array.isArray(os.fotos) && os.fotos.length > 0) {
      fotosBadgeHtml = `<span class="badge" style="background:rgba(139,92,246,0.15); color:var(--accent); border:1px solid rgba(139,92,246,0.3); display:inline-flex; align-items:center; gap:4px; font-size:var(--font-xs); padding:2px 7px; border-radius:var(--radius-full); font-weight:700;">
        <img src="${os.fotos[0]}" style="width:14px; height:14px; border-radius:3px; object-fit:cover;">
        📷 ${os.fotos.length} foto${os.fotos.length > 1 ? 's' : ''}
      </span>`;
    }

    let actionsHtml = '';
    if (canAssumir) {
      actionsHtml += `<button class="btn btn-blue btn-xs os-card-action-btn btn-assumir" data-id="${os.id}" style="background:#2563eb; border-color:#2563eb; color:#ffffff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        Assumir
      </button>`;
    }
    if (canDelegar) {
      actionsHtml += `<button class="btn btn-secondary btn-xs os-card-action-btn btn-delegar" data-id="${os.id}" style="margin-left:4px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>
        Delegar
      </button>`;
    }
    if (os.status === 'em_andamento') {
      actionsHtml += `<button class="btn btn-secondary btn-xs os-card-action-btn btn-pdf-os-card" data-id="${os.id}" title="Baixar Ordem de Serviço (PDF)" style="font-weight:700; margin-left:4px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        PDF
      </button>`;
      actionsHtml += `<button class="btn btn-secondary btn-xs os-card-action-btn btn-coletar-assinatura" data-id="${os.id}" style="margin-left:4px;" title="Coletar Assinatura do Cliente">
        ✍️ Assinar
      </button>`;
    }
    if (canConcluir) {
      actionsHtml += `<button class="btn btn-blue btn-xs os-card-action-btn btn-concluir" data-id="${os.id}" style="margin-left:4px; background:#2563eb; border-color:#2563eb; color:#ffffff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Concluir
      </button>`;
    }
    if (canExcluir && os.status !== 'aguardando') {
      actionsHtml += `<button class="btn btn-secondary btn-xs os-card-action-btn btn-excluir-os-card" data-id="${os.id}" style="margin-left:4px; color:#ef4444; border-color:rgba(239,68,68,0.3);" title="Excluir OS">🗑️ Excluir</button>`;
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
            ${os.assinaturaCliente ? `<span class="badge badge-assinatura-ok" title="Assinado em ${new Date(os.dataAssinatura).toLocaleString('pt-BR')}">✅ Assinado</span>` : ''}
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

  function openModalFotosRetirada(os) {
    let tempFotos = [...(os.fotos || [])];
    const bodyHtml = `
      <div style="margin-bottom:12px; font-size:13px; color:var(--text-secondary);">
        Anexe ou tire fotos do veículo para a Retirada <strong>${os.id}</strong>:
      </div>
      <input type="file" id="modal-foto-camera" accept="image/*" capture="environment" multiple style="display:none;">
      <input type="file" id="modal-foto-galeria" accept="image/*" multiple style="display:none;">
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <button type="button" class="btn btn-secondary" id="btn-modal-camera" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
          📷 Câmera
        </button>
        <button type="button" class="btn btn-secondary" id="btn-modal-galeria" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
          🖼️ Galeria
        </button>
      </div>
      <div id="modal-fotos-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; min-height:60px;"></div>
    `;

    openModal(`Fotos - Retirada ${os.id}`, bodyHtml, () => {
      Storage.updateOrdem(os.id, { fotos: tempFotos, temFotos: tempFotos.length > 0 });
      showToast(`${tempFotos.length} foto(s) salva(s) na Retirada!`, 'success');
      renderListaOS('aguardando');
      return true;
    });

    setTimeout(() => {
      const grid = document.getElementById('modal-fotos-grid');
      const inputCam = document.getElementById('modal-foto-camera');
      const inputGal = document.getElementById('modal-foto-galeria');
      const btnCam = document.getElementById('btn-modal-camera');
      const btnGal = document.getElementById('btn-modal-galeria');

      const renderGrid = () => {
        if (!grid) return;
        if (tempFotos.length === 0) {
          grid.innerHTML = `<div style="grid-column:span 4; text-align:center; padding:16px; font-size:12px; color:var(--text-tertiary);">Nenhuma foto anexada.</div>`;
          return;
        }
        grid.innerHTML = tempFotos.map((f, idx) => `
          <div style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:1px solid var(--glass-border);">
            <img src="${f}" style="width:100%; height:100%; object-fit:cover;">
            <button type="button" data-idx="${idx}" class="btn-del-modal-foto" style="position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
          </div>
        `).join('');

        grid.querySelectorAll('.btn-del-modal-foto').forEach(b => {
          b.onclick = () => {
            tempFotos.splice(parseInt(b.dataset.idx), 1);
            renderGrid();
          };
        });
      };

      const handleFiles = (files) => {
        Array.from(files).forEach(file => {
          if (tempFotos.length >= 8) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            Utils.comprimirFotoBase64(e.target.result, 800, 800, 0.75).then(compressed => {
              tempFotos.push(compressed);
              renderGrid();
            });
          };
          reader.readAsDataURL(file);
        });
      };

      if (btnCam && inputCam) btnCam.onclick = () => inputCam.click();
      if (btnGal && inputGal) btnGal.onclick = () => inputGal.click();
      if (inputCam) inputCam.onchange = (e) => handleFiles(e.target.files);
      if (inputGal) inputGal.onchange = (e) => handleFiles(e.target.files);

      renderGrid();
    }, 50);
  }

  function isCanvasBlank(canvas) {
    if (!canvas) return true;
    const context = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  }

  function initSignatureCanvas() {
    const canvas = document.getElementById('signature-canvas');
    const wrapper = document.getElementById('sig-wrapper');
    const hint = document.getElementById('sig-hint');
    const btnClear = document.getElementById('btn-sig-clear');
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width || 340;
    canvas.height = rect.height || 180;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      return {
        x: clientX - r.left,
        y: clientY - r.top
      };
    }

    function startDrawing(e) {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      if (hint) hint.style.display = 'none';
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      if (hint) hint.style.display = 'none';
    }

    function stopDrawing(e) {
      if (isDrawing) {
        isDrawing = false;
      }
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (hint) hint.style.display = 'block';
      });
    }
  }

  function openModalColetarAssinatura(osId, targetRole = 'cliente') {
    const os = Storage.getOrdemById(osId);
    if (!os) return;
    const isMotorista = targetRole === 'motorista';
    openModalAssinaturaRetirada(os, isMotorista, false);
  }

  function openModalAssinaturaRetirada(os, isMotorista = false, isForDelivery = false) {
    let tituloModal = 'Assinatura do Cliente (Retirada)';
    if (isMotorista) tituloModal = 'Assinatura do Motorista';
    if (isForDelivery) tituloModal = 'Assinatura do Cliente (Entrega)';

    let defaultNome = os.clienteNome || '';
    if (isMotorista) defaultNome = os.mecanico || (currentUser ? currentUser.nome : '');
    if (isForDelivery) defaultNome = os.assinanteEntregaNome || os.clienteNome || '';

    const bodyHtml = `
      <div style="margin-bottom:12px; font-size:var(--font-xs); color:var(--text-secondary); line-height:1.4;">
        Coleta de assinatura digital para a Ordem <strong>${os.id}</strong> (${Utils.escapeHtml(os.clienteNome)})
      </div>

      <div class="form-group">
        <label class="form-label required">Nome do Assinante (${isMotorista ? 'Motorista / Técnico' : 'Cliente'})</label>
        <input type="text" class="form-input" id="sig-input-nome" value="${Utils.escapeHtml(defaultNome)}" placeholder="Nome de quem está assinando">
      </div>

      <div class="signature-box-container">
        <label class="form-label required">Assine com o dedo ou caneta na caixa abaixo:</label>
        <div class="signature-canvas-wrapper" id="sig-wrapper">
          <canvas id="signature-canvas" class="signature-canvas"></canvas>
          <div id="sig-hint" class="signature-canvas-hint">✍️ Desenhe a assinatura aqui</div>
        </div>
        <div class="signature-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-sig-clear">🔄 Limpar Assinatura</button>
        </div>
      </div>
    `;

    openModal(tituloModal, bodyHtml, () => {
      const inputNome = document.getElementById('sig-input-nome');
      const nomeAssinante = inputNome ? inputNome.value.trim() : defaultNome;

      const canvas = document.getElementById('signature-canvas');
      if (!canvas || isCanvasBlank(canvas)) {
        showToast('Por favor, faça a assinatura antes de salvar.', 'error');
        return false;
      }

      const dataUrl = canvas.toDataURL('image/png');
      const dataAssinatura = new Date().toISOString();

      if (isForDelivery) {
        Storage.updateOrdem(os.id, {
          assinaturaEntrega: dataUrl,
          dataAssinaturaEntrega: dataAssinatura,
          assinanteEntregaNome: nomeAssinante
        });
        const userNome = currentUser ? currentUser.nome : 'Motorista';
        Storage.addHistorico(os.id, `Assinatura de entrega coletada por ${userNome}`, userNome);
        showToast('Assinatura de entrega salva com sucesso!', 'success');
        if (currentPage === 'motorista-entregas') renderMotoristaEntregas();
      } else if (isMotorista) {
        Storage.updateOrdem(os.id, {
          assinaturaMotorista: dataUrl,
          dataAssinaturaMotorista: dataAssinatura,
          assinanteMotoristaNome: nomeAssinante
        });
        const userNome = currentUser ? currentUser.nome : 'Motorista';
        Storage.addHistorico(os.id, `Assinatura do motorista (${nomeAssinante}) coletada por ${userNome}`, userNome);
        showToast('Assinatura do motorista salva com sucesso!', 'success');
      } else {
        Storage.updateOrdem(os.id, {
          assinaturaCliente: dataUrl,
          dataAssinatura: dataAssinatura,
          assinanteNome: nomeAssinante
        });
        const userNome = currentUser ? currentUser.nome : 'Motorista';
        Storage.addHistorico(os.id, `Assinatura do cliente coletada por ${userNome}`, userNome);
        showToast('Assinatura do cliente salva com sucesso!', 'success');
        if (currentPage === 'motorista-retiradas') renderMotoristaRetiradas();
      }

      renderListaOS('aguardando');
      renderListaOS('em_andamento');
      renderListaOS('concluido');
      return true;
    });

    setTimeout(() => {
      initSignatureCanvas();
    }, 50);
  }

  function openModalAgendarEntrega(osId) {
    const os = Storage.getOrdemById(osId);
    if (!os) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const html = `
      <div style="padding:10px 0;">
        <div style="font-size:14px; color:var(--text-secondary); margin-bottom:14px;">
          Agende a devolução do veículo para o cliente <strong>${Utils.escapeHtml(os.clienteNome)}</strong> (${Utils.escapeHtml(os.modeloVeiculo || 'Veículo')}).
        </div>

        <form id="form-agendar-entrega" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:var(--text-primary); display:block; margin-bottom:4px;">Data de Entrega *</label>
            <input type="date" id="entrega-modal-data" value="${os.dataEntrega || todayStr}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-surface-secondary); color:var(--text-primary); font-size:14px;">
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; color:var(--text-primary); display:block; margin-bottom:4px;">Hora da Entrega (Opcional)</label>
            <input type="time" id="entrega-modal-hora" value="${os.horaEntrega || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-surface-secondary); color:var(--text-primary); font-size:14px;">
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; color:var(--text-primary); display:block; margin-bottom:4px;">Motorista Responsável</label>
            <select id="entrega-modal-motorista" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg-surface-secondary); color:var(--text-primary); font-size:14px;">
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="background:#10b981; border-color:#10b981; margin-top:8px; padding:12px; font-weight:700; width:100%;">
            📦 Confirmar Agendamento de Entrega
          </button>
        </form>
      </div>
    `;

    openBottomSheet(`📦 Agendar Entrega (${os.id})`, html);
    populateMotoristasSelect('entrega-modal-motorista', os.motoristaEntrega || '');

    const form = document.getElementById('form-agendar-entrega');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const data = document.getElementById('entrega-modal-data').value;
        const hora = document.getElementById('entrega-modal-hora').value;
        const motorista = document.getElementById('entrega-modal-motorista').value;

        Storage.updateOrdem(osId, {
          temDataEntrega: true,
          dataEntrega: data,
          horaEntrega: hora,
          motoristaEntrega: motorista,
          statusEntrega: 'pendente',
          atualizadoEm: new Date().toISOString()
        });

        Storage.addHistorico(osId, `Entrega agendada para ${data} (${motorista || 'Motorista'})`, currentUser ? currentUser.nome : 'Sistema');
        showToast('Entrega agendada com sucesso!', 'success');
        closeModal();
        renderListaOS('concluido');
        renderMotoristaRetiradas();
        updateNavBadges();
      };
    }
  }

  function assumirServico(id) {
    const os = Storage.getOrdemById(id);
    if (!os || os.status !== 'aguardando') return;
    const nowIso = new Date().toISOString();
    Storage.updateOrdem(id, {
      status: 'em_andamento',
      mecanico: currentUser.nome,
      assumidoPor: currentUser.nome,
      dataAssumido: nowIso,
      horaInicio: nowIso
    });
    Storage.addHistorico(id, 'Serviço Assumido pelo Mecânico', currentUser.nome);
    showToast('Serviço assumido com sucesso!', 'success');
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
    Storage.updateOrdem(retiradaId, {
      status: 'coletado',
      dataColetado: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
    Storage.addHistorico(retiradaId, 'Retirada Concluída pelo Motorista (Coletado)', currentUser ? currentUser.nome : 'Motorista');
    showToast(`Retirada ${retiradaId} concluída com sucesso!`, 'success');

    renderMotoristaRetiradas();
    renderListaOS('aguardando');
    updateNavBadges();
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
    populateMecanicosSelect('os-mecanico', osData ? (osData.mecanico || '') : '');

    // Reset payment checkboxes
    document.querySelectorAll('.payment-check').forEach(cb => cb.checked = false);

    // Reset partial payment fields
    const inputEntradaReset = document.getElementById('os-valor-entrada');
    if (inputEntradaReset) {
      inputEntradaReset.value = '';
      Utils.aplicarMascaraMoedaInput(inputEntradaReset);
    }
    document.getElementById('os-status-pagamento').value = 'pendente';

    // Setup payment container toggle: show/hide forma de pagamento based on status
    const statusPagSelect = document.getElementById('os-status-pagamento');
    const containerFormaPag = document.getElementById('container-forma-pagamento');
    const atualizarVisibilidadeForma = () => {
      const val = statusPagSelect ? statusPagSelect.value : 'pendente';
      if (containerFormaPag) containerFormaPag.style.display = (val === 'pendente') ? 'none' : 'block';
    };
    if (statusPagSelect) {
      statusPagSelect.removeEventListener('change', statusPagSelect._pagHandler);
      statusPagSelect._pagHandler = atualizarVisibilidadeForma;
      statusPagSelect.addEventListener('change', statusPagSelect._pagHandler);
    }
    atualizarVisibilidadeForma();

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
      atualizarVisibilidadeForma();
      if (osData.statusPagamento === 'parcial' && inputEntradaReset) {
        inputEntradaReset.value = osData.valorEntrada || '';
      }
      const elPrio = document.getElementById('os-prioridade');
      if (elPrio) elPrio.value = osData.prioridade || 'normal';
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
      // Update visibility after restoring
      atualizarVisibilidadeForma();

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

  function populateMecanicosSelect(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const usuarios = Storage.getUsuarios();
    const cargos = Storage.getCargos();

    let mecanicos = usuarios.filter(u => {
      if (u.exibirNaDelegacao === false) return false;
      const cargo = cargos.find(c => c.id === u.role);
      const cargoNome = (cargo ? cargo.nome : (u.role || '')).toLowerCase();
      return u.role === 'role_mecanico' || u.role === 'mecanico' || cargoNome.includes('mecanic') || cargoNome.includes('mecânic') || cargoNome.includes('tecnico') || cargoNome.includes('técnico');
    });

    if (mecanicos.length === 0) {
      mecanicos = usuarios.filter(u => u.exibirNaDelegacao !== false);
    }
    mecanicos.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    select.innerHTML = '<option value="">Selecione o mecânico (opcional)...</option>' +
      mecanicos.map(u => `<option value="${u.nome}" ${u.nome === selectedValue ? 'selected' : ''}>${u.nome}</option>`).join('');
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

    // Collect payment methods — only required if status is not pendente
    const statusPagamentoVal = document.getElementById('os-status-pagamento').value;
    const formasPagamento = [];
    document.querySelectorAll('.payment-check:checked').forEach(cb => {
      formasPagamento.push(cb.value);
    });
    if (formasPagamento.length === 0 && statusPagamentoVal !== 'pendente') {
      showToast('Selecione pelo menos uma forma de pagamento', 'error');
      return;
    }
    // Se pendente sem forma selecionada, usa ['pendente'] como placeholder
    if (formasPagamento.length === 0) formasPagamento.push('pendente');

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

    const elMecanico = document.getElementById('os-mecanico');
    const mecanico = (elMecanico && elMecanico.value) ? elMecanico.value : (editingOS ? editingOS.mecanico : null);

    const checkFotos = document.getElementById('os-check-fotos');
    const temFotos = checkFotos ? checkFotos.checked : false;
    const fotos = temFotos ? [...fotosAnexadas] : [];

    const elEndereco = document.getElementById('os-endereco');
    const elCpf = document.getElementById('os-cpf');
    const elPrioridade = document.getElementById('os-prioridade');
    const elModelo = document.getElementById('os-modelo');
    const elCor = document.getElementById('os-cor');
    const elObs = document.getElementById('os-observacoes');
    const elNome = document.getElementById('os-cliente-nome');
    const elTel = document.getElementById('os-telefone');

    const osData = {
      tipo: isVisitaTecnicaForm ? 'visita_tecnica' : (editingOS ? (editingOS.tipo || 'os') : 'os'),
      clienteNome: elNome ? elNome.value.trim() : '',
      clienteTelefone: elTel ? elTel.value.trim() : '',
      clienteCpf: elCpf ? elCpf.value.trim() : '',
      clienteEndereco: elEndereco ? elEndereco.value.trim() : '',
      modeloVeiculo: elModelo ? elModelo.value : '',
      corVeiculo: elCor ? elCor.value : '',
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
      prioridade: elPrioridade ? elPrioridade.value : (editingOS ? (editingOS.prioridade || 'normal') : 'normal'),
      status: editingOS ? editingOS.status : 'aguardando',
      atendente: editingOS ? editingOS.atendente : (currentUser ? currentUser.nome : 'Atendente'),
      mecanico,
      observacoes: elObs ? elObs.value.trim() : '',
      camposPersonalizados,
      horaInicio: editingOS ? editingOS.horaInicio : null,
      horaFim: editingOS ? editingOS.horaFim : null,
      tempoTotal: editingOS ? editingOS.tempoTotal : null,
      criadoPor: editingOS ? editingOS.criadoPor : (currentUser ? currentUser.nome : 'Sistema'),
      criadoEm: editingOS ? editingOS.criadoEm : new Date().toISOString(),
      editadoPor: editingOS ? (currentUser ? currentUser.nome : 'Sistema') : null,
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
        Storage.updateOrdem(origemRetiradaId, { status: 'convertida', osCriadaId: saved.id, atualizadoEm: new Date().toISOString() });
        showToast(`Retirada ${origemRetiradaId} convertida em Ordem de Serviço ${saved.id}!`, 'info');
        origemRetiradaId = null;
      }
    }

    editingOS = null;
    formSalvoComSucesso = true;
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

    // Actions (Bandeja Minimalista de Ações)
    const isAdminMaster = currentUser && (currentUser.usuario === 'admin' || currentUser.role === 'role_admin' || currentUser.usuario === 'suprabikemarketing@gmail.com');
    const canAssumir = temPermissao('assumir_servico') && os.status === 'aguardando';
    const canConcluir = temPermissao('concluir_servico') && os.status === 'em_andamento';
    const canEditar = temPermissao('editar_os') && (os.status === 'aguardando' || isAdminMaster);
    const canExcluir = temPermissao('excluir_os') || isAdminMaster;
    const canDelegar = temPermissao('delegar_servico') && os.status === 'aguardando';

    let heroActionHtml = '';
    if (canConcluir) {
      heroActionHtml = `<button class="btn btn-success action-tray-hero-btn" id="btn-detail-concluir" style="background:#22c55e; border-color:#22c55e;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Concluir Serviço
      </button>`;
    } else if (canAssumir) {
      heroActionHtml = `<button class="btn btn-blue action-tray-hero-btn" id="btn-detail-assumir" style="background:#2563eb; border-color:#2563eb;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        Assumir Serviço
      </button>`;
    }

    let quickGridHtml = `
      <button type="button" class="action-tray-btn action-tray-btn-sig" id="btn-detail-coletar-assinatura">
        ✍️ Assinar Cliente
      </button>
      <button type="button" class="action-tray-btn action-tray-btn-wa" id="btn-detail-whatsapp">
        💬 WhatsApp
      </button>
      <button type="button" class="action-tray-btn action-tray-btn-pdf" id="btn-detail-pdf-os-andamento">
        📑 PDF da OS
      </button>
      ${canEditar ? `
        <button type="button" class="action-tray-btn action-tray-btn-edit" id="btn-detail-editar">
          ✏️ Editar OS
        </button>
      ` : ''}
    `;

    let moreContentHtml = '';
    moreContentHtml += `
      <button type="button" class="btn btn-secondary btn-block btn-sm" id="btn-detail-coletar-assinatura-motorista" style="font-size:12px; font-weight:700; color:#3b82f6; border-color:rgba(59,130,246,0.3); background:rgba(59,130,246,0.06);">
        ✍️ Assinatura Motorista
      </button>`;
    if (canDelegar) {
      moreContentHtml += `
        <button type="button" class="btn btn-secondary btn-block btn-sm" id="btn-detail-delegar" style="font-size:12px; font-weight:700;">
          👤 Delegar Serviço a outro técnico
        </button>`;
    }
    if (os.status === 'concluido' || os.tipo === 'retirada' || os.status === 'retirada_pendente') {
      moreContentHtml += `
        <button type="button" class="btn btn-secondary btn-block btn-sm" id="btn-detail-pdf-retirada" style="font-size:12px; font-weight:700;">
          📋 Baixar Termo de Retirada (PDF)
        </button>`;
    }
    if (os.status === 'concluido') {
      moreContentHtml += `
        <button type="button" class="btn btn-secondary btn-block btn-sm" id="btn-detail-pdf-entrega" style="font-size:12px; font-weight:700;">
          📄 Baixar Termo de Entrega (PDF)
        </button>`;
    }
    if (canExcluir) {
      moreContentHtml += `
        <button type="button" class="btn btn-danger btn-block btn-sm" id="btn-detail-excluir" style="margin-top:6px; font-size:12px;">
          🗑️ Excluir Ordem de Serviço
        </button>`;
    }

    let actionsHtml = `
      <div class="action-tray-container">
        <div class="action-tray-header">Ações do Serviço</div>
        ${heroActionHtml}
        <div class="action-tray-grid">
          ${quickGridHtml}
        </div>
        ${moreContentHtml ? `
          <details class="action-tray-more">
            <summary class="action-tray-more-summary">
              <span>⚙️ Mais Opções e PDFs</span>
              <svg class="action-tray-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>
            <div class="action-tray-more-content">
              ${moreContentHtml}
            </div>
          </details>
        ` : ''}
      </div>
    `;

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

      ${os.assinaturaCliente ? `
        <div class="os-detail-section">
          <div class="os-detail-section-title" style="color:#22c55e;">✅ Assinatura Digital do Cliente</div>
          <div class="signature-preview-card">
            <img src="${os.assinaturaCliente}" class="signature-preview-img" alt="Assinatura do Cliente">
            <div style="font-size:11px; color:var(--text-secondary); text-align:center;">
              Assinado em <strong>${Utils.formatarDataHora(os.dataAssinatura)}</strong> ${os.assinanteNome ? `por <strong>${Utils.escapeHtml(os.assinanteNome)}</strong>` : ''}
            </div>
          </div>
        </div>` : ''}

      ${os.assinaturaMotorista ? `
        <div class="os-detail-section">
          <div class="os-detail-section-title" style="color:#3b82f6;">✅ Assinatura Digital do Motorista / Técnico</div>
          <div class="signature-preview-card" style="background:rgba(59,130,246,0.08); border-color:rgba(59,130,246,0.3);">
            <img src="${os.assinaturaMotorista}" class="signature-preview-img" alt="Assinatura do Motorista">
            <div style="font-size:11px; color:var(--text-secondary); text-align:center;">
              Assinado em <strong>${Utils.formatarDataHora(os.dataAssinaturaMotorista)}</strong> ${os.assinanteMotoristaNome ? `por <strong>${Utils.escapeHtml(os.assinanteMotoristaNome)}</strong>` : ''}
            </div>
          </div>
        </div>` : ''}

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

    const btnColetarAssinatura = document.getElementById('btn-detail-coletar-assinatura');
    if (btnColetarAssinatura) {
      btnColetarAssinatura.addEventListener('click', () => openModalColetarAssinatura(os.id, 'cliente'));
    }

    const btnColetarAssinaturaMot = document.getElementById('btn-detail-coletar-assinatura-motorista');
    if (btnColetarAssinaturaMot) {
      btnColetarAssinaturaMot.addEventListener('click', () => openModalColetarAssinatura(os.id, 'motorista'));
    }

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
          <div style="display:flex; align-items:center; gap:8px; width:100%;">
            <span>${secName} <small style="color:var(--text-tertiary)">(${secCampos.length})</small></span>
            <button type="button" class="btn btn-primary btn-xs btn-add-campo-secao" data-secao="${Utils.escapeHtml(secName)}" style="margin-left:auto; font-size:11px; padding:3px 10px; border-radius:var(--radius-full);">
              + Adicionar Item
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="collapse-icon"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="collapsible-body">
          ${secCampos.map(c => `
            <div class="admin-item">
              <div class="admin-item-info">
                <div class="admin-item-name">${c.nome}</div>
                <div class="admin-item-meta">${c.tipo === 'sim_nao' ? 'Sim/Não' : c.tipo === 'sim_nao_quantidade' ? 'Sim/Não + Qtd' : 'Texto'} · ${c.ativo ? '✅ Ativo' : '❌ Inativo'}</div>
              </div>
              <div class="admin-item-actions">
                <button class="btn btn-blue btn-xs btn-edit-campo" data-id="${c.id}" title="Editar este campo">
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

    container.querySelectorAll('.btn-add-campo-secao').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModalNovoCampo(btn.dataset.secao);
      });
    });

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
