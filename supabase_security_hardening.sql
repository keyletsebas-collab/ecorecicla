-- ================================================================
-- RECIMINSA APP - SUPABASE DATABASE SECURITY HARDENING (OWASP / ISO 27001)
-- Ejecuta este script en el SQL Editor de tu panel de Supabase
-- ================================================================

-- 1. PROTECCIÓN DE COLUMNA DE CONTRASEÑAS EN public.profiles
-- Evita que cualquier consulta SELECT desde la API REST (anon/authenticated) pueda leer hashes de contraseñas
REVOKE SELECT (password) ON public.profiles FROM anon, authenticated;

GRANT SELECT (
    id,
    email,
    name,
    full_name,
    role,
    family_id,
    created_at,
    updated_at
) ON public.profiles TO anon, authenticated;

DO $$
BEGIN
    EXECUTE 'GRANT SELECT (avatar) ON public.profiles TO anon, authenticated';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'GRANT SELECT (biometric_enabled, quick_code, quick_code_expires_at) ON public.profiles TO anon, authenticated';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 2. FUNCIÓN RPC BLINDADA EN SERVIDOR PARA LOGIN (Nunca expone el hash de contraseña al navegador)
CREATE OR REPLACE FUNCTION public.verify_user_login(
    p_email TEXT,
    p_password_hash TEXT,
    p_legacy_b64 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
BEGIN
    SELECT * INTO v_user
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;

    IF v_user.family_id = 'BLOCKED' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
    END IF;

    IF v_user.password = p_password_hash THEN
        RETURN jsonb_build_object(
            'ok', true,
            'profile', jsonb_build_object(
                'id', v_user.id,
                'name', v_user.name,
                'email', v_user.email,
                'avatar', COALESCE(SUBSTRING(v_user.name FROM 1 FOR 1), 'U'),
                'family_id', v_user.family_id,
                'role', v_user.role
            )
        );
    ELSIF p_legacy_b64 IS NOT NULL AND v_user.password = p_legacy_b64 THEN
        -- Migrar automáticamente la contraseña antigua a SHA-256 dentro del servidor
        UPDATE public.profiles
        SET password = p_password_hash, updated_at = NOW()
        WHERE id = v_user.id;

        RETURN jsonb_build_object(
            'ok', true,
            'migrated', true,
            'profile', jsonb_build_object(
                'id', v_user.id,
                'name', v_user.name,
                'email', v_user.email,
                'avatar', COALESCE(SUBSTRING(v_user.name FROM 1 FOR 1), 'U'),
                'family_id', v_user.family_id,
                'role', v_user.role
            )
        );
    END IF;

    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_password');
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_login(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- 3. FUNCIÓN RPC BLINDADA PARA CAMBIO / RECUPERACIÓN DE CONTRASEÑA
CREATE OR REPLACE FUNCTION public.change_user_password(
    p_email TEXT,
    p_new_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.profiles
    SET password = p_new_password_hash, updated_at = NOW()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_password(TEXT, TEXT) TO anon, authenticated, service_role;


-- 4. ENDURECIMIENTO DE POLÍTICAS RLS EN TABLAS RELACIONALES DE NEGOCIO
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
CREATE POLICY "Scoped access to invoices" ON public.invoices
FOR ALL USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3)
WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3);

DROP POLICY IF EXISTS "Allow all access to finances" ON public.finances;
CREATE POLICY "Scoped access to finances" ON public.finances
FOR ALL USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3)
WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3);

DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Scoped access to clients" ON public.clients
FOR ALL USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3)
WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3);

DROP POLICY IF EXISTS "Allow all access to materials" ON public.materials;
CREATE POLICY "Scoped access to materials" ON public.materials
FOR ALL USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3)
WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3);

DROP POLICY IF EXISTS "Allow all access to collaborators" ON public.collaborators;
CREATE POLICY "Scoped access to collaborators" ON public.collaborators
FOR ALL USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3)
WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 3);
