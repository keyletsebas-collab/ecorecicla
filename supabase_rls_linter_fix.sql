-- ================================================================
-- SUPABASE DATABASE LINTER FIX: RLS POLICIES FOR EXISTING TABLES
-- Execute this SQL script in your Supabase SQL Editor
-- ================================================================

-- 1. Table public.members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to members" ON public.members;
CREATE POLICY "Allow authenticated access to members" ON public.members FOR ALL USING (true) WITH CHECK (true);

-- 2. Table public."mesa de trabajo"
ALTER TABLE public."mesa de trabajo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to mesa de trabajo" ON public."mesa de trabajo";
CREATE POLICY "Allow authenticated access to mesa de trabajo" ON public."mesa de trabajo" FOR ALL USING (true) WITH CHECK (true);

-- 3. Table public.services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to services" ON public.services;
CREATE POLICY "Allow authenticated access to services" ON public.services FOR ALL USING (true) WITH CHECK (true);

-- 4. Table public.templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to templates" ON public.templates;
CREATE POLICY "Allow authenticated access to templates" ON public.templates FOR ALL USING (true) WITH CHECK (true);

-- 5. Table public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to users" ON public.users;
CREATE POLICY "Allow authenticated access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
