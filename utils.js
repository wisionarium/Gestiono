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
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      alert('Aguarde o carregamento do gerador de PDF ou verifique sua conexão.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const camposDef = typeof Storage !== 'undefined' ? Storage.getCampos() : [];
    const campos = os.camposPersonalizados || {};

    // === Coleta de dados dos campos personalizados ===
    let temGarantia = false;
    let endereco = '';
    let valorRetirada = '';
    let levar = '';
    let deixouChave = false;
    let deixouCarregador = false;
    let deixouControle = false;
    let deixouDocumento = false;

    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (!cDef) continue;
      const name = cDef.nome.toLowerCase();

      if ((name.includes('garantia') || name.includes('warranty')) && (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim')) {
        temGarantia = true;
      }
      if (name.includes('endereço') || name.includes('endereco') || name.includes('rua') || name.includes('bairro') || name.includes('cidade')) {
        if (val.valor && typeof val.valor === 'string') endereco = val.valor;
      }
      if (name.includes('taxa') || name.includes('retirada') || name.includes('valor')) {
        if (val.valor !== undefined && val.valor !== null) {
          if (typeof val.valor === 'number') valorRetirada = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() !== '' && val.valor.toLowerCase() !== 'true' && val.valor.toLowerCase() !== 'false') valorRetirada = val.valor;
        }
      }
      if (name.includes('levar') || name.includes('trazer') || name.includes('itens')) {
        if (val.valor && typeof val.valor === 'string') levar = val.valor;
      }
      if (name.includes('chave')) deixouChave = !!val.valor;
      if (name.includes('carregador')) deixouCarregador = !!val.valor;
      if (name.includes('controle') || name.includes('nfc') || name.includes('tag')) deixouControle = !!val.valor;
      if (name.includes('documento') || name.includes('doc')) deixouDocumento = !!val.valor;
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const pageW = 210;
    const marginL = 15;
    const marginR = 15;
    const contentW = pageW - marginL - marginR;
    let y = 15;

    // === Helpers ===
    function drawSectionTitle(title) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(title, marginL + 4, y + 4);
      y += 7;
      doc.setDrawColor(203, 213, 225);
      doc.line(marginL, y - 2.5, marginL + contentW, y - 2.5);
      y += 1;
    }

    function drawField(label, value, x, maxW) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(label, x, y);
      const labelW = doc.getTextWidth(label) + 1;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 133);
      const val = value || '—';
      doc.text(val, x + labelW, y);
      // Underline dashed
      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(x + labelW, y + 0.5, x + maxW, y + 0.5);
      doc.setLineDashPattern([], 0);
    }

    function drawSectionBox(startY, endY) {
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginL, startY, contentW, endY - startY, 2, 2, 'FD');
    }

    // === CABEÇALHO ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(239, 68, 68); // vermelho
    doc.text('SUPRA', pageW / 2 - 2, y, { align: 'right' });
    doc.setTextColor(30, 58, 138); // azul escuro
    doc.text(' BIKE', pageW / 2 + 2, y, { align: 'left' });
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('TERMO DE AUTORIZAÇÃO DE RETIRADA PARA MANUTENÇÃO', pageW / 2, y, { align: 'center' });
    y += 3;

    // Linha vermelha separadora
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.8);
    doc.line(marginL, y, marginL + contentW, y);
    doc.setLineWidth(0.2);
    y += 6;

    // === GARANTIA + DATA ===
    if (temGarantia) {
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(marginL, y - 3.5, 24, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('GARANTIA', marginL + 2, y);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Data: ' + dataGeracao, marginL + contentW, y, { align: 'right' });
    y += 8;

    // === DADOS DO CLIENTE ===
    let secY = y;
    drawSectionBox(secY, secY + 24);
    y = secY + 1;
    drawSectionTitle('DADOS DO CLIENTE');
    
    drawField('Nome: ', os.clienteNome || '', marginL + 4, marginL + contentW * 0.58);
    drawField('Cel.: ', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', marginL + contentW * 0.62, marginL + contentW - 4);
    y += 6;
    
    drawField('Endereço: ', endereco || 'Não cadastrado', marginL + 4, marginL + contentW - 4);
    y += 8;

    // === DADOS DO VEÍCULO ===
    secY = y;
    drawSectionBox(secY, secY + 18);
    y = secY + 1;
    drawSectionTitle('DADOS DO VEÍCULO');
    
    drawField('Modelo: ', os.modeloVeiculo || '', marginL + 4, marginL + contentW * 0.45);
    drawField('Cor: ', os.corVeiculo || '', marginL + contentW * 0.52, marginL + contentW - 4);
    y += 8;

    // === TAXA DE RETIRADA ===
    secY = y;
    drawSectionBox(secY, secY + 18);
    y = secY + 1;
    drawSectionTitle('TAXA DE RETIRADA');
    
    drawField('Valor: ', valorRetirada || '', marginL + 4, marginL + contentW * 0.45);
    drawField('Levar: ', levar || '', marginL + contentW * 0.52, marginL + contentW - 4);
    y += 8;

    // === ITENS RETIRADOS ===
    secY = y;
    drawSectionBox(secY, secY + 18);
    y = secY + 1;
    drawSectionTitle('ITENS RETIRADOS');
    
    const itens = [
      { label: 'Chaves', checked: deixouChave },
      { label: 'Controles', checked: deixouControle },
      { label: 'Carregador', checked: deixouCarregador },
      { label: 'Documentos', checked: deixouDocumento }
    ];
    
    const colW = (contentW - 8) / 4;
    itens.forEach((item, i) => {
      const ix = marginL + 4 + i * colW;
      const checkChar = item.checked ? '☑' : '☐';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text(checkChar, ix, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(' ' + item.label, ix + 4, y);
    });
    y += 8;

    // === DESCRIÇÃO DA MANUTENÇÃO ===
    const obsText = os.observacoes || 'Nenhuma observação cadastrada.';
    const obsLines = doc.splitTextToSize(obsText, contentW - 12);
    const obsHeight = Math.max(20, obsLines.length * 4.5 + 12);
    
    secY = y;
    drawSectionBox(secY, secY + obsHeight);
    y = secY + 1;
    drawSectionTitle('DESCRIÇÃO DA MANUTENÇÃO (OBSERVAÇÕES)');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 133);
    doc.text(obsLines, marginL + 4, y + 1);
    y = secY + obsHeight + 3;

    // === AUTORIZAÇÃO ===
    const autTexto1 = 'Autorizo a SUPRA BIKE a retirar o veículo acima para realização de inspeção técnica, manutenção e/ou reparo.';
    const autTexto2 = 'Estou ciente de que a retirada do veículo não caracteriza aprovação automática da garantia. Caso o defeito não esteja coberto pela garantia, será apresentado orçamento para aprovação antes da execução do serviço.';
    const aut1Lines = doc.splitTextToSize(autTexto1, contentW - 12);
    const aut2Lines = doc.splitTextToSize(autTexto2, contentW - 12);
    const autHeight = (aut1Lines.length + aut2Lines.length) * 4.5 + 14;

    secY = y;
    drawSectionBox(secY, secY + autHeight);
    y = secY + 1;
    drawSectionTitle('AUTORIZAÇÃO');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(aut1Lines, marginL + 4, y + 1);
    y += aut1Lines.length * 4.5 + 2;
    doc.text(aut2Lines, marginL + 4, y + 1);
    y = secY + autHeight + 8;

    // === ASSINATURAS ===
    const sigW = (contentW - 20) / 2;

    // Assinatura do cliente
    doc.setDrawColor(148, 163, 184);
    doc.line(marginL + 4, y, marginL + 4 + sigW, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Assinatura do Cliente', marginL + 4 + sigW / 2, y + 5, { align: 'center' });

    // Técnico responsável
    const tecX = marginL + contentW - 4 - sigW;
    if (os.mecanico) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(os.mecanico, tecX + sigW / 2, y - 2, { align: 'center' });
    }
    doc.line(tecX, y, tecX + sigW, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Técnico Responsável', tecX + sigW / 2, y + 5, { align: 'center' });

    // === SALVAR PDF ===
    doc.save('Termo_Retirada_OS_' + os.id + '.pdf');
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
