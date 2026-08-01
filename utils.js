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

  function gerarPDFRetirada(osInput) {
    const os = (typeof osInput === 'string' && typeof Storage !== 'undefined') ? Storage.getOrdemById(osInput) : osInput;
    if (!os) {
      console.warn('OS não encontrada para geração do PDF:', osInput);
      return;
    }

    const camposDef = typeof Storage !== 'undefined' ? Storage.getCampos() : [];
    const campos = os.camposPersonalizados || {};

    // === Coleta de dados dos campos personalizados e diretos ===
    let temGarantia = !!os.temGarantia, endereco = os.clienteEndereco || '', valorRetirada = os.valorRetirada || 'R$ 0,00', taxaEntrega = os.taxaEntrega || os.levar || 'R$ 0,00';
    let deixouChave = !!os.deixouChave, deixouCarregador = !!os.deixouCarregador, deixouControle = !!os.deixouControle, deixouDocumento = !!os.deixouDocumento;
    let qtdChave = os.qtdChave || '', qtdControle = os.qtdControle || '';

    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (!cDef) continue;
      const name = cDef.nome.toLowerCase();
      if (!temGarantia && (name.includes('garantia') || name.includes('warranty')) && (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim')) temGarantia = true;
      if (!endereco && (name.includes('endere') || name.includes('rua') || name.includes('bairro') || name.includes('cidade'))) { if (val.valor && typeof val.valor === 'string') endereco = val.valor; }
      if ((!valorRetirada || valorRetirada === 'R$ 0,00') && (name.includes('retirada') || name.includes('taxa'))) {
        if (val.valor != null) {
          if (typeof val.valor === 'number') valorRetirada = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) valorRetirada = val.valor;
        }
      }
      if ((!taxaEntrega || taxaEntrega === 'R$ 0,00') && (name.includes('entrega') || name.includes('levar') || name.includes('trazer'))) {
        if (val.valor != null) {
          if (typeof val.valor === 'number') taxaEntrega = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) taxaEntrega = val.valor;
        }
      }
      if (!deixouChave && name.includes('chave')) deixouChave = !!val.valor;
      if (!deixouCarregador && name.includes('carregador')) deixouCarregador = !!val.valor;
      if (!deixouControle && (name.includes('controle') || name.includes('nfc') || name.includes('tag'))) deixouControle = !!val.valor;
      if (!deixouDocumento && (name.includes('documento') || name.includes('doc'))) deixouDocumento = !!val.valor;
      if (!qtdChave && name.includes('chave') && val.quantidade) qtdChave = val.quantidade;
      if (!qtdControle && (name.includes('controle') || name.includes('nfc') || name.includes('tag')) && val.quantidade) qtdControle = val.quantidade;
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const servicos = os.servicos || [];
    const observacoes = os.observacoes || '';
    const fotos = (os.temFotos && Array.isArray(os.fotos)) ? os.fotos : ((Array.isArray(os.fotos)) ? os.fotos : []);

    const dataBag = { temGarantia, endereco, valorRetirada, taxaEntrega, deixouChave, deixouCarregador, deixouControle, deixouDocumento, qtdChave, qtdControle, dataGeracao, servicos, observacoes, fotos };

    if (window.jspdf) {
      _gerarPDFComJsPDF(os, dataBag);
    } else {
      _gerarPDFFallbackHTML(os, dataBag);
    }
  }

  function _gerarPDFComJsPDF(os, d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const pw = 210;
    const ml = 15;
    const cw = 180;

    function drawSectionHeader(title, cy) {
      doc.setFillColor(240, 245, 240);
      doc.setDrawColor(203, 213, 225);
      doc.rect(ml, cy, cw, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
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
      if (checked) {
        doc.line(cx, cy - 3, cx + 3, cy);
        doc.line(cx, cy, cx + 3, cy - 3);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(lbl, cx + 5, cy);
    }

    // 1. CABEÇALHO
    doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
    doc.setTextColor(239, 68, 68); doc.text('SUPRA', pw / 2 - 2, 16, { align: 'right' });
    doc.setTextColor(30, 58, 138); doc.text(' BIKE', pw / 2 + 2, 16, { align: 'left' });
    
    doc.setFontSize(13.5); doc.setTextColor(0);
    doc.text('RELATÓRIO E TERMO DE ENTREGA', pw / 2, 24, { align: 'center' });

    // 2. GARANTIA + DATA
    let y = 33;
    if (d.temGarantia) {
      doc.setFillColor(34, 197, 94);
      doc.rect(ml, y - 3.5, 22, 5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255);
      doc.text('GARANTIA', ml + 2, y);
    }
    
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0);
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    doc.text(`Data:  ${dataExibicao}`, ml + cw - 32, y);

    // 3. DADOS DO CLIENTE
    y = 38;
    drawSectionHeader('DADOS DO CLIENTE', y);
    
    y += 12;
    field('Nome:', os.clienteNome || '', ml + 2, ml + cw - 2, y);
    
    y += 6;
    field('CPF:', os.clienteCpf || '', ml + 2, ml + cw * 0.48, y);
    field('Cel.:', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', ml + cw * 0.52, ml + cw - 2, y);
    
    y += 6;
    const enderecoFormatado = os.clienteEndereco || d.endereco || 'Não cadastrado';
    field('Endereço:', enderecoFormatado, ml + 2, ml + cw - 2, y);

    // 4. DADOS DO VEÍCULO
    y = 68;
    drawSectionHeader('DADOS DO VEÍCULO', y);
    
    y += 12;
    field('Modelo:', os.modeloVeiculo || '', ml + 2, ml + cw * 0.48, y);
    field('Cor:', os.corVeiculo || '', ml + cw * 0.52, ml + cw - 2, y);

    // 5. TAXAS (RETIRADA E ENTREGA)
    y = 88;
    drawSectionHeader('TAXAS (RETIRADA E ENTREGA)', y);
    
    y += 12;
    field('Taxa Retirada:', d.valorRetirada || 'R$ 0,00', ml + 2, ml + cw * 0.48, y);
    field('Taxa Entrega:', d.taxaEntrega || 'R$ 0,00', ml + cw * 0.52, ml + cw - 2, y);

    // 6. ITENS RETIRADOS
    y = 108;
    drawSectionHeader('ITENS RETIRADOS', y);
    
    y += 10;
    const colWidth = cw / 4;
    const labelChave = 'Chaves' + (d.qtdChave ? ` [ ${d.qtdChave} ]` : ' [   ]');
    const labelControle = 'Controles' + (d.qtdControle ? ` [ ${d.qtdControle} ]` : ' [   ]');
    drawCheck(labelChave, d.deixouChave, ml + 2, y);
    drawCheck(labelControle, d.deixouControle, ml + 2 + colWidth, y);
    drawCheck('Carregador', d.deixouCarregador, ml + 2 + colWidth * 2, y);
    drawCheck('Documentos', d.deixouDocumento, ml + 2 + colWidth * 3, y);

    // 7. DESCRIÇÃO DA MANUTENÇÃO
    y = 126;
    drawSectionHeader('DESCRIÇÃO DA MANUTENÇÃO', y);
    
    y += 6;
    const boxStartY = y;
    const boxHeight = 76;
    doc.setDrawColor(180); doc.setFillColor(255);
    doc.rect(ml, boxStartY, cw, boxHeight);
    
    let currentY = boxStartY + 4.5;
    
    if (d.servicos && d.servicos.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('SERVIÇOS EXECUTADOS:', ml + 3, currentY);
      currentY += 4.5;

      d.servicos.forEach((s, idx) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 133);
        doc.text(`${idx + 1}. ${s.descricao || 'Serviço'}`, ml + 3, currentY);
        doc.text(`(${formatarMoeda(s.valor || 0)})`, ml + 50, currentY);
        currentY += 4.5;
      });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(239, 68, 68);
      doc.text(`VALOR TOTAL: ${formatarMoeda(os.valorTotal || 0)}`, ml + cw - 3, currentY - 4.5, { align: 'right' });
      currentY += 1.5;
    }

    if (d.observacoes) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 138);
      doc.text('OBSERVAÇÕES:', ml + 3, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 133);
      const splitObs = doc.splitTextToSize(d.observacoes, cw - 6);
      doc.text(splitObs, ml + 3, currentY);
    }

    const photoAreaY = boxStartY + boxHeight - 25;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0);
    doc.text('FOTOS:', ml + 3, photoAreaY);

    const pwImage = 30;
    const phImage = 20;
    const pGap = (cw - 6 - (pwImage * 5)) / 4;

    for (let i = 0; i < 5; i++) {
      const px = ml + 3 + i * (pwImage + pGap);
      doc.setDrawColor(200); doc.setFillColor(250, 250, 250);
      doc.rect(px, photoAreaY + 2, pwImage, phImage, 'FD');

      if (d.fotos && d.fotos[i]) {
        try {
          let format = 'JPEG';
          if (d.fotos[i].includes('image/png') || d.fotos[i].includes('data:image/png')) format = 'PNG';
          doc.addImage(d.fotos[i], format, px, photoAreaY + 2, pwImage, phImage);
        } catch(e) {
          console.warn('Erro ao inserir foto no PDF:', e);
        }
      }
    }

    // 8. ASSINATURAS
    y = boxStartY + boxHeight + 12;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('Assinatura do Cliente:', pw / 2, y, { align: 'center' });
    doc.setDrawColor(120); doc.setLineWidth(0.3);
    doc.line(pw / 2 - 50, y + 6, pw / 2 + 50, y + 6);
    
    y += 14;
    doc.text('Técnico Responsável', pw / 2, y, { align: 'center' });
    if (os.mecanico) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 133);
      doc.text(os.mecanico, pw / 2, y + 5.5, { align: 'center' });
    }
    doc.line(pw / 2 - 35, y + 7, pw / 2 + 35, y + 7);

    doc.save('Termo_Entrega_OS_' + os.id + '.pdf');
  }

  function _gerarPDFFallbackHTML(os, d) {
    let descTextoHtml = '';
    if (d.servicos && d.servicos.length > 0) {
      descTextoHtml += '<strong style="color:#1e3a8a;">SERVIÇOS EXECUTADOS:</strong><br>';
      d.servicos.forEach((s, idx) => {
        descTextoHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${idx + 1}. ${escapeHtml(s.descricao || 'Serviço')} (${formatarMoeda(s.valor || 0)})</span></div>`;
      });
      descTextoHtml += `<div style="text-align:right; margin-top:4px;"><strong style="color:#ef4444; font-size:12px;">VALOR TOTAL: ${formatarMoeda(os.valorTotal || 0)}</strong></div>`;
      if (d.observacoes) {
        descTextoHtml += `<br><strong style="color:#1e3a8a;">OBSERVAÇÕES:</strong><br>${escapeHtml(d.observacoes).replace(/\n/g, '<br>')}`;
      }
    } else {
      descTextoHtml = d.observacoes ? escapeHtml(d.observacoes).replace(/\n/g, '<br>') : 'Nenhuma manutenção cadastrada.';
    }

    // Slots das 5 fotos em HTML inline
    let fotosHtml = '<div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #ddd; padding-top:10px;">';
    for (let i = 0; i < 5; i++) {
      if (d.fotos && d.fotos[i]) {
        fotosHtml += `<div style="width:70px; height:50px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;"><img src="${d.fotos[i]}" style="width:100%; height:100%; object-fit:cover;"></div>`;
      } else {
        fotosHtml += `<div style="width:70px; height:50px; border:1px dashed #cbd5e1; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Vazio</div>`;
      }
    }
    fotosHtml += '</div>';

    const ck = (v) => v ? '☒' : '☐';
    const dataExibicao = os.criadoEm ? new Date(os.criadoEm).toLocaleDateString('pt-BR') : d.dataGeracao;
    const enderecoFormatado = os.clienteEndereco || d.endereco || 'Não cadastrado';
    const labelChaveHtml = 'Chaves ' + (d.qtdChave ? `[ ${d.qtdChave} ]` : '[   ]');
    const labelControleHtml = 'Controles ' + (d.qtdControle ? `[ ${d.qtdControle} ]` : '[   ]');

    const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo_Entrega_OS_${os.id}</title>
<style>
@page{size:A4 portrait;margin:12mm 15mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#0f172a;background:#fff;padding:20px;font-size:12px; max-width:800px; margin:0 auto;}
.header{text-align:center;border-bottom:2px solid #ef4444;padding-bottom:8px;margin-bottom:10px}
.brand{font-size:26px;font-weight:800;letter-spacing:1px}.red{color:#ef4444}.blue{color:#1e3a8a}
h2{font-size:13px;font-weight:800;text-transform:uppercase;color:#1e293b;margin-top:4px}
.meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.garantia-badge{background:#22c55e;color:#fff;padding:2px 8px;font-weight:800;font-size:9px;border-radius:3px;}
.section-title{font-weight:800;font-size:10px;text-transform:uppercase;color:#000;background:#f0f5f0;border:1px solid #cbd5e1;padding:4px 8px;margin-bottom:6px;border-radius:3px;}
.fields-row{display:flex;gap:20px;margin-bottom:6px;font-size:11px; border-bottom:1px solid #f1f5f9; padding-bottom:4px;}
.field{flex:1; display:flex;}
.fl{font-weight:700; margin-right:5px;}
.fv{color:#334185; font-weight:700;}
.checks-row{display:flex;gap:15px;font-size:11px;margin-bottom:8px;}.ci{display:flex;align-items:center;gap:6px;}
.ck{font-size:14px;color:#1e3a8a;font-weight:bold;}
.obs-container{border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#fff;min-height:80px;margin-bottom:8px;}
.obs{font-size:10px;line-height:1.4;color:#334155;}
.sigs{display:flex;flex-direction:column;align-items:center;gap:15px;margin-top:30px;font-size:11px}
.sb{text-align:center; width:60%;}
.sl{border-bottom:1px solid #94a3b8;height:20px;margin-bottom:3px}.sn{font-weight:700;line-height:20px;color:#0f172a}
</style></head><body>
<div class="header"><div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div>
<h2>Relatório e Termo de Entrega</h2></div>
<div class="meta-row"><div>${d.temGarantia ? '<span class="garantia-badge">GARANTIA</span>' : ''}</div><div style="font-size:11px;font-weight:600;color:#475569">Data: <u>${dataExibicao}</u></div></div>

<div class="section-title">Dados do Cliente</div>
<div class="fields-row">
  <div class="field"><span class="fl">Nome:</span> <span class="fv">${os.clienteNome||'\u2014'}</span></div>
</div>
<div class="fields-row">
  <div class="field"><span class="fl">CPF:</span> <span class="fv">${os.clienteCpf||'\u2014'}</span></div>
  <div class="field"><span class="fl">Cel.:</span> <span class="fv">${os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '\u2014'}</span></div>
</div>
<div class="fields-row" style="border:none;"><span class="fl">Endereço:</span> <span class="fv">${enderecoFormatado}</span></div>

<div class="section-title" style="margin-top:8px;">Dados do Veículo</div>
<div class="fields-row" style="border:none;">
  <div class="field"><span class="fl">Modelo:</span> <span class="fv">${os.modeloVeiculo||'\u2014'}</span></div>
  <div class="field"><span class="fl">Cor:</span> <span class="fv">${os.corVeiculo||'\u2014'}</span></div>
</div>

<div class="section-title" style="margin-top:8px;">Taxas (Retirada e Entrega)</div>
<div class="fields-row" style="border:none;">
  <div class="field"><span class="fl">Taxa Retirada:</span> <span class="fv">${d.valorRetirada||'R$ 0,00'}</span></div>
  <div class="field"><span class="fl">Taxa Entrega:</span> <span class="fv">${d.taxaEntrega||'R$ 0,00'}</span></div>
</div>

<div class="section-title" style="margin-top:8px;">Itens Retirados</div>
<div class="checks-row">
  <div class="ci"><span class="ck">${ck(d.deixouChave)}</span> ${labelChaveHtml}</div>
  <div class="ci"><span class="ck">${ck(d.deixouControle)}</span> ${labelControleHtml}</div>
  <div class="ci"><span class="ck">${ck(d.deixouCarregador)}</span> Carregador</div>
  <div class="ci"><span class="ck">${ck(d.deixouDocumento)}</span> Documentos</div>
</div>

<div class="section-title" style="margin-top:8px;">Descrição da Manutenção</div>
<div class="obs-container">
  <div class="obs">${descTextoHtml}</div>
  ${fotosHtml}
</div>

<div class="sigs">
  <div class="sb"><div class="sl"></div><div style="font-weight:700">Assinatura do Cliente</div></div>
  <div class="sb"><div class="sl sn">${os.mecanico||'\u2014'}</div><div style="font-weight:700">Técnico Responsável</div></div>
</div>
</body></html>`;

    // Download direto do HTML
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Termo_Entrega_OS_' + os.id + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
    gerarPDFTermoRetirada: gerarPDFRetirada,
    gerarPDFEntrega: gerarPDFRetirada,
    hashSenha, gerarId, debounce
  };
})();
