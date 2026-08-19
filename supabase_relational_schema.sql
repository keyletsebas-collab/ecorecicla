-- ================================================================
-- SUPABASE RELATIONAL TABLES & REALTIME SCHEMA
-- Execute this SQL script in your Supabase SQL Editor
-- ================================================================

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    type TEXT,
    ncf TEXT,
    company TEXT,
    total NUMERIC,
    data JSONB NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Finances Table (Ingresos / Egresos)
CREATE TABLE IF NOT EXISTS public.finances (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ingreso' or 'egreso'
    amount NUMERIC,
    concept TEXT,
    data JSONB NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    name TEXT,
    nit TEXT,
    data JSONB NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Materials Table
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    code TEXT,
    name TEXT,
    data JSONB NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Collaborators Table
CREATE TABLE IF NOT EXISTS public.collaborators (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    name TEXT,
    data JSONB NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for all relational tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

-- Security Policies (Allow access to all authenticated and anon users)
DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
CREATE POLICY "Allow all access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to finances" ON public.finances;
CREATE POLICY "Allow all access to finances" ON public.finances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to materials" ON public.materials;
CREATE POLICY "Allow all access to materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to collaborators" ON public.collaborators;
CREATE POLICY "Allow all access to collaborators" ON public.collaborators FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborators;
