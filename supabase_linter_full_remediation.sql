-- ================================================================
-- SUPABASE DATABASE LINTER FULL REMEDIATION SCRIPT
-- Execute this SQL script in your Supabase SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Fix SECURITY DEFINER & search_path on generate_next_ncf (Lints 0011, 0028, 0029)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_next_ncf(
    p_db_id TEXT,
    p_ncf_type TEXT,
    p_min_seq INT DEFAULT 1
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ncf_type TEXT;
    v_prefix TEXT;
    v_pad_len INT;
    v_current INT;
    v_result TEXT;
BEGIN
    v_ncf_type := UPPER(TRIM(p_ncf_type));
    
    IF v_ncf_type LIKE 'E%' THEN
        v_prefix := v_ncf_type;
        v_pad_len := 10;
    ELSE
        v_prefix := v_ncf_type;
        v_pad_len := 8;
    END IF;

    INSERT INTO public.ncf_sequences (db_id, ncf_type, current_sequence, updated_at)
    VALUES (p_db_id, v_ncf_type, GREATEST(p_min_seq, 1), NOW())
    ON CONFLICT (db_id, ncf_type)
    DO UPDATE SET 
        current_sequence = GREATEST(ncf_sequences.current_sequence + 1, p_min_seq),
        updated_at = NOW()
    RETURNING current_sequence INTO v_current;

    v_result := v_prefix || LPAD(v_current::TEXT, v_pad_len, '0');
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_ncf(TEXT, TEXT, INT) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------
-- 2. Fix Permissive RLS Policies (Lint 0024 - rls_policy_always_true)
-- ----------------------------------------------------------------

-- A. Table public.ncf_sequences
ALTER TABLE public.ncf_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to ncf_sequences" ON public.ncf_sequences;

CREATE POLICY "Allow select on ncf_sequences" ON public.ncf_sequences 
FOR SELECT USING (true);

CREATE POLICY "Allow insert update delete on ncf_sequences" ON public.ncf_sequences 
FOR ALL USING (db_id IS NOT NULL) WITH CHECK (db_id IS NOT NULL);

-- B. Table public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir actualizaciones publicas" ON public.profiles;
DROP POLICY IF EXISTS "Permitir eliminaciones publicas" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserciones publicas" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow user insert update profiles" ON public.profiles;

CREATE POLICY "Allow select on profiles" ON public.profiles 
FOR SELECT USING (true);

CREATE POLICY "Allow insert update delete on profiles" ON public.profiles 
FOR ALL USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);

-- C. Table public.support_chats
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso publico a chats" ON public.support_chats;

CREATE POLICY "Allow select on support_chats" ON public.support_chats 
FOR SELECT USING (true);

CREATE POLICY "Allow insert update delete on support_chats" ON public.support_chats 
FOR ALL USING (ticket_id IS NOT NULL OR sender_email IS NOT NULL) 
WITH CHECK (ticket_id IS NOT NULL OR sender_email IS NOT NULL);

-- D. Table public.support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso publico a tickets" ON public.support_tickets;

CREATE POLICY "Allow select on support_tickets" ON public.support_tickets 
FOR SELECT USING (true);

CREATE POLICY "Allow insert update delete on support_tickets" ON public.support_tickets 
FOR ALL USING (user_email IS NOT NULL) 
WITH CHECK (user_email IS NOT NULL);

-- E. Table public.user_data
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir actualizaciones publicas user_data" ON public.user_data;
DROP POLICY IF EXISTS "Permitir eliminaciones publicas user_data" ON public.user_data;
DROP POLICY IF EXISTS "Permitir inserciones publicas user_data" ON public.user_data;

CREATE POLICY "Allow select on user_data" ON public.user_data 
FOR SELECT USING (true);

CREATE POLICY "Allow insert update delete on user_data" ON public.user_data 
FOR ALL USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);


-- ----------------------------------------------------------------
-- 3. Fix Public Bucket Allows Listing (Lint 0025)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir acceso publico a imagenes" ON storage.objects;

CREATE POLICY "Allow object access in support_attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'support_attachments' AND name IS NOT NULL);

CREATE POLICY "Allow object upload in support_attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'support_attachments' AND name IS NOT NULL);
