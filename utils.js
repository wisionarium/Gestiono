// ============================================
// UTILS.JS — Funções Utilitárias
// ============================================

const Utils = (() => {

  function gerarCodigoOS(ordensExistentes) {
    const seq = String(ordensExistentes.length + 1).padStart(4, '0');
    return `SB-${seq}`;
  }

  function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  }

  function formatarTelefone(tel) {
    if (!tel) return '';
    const digits = tel.replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return tel;
  }

  function limparTelefone(tel) {
    return tel ? tel.replace(/\D/g, '') : '';
  }

  function formatarData(dataStr) {
    if (!dataStr) return '—';
    const d = new Date(dataStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatarDataHora(dataStr) {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatarHora(dataStr) {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function calcularTempoTotal(inicio, fim) {
    if (!inicio || !fim) return null;
    const diff = new Date(fim) - new Date(inicio);
    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    if (horas > 0) return `${horas}h ${minutos}min`;
    return `${minutos}min`;
  }

  function traduzirStatus(status) {
    const map = { 'aguardando': 'Aguardando serviço', 'em_andamento': 'Em andamento', 'concluido': 'Concluído' };
    return map[status] || status;
  }

  function traduzirVeiculo(tipo) {
    const map = { 'bicicleta': 'Bicicleta', 'scooter': 'Scooter', 'triciclo': 'Triciclo' };
    return map[tipo] || tipo;
  }

  /**
   * Traduz forma de pagamento - suporta string ou array
   */
  function traduzirPagamento(forma) {
    const map = {
      'pix': 'Pix',
      'dinheiro': 'Dinheiro',
      'credito': 'Crédito',
      'debito': 'Débito'
    };
    if (Array.isArray(forma)) {
      return forma.map(f => map[f] || f).join(' + ');
    }
    return map[forma] || forma;
  }

  function traduzirStatusPagamento(status, os) {
    if (status === 'parcial' && os && os.valorEntrada) {
      const falta = Math.max(0, (os.valorTotal || 0) - (os.valorEntrada || 0));
      return `Entrada R$ ${os.valorEntrada.toFixed(2).replace('.', ',')} (Falta R$ ${falta.toFixed(2).replace('.', ',')})`;
    }
    const map = { 'pago': 'Pago Total', 'pendente': 'Pendente', 'parcial': 'Entrada Parcial' };
    return map[status] || status;
  }

  function traduzirRole(role) {
    const map = { 'admin': 'Admin Master', 'atendente': 'Atendente', 'mecanico': 'Mecânico' };
    return map[role] || role;
  }

  function gerarMensagemWhatsApp(os, customTemplate = null) {
    const template = customTemplate || ((typeof Storage !== 'undefined' && Storage.getTemplateWhatsApp) ? Storage.getTemplateWhatsApp() : `Olá, @{nome_cliente}! Tudo bem?\n\nInformamos que o seu veículo está pronto para retirada!\n\nServiços realizados:\n@{lista_servicos}\n\nValor total: @{valor_total}\nPagamento: @{forma_pagamento} (@{status_pagamento})\n\nData: @{data}\nHora: @{hora}\n\nVeículo: @{veiculo}\n\nAgradecemos a preferência e ficamos à disposição!`);
    const nomeCliente = os.clienteNome ? os.clienteNome.trim() : 'Cliente';
    const veiculo = `${os.modeloVeiculo || 'Veículo'}${os.corVeiculo ? ` (${os.corVeiculo})` : ''}`;
    const pagamentoStr = traduzirPagamento(os.formaPagamento);
    const statusPgto = traduzirStatusPagamento(os.statusPagamento, os);
    const valorTotalStr = formatarMoeda(os.valorTotal);
    
    let listaServicosTxt = '';
    if (os.servicos && os.servicos.length > 0) {
      listaServicosTxt = os.servicos.map(s => `• ${s.descricao.trim()} — ${formatarMoeda(s.valor)}`).join('\n');
    }

    const dataHoje = new Date();
    const dataStr = formatarData(os.dataServico || dataHoje.toISOString().split('T')[0]);
    const horaStr = formatarHora(dataHoje.toISOString());

    let msg = template
      .replace(/@\{nome_cliente\}/g, nomeCliente)
      .replace(/@\{veiculo\}/g, veiculo)
      .replace(/@\{lista_servicos\}/g, listaServicosTxt)
      .replace(/@\{valor_total\}/g, valorTotalStr)
      .replace(/@\{forma_pagamento\}/g, pagamentoStr)
      .replace(/@\{status_pagamento\}/g, statusPgto)
      .replace(/@\{data\}/g, dataStr)
      .replace(/@\{hora\}/g, horaStr);

    return msg.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function gerarLinkWhatsApp(telefone, mensagem) {
    const tel = limparTelefone(telefone);
    const telCompleto = tel.startsWith('55') ? tel : `55${tel}`;
    
    const msgSanitizada = (mensagem || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const encoded = encodeURIComponent(msgSanitizada)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");

    return `https://api.whatsapp.com/send?phone=${telCompleto}&text=${encoded}`;
  }

  function formatarDataEntrega(dataStr, horaStr) {
    if (!dataStr) return null;
    const partes = dataStr.split('-');
    if (partes.length !== 3) return null;

    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const dia = parseInt(partes[2], 10);

    const dataObj = new Date(ano, mes, dia);
    const diasSemana = [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
      'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];
    const diasSemanaCurtos = [
      'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'
    ];

    const idx = dataObj.getDay();
    const diaSemana = diasSemana[idx];
    const diaSemanaCurto = diasSemanaCurtos[idx];
    const dataFormatada = `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;

    let complementoHora = '';
    if (horaStr) {
      complementoHora = ` às ${horaStr}h`;
    }

    return {
      diaSemana,
      diaSemanaCurto,
      dataFormatada,
      horaStr,
      textoCompleto: `${diaSemana}, ${dataFormatada}${complementoHora}`,
      textoCurto: `${diaSemanaCurto}, ${dataFormatada}${complementoHora}`
    };
  }

  function comprimirFotoBase64(file, maxWidth = 900, quality = 0.65) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  function removerAcentos(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hashSenha(senha) {
    let hash = 0;
    for (let i = 0; i < senha.length; i++) {
      const char = senha.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function gerarPDFRetirada(os) {
    if (typeof html2pdf === 'undefined') {
      alert('Aguarde o carregamento do gerador de PDF ou verifique sua conexão.');
      return;
    }

    const camposDef = typeof Storage !== 'undefined' ? Storage.getCampos() : [];
    const campos = os.camposPersonalizados || {};
    
    // Procura por Garantia
    let temGarantia = false;
    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (cDef) {
        const name = cDef.nome.toLowerCase();
        if ((name.includes('garantia') || name.includes('warranty')) && (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim')) {
          temGarantia = true;
          break;
        }
      }
    }

    // Procura por Endereço
    let endereco = '';
    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (cDef) {
        const name = cDef.nome.toLowerCase();
        if (name.includes('endereço') || name.includes('endereco') || name.includes('rua') || name.includes('bairro') || name.includes('cidade')) {
          if (val.valor && typeof val.valor === 'string') {
            endereco = val.valor;
            break;
          }
        }
      }
    }

    // Procura por Taxa de Retirada / Valor
    let valorRetirada = '';
    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (cDef) {
        const name = cDef.nome.toLowerCase();
        if (name.includes('taxa') || name.includes('retirada') || name.includes('valor')) {
          if (val.valor !== undefined && val.valor !== null) {
            if (typeof val.valor === 'number') {
              valorRetirada = formatarMoeda(val.valor);
            } else if (typeof val.valor === 'string' && val.valor.trim() !== '' && val.valor.toLowerCase() !== 'true' && val.valor.toLowerCase() !== 'false') {
              valorRetirada = val.valor;
            }
          }
        }
      }
    }

    // Procura por Levar
    let levar = '';
    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (cDef) {
        const name = cDef.nome.toLowerCase();
        if (name.includes('levar') || name.includes('trazer') || name.includes('itens')) {
          if (val.valor && typeof val.valor === 'string') {
            levar = val.valor;
            break;
          }
        }
      }
    }

    // Determina itens retirados (checkboxes)
    let deixouChave = false;
    let deixouCarregador = false;
    let deixouControle = false;
    let deixouDocumento = false;

    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (cDef) {
        const name = cDef.nome.toLowerCase();
        if (name.includes('chave')) deixouChave = !!val.valor;
        if (name.includes('carregador')) deixouCarregador = !!val.valor;
        if (name.includes('controle') || name.includes('nfc') || name.includes('tag')) deixouControle = !!val.valor;
        if (name.includes('documento') || name.includes('doc')) deixouDocumento = !!val.valor;
      }
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR');

    const opt = {
      margin:       [10, 15, 10, 15],
      filename:     'Termo_Retirada_OS_' + os.id + '.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const container = document.createElement('div');
    container.style.fontFamily = "'Outfit', 'Inter', sans-serif";
    container.style.color = "#0f172a";
    container.style.padding = "10px";
    container.style.background = "#fff";
    container.style.width = "100%";
    container.style.boxSizing = "border-box";

    let htmlContent = `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
        <span style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 2px;">
          <span style="color: #ef4444;">SUPRA</span> <span style="color: #1e3a8a;">BIKE</span>
        </span>
        <h2 style="font-size: 15px; font-weight: 800; text-align: center; color: #1e293b; margin: 8px 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
          TERMO DE AUTORIZAÇÃO DE RETIRADA PARA MANUTENÇÃO
        </h2>
      </div>

      <!-- Garantia e Data -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="height: 26px;">
          ${temGarantia ? `
            <span style="background: #22c55e; color: #fff; padding: 4px 10px; font-weight: 800; font-size: 11px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">
              GARANTIA
            </span>
          ` : ''}
        </div>
        <div style="font-size: 12px; font-weight: 600; color: #475569;">
          Data: <span style="border-bottom: 1.5px solid #94a3b8; padding: 0 8px 2px;">${dataGeracao}</span>
        </div>
      </div>

      <!-- Dados do Cliente -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
          DADOS DO CLIENTE
        </div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 6px;">
          <div><strong>Nome:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 80%; padding-left: 4px;">${os.clienteNome || ''}</span></div>
          <div><strong>Cel.:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 75%; padding-left: 4px;">${os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : ''}</span></div>
        </div>
        <div style="font-size: 12px;">
          <strong>Endereço:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 86%; padding-left: 4px;">${endereco || 'Não cadastrado'}</span>
        </div>
      </div>

      <!-- Dados do Veículo -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
          DADOS DO VEÍCULO
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
          <div><strong>Modelo:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 78%; padding-left: 4px;">${os.modeloVeiculo || ''}</span></div>
          <div><strong>Cor:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 82%; padding-left: 4px;">${os.corVeiculo || ''}</span></div>
        </div>
      </div>

      <!-- Taxa de Retirada -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
          TAXA DE RETIRADA
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
          <div><strong>Valor:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 80%; padding-left: 4px;">${valorRetirada || ''}</span></div>
          <div><strong>Levar:</strong> <span style="border-bottom: 1px dashed #94a3b8; display: inline-block; width: 80%; padding-left: 4px;">${levar || ''}</span></div>
        </div>
      </div>

      <!-- Itens Retirados -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
          ITENS RETIRADOS
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); font-size: 12px; padding: 2px 0;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${deixouChave ? '☑' : '☐'}</span> Chaves
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${deixouControle ? '☑' : '☐'}</span> Controles
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${deixouCarregador ? '☑' : '☐'}</span> Carregador
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${deixouDocumento ? '☑' : '☐'}</span> Documentos
          </div>
        </div>
      </div>

      <!-- Descrição da Manutenção -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
          DESCRIÇÃO DA MANUTENÇÃO (OBSERVAÇÕES)
        </div>
        <div style="font-size: 11px; line-height: 1.5; color: #334155; min-height: 80px; word-break: break-word;">
          ${os.observacoes ? os.observacoes.replace(/\n/g, '<br>') : 'Nenhuma observação cadastrada.'}
        </div>
      </div>

      <!-- Fotos (Opcional) -->
      ${os.temFotos && Array.isArray(os.fotos) && os.fotos.length > 0 ? `
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #f8fafc;">
          <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 0.5px;">
            FOTOS
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${os.fotos.map(src => `
              <img src="${src}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;">
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Autorização -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 25px; background: #f8fafc; font-size: 10.5px; line-height: 1.5; color: #475569;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; letter-spacing: 0.5px;">
          AUTORIZAÇÃO
        </div>
        <p style="margin-bottom: 4px;">
          Autorizo a <strong>SUPRA BIKE</strong> a retirar o veículo acima para realização de inspeção técnica, manutenção e/ou reparo.
        </p>
        <p>
          Estou ciente de que a retirada do veículo não caracteriza aprovação automática da garantia. Caso o defeito não esteja coberto pela garantia, será apresentado orçamento para aprovação antes da execução do serviço.
        </p>
      </div>

      <!-- Assinaturas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; font-size: 11px;">
        <div style="text-align: center;">
          <div style="border-bottom: 1px solid #94a3b8; height: 25px; margin-bottom: 4px;"></div>
          <strong>Assinatura do Cliente</strong>
        </div>
        <div style="text-align: center;">
          <div style="border-bottom: 1px solid #94a3b8; height: 25px; margin-bottom: 4px; font-weight: 700; line-height: 25px; color: #0f172a;">
            ${os.mecanico || '—'}
          </div>
          <strong>Técnico Responsável</strong>
        </div>
      </div>
    `;

    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    html2pdf().from(container).set(opt).save().then(() => {
      document.body.removeChild(container);
    }).catch(err => {
      console.error('Erro ao gerar PDF:', err);
      document.body.removeChild(container);
    });
  }

  function abrirInstagram(username = 'wisionarium') {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const webUrl = `https://www.instagram.com/${username}/`;
    const appUrl = `instagram://user?username=${username}`;

    if (isMobile) {
      const start = Date.now();
      window.location.href = appUrl;

      setTimeout(() => {
        if (Date.now() - start < 1800) {
          window.open(webUrl, '_blank');
        }
      }, 1200);
    } else {
      window.open(webUrl, '_blank');
    }
  }

  return {
    gerarCodigoOS, formatarMoeda, formatarTelefone, limparTelefone,
    formatarData, formatarDataHora, formatarHora, calcularTempoTotal,
    traduzirStatus, traduzirVeiculo, traduzirPagamento,
    traduzirStatusPagamento, traduzirRole, formatarDataEntrega,
    comprimirFotoBase64, removerAcentos, escapeHtml,
    gerarMensagemWhatsApp, gerarLinkWhatsApp, abrirInstagram, gerarPDFRetirada,
    hashSenha, gerarId, debounce
  };
})();
