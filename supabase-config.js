// ============================================
// SUPABASE CONFIG — Conexão com Banco de Dados Nuvem
// ============================================

const SupabaseConfig = (() => {
  const DEFAULT_URL = 'https://jmyyzeslvarktonfiklx.supabase.co';
  const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteXl6ZXNsdmFya3RvbmZpa2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTgwNjQsImV4cCI6MjEwMDgzNDA2NH0.FqfT_vtEhpixAo9eSoFESYzFMCRtpKJZOoQjbXWe7As';

  let SUPABASE_URL = localStorage.getItem('os_supabase_url') || DEFAULT_URL;
  let SUPABASE_ANON_KEY = localStorage.getItem('os_supabase_key') || DEFAULT_KEY;

  if (!localStorage.getItem('os_supabase_url')) {
    localStorage.setItem('os_supabase_url', DEFAULT_URL);
    localStorage.setItem('os_supabase_key', DEFAULT_KEY);
  }

  let client = null;

  function initClient() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase conectado com sucesso!');
        return true;
      } catch (e) {
        console.error('❌ Erro ao inicializar Supabase:', e);
        client = null;
        return false;
      }
    }
    client = null;
    return false;
  }

  function getClient() {
    if (!client) {
      initClient();
    }
    return client;
  }

  function isConnected() {
    return !!getClient();
  }

  function setCredentials(url, key) {
    SUPABASE_URL = (url || '').trim();
    SUPABASE_ANON_KEY = (key || '').trim();
    localStorage.setItem('os_supabase_url', SUPABASE_URL);
    localStorage.setItem('os_supabase_key', SUPABASE_ANON_KEY);
    return initClient();
  }

  function getCredentials() {
    return {
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY
    };
  }

  let realtimeChannel = null;

  function initRealtime(callback) {
    if (realtimeChannel) return realtimeChannel;
    const client = getClient();
    if (!client) return null;

    try {
      realtimeChannel = client
        .channel('public-db-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ordens_servico' },
          (payload) => {
            console.log('⚡ Realtime: ordens_servico alterada', payload);
            if (callback) callback('ordens_servico', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'usuarios' },
          (payload) => {
            console.log('⚡ Realtime: usuarios alterados', payload);
            if (callback) callback('usuarios', payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'configuracoes' },
          (payload) => {
            console.log('⚡ Realtime: configuracoes alteradas', payload);
            if (callback) callback('configuracoes', payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('📡 Supabase Realtime conectado com sucesso!');
          }
        });

      return realtimeChannel;
    } catch (e) {
      console.warn('Erro ao conectar Supabase Realtime:', e);
      return null;
    }
  }

  // Tenta inicializar na carga
  initClient();

  return {
    getClient,
    isConnected,
    setCredentials,
    getCredentials,
    initRealtime
  };
})();
