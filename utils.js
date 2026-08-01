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
    const camposDef = typeof Storage !== 'undefined' ? Storage.getCampos() : [];
    const campos = os.camposPersonalizados || {};

    // === Coleta de dados dos campos personalizados ===
    let temGarantia = false, endereco = '', valorRetirada = '', levar = '';
    let deixouChave = false, deixouCarregador = false, deixouControle = false, deixouDocumento = false;

    for (const [campoId, val] of Object.entries(campos)) {
      const cDef = camposDef.find(c => c.id === campoId);
      if (!cDef) continue;
      const name = cDef.nome.toLowerCase();
      if ((name.includes('garantia') || name.includes('warranty')) && (val.valor === true || val.valor === 'Sim' || String(val.valor).toLowerCase() === 'sim')) temGarantia = true;
      if (name.includes('endere') || name.includes('rua') || name.includes('bairro') || name.includes('cidade')) { if (val.valor && typeof val.valor === 'string') endereco = val.valor; }
      if (name.includes('taxa') || name.includes('retirada') || name.includes('valor')) {
        if (val.valor != null) {
          if (typeof val.valor === 'number') valorRetirada = formatarMoeda(val.valor);
          else if (typeof val.valor === 'string' && val.valor.trim() && !['true','false'].includes(val.valor.toLowerCase())) valorRetirada = val.valor;
        }
      }
      if (name.includes('levar') || name.includes('trazer') || name.includes('itens')) { if (val.valor && typeof val.valor === 'string') levar = val.valor; }
      if (name.includes('chave')) deixouChave = !!val.valor;
      if (name.includes('carregador')) deixouCarregador = !!val.valor;
      if (name.includes('controle') || name.includes('nfc') || name.includes('tag')) deixouControle = !!val.valor;
      if (name.includes('documento') || name.includes('doc')) deixouDocumento = !!val.valor;
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const servicos = os.servicos || [];
    const observacoes = os.observacoes || '';
    const fotos = (os.temFotos && Array.isArray(os.fotos)) ? os.fotos : [];

    // === Tenta usar jsPDF (download direto sem print dialog) ===
    if (window.jspdf) {
      _gerarPDFComJsPDF(os, { temGarantia, endereco, valorRetirada, levar, deixouChave, deixouCarregador, deixouControle, deixouDocumento, dataGeracao, servicos, observacoes, fotos });
    } else {
      // Fallback: gera HTML e faz download como arquivo .html (sem print dialog)
      _gerarPDFFallbackHTML(os, { temGarantia, endereco, valorRetirada, levar, deixouChave, deixouCarregador, deixouControle, deixouDocumento, dataGeracao, servicos, observacoes, fotos });
    }
  }

  function _gerarPDFComJsPDF(os, d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pw = 210, ml = 15, cw = pw - ml * 2;
    let y = 15;

    function secTitle(t) {
      doc.setDrawColor(203, 213, 225); doc.setFillColor(248, 250, 252);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(t, ml + 4, y + 4); y += 7;
      doc.line(ml, y - 2.5, ml + cw, y - 2.5); y += 1;
    }
    function field(lbl, val, x, mw) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(lbl, x, y);
      const lw = doc.getTextWidth(lbl) + 1;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 65, 133);
      doc.text(val || '\u2014', x + lw, y);
      doc.setDrawColor(148, 163, 184); doc.setLineDashPattern([1,1],0);
      doc.line(x + lw, y + 0.5, x + mw, y + 0.5); doc.setLineDashPattern([],0);
    }
    function box(sy, ey) {
      doc.setDrawColor(203, 213, 225); doc.setFillColor(248, 250, 252);
      doc.roundedRect(ml, sy, cw, ey - sy, 2, 2, 'FD');
    }
    function checkPage(need) { if (y + need > 280) { doc.addPage(); y = 15; } }

    // HEADER
    doc.setFont('helvetica','bold'); doc.setFontSize(26);
    doc.setTextColor(239,68,68); doc.text('SUPRA', pw/2 - 2, y, {align:'right'});
    doc.setTextColor(30,58,138); doc.text(' BIKE', pw/2 + 2, y, {align:'left'});
    y += 8;
    doc.setFontSize(11); doc.setTextColor(30,41,59);
    doc.text('TERMO DE AUTORIZA\u00C7\u00C3O DE RETIRADA PARA MANUTEN\u00C7\u00C3O', pw/2, y, {align:'center'});
    y += 3;
    doc.setDrawColor(239,68,68); doc.setLineWidth(0.8); doc.line(ml, y, ml+cw, y); doc.setLineWidth(0.2); y += 6;

    // GARANTIA + DATA
    if (d.temGarantia) {
      doc.setFillColor(34,197,94); doc.roundedRect(ml, y-3.5, 24, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
      doc.text('GARANTIA', ml+2, y);
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(71,85,105);
    doc.text('Data: ' + d.dataGeracao, ml+cw, y, {align:'right'}); y += 8;

    // DADOS DO CLIENTE
    let sy = y; box(sy, sy+24); y = sy+1; secTitle('DADOS DO CLIENTE');
    field('Nome: ', os.clienteNome||'', ml+4, ml+cw*0.58);
    field('Cel.: ', os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '', ml+cw*0.62, ml+cw-4);
    y += 6; field('Endere\u00E7o: ', d.endereco||'N\u00E3o cadastrado', ml+4, ml+cw-4); y += 8;

    // DADOS DO VEÍCULO
    sy = y; box(sy, sy+18); y = sy+1; secTitle('DADOS DO VE\u00CDCULO');
    field('Modelo: ', os.modeloVeiculo||'', ml+4, ml+cw*0.45);
    field('Cor: ', os.corVeiculo||'', ml+cw*0.52, ml+cw-4); y += 8;

    // TAXA DE RETIRADA
    sy = y; box(sy, sy+18); y = sy+1; secTitle('TAXA DE RETIRADA');
    field('Valor: ', d.valorRetirada||'', ml+4, ml+cw*0.45);
    field('Levar: ', d.levar||'', ml+cw*0.52, ml+cw-4); y += 8;

    // ITENS RETIRADOS
    sy = y; box(sy, sy+18); y = sy+1; secTitle('ITENS RETIRADOS');
    const itens = [{l:'Chaves',c:d.deixouChave},{l:'Controles',c:d.deixouControle},{l:'Carregador',c:d.deixouCarregador},{l:'Documentos',c:d.deixouDocumento}];
    const colW = (cw-8)/4;
    itens.forEach((it,i) => {
      const ix = ml+4+i*colW;
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,58,138);
      doc.text(it.c ? '\u2611' : '\u2610', ix, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,41,59);
      doc.text(' '+it.l, ix+4, y);
    }); y += 8;

    // DESCRIÇÃO DA MANUTENÇÃO (Unificada com Serviços)
    let descTexto = '';
    if (d.servicos && d.servicos.length > 0) {
      descTexto += 'SERVI\u00C7OS EXECUTADOS:\n';
      d.servicos.forEach((s, idx) => {
        descTexto += `${idx + 1}. ${s.descricao || 'Servi\u00E7o'} (${formatarMoeda(s.valor || 0)})\n`;
      });
      descTexto += `VALOR TOTAL: ${formatarMoeda(os.valorTotal || 0)}\n`;
      if (d.observacoes) {
        descTexto += `\nOBSERVA\u00C7\u00D5ES:\n${d.observacoes}`;
      }
    } else {
      descTexto = d.observacoes || 'Nenhuma manuten\u00E7\u00E3o cadastrada.';
    }

    const obsLines = doc.splitTextToSize(descTexto, cw-12);
    const obsH = Math.max(18, obsLines.length * 4.2 + 12);
    checkPage(obsH);
    sy = y; box(sy, sy+obsH); y = sy+1; secTitle('DESCRI\u00C7\u00C3O DA MANUTEN\u00C7\u00C3O (OBSERVA\u00C7\u00D5ES)');
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(51,65,133);
    doc.text(obsLines, ml+4, y+1); y = sy+obsH+3;

    // AUTORIZAÇÃO
    const a1 = 'Autorizo a SUPRA BIKE a retirar o ve\u00EDculo acima para realiza\u00E7\u00E3o de inspe\u00E7\u00E3o t\u00E9cnica, manuten\u00E7\u00E3o e/ou reparo.';
    const a2 = 'Estou ciente de que a retirada do ve\u00EDculo n\u00E3o caracteriza aprova\u00E7\u00E3o autom\u00E1tica da garantia. Caso o defeito n\u00E3o esteja coberto pela garantia, ser\u00E1 apresentado or\u00E7amento para aprova\u00E7\u00E3o antes da execu\u00E7\u00E3o do servi\u00E7o.';
    const a1L = doc.splitTextToSize(a1, cw-12), a2L = doc.splitTextToSize(a2, cw-12);
    const aH = (a1L.length+a2L.length)*4.2+14;
    checkPage(aH);
    sy = y; box(sy, sy+aH); y = sy+1; secTitle('AUTORIZA\u00C7\u00C3O');
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(71,85,105);
    doc.text(a1L, ml+4, y+1); y += a1L.length*4.2+2;
    doc.text(a2L, ml+4, y+1); y = sy+aH+8;

    // ASSINATURAS
    checkPage(20);
    const sw = (cw-20)/2;
    doc.setDrawColor(148,163,184);
    doc.line(ml+4, y, ml+4+sw, y);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(30,41,59);
    doc.text('Assinatura do Cliente', ml+4+sw/2, y+5, {align:'center'});
    const tx = ml+cw-4-sw;
    if (os.mecanico) { doc.setTextColor(15,23,42); doc.text(os.mecanico, tx+sw/2, y-2, {align:'center'}); }
    doc.line(tx, y, tx+sw, y);
    doc.setTextColor(30,41,59); doc.text('T\u00E9cnico Respons\u00E1vel', tx+sw/2, y+5, {align:'center'});

    // FOTOS (em nova página se houver fotos anexadas)
    if (d.fotos && d.fotos.length > 0) {
      doc.addPage();
      y = 15;
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(30,41,59);
      doc.text('FOTOS DO VE\u00CDCULO - OS ' + os.id, pw/2, y, {align:'center'});
      y += 10;

      const imgW = 80, imgH = 60, gap = 8, cols = 2;
      d.fotos.forEach((src, i) => {
        if (!src) return;
        const col = i % cols;
        const x = ml + col * (imgW + gap);
        if (col === 0 && i > 0) y += imgH + gap;
        if (y + imgH > 280) { doc.addPage(); y = 15; }
        try {
          let format = 'JPEG';
          if (src.includes('image/png') || src.includes('data:image/png')) format = 'PNG';
          // jsPDF adiciona fotos base64 de forma direta e síncrona
          doc.addImage(src, format, x, y, imgW, imgH);
        } catch(e) {
          console.warn('Erro ao desenhar imagem no PDF:', e);
        }
      });
    }

    // Salva o PDF diretamente no dispositivo
    doc.save('Termo_Retirada_OS_' + os.id + '.pdf');
  }

  function _gerarPDFFallbackHTML(os, d) {
    let descTextoHtml = '';
    if (d.servicos && d.servicos.length > 0) {
      descTextoHtml += '<strong style="color:#1e3a8a;">SERVI\u00C7OS EXECUTADOS:</strong><br>';
      d.servicos.forEach((s, idx) => {
        descTextoHtml += `${idx + 1}. ${escapeHtml(s.descricao || 'Servi\u00E7o')} (${formatarMoeda(s.valor || 0)})<br>`;
      });
      descTextoHtml += `<strong style="color:#ef4444;">VALOR TOTAL: ${formatarMoeda(os.valorTotal || 0)}</strong><br>`;
      if (d.observacoes) {
        descTextoHtml += `<br><strong style="color:#1e3a8a;">OBSERVA\u00C7\u00D5ES:</strong><br>${escapeHtml(d.observacoes).replace(/\n/g, '<br>')}`;
      }
    } else {
      descTextoHtml = d.observacoes ? escapeHtml(d.observacoes).replace(/\n/g, '<br>') : 'Nenhuma manuten\u00E7\u00E3o cadastrada.';
    }

    const fotosHtml = d.fotos.length > 0 ? `
      <div class="section">
        <div class="section-title">Fotos do Ve\u00EDculo</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${d.fotos.map(src => `<img src="${src}" style="width:120px;height:90px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;">`).join('')}
        </div>
      </div>` : '';

    const ck = (v) => v ? '\u2611' : '\u2610';
    const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo_Retirada_OS_${os.id}</title>
<style>
@page{size:A4 portrait;margin:12mm 15mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#0f172a;background:#fff;padding:20px;font-size:12px}
.header{text-align:center;border-bottom:2.5px solid #ef4444;padding-bottom:10px;margin-bottom:12px}
.brand{font-size:30px;font-weight:800;letter-spacing:2px}.red{color:#ef4444}.blue{color:#1e3a8a}
h2{font-size:13px;font-weight:800;text-transform:uppercase;color:#1e293b;margin-top:6px}
.meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.garantia-badge{background:#22c55e;color:#fff;padding:3px 10px;font-weight:800;font-size:10px;border-radius:4px;text-transform:uppercase}
.section{border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;margin-bottom:10px;background:#f8fafc}
.section-title{font-weight:800;font-size:10px;text-transform:uppercase;color:#1e293b;border-bottom:1.5px solid #cbd5e1;padding-bottom:3px;margin-bottom:7px}
.fields-row{display:flex;gap:15px;font-size:11px;margin-bottom:5px}.field{flex:1}
.fl{font-weight:700}.fv{border-bottom:1px dashed #94a3b8;display:inline-block;min-width:60%;padding-left:3px;color:#334185}
.checks-row{display:flex;gap:10px;font-size:11px}.ci{display:flex;align-items:center;gap:4px;flex:1}
.ck{font-size:15px;font-weight:bold;color:#1e3a8a}
.obs{font-size:10.5px;line-height:1.5;color:#334155;min-height:30px;}
.auth{font-size:10px;line-height:1.5;color:#475569}
.sigs{display:flex;gap:40px;margin-top:30px;font-size:11px}.sb{flex:1;text-align:center}
.sl{border-bottom:1px solid #94a3b8;height:25px;margin-bottom:4px}.sn{font-weight:700;line-height:25px;color:#0f172a}
</style></head><body>
<div class="header"><div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div>
<h2>Termo de Autoriza\u00E7\u00E3o de Retirada para Manuten\u00E7\u00E3o</h2></div>
<div class="meta-row"><div>${d.temGarantia ? '<span class="garantia-badge">GARANTIA</span>' : ''}</div><div style="font-size:11px;font-weight:600;color:#475569">Data: <u>${d.dataGeracao}</u></div></div>
<div class="section"><div class="section-title">Dados do Cliente</div>
<div class="fields-row"><div class="field"><span class="fl">Nome:</span> <span class="fv">${os.clienteNome||'\u2014'}</span></div>
<div class="field"><span class="fl">Cel.:</span> <span class="fv">${os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '\u2014'}</span></div></div>
<div><span class="fl">Endere\u00E7o:</span> <span class="fv" style="width:85%">${d.endereco||'N\u00E3o cadastrado'}</span></div></div>
<div class="section"><div class="section-title">Dados do Ve\u00EDculo</div>
<div class="fields-row"><div class="field"><span class="fl">Modelo:</span> <span class="fv">${os.modeloVeiculo||'\u2014'}</span></div>
<div class="field"><span class="fl">Cor:</span> <span class="fv">${os.corVeiculo||'\u2014'}</span></div></div></div>
<div class="section"><div class="section-title">Taxa de Retirada</div>
<div class="fields-row"><div class="field"><span class="fl">Valor:</span> <span class="fv">${d.valorRetirada||'\u2014'}</span></div>
<div class="field"><span class="fl">Levar:</span> <span class="fv">${d.levar||'\u2014'}</span></div></div></div>
<div class="section"><div class="section-title">Itens Retirados</div>
<div class="checks-row"><div class="ci"><span class="ck">${ck(d.deixouChave)}</span> Chaves</div>
<div class="ci"><span class="ck">${ck(d.deixouControle)}</span> Controles</div>
<div class="ci"><span class="ck">${ck(d.deixouCarregador)}</span> Carregador</div>
<div class="ci"><span class="ck">${ck(d.deixouDocumento)}</span> Documentos</div></div></div>
<div class="section"><div class="section-title">Descri\u00E7\u00E3o da Manuten\u00E7\u00E3o (Observa\u00E7\u00F5es)</div><div class="obs">${descTextoHtml}</div></div>
${fotosHtml}
<div class="section"><div class="section-title">Autoriza\u00E7\u00E3o</div>
<p class="auth">Autorizo a <strong>SUPRA BIKE</strong> a retirar o ve\u00EDculo acima para realiza\u00E7\u00E3o de inspe\u00E7\u00E3o t\u00E9cnica, manuten\u00E7\u00E3o e/ou reparo.</p>
<p class="auth" style="margin-top:4px">Estou ciente de que a retirada do ve\u00EDculo n\u00E3o caracteriza aprova\u00E7\u00E3o autom\u00E1tica da garantia. Caso o defeito n\u00E3o esteja coberto pela garantia, ser\u00E1 apresentado or\u00E7amento para aprova\u00E7\u00E3o antes da execu\u00E7\u00E3o do servi\u00E7o.</p></div>
<div class="sigs"><div class="sb"><div class="sl"></div><div style="font-weight:700">Assinatura do Cliente</div></div>
<div class="sb"><div class="sl sn">${os.mecanico||'\u2014'}</div><div style="font-weight:700">T\u00E9cnico Respons\u00E1vel</div></div></div>
</body></html>`;

    // Download direto como arquivo HTML (sem abrir caixa de impressão)
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Termo_Retirada_OS_' + os.id + '.html';
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
    hashSenha, gerarId, debounce
  };
})();
