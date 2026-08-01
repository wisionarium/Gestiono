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
    const checkOn = '☑';
    const checkOff = '☐';

    const htmlDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo_Retirada_OS_${os.id}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #fff; padding: 10px; font-size: 12px; }
    .header { text-align: center; border-bottom: 2.5px solid #ef4444; padding-bottom: 10px; margin-bottom: 12px; }
    .header .brand { font-size: 30px; font-weight: 800; letter-spacing: 2px; }
    .header .brand .red { color: #ef4444; }
    .header .brand .blue { color: #1e3a8a; }
    .header h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin-top: 6px; letter-spacing: 0.5px; }
    .meta-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .garantia-badge { background: #22c55e; color: #fff; padding: 3px 10px; font-weight: 800; font-size: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .data-label { font-size: 11px; font-weight: 600; color: #475569; }
    .section { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; background: #f8fafc; }
    .section-title { font-weight: 800; font-size: 10px; text-transform: uppercase; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 7px; letter-spacing: 0.5px; }
    .fields-row { display: flex; gap: 15px; font-size: 11px; margin-bottom: 5px; }
    .fields-row .field { flex: 1; }
    .field-label { font-weight: 700; }
    .field-value { border-bottom: 1px dashed #94a3b8; display: inline-block; min-width: 60%; padding-left: 3px; color: #334185; }
    .field-full { font-size: 11px; }
    .checks-row { display: flex; gap: 10px; font-size: 11px; }
    .check-item { display: flex; align-items: center; gap: 4px; flex: 1; }
    .check-icon { font-size: 15px; font-weight: bold; color: #1e3a8a; }
    .obs-text { font-size: 10.5px; line-height: 1.5; color: #334155; min-height: 50px; word-break: break-word; white-space: pre-wrap; }
    .auth-text { font-size: 10px; line-height: 1.5; color: #475569; }
    .signatures { display: flex; gap: 40px; margin-top: 30px; font-size: 11px; }
    .sig-block { flex: 1; text-align: center; }
    .sig-line { border-bottom: 1px solid #94a3b8; height: 25px; margin-bottom: 4px; }
    .sig-name { font-weight: 700; line-height: 25px; color: #0f172a; }
    .sig-label { font-weight: 700; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand"><span class="red">SUPRA</span> <span class="blue">BIKE</span></div>
    <h2>Termo de Autorização de Retirada para Manutenção</h2>
  </div>

  <div class="meta-row">
    <div>${temGarantia ? '<span class="garantia-badge">GARANTIA</span>' : ''}</div>
    <div class="data-label">Data: <u>${dataGeracao}</u></div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="fields-row">
      <div class="field"><span class="field-label">Nome:</span> <span class="field-value">${os.clienteNome || '—'}</span></div>
      <div class="field"><span class="field-label">Cel.:</span> <span class="field-value">${os.clienteTelefone ? formatarTelefone(os.clienteTelefone) : '—'}</span></div>
    </div>
    <div class="field-full"><span class="field-label">Endereço:</span> <span class="field-value" style="width:85%">${endereco || 'Não cadastrado'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Veículo</div>
    <div class="fields-row">
      <div class="field"><span class="field-label">Modelo:</span> <span class="field-value">${os.modeloVeiculo || '—'}</span></div>
      <div class="field"><span class="field-label">Cor:</span> <span class="field-value">${os.corVeiculo || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Taxa de Retirada</div>
    <div class="fields-row">
      <div class="field"><span class="field-label">Valor:</span> <span class="field-value">${valorRetirada || '—'}</span></div>
      <div class="field"><span class="field-label">Levar:</span> <span class="field-value">${levar || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens Retirados</div>
    <div class="checks-row">
      <div class="check-item"><span class="check-icon">${deixouChave ? checkOn : checkOff}</span> Chaves</div>
      <div class="check-item"><span class="check-icon">${deixouControle ? checkOn : checkOff}</span> Controles</div>
      <div class="check-item"><span class="check-icon">${deixouCarregador ? checkOn : checkOff}</span> Carregador</div>
      <div class="check-item"><span class="check-icon">${deixouDocumento ? checkOn : checkOff}</span> Documentos</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Descrição da Manutenção (Observações)</div>
    <div class="obs-text">${os.observacoes || 'Nenhuma observação cadastrada.'}</div>
  </div>

  <div class="section">
    <div class="section-title">Autorização</div>
    <p class="auth-text">Autorizo a <strong>SUPRA BIKE</strong> a retirar o veículo acima para realização de inspeção técnica, manutenção e/ou reparo.</p>
    <p class="auth-text" style="margin-top:4px">Estou ciente de que a retirada do veículo não caracteriza aprovação automática da garantia. Caso o defeito não esteja coberto pela garantia, será apresentado orçamento para aprovação antes da execução do serviço.</p>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Assinatura do Cliente</div>
    </div>
    <div class="sig-block">
      <div class="sig-line sig-name">${os.mecanico || '—'}</div>
      <div class="sig-label">Técnico Responsável</div>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`;

    // Abre nova janela com o termo e aciona impressão/salvar como PDF
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(htmlDoc);
      printWindow.document.close();
    } else {
      // Fallback: usa Blob + link
      const blob = new Blob([htmlDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
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
