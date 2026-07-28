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

  // Tenta inicializar na carga
  initClient();

  return {
    getClient,
    isConnected,
    setCredentials,
    getCredentials
  };
})();
