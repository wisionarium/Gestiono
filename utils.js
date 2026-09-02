// ============================================
// UTILS.JS — Funções Utilitárias
// ============================================

const Utils = (() => {

  function gerarCodigoOS(ordensExistentes) {
    let maxSeq = 0;
    (ordensExistentes || []).forEach(o => {
      if (o && o.id && typeof o.id === 'string') {
        const match = o.id.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });
    const seq = String(maxSeq + 1).padStart(4, '0');
    return `SB-${seq}`;
  }

  function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  }

  function formatarMoedaDigitada(valorInput) {
    if (valorInput === null || valorInput === undefined) return 'R$ 0,00';
    let str = String(valorInput).trim();
    if (!str) return 'R$ 0,00';

    let clean = str.replace(/[^0-9,\.]/g, '');
    if (!clean) return 'R$ 0,00';

    if (clean.includes(',') || clean.includes('.')) {
      const normalized = clean.replace(',', '.');
      const parts = normalized.split('.');
      const inteiro = parts[0] || '0';
      const decimal = (parts[1] || '').slice(0, 2);
      const valNum = parseFloat(`${inteiro}.${decimal.padEnd(2, '0')}`);
      return isNaN(valNum) ? 'R$ 0,00' : formatarMoeda(valNum);
    }

    const valNum = parseFloat(clean);
    if (isNaN(valNum)) return 'R$ 0,00';
    return formatarMoeda(valNum);
  }

  function aplicarMascaraMoedaInput(inputElement) {
    if (!inputElement) return;

    inputElement.addEventListener('focus', function() {
      if (this.value === 'R$ 0,00' || this.value === 'R$ 0' || this.value === '0') {
        this.value = '';
      } else {
        this.select();
      }
    });

    inputElement.addEventListener('blur', function() {
      if (!this.value.trim()) {
        this.value = 'R$ 0,00';
      } else {
        this.value = formatarMoedaDigitada(this.value);
      }
    });
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
    const map = { 
      'admin': 'Admin Master', 
      'role_admin': 'Admin Master', 
      'atendente': 'Atendente', 
      'role_atendente': 'Atendente', 
      'mecanico': 'Mecânico', 
      'role_mecanico': 'Mecânico', 
      'motorista': 'Motorista', 
      'role_motorista': 'Motorista' 
    };
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

  // =============================================
  // COLETA DE DADOS COMPARTILHADA (usado pelos 3 PDFs)
  // =============================================
  function _coletarDadosPDF(osInput) {
    const os = (typeof osInput === 'string' && typeof Storage !== 'undefined') ? Storage.getOrdemById(osInput) : osInput;
    if (!os) { console.warn('OS não encontrada para geração do PDF:', osInput); return null; }

    const camposDef = typeof Storage !== 'undefined' ? Storage.getCampos() : [];
    const campos = os.camposPersonalizados || {};

    let temGarantia = !!os.temGarantia, endereco = os.clienteEndereco || '', valorRetirada = os.valorRetirada || 'R$ 0,00', taxaEntrega = os.taxaEntrega || os.levar || 'R$ 0,00';
    let deixouChave = !!os.deixouChave, deixouCarregador = !!os.deixouCarregador, deixouControle = !!os.deixouControle, deixouDocumento = !!os.deixouDocumento;
    let qtdChave = os.qtdChave || '', qtdControle = os.qtdControle || '';
    let motoristaEntrega = os.motoristaEntrega || null;
    let checklistItems = [];

    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (!cDef) continue;
      const name = cDef.nome;
      const nameLower = name.toLowerCase();

      if (!temGarantia && (nameLower.includes('garantia') || nameLower.includes('warranty')) && (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim')) temGarantia = true;
      if (!endereco && (nameLower.includes('endere') || nameLower.includes('rua') || nameLower.includes('bairro') || nameLower.includes('cidade'))) { if (val.valor && typeof val.valor === 'string') endereco = val.valor; }
      if ((!valorRetirada || valorRetirada === 'R$ 0,00') && (nameLower.includes('retirada') || nameLower.includes('taxa'))) {
        if (val.valor != null) {
          if (typeof val.valor === 'number') valorRetirada = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) valorRetirada = val.valor;
        }
      }
      if ((!taxaEntrega || taxaEntrega === 'R$ 0,00') && (nameLower.includes('entrega') || nameLower.includes('levar') || nameLower.includes('trazer'))) {
        if (val.valor != null) {
          if (typeof val.valor === 'number') taxaEntrega = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) taxaEntrega = val.valor;
        }
      }
      if (!deixouChave && nameLower.includes('chave')) deixouChave = !!val.valor;
      if (!deixouCarregador && nameLower.includes('carregador')) deixouCarregador = !!val.valor;
      if (!deixouControle && (nameLower.includes('controle') || nameLower.includes('nfc') || nameLower.includes('tag'))) deixouControle = !!val.valor;
      if (!deixouDocumento && (nameLower.includes('documento') || nameLower.includes('doc'))) deixouDocumento = !!val.valor;
      if (!qtdChave && nameLower.includes('chave') && val.quantidade) qtdChave = val.quantidade;
      if (!qtdControle && (nameLower.includes('controle') || nameLower.includes('nfc') || nameLower.includes('tag')) && val.quantidade) qtdControle = val.quantidade;

      const cleanName = name.replace(/\?/g, '').trim();
      if (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim') {
        let txt = `• ${cleanName}: SIM`;
        if (val.quantidade !== undefined && val.quantidade > 0) {
          txt += ` (${val.quantidade})`;
        }
        checklistItems.push(txt);
      } else if (val.valor && typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) {
        checklistItems.push(`• ${cleanName}: ${val.valor}`);
      }
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const servicos = os.servicos || [];
    const observacoes = os.observacoes || '';
    const fotos = (os.temFotos && Array.isArray(os.fotos)) ? os.fotos : ((Array.isArray(os.fotos)) ? os.fotos : []);

    return { os, dataBag: { temGarantia, motoristaEntrega, checklistItems, endereco, valorRetirada, taxaEntrega, deixouChave, deixouCarregador, deixouControle, deixouDocumento, qtdChave, qtdControle, dataGeracao, servicos, observacoes, fotos } };
  }

  // =============================================
  // HELPERS jsPDF COMPARTILHADOS
  // =============================================
  function _pdfHelpers(doc, ml, cw) {
    function drawSectionHeader(title, cy) {
      doc.setFillColor(240, 245, 240);
      doc.setDrawColor(203, 213, 225);
      doc.rect(ml, cy, cw, 6, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(title, ml + 3, cy + 4.2);
    }
    function field(lbl, val, xStart, xLineEnd, cy) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(lbl, xStart, cy);
      const lblW = doc.getTextWidth(lbl) + 1.5;
      const lx = xStart + lblW;
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
      doc.line(lx, cy + 1, xLineEnd, cy + 1);
      if (val) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 133);
        doc.text(String(val), lx + 1, cy - 0.5);
      }
    }
    function drawCheck(lbl, checked, cx, cy) {
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(cx, cy - 3, 3, 3);
      if (checked) { doc.line(cx, cy - 3, cx + 3, cy); doc.line(cx, cy, cx + 3, cy - 3); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(lbl, cx + 5, cy);
    }
    function drawHeader(pw) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
      doc.setTextColor(239, 68, 68); doc.text('SUPRA', pw / 2 - 2, 16, { align: 'right' });
      doc.setTextColor(30, 58, 138); doc.text(' BIKE', pw / 2 + 2, 16, { align: 'left' });
    }
    function drawFotos(fotos, photoAreaY) {
      if (!fotos || fotos.length === 0) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('FOTOS / ANEXOS DO VEÍCULO (' + fotos.length + '):', ml + 3, photoAreaY);
      const maxFotos = Math.min(fotos.length, 5);
      const pwI = 32, phI = 22, pGap = 3;
      for (let i = 0; i < maxFotos; i++) {
        const px = ml + 3 + i * (pwI + pGap);
        doc.setDrawColor(200); doc.setFillColor(250, 250, 250);
        doc.rect(px, photoAreaY + 2, pwI, phI, 'FD');
        if (fotos[i]) {
          try {
            let fmt = 'JPEG';
            if (fotos[i].includes('image/png') || fotos[i].includes('data:image/png')) fmt = 'PNG';
            doc.addImage(fotos[i], fmt, px, photoAreaY + 2, pwI, phI);
          } catch(e) { console.warn('Erro ao inserir foto no PDF:', e); }
        }
      }
    }
    function drawAssinaturas(pw, y, mecanico, labelTecnico, assinaturaCliente, assinanteNome, assinaturaMotorista, assinanteMotoristaNome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text('Assinatura do Cliente:', pw / 2, y, { align: 'center' });

      if (assinaturaCliente && assinaturaCliente.length > 20) {
        try {
          let fmt = 'PNG';
          if (assinaturaCliente.includes('image/jpeg')) fmt = 'JPEG';
          doc.addImage(assinaturaCliente, fmt, pw / 2 - 35, y + 2, 70, 20);
          if (assinanteNome) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
            doc.text('Assinado por: ' + assinanteNome, pw / 2, y + 24, { align: 'center' });
          }
          y += 24;
        } catch(e) {
          console.warn('Erro ao desenhar assinatura cliente no PDF:', e);
          doc.setDrawColor(120); doc.setLineWidth(0.3);
          doc.line(pw / 2 - 50, y + 6, pw / 2 + 50, y + 6);
        }
      } else {
        doc.setDrawColor(120); doc.setLineWidth(0.3);
        doc.line(pw / 2 - 50, y + 6, pw / 2 + 50, y + 6);
      }

      y += 15;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
      const titleMotorista = labelTecnico || 'Responsável pela Retirada / Técnico';
      doc.text(titleMotorista + ':', pw / 2, y, { align: 'center' });

      if (assinaturaMotorista && assinaturaMotorista.length > 20) {
        try {
          let fmt = 'PNG';
          if (assinaturaMotorista.includes('image/jpeg')) fmt = 'JPEG';
          doc.addImage(assinaturaMotorista, fmt, pw / 2 - 35, y + 2, 70, 20);
          const nomeMot = assinanteMotoristaNome || mecanico || 'Responsável';
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
          doc.text('Assinado por: ' + nomeMot, pw / 2, y + 24, { align: 'center' });
        } catch(e) {
          console.warn('Erro ao desenhar assinatura motorista no PDF:', e);
          doc.setDrawColor(120); doc.setLineWidth(0.3);
          doc.line(pw / 2 - 35, y + 6, pw / 2 + 35, y + 6);
          if (mecanico) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 133);
            doc.text(mecanico, pw / 2, y + 10, { align: 'center' });
          }
        }
      } else {
        doc.setDrawColor(120); doc.setLineWidth(0.3);
        doc.line(pw / 2 - 35, y + 6, pw / 2 + 35, y + 6);
        const nomeMot = assinanteMotoristaNome || mecanico;
        if (nomeMot) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 133);
          doc.text(nomeMot, pw / 2, y + 10, { align: 'center' });
        }
      }
    }
    function drawFooter(pw) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100);
      doc.text('Supra Bike CNPJ 07.870.286.0001-05 - Estr. Real de Mauá N 739. Magé, RJ.', pw / 2, 285, { align: 'center' });
    }
    return { drawSectionHeader, field, drawCheck, drawHeader, drawFotos, drawAssinaturas, drawFooter };
  }

  // =============================================
  // 1. PDF — TERMO DE ENTREGA (Imagem 1)
  // =============================================
  function gerarPDFEntrega(osInput) {
    const result = _coletarDadosPDF(osInput);
    if (!result) return;
    const { os, dataBag: d } = result;

    if (!window.jspdf) { _gerarEntregaFallbackHTML(os, d); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pw = 210, ml = 15, cw = 180;
    const h = _pdfHelpers(doc, ml, cw);

    // Cabeçalho
    h.drawHeader(pw);
    doc.setFontSize(13.5); doc.setTextColor(0);
    doc.text('RELATÓRIO E TERMO DE ENTREGA', pw / 2, 24, { align: 'center' });

    // Data
    let y = 33;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0);
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    doc.text('Data:  ' + dataExibicao, ml + cw - 32, y);

    // Dados do Cliente
    y = 38;
    h.drawSectionHeader('DADOS DO CLIENTE', y);
    y += 12; h.field('Nome:', os.clienteNome || '', ml + 2, ml + cw - 2, y);
    y += 6; h.field('CPF:', os.clienteCpf || '', ml + 2, ml + cw * 0.48, y);
    h.field('Cel.:', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', ml + cw * 0.52, ml + cw - 2, y);
    y += 6; h.field('Endereço:', os.clienteEndereco || d.endereco || 'Não cadastrado', ml + 2, ml + cw - 2, y);

    // Dados do Veículo
    y = 68; h.drawSectionHeader('DADOS DO VEÍCULO', y);
    y += 12; h.field('Modelo:', os.modeloVeiculo || '', ml + 2, ml + cw * 0.45, y);
    h.field('Cor:', os.corVeiculo || '', ml + cw * 0.48, ml + cw * 0.70, y);
    h.field('Garantia:', d.temGarantia ? 'SIM ✅' : 'NÃO', ml + cw * 0.73, ml + cw - 2, y);

    // Taxa de Entrega
    y = 88; h.drawSectionHeader('TAXA DE ENTREGA', y);
    y += 12; h.field('Valor:', d.taxaEntrega || 'R$ 0,00', ml + 2, ml + cw * 0.48, y);
    if (d.motoristaEntrega) {
      h.field('Resp. Entrega:', d.motoristaEntrega, ml + cw * 0.52, ml + cw - 2, y);
    }

    // Itens Entregues
    y = 108; h.drawSectionHeader('ITENS ENTREGUES', y);
    y += 10;
    const colW = cw / 4;
    h.drawCheck('Chaves' + (d.qtdChave ? ' [ ' + d.qtdChave + ' ]' : ' [   ]'), d.deixouChave, ml + 2, y);
    h.drawCheck('Controles' + (d.qtdControle ? ' [ ' + d.qtdControle + ' ]' : ' [   ]'), d.deixouControle, ml + 2 + colW, y);
    h.drawCheck('Carregador', d.deixouCarregador, ml + 2 + colW * 2, y);
    h.drawCheck('Documentos', d.deixouDocumento, ml + 2 + colW * 3, y);

    // Descrição da Manutenção
    y = 126; h.drawSectionHeader('DESCRIÇÃO DA MANUTENÇÃO', y);
    y += 6;
    const boxStartY = y;

    let contentH = 10;
    const servicos = d.servicos || [];
    if (servicos.length > 0) {
      contentH += 5 + (servicos.length * 5) + 6;
    }
    let obsLines = [];
    if (d.observacoes) {
      obsLines = doc.splitTextToSize(d.observacoes, cw - 10);
      contentH += 5 + (obsLines.length * 4.5) + 3;
    }
    const boxHeight = Math.max(contentH, 38);

    doc.setDrawColor(203, 213, 225); doc.setFillColor(255, 255, 255); doc.rect(ml, boxStartY, cw, boxHeight, 'FD');

    let curY = boxStartY + 6;
    if (servicos.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 58, 138);
      doc.text('SERVIÇOS EXECUTADOS:', ml + 4, curY); curY += 5;
      servicos.forEach((s, idx) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
        doc.text((idx + 1) + '. ' + (s.descricao || 'Serviço'), ml + 6, curY);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 133);
        doc.text(formatarMoeda(s.valor || 0), ml + cw - 6, curY, { align: 'right' });
        curY += 5;
      });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      doc.line(ml + 4, curY, ml + cw - 4, curY);
      curY += 4.5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(239, 68, 68);
      doc.text('VALOR TOTAL: ' + formatarMoeda(os.valorTotal || 0), ml + cw - 6, curY, { align: 'right' });
      curY += 6;
    }
    if (d.observacoes && obsLines.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('OBSERVAÇÕES:', ml + 4, curY); curY += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
      doc.text(obsLines, ml + 6, curY);
    }

    // Declaração de recebimento
    y = boxStartY + boxHeight + 6;
    const validFotosEnt = (os.fotos || []).filter(f => typeof f === 'string' && f.length > 20);
    if (validFotosEnt.length > 0) {
      h.drawFotos(validFotosEnt, y);
      y += 27;
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(70);
    const termoEntrega = "Declaro que recebi o veículo/produto da Supra Bike e confirmo que ele foi entregue em perfeitas condições, após a realização dos serviços de manutenção, conforme verificado no momento da entrega.\nDeclaro ainda que realizei a conferência do veículo/produto e estou ciente de que o seu recebimento representa a aceitação das condições em que foi entregue.\nAo prosseguir, confirmo que li, compreendi e aceito os termos acima.";
    const linesTermoE = doc.splitTextToSize(termoEntrega, cw);
    doc.text(linesTermoE, ml, y);

    y += (linesTermoE.length * 3.5) + 14;
    h.drawAssinaturas(pw, y, os.mecanico, 'Responsável pela Entrega', os.assinaturaCliente, os.assinanteNome || os.clienteNome, os.assinaturaMotorista, os.assinanteMotoristaNome);
    h.drawFooter(pw);

    doc.save('Termo_Entrega_OS_' + os.id + '.pdf');
  }

  function _gerarEntregaFallbackHTML(os, d) {
    const ck = (v) => v ? '☒' : '☐';
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    const enderecoF = os.clienteEndereco || d.endereco || 'Não cadastrado';
    const lChave = 'Chaves ' + (d.qtdChave ? '[ ' + d.qtdChave + ' ]' : '[   ]');
    const lControle = 'Controles ' + (d.qtdControle ? '[ ' + d.qtdControle + ' ]' : '[   ]');

    let descHtml = '';
    if (d.servicos && d.servicos.length > 0) {
      descHtml += '<strong style="color:#1e3a8a;">SERVIÇOS EXECUTADOS:</strong><br>';
      d.servicos.forEach((s, i) => { descHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>' + (i+1) + '. ' + escapeHtml(s.descricao||'Serviço') + ' (' + formatarMoeda(s.valor||0) + ')</span></div>'; });
      descHtml += '<div style="text-align:right;margin-top:4px;"><strong style="color:#ef4444;font-size:12px;">VALOR TOTAL: ' + formatarMoeda(os.valorTotal||0) + '</strong></div>';
      if (d.observacoes) descHtml += '<br><strong style="color:#1e3a8a;">OBSERVAÇÕES:</strong> ' + escapeHtml(d.observacoes).replace(/\n/g,'<br>');
    } else { descHtml = d.observacoes ? '<strong>OBSERVAÇÕES:</strong> ' + escapeHtml(d.observacoes).replace(/\n/g,'<br>') : 'Nenhuma manutenção cadastrada.'; }

    const termoTexto = '<div style="margin-top:14px;margin-bottom:14px;padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;font-size:10px;line-height:1.4;color:#334155;"><p style="margin-bottom:4px;">Declaro que recebi o veículo/produto da Supra Bike e confirmo que ele foi entregue em perfeitas condições, após a realização dos serviços de manutenção, conforme verificado no momento da entrega.</p><p style="margin-bottom:4px;">Declaro ainda que realizei a conferência do veículo/produto e estou ciente de que o seu recebimento representa a aceitação das condições em que foi entregue.</p><p style="font-weight:700;color:#0f172a;margin-bottom:0;">Ao prosseguir, confirmo que li, compreendi e aceito os termos acima.</p></div>';

    const sigClienteHtml = os.assinaturaCliente ?
      '<div class="sb"><div class="sl" style="height:auto;border:none;"><img src="' + os.assinaturaCliente + '" style="max-height:45px;width:auto;"></div><div style="font-weight:700">Assinatura do Cliente (' + escapeHtml(os.assinanteNome || os.clienteNome) + ')</div></div>' :
      '<div class="sb"><div class="sl"></div><div style="font-weight:700">Assinatura do Cliente</div></div>';

    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo_Entrega_OS_' + os.id + '</title><style>@page{size:A4 portrait;margin:12mm 15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#0f172a;background:#fff;padding:20px;font-size:12px;max-width:800px;margin:0 auto}.header{text-align:center;border-bottom:2px solid #ef4444;padding-bottom:8px;margin-bottom:10px}.brand{font-size:26px;font-weight:800;letter-spacing:1px}.red{color:#ef4444}.blue{color:#1e3a8a}h2{font-size:13px;font-weight:800;text-transform:uppercase;color:#1e293b;margin-top:4px}.meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.section-title{font-weight:800;font-size:10px;text-transform:uppercase;color:#000;background:#f0f5f0;border:1px solid #cbd5e1;padding:4px 8px;margin-bottom:6px;border-radius:3px}.fields-row{display:flex;gap:20px;margin-bottom:6px;font-size:11px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}.field{flex:1;display:flex}.fl{font-weight:700;margin-right:5px}.fv{color:#334185;font-weight:700}.checks-row{display:flex;gap:15px;font-size:11px;margin-bottom:8px}.ci{display:flex;align-items:center;gap:6px}.ck{font-size:14px;color:#1e3a8a;font-weight:bold}.obs-container{border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#fff;min-height:40px;margin-bottom:8px}.obs{font-size:10px;line-height:1.4;color:#334155}.sigs{display:flex;flex-direction:column;align-items:center;gap:15px;margin-top:30px;font-size:11px}.sb{text-align:center;width:60%}.sl{border-bottom:1px solid #94a3b8;height:20px;margin-bottom:3px}.sn{font-weight:700;line-height:20px;color:#0f172a}.footer{text-align:center;font-size:10px;color:#64748b;margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:8px}</style></head><body><div class="header"><div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div><h2>Relatório e Termo de Entrega</h2></div><div class="meta-row"><div></div><div style="font-size:11px;font-weight:600;color:#475569">Data: <u>' + dataExibicao + '</u></div></div><div class="section-title">Dados do Cliente</div><div class="fields-row"><div class="field"><span class="fl">Nome:</span> <span class="fv">' + (os.clienteNome||'\u2014') + '</span></div></div><div class="fields-row"><div class="field"><span class="fl">CPF:</span> <span class="fv">' + (os.clienteCpf||'\u2014') + '</span></div><div class="field"><span class="fl">Cel.:</span> <span class="fv">' + (os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '\u2014') + '</span></div></div><div class="fields-row" style="border:none;"><span class="fl">Endereço:</span> <span class="fv">' + enderecoF + '</span></div><div class="section-title" style="margin-top:8px;">Dados do Veículo</div><div class="fields-row" style="border:none;"><div class="field"><span class="fl">Modelo:</span> <span class="fv">' + (os.modeloVeiculo||'\u2014') + '</span></div><div class="field"><span class="fl">Cor:</span> <span class="fv">' + (os.corVeiculo||'\u2014') + '</span></div></div><div class="section-title" style="margin-top:8px;">Taxa de Entrega</div><div class="fields-row" style="border:none;"><div class="field"><span class="fl">Valor:</span> <span class="fv">' + (d.taxaEntrega||'R$ 0,00') + '</span></div></div><div class="section-title" style="margin-top:8px;">Itens Entregues</div><div class="checks-row"><div class="ci"><span class="ck">' + ck(d.deixouChave) + '</span> ' + lChave + '</div><div class="ci"><span class="ck">' + ck(d.deixouControle) + '</span> ' + lControle + '</div><div class="ci"><span class="ck">' + ck(d.deixouCarregador) + '</span> Carregador</div><div class="ci"><span class="ck">' + ck(d.deixouDocumento) + '</span> Documentos</div></div><div class="section-title" style="margin-top:8px;">Descrição da Manutenção</div><div class="obs-container"><div class="obs">' + descHtml + '</div></div>' + termoTexto + '<div class="sigs">' + sigClienteHtml + '<div class="sb"><div class="sl"></div><div style="font-weight:700">Responsável pela Entrega</div></div></div><div class="footer">Supra Bike CNPJ 07.870.286.0001-05 - Estr. Real de Mauá N 739. Magé, RJ.</div></body></html>';

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Termo_Entrega_OS_' + os.id + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // =============================================
  // 2. PDF — TERMO DE RETIRADA (Imagem 3)
  // =============================================
  function gerarPDFRetiradaDoc(osInput) {
    const result = _coletarDadosPDF(osInput);
    if (!result) return;
    const { os, dataBag: d } = result;

    if (!window.jspdf) { _gerarRetiradaFallbackHTML(os, d); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pw = 210, ml = 15, cw = 180;
    const h = _pdfHelpers(doc, ml, cw);

    // Cabeçalho
    h.drawHeader(pw);
    doc.setFontSize(13.5); doc.setTextColor(0);
    doc.text('RELATÓRIO E TERMO DE RETIRADA', pw / 2, 24, { align: 'center' });

    // Data
    let y = 33;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0);
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    doc.text('Data:  ' + dataExibicao, ml + cw - 32, y);

    // Dados do Cliente
    y = 38;
    h.drawSectionHeader('DADOS DO CLIENTE', y);
    y += 12; h.field('Nome:', os.clienteNome || '', ml + 2, ml + cw - 2, y);
    y += 6; h.field('CPF:', os.clienteCpf || '', ml + 2, ml + cw * 0.48, y);
    h.field('Cel.:', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', ml + cw * 0.52, ml + cw - 2, y);
    y += 6; h.field('Endereço:', os.clienteEndereco || d.endereco || 'Não cadastrado', ml + 2, ml + cw - 2, y);

    // Dados do Veículo
    y = 68; h.drawSectionHeader('DADOS DO VEÍCULO', y);
    y += 12; h.field('Modelo:', os.modeloVeiculo || '', ml + 2, ml + cw * 0.45, y);
    h.field('Cor:', os.corVeiculo || '', ml + cw * 0.48, ml + cw * 0.70, y);
    h.field('Garantia:', d.temGarantia ? 'SIM ✅' : 'NÃO', ml + cw * 0.73, ml + cw - 2, y);

    // Taxa de Retirada
    y = 88; h.drawSectionHeader('TAXA DE RETIRADA', y);
    y += 12; h.field('Valor:', d.valorRetirada || 'R$ 0,00', ml + 2, ml + cw - 2, y);

    // Itens Retirados
    y = 108; h.drawSectionHeader('ITENS RETIRADOS', y);
    y += 10;
    const colW2 = cw / 4;
    h.drawCheck('Chaves' + (d.qtdChave ? ' [ ' + d.qtdChave + ' ]' : ' [   ]'), d.deixouChave, ml + 2, y);
    h.drawCheck('Controles' + (d.qtdControle ? ' [ ' + d.qtdControle + ' ]' : ' [   ]'), d.deixouControle, ml + 2 + colW2, y);
    h.drawCheck('Carregador', d.deixouCarregador, ml + 2 + colW2 * 2, y);
    h.drawCheck('Documentos', d.deixouDocumento, ml + 2 + colW2 * 3, y);

    // Relato do Cliente
    y = 126; h.drawSectionHeader('RELATO DO CLIENTE', y);
    y += 6;
    const bsY = y;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 133);
    const relatoText = d.observacoes || 'Nenhum relato informado pelo cliente.';
    const relatoLines = doc.splitTextToSize(relatoText, cw - 6);
    const bH = Math.max((relatoLines.length * 4.5) + 10, 45);

    doc.setDrawColor(180); doc.setFillColor(255); doc.rect(ml, bsY, cw, bH);
    doc.text(relatoLines, ml + 3, bsY + 6);

    // Declaração de ciência e autorização
    y = bsY + bH + 6;
    const validFotosRet = (os.fotos || []).filter(f => typeof f === 'string' && f.length > 20);
    if (validFotosRet.length > 0) {
      h.drawFotos(validFotosRet, y);
      y += 27;
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(70);
    const termoTexto = "Declaro estar ciente e de acordo com a retirada do meu veículo pela Supra Bike para realização de inspeção técnica, diagnóstico e dos serviços de manutenção que se fizerem necessários.\nAutorizo a equipe técnica da Supra Bike a executar os procedimentos necessários para avaliação e manutenção do veículo, conforme as condições identificadas durante a análise.\nAo prosseguir, confirmo que li, compreendi e aceito os termos acima.";
    const linesTermo = doc.splitTextToSize(termoTexto, cw);
    doc.text(linesTermo, ml, y);

    y += (linesTermo.length * 3.5) + 14;
    h.drawAssinaturas(pw, y, os.mecanico, 'Responsável pela Retirada', os.assinaturaCliente, os.assinanteNome || os.clienteNome, os.assinaturaMotorista, os.assinanteMotoristaNome);
    h.drawFooter(pw);

    doc.save('Termo_Retirada_OS_' + os.id + '.pdf');
  }

  function _gerarRetiradaFallbackHTML(os, d) {
    const ck = (v) => v ? '☒' : '☐';
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    const enderecoF = os.clienteEndereco || d.endereco || 'Não cadastrado';
    const lChave = 'Chaves ' + (d.qtdChave ? '[ ' + d.qtdChave + ' ]' : '[   ]');
    const lControle = 'Controles ' + (d.qtdControle ? '[ ' + d.qtdControle + ' ]' : '[   ]');

    const descHtml = d.observacoes ? escapeHtml(d.observacoes).replace(/\n/g,'<br>') : 'Nenhuma informação relatada pelo cliente.';

    const declaraTexto = '<div style="margin-top:14px;margin-bottom:14px;padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;font-size:10px;line-height:1.4;color:#334155;"><p style="margin-bottom:4px;">Declaro estar ciente e de acordo com a retirada do meu veículo pela Supra Bike para realização de inspeção técnica, diagnóstico e dos serviços de manutenção que se fizerem necessários.</p><p style="margin-bottom:4px;">Autorizo a equipe técnica da Supra Bike a executar os procedimentos necessários para avaliação e manutenção do veículo, conforme as condições identificadas durante a análise.</p><p style="font-weight:700;color:#0f172a;margin-bottom:0;">Ao prosseguir, confirmo que li, compreendi e aceito os termos acima.</p></div>';

    const sigClienteRetiradaHtml = os.assinaturaCliente ?
      '<div class="sb"><div class="sl" style="height:auto;border:none;"><img src="' + os.assinaturaCliente + '" style="max-height:45px;width:auto;"></div><div style="font-weight:700">Assinatura do Cliente (' + escapeHtml(os.assinanteNome || os.clienteNome) + ')</div></div>' :
      '<div class="sb"><div class="sl"></div><div style="font-weight:700">Assinatura do Cliente</div></div>';

    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo_Retirada_OS_' + os.id + '</title><style>@page{size:A4 portrait;margin:12mm 15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#0f172a;background:#fff;padding:20px;font-size:12px;max-width:800px;margin:0 auto}.header{text-align:center;border-bottom:2px solid #ef4444;padding-bottom:8px;margin-bottom:10px}.brand{font-size:26px;font-weight:800;letter-spacing:1px}.red{color:#ef4444}.blue{color:#1e3a8a}h2{font-size:13px;font-weight:800;text-transform:uppercase;color:#1e293b;margin-top:4px}.section-title{font-weight:800;font-size:10px;text-transform:uppercase;color:#000;background:#f0f5f0;border:1px solid #cbd5e1;padding:4px 8px;margin-bottom:6px;border-radius:3px}.fields-row{display:flex;gap:20px;margin-bottom:6px;font-size:11px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}.field{flex:1;display:flex}.fl{font-weight:700;margin-right:5px}.fv{color:#334185;font-weight:700}.checks-row{display:flex;gap:15px;font-size:11px;margin-bottom:8px}.ci{display:flex;align-items:center;gap:6px}.ck{font-size:14px;color:#1e3a8a;font-weight:bold}.obs-container{border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#fff;min-height:50px;margin-bottom:8px}.obs{font-size:10px;line-height:1.4;color:#334155}.sigs{display:flex;flex-direction:column;align-items:center;gap:15px;margin-top:30px;font-size:11px}.sb{text-align:center;width:60%}.sl{border-bottom:1px solid #94a3b8;height:20px;margin-bottom:3px}.sn{font-weight:700;line-height:20px;color:#0f172a}.footer{text-align:center;font-size:10px;color:#64748b;margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:8px}</style></head><body><div class="header"><div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div><h2>Relatório e Termo de Retirada</h2></div><div class="section-title">Dados do Cliente</div><div class="fields-row"><div class="field"><span class="fl">Nome:</span> <span class="fv">' + (os.clienteNome||'\u2014') + '</span></div></div><div class="fields-row"><div class="field"><span class="fl">CPF:</span> <span class="fv">' + (os.clienteCpf||'\u2014') + '</span></div><div class="field"><span class="fl">Cel.:</span> <span class="fv">' + (os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '\u2014') + '</span></div></div><div class="fields-row" style="border:none;"><span class="fl">Endereço:</span> <span class="fv">' + enderecoF + '</span></div><div class="section-title" style="margin-top:8px;">Dados do Veículo</div><div class="fields-row" style="border:none;"><div class="field"><span class="fl">Modelo:</span> <span class="fv">' + (os.modeloVeiculo||'\u2014') + '</span></div><div class="field"><span class="fl">Cor:</span> <span class="fv">' + (os.corVeiculo||'\u2014') + '</span></div></div><div class="section-title" style="margin-top:8px;">Taxa de Retirada</div><div class="fields-row" style="border:none;"><div class="field"><span class="fl">Valor:</span> <span class="fv">' + (d.valorRetirada||'R$ 0,00') + '</span></div></div><div class="section-title" style="margin-top:8px;">Itens Retirados</div><div class="checks-row"><div class="ci"><span class="ck">' + ck(d.deixouChave) + '</span> ' + lChave + '</div><div class="ci"><span class="ck">' + ck(d.deixouControle) + '</span> ' + lControle + '</div><div class="ci"><span class="ck">' + ck(d.deixouCarregador) + '</span> Carregador</div><div class="ci"><span class="ck">' + ck(d.deixouDocumento) + '</span> Documentos</div></div><div class="section-title" style="margin-top:8px;">Relato do Cliente</div><div class="obs-container"><div class="obs" style="color:#334185;">' + descHtml + '</div></div>' + declaraTexto + '<div class="sigs">' + sigClienteRetiradaHtml + '<div class="sb"><div class="sl"></div><div style="font-weight:700">Responsável pela Retirada</div></div></div><div class="footer">Supra Bike CNPJ 07.870.286.0001-05 - Estr. Real de Mauá N 739. Magé, RJ.</div></body></html>';

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Termo_Retirada_OS_' + os.id + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // =============================================
  // 3. PDF — ORDEM DE SERVIÇO (Imagem 2)
  // =============================================
  function gerarPDFOrdemServico(osInput) {
    const result = _coletarDadosPDF(osInput);
    if (!result) return;
    const { os, dataBag: d } = result;

    if (!window.jspdf) { _gerarOSFallbackHTML(os, d); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pw = 210, ml = 15, cw = 180;
    const h = _pdfHelpers(doc, ml, cw);

    // === CABEÇALHO ===
    h.drawHeader(pw);
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text('ORDEM DE SERVIÇO', pw / 2, 24, { align: 'center' });

    // Data
    let y = 33;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0);
    const dataCriacao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    doc.text('Data:  ' + dataCriacao, ml + cw - 32, y);

    // === DADOS DO CLIENTE ===
    y = 38;
    h.drawSectionHeader('DADOS DO CLIENTE', y);
    y += 12; h.field('Nome:', os.clienteNome || '', ml + 2, ml + cw - 2, y);
    y += 6; h.field('CPF:', os.clienteCpf || '', ml + 2, ml + cw * 0.48, y);
    h.field('Cel.:', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', ml + cw * 0.52, ml + cw - 2, y);
    y += 6; h.field('Endereço:', os.clienteEndereco || d.endereco || 'Não cadastrado', ml + 2, ml + cw - 2, y);

    // === DADOS DO VEÍCULO ===
    y += 8; h.drawSectionHeader('DADOS DO VEÍCULO', y);
    y += 12; h.field('Modelo:', os.modeloVeiculo || '', ml + 2, ml + cw * 0.45, y);
    h.field('Cor:', os.corVeiculo || '', ml + cw * 0.48, ml + cw * 0.70, y);
    h.field('Garantia:', d.temGarantia ? 'SIM ✅' : 'NÃO', ml + cw * 0.73, ml + cw - 2, y);

    if (d.motoristaEntrega) {
      y += 6;
      h.field('Responsável pela entrega:', d.motoristaEntrega, ml + 2, ml + cw - 2, y);
    }

    // === DESCRIÇÃO DA MANUTENÇÃO ===
    y += 8; h.drawSectionHeader('DESCRIÇÃO DA MANUTENÇÃO', y);
    y += 6;
    const bsY = y;

    const servicos = d.servicos || [];
    let obsLines = [];
    if (d.observacoes) {
      obsLines = doc.splitTextToSize('OBSERVAÇÕES: ' + d.observacoes, cw - 6);
    }
    let chkLines = [];
    if (d.checklistItems && d.checklistItems.length > 0) {
      chkLines = doc.splitTextToSize('CHECKLIST & ACESSÓRIOS: ' + d.checklistItems.join('  •  '), cw - 6);
    }

    const validFotos = (d.fotos && Array.isArray(d.fotos)) ? d.fotos.filter(f => f && f.length > 10) : [];
    const hasFotos = validFotos.length > 0;

    let contentH = 10;
    if (servicos.length > 0) contentH += 6 + (servicos.length * 5) + 6;
    if (chkLines.length > 0) contentH += 5 + (chkLines.length * 4.5) + 4;
    if (obsLines.length > 0) contentH += 5 + (obsLines.length * 4.5) + 4;

    let bH = Math.max(contentH, 42);
    let photoAreaY = 0;
    if (hasFotos) {
      photoAreaY = bsY + bH + 2;
      bH += 28;
    }

    doc.setDrawColor(203, 213, 225); doc.setFillColor(255, 255, 255); doc.rect(ml, bsY, cw, bH, 'FD');

    let cY = bsY + 6;
    if (servicos.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 58, 138);
      doc.text('SERVIÇOS EXECUTADOS:', ml + 4, cY); cY += 5;
      servicos.forEach((s, idx) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
        doc.text((idx + 1) + '. ' + (s.descricao || 'Serviço'), ml + 6, cY);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 133);
        doc.text(formatarMoeda(s.valor || 0), ml + cw - 6, cY, { align: 'right' });
        cY += 5;
      });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      doc.line(ml + 4, cY, ml + cw - 4, cY);
      cY += 4.5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(239, 68, 68);
      doc.text('VALOR TOTAL: ' + formatarMoeda(os.valorTotal || 0), ml + cw - 6, cY, { align: 'right' });
      cY += 6;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 58, 138);
      doc.text('SERVIÇOS (PREENCHIMENTO MANUAL - VISITA TÉCNICA):', ml + 4, cY); cY += 7;
      for (let i = 1; i <= 5; i++) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(203, 213, 225);
        doc.text(i + '. ____________________________________________________________________________________', ml + 6, cY);
        cY += 5.5;
      }
    }
    if (chkLines.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('CHECKLIST & ACESSÓRIOS:', ml + 4, cY); cY += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(51, 65, 133);
      doc.text(chkLines, ml + 6, cY);
      cY += (chkLines.length * 4.5) + 3;
    }
    if (d.observacoes && obsLines.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('OBSERVAÇÕES:', ml + 4, cY); cY += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
      doc.text(obsLines, ml + 6, cY);
    }

    // FOTOS ANEXADAS
    y = bsY + bH + 6;
    const validFotosOS = (os.fotos || []).filter(f => typeof f === 'string' && f.length > 20);
    if (validFotosOS.length > 0) {
      h.drawFotos(validFotosOS, y);
      y += 27;
    }

    // === ASSINATURAS ===
    y += 10;
    if (y > 240) { doc.addPage(); y = 30; }
    h.drawAssinaturas(pw, y, os.mecanico, 'Técnico Responsável', os.assinaturaCliente, os.assinanteNome || os.clienteNome, os.assinaturaMotorista, os.assinanteMotoristaNome);
    h.drawFooter(pw);

    doc.save('Ordem_Servico_OS_' + os.id + '.pdf');
  }

  function _gerarOSFallbackHTML(os, d) {
    const dataCriacao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    const enderecoF = os.clienteEndereco || d.endereco || 'Não cadastrado';
    const servicos = d.servicos || [];

    let descHtml = '';
    if (servicos.length > 0) {
      descHtml += '<strong style="color:#1e3a8a;">SERVIÇOS EXECUTADOS:</strong><br>';
      servicos.forEach((s, i) => { descHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>' + (i+1) + '. ' + escapeHtml(s.descricao||'Serviço') + ' (' + formatarMoeda(s.valor||0) + ')</span></div>'; });
      descHtml += '<div style="text-align:right;margin-top:4px;"><strong style="color:#ef4444;font-size:12px;">VALOR TOTAL: ' + formatarMoeda(os.valorTotal||0) + '</strong></div>';
      if (d.observacoes) descHtml += '<br><strong style="color:#1e3a8a;">OBSERVAÇÕES:</strong> ' + escapeHtml(d.observacoes).replace(/\n/g,'<br>');
    } else { descHtml = d.observacoes ? '<strong>OBSERVAÇÕES:</strong> ' + escapeHtml(d.observacoes).replace(/\n/g,'<br>') : 'Nenhuma manutenção cadastrada.'; }

    const validFotos = (d.fotos && Array.isArray(d.fotos)) ? d.fotos.filter(f => f && f.length > 10) : [];
    let fotosHtml = '';
    if (validFotos.length > 0) {
      fotosHtml = '<div style="margin-top:10px;border-top:1px solid #ddd;padding-top:8px;"><strong style="font-size:10px;color:#000;">FOTOS:</strong><div style="display:flex;gap:10px;margin-top:6px;">';
      for (let i = 0; i < 5; i++) { fotosHtml += validFotos[i] ? '<div style="width:70px;height:50px;border:1px solid #cbd5e1;border-radius:4px;overflow:hidden;"><img src="' + validFotos[i] + '" style="width:100%;height:100%;object-fit:cover;"></div>' : ''; }
      fotosHtml += '</div></div>';
    }

    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ordem_Servico_OS_' + os.id + '</title><style>@page{size:A4 portrait;margin:12mm 15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#0f172a;background:#fff;padding:20px;font-size:12px;max-width:800px;margin:0 auto}.header{text-align:center;border-bottom:2px solid #ef4444;padding-bottom:8px;margin-bottom:10px}.brand{font-size:26px;font-weight:800;letter-spacing:1px}.red{color:#ef4444}.blue{color:#1e3a8a}h2{font-size:14px;font-weight:800;text-transform:uppercase;color:#1e293b;margin-top:4px}.meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.section-title{font-weight:800;font-size:10px;text-transform:uppercase;color:#000;background:#f0f5f0;border:1px solid #cbd5e1;padding:4px 8px;margin-bottom:6px;border-radius:3px}.fields-row{display:flex;gap:20px;margin-bottom:6px;font-size:11px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}.field{flex:1;display:flex}.fl{font-weight:700;margin-right:5px}.fv{color:#334185;font-weight:700}.obs-container{border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#fff;min-height:40px;margin-bottom:8px}.obs{font-size:10px;line-height:1.4;color:#334155}.sigs{display:flex;flex-direction:column;align-items:center;gap:15px;margin-top:30px;font-size:11px}.sb{text-align:center;width:60%}.sl{border-bottom:1px solid #94a3b8;height:20px;margin-bottom:3px}.sn{font-weight:700;line-height:20px;color:#0f172a}.footer{text-align:center;font-size:10px;color:#64748b;margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:8px}</style></head><body><div class="header"><div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div><h2>Ordem de Serviço</h2></div><div class="meta-row"><div></div><div style="font-size:11px;font-weight:600;color:#475569">Data: <u>' + dataCriacao + '</u></div></div><div class="section-title">Dados do Cliente</div><div class="fields-row"><div class="field"><span class="fl">Nome:</span> <span class="fv">' + (os.clienteNome||'\u2014') + '</span></div></div><div class="fields-row"><div class="field"><span class="fl">CPF:</span> <span class="fv">' + (os.clienteCpf||'\u2014') + '</span></div><div class="field"><span class="fl">Cel.:</span> <span class="fv">' + (os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '\u2014') + '</span></div></div><div class="fields-row" style="border:none;"><span class="fl">Endereço:</span> <span class="fv">' + enderecoF + '</span></div><div class="section-title" style="margin-top:8px;">Dados do Veículo</div><div class="fields-row" style="border:none;"><div class="field"><span class="fl">Modelo:</span> <span class="fv">' + (os.modeloVeiculo||'\u2014') + '</span></div><div class="field"><span class="fl">Cor:</span> <span class="fv">' + (os.corVeiculo||'\u2014') + '</span></div></div><div class="section-title" style="margin-top:8px;">Descrição da Manutenção</div><div class="obs-container"><div class="obs">' + descHtml + '</div>' + fotosHtml + '</div><div class="sigs"><div class="sb"><div class="sl"></div><div style="font-weight:700">Assinatura do Cliente</div></div><div class="sb"><div class="sl sn">' + (os.mecanico||'\u2014') + '</div><div style="font-weight:700">Técnico Responsável</div></div></div><div class="footer">Supra Bike CNPJ 07.870.286.0001-05 - Estr. Real de Mauá N 739. Magé, RJ.</div></body></html>';

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Ordem_Servico_OS_' + os.id + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // =============================================
  // INSTAGRAM
  // =============================================
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
    gerarCodigoOS, formatarMoeda, formatarMoedaDigitada, aplicarMascaraMoedaInput,
    formatarTelefone, limparTelefone,
    formatarData, formatarDataHora, formatarHora, calcularTempoTotal,
    traduzirStatus, traduzirVeiculo, traduzirPagamento,
    traduzirStatusPagamento, traduzirRole, formatarDataEntrega,
    comprimirFotoBase64, removerAcentos, escapeHtml,
    gerarMensagemWhatsApp, gerarLinkWhatsApp, abrirInstagram,
    gerarPDFEntrega,
    gerarPDFRetirada: gerarPDFRetiradaDoc,
    gerarPDFTermoRetirada: gerarPDFRetiradaDoc,
    gerarPDFRetiradaDoc,
    gerarPDFOrdemServico,
    hashSenha, gerarId, debounce
  };
})();

