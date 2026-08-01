-- ============================================
-- SCRIPT DE CRIAÇÃO DE TABELAS — SUPABASE (BOA GESTÃO)
-- Cole este código no SQL Editor do seu Supabase e clique em "Run"
-- ============================================

-- 1. Tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id TEXT PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_cpf TEXT,
  cliente_endereco TEXT,
  modelo_veiculo TEXT,
  cor_veiculo TEXT,
  servicos JSONB DEFAULT '[]'::jsonb,
  valor_total NUMERIC DEFAULT 0,
  valor_entrada NUMERIC DEFAULT 0,
  valor_restante NUMERIC DEFAULT 0,
  forma_pagamento JSONB DEFAULT '[]'::jsonb,
  status_pagamento TEXT DEFAULT 'pendente',
  status TEXT DEFAULT 'aguardando',
  prioridade TEXT DEFAULT 'normal',
  observacoes TEXT,
  data_servico DATE,
  tem_data_entrega BOOLEAN DEFAULT false,
  data_entrega DATE,
  hora_entrega TEXT,
  tem_fotos BOOLEAN DEFAULT false,
  fotos JSONB DEFAULT '[]'::jsonb,
  campos_personalizados JSONB DEFAULT '{}'::jsonb,
  atendente TEXT,
  mecanico TEXT,
  editado_por TEXT,
  editado_em TIMESTAMP WITH TIME ZONE,
  hora_inicio TIMESTAMP WITH TIME ZONE,
  hora_fim TIMESTAMP WITH TIME ZONE,
  tempo_total TEXT,
  historico JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Usuários (Funcionários)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  usuario TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  role TEXT NOT NULL,
  is_interno BOOLEAN DEFAULT false,
  exibir_na_delegacao BOOLEAN DEFAULT true,
  foto_perfil TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Cargos e Permissões
CREATE TABLE IF NOT EXISTS public.cargos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  permissoes JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Listas de Opções (Modelos, Cores, etc)
CREATE TABLE IF NOT EXISTS public.opcoes_listas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  campo TEXT UNIQUE NOT NULL,
  itens JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Tabela de Campos Personalizados
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  secao TEXT DEFAULT 'Outros',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Tabela de Configurações Gerais (ex: Template do WhatsApp)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- HABILITAR RLS (Row Level Security) e PERMITIR ACESSO PÚBLICO/ANON KEY
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes_listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público (Leitura, Inserção, Atualização, Exclusão)
DROP POLICY IF EXISTS "Public Ordens Access" ON public.ordens_servico;
CREATE POLICY "Public Ordens Access" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Usuarios Access" ON public.usuarios;
CREATE POLICY "Public Usuarios Access" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Cargos Access" ON public.cargos;
CREATE POLICY "Public Cargos Access" ON public.cargos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Opcoes Access" ON public.opcoes_listas;
CREATE POLICY "Public Opcoes Access" ON public.opcoes_listas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Campos Access" ON public.campos_personalizados;
CREATE POLICY "Public Campos Access" ON public.campos_personalizados FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Config Access" ON public.configuracoes;
CREATE POLICY "Public Config Access" ON public.configuracoes FOR ALL USING (true) WITH CHECK (true);

-- HABILITAR SUPABASE REALTIME NAS TABELAS (Tempo Real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cargos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.opcoes_listas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campos_personalizados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes;
