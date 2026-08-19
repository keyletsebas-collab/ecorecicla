-- ================================================================
-- SUPABASE PROFILES & MASTER ROLES SCHEMA (UNIVERSAL FAILSAFE)
-- Execute this SQL script in your Supabase SQL Editor
-- ================================================================

-- 1. Profiles Table for immutable user roles
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely add missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'colaborador';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Remove NOT NULL constraints on name and password columns from legacy templates
DO $$
BEGIN
    ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.profiles ALTER COLUMN password DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user insert update profiles" ON public.profiles;
CREATE POLICY "Allow user insert update profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 5. Insert/Update initial master profiles with values for password, name, and full_name
INSERT INTO public.profiles (id, email, password, role, name, full_name)
VALUES 
    ('master_gerencia', 'gerenciareciminsasrl@gmail.com', 'MANAGED_AUTH', 'master', 'Gerencia Reciminsa', 'Gerencia Reciminsa'),
    ('master_keylet', 'keyletsebas@gmail.com', 'MANAGED_AUTH', 'master', 'Keylet Sebas', 'Keylet Sebas'),
    ('master_noreply', 'noreplyreciminsasrl@gmail.com', 'MANAGED_AUTH', 'master', 'Soporte Reciminsa', 'Soporte Reciminsa')
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role, updated_at = NOW();
