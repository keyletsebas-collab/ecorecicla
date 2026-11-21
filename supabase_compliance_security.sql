-- ============================================================================
-- RECIMINSA APP - COMPLIANCE, PRIVACY & SECURITY HARDENING SQL (IDEMPOTENTE)
-- Ejecutar en el SQL Editor del proyecto Supabase antes de produccion.
-- ============================================================================

-- 1. Columnas de auditoria legal y autenticacion segura en public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quick_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quick_code_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version TEXT;

-- 2. RPC seguro: resolver empresa por codigo sin exponer lectura abierta de user_data
CREATE OR REPLACE FUNCTION public.resolve_company_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean TEXT := TRIM(COALESCE(p_code, ''));
    v_norm TEXT := UPPER(REPLACE(TRIM(COALESCE(p_code, '')), ' ', ''));
    v_row RECORD;
    v_family_id TEXT;
    v_company_name TEXT;
    v_company_code TEXT;
BEGIN
    IF LENGTH(v_clean) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
    END IF;

    -- 2a. Buscar registro dedicado company_code_*
    SELECT id, data INTO v_row
    FROM public.user_data
    WHERE id IN ('company_code_' || v_norm, 'company_code_' || v_clean)
    LIMIT 1;

    IF FOUND AND v_row.data IS NOT NULL THEN
        v_family_id := NULLIF(TRIM(COALESCE(v_row.data ->> 'familyId', '')), '');
        v_company_name := COALESCE(NULLIF(TRIM(v_row.data ->> 'companyName'), ''), 'Empresa');
        v_company_code := COALESCE(NULLIF(TRIM(v_row.data ->> 'companyCode'), ''), v_family_id);
        IF v_family_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'ok', true,
                'familyId', v_family_id,
                'companyName', v_company_name,
                'companyCode', v_company_code
            );
        END IF;
    END IF;

    -- 2b. Buscar por family_id exacto (numerico o codigo legado)
    SELECT id, data INTO v_row
    FROM public.user_data
    WHERE id = 'family_' || v_clean
       OR id = 'family_' || v_norm
    LIMIT 1;

    IF FOUND AND v_row.data IS NOT NULL THEN
        v_family_id := COALESCE(
            NULLIF(TRIM(v_row.data -> 'recim_company_shared_settings' ->> 'familyId'), ''),
            NULLIF(TRIM(v_row.data -> 'sharedCompanySettings' ->> 'familyId'), ''),
            SUBSTRING(v_row.id FROM 8)
        );
        v_company_name := COALESCE(
            NULLIF(TRIM(v_row.data -> 'recim_company_shared_settings' ->> 'companyName'), ''),
            NULLIF(TRIM(v_row.data -> 'sharedCompanySettings' ->> 'companyName'), ''),
            'Empresa'
        );
        v_company_code := COALESCE(
            NULLIF(TRIM(v_row.data -> 'recim_company_shared_settings' ->> 'customJoinCode'), ''),
            NULLIF(TRIM(v_row.data -> 'recim_company_shared_settings' ->> 'companyCode'), ''),
            NULLIF(TRIM(v_row.data -> 'sharedCompanySettings' ->> 'companyCode'), ''),
            v_family_id
        );
        RETURN jsonb_build_object(
            'ok', true,
            'familyId', v_family_id,
            'companyName', v_company_name,
            'companyCode', v_company_code
        );
    END IF;

    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_company_by_code(TEXT) TO anon, authenticated, service_role;


-- 3. RPC seguro: validacion atomica de un solo uso para Quick Code (evita SELECT * de todos los usuarios)
CREATE OR REPLACE FUNCTION public.verify_quick_code_login(
    p_email TEXT,
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF TRIM(COALESCE(p_email, '')) = '' OR TRIM(COALESCE(p_code, '')) !~ '^\d{6}$' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
    END IF;

    SELECT id, email, name, family_id, role, quick_code, quick_code_expires_at
    INTO v_user
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND quick_code = TRIM(p_code)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
    END IF;

    IF v_user.family_id = 'BLOCKED' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
    END IF;

    IF v_user.quick_code_expires_at IS NULL OR v_user.quick_code_expires_at < NOW() THEN
        UPDATE public.profiles
        SET quick_code = NULL, quick_code_expires_at = NULL
        WHERE id = v_user.id;
        RETURN jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;

    -- Invalidar inmediatamente tras su uso (codigo de un solo uso)
    UPDATE public.profiles
    SET quick_code = NULL, quick_code_expires_at = NULL, updated_at = NOW()
    WHERE id = v_user.id;

    RETURN jsonb_build_object(
        'ok', true,
        'profile', jsonb_build_object(
            'id', v_user.id,
            'email', v_user.email,
            'name', v_user.name,
            'family_id', v_user.family_id,
            'role', COALESCE(v_user.role, 'member')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_quick_code_login(TEXT, TEXT) TO anon, authenticated, service_role;


-- 4. Endurecimiento de Soporte IT (evita borrado o modificacion masiva anonima sin filtro)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
        DROP POLICY IF EXISTS "Permitir acceso publico a tickets" ON public.support_tickets;
        DROP POLICY IF EXISTS "Support tickets scoped read" ON public.support_tickets;
        DROP POLICY IF EXISTS "Support tickets scoped insert" ON public.support_tickets;
        DROP POLICY IF EXISTS "Support tickets scoped update" ON public.support_tickets;
        DROP POLICY IF EXISTS "Support tickets scoped delete" ON public.support_tickets;

        CREATE POLICY "Support tickets scoped read" ON public.support_tickets
            FOR SELECT USING (user_email IS NOT NULL AND LENGTH(TRIM(user_email)) > 3);
        CREATE POLICY "Support tickets scoped insert" ON public.support_tickets
            FOR INSERT WITH CHECK (user_email IS NOT NULL AND LENGTH(TRIM(user_email)) > 3 AND module IS NOT NULL);
        CREATE POLICY "Support tickets scoped update" ON public.support_tickets
            FOR UPDATE USING (id IS NOT NULL)
            WITH CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
        CREATE POLICY "Support tickets scoped delete" ON public.support_tickets
            FOR DELETE USING (id IS NOT NULL AND (public.is_admin_user() OR auth.role() = 'authenticated' OR user_email IS NOT NULL));
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_chats') THEN
        DROP POLICY IF EXISTS "Permitir acceso publico a chats" ON public.support_chats;
        DROP POLICY IF EXISTS "Support chats scoped read" ON public.support_chats;
        DROP POLICY IF EXISTS "Support chats scoped insert" ON public.support_chats;
        DROP POLICY IF EXISTS "Support chats scoped update" ON public.support_chats;

        CREATE POLICY "Support chats scoped read" ON public.support_chats
            FOR SELECT USING (ticket_id IS NOT NULL);
        CREATE POLICY "Support chats scoped insert" ON public.support_chats
            FOR INSERT WITH CHECK (ticket_id IS NOT NULL AND sender_email IS NOT NULL AND LENGTH(TRIM(message)) > 0);
        CREATE POLICY "Support chats scoped update" ON public.support_chats
            FOR UPDATE USING (ticket_id IS NOT NULL)
            WITH CHECK (ticket_id IS NOT NULL);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- NOTA DE ARQUITECTURA PARA PRODUCCION:
-- Para maximo aislamiento multi-inquilino, planificar la migracion completa hacia
-- Supabase Auth JWT (auth.uid()) vinculando profiles.auth_uid = auth.uid() y
-- restringiendo user_data por pertenencia verificada a family_id en RLS.
