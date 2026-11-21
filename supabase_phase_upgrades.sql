-- ============================================================================
-- RECIMINSA APP - MIGRACIÓN SQL POR FASES (IDEMPOTENTE)
-- Incluye:
--   1. public.eco_certificates (Historial de Constancias Verdes con QR)
--   2. public.audit_logs (Base para Auditoría de acciones sensibles - Fase 3)
--   3. Storage bucket 'company-assets' + políticas (Base para logos/fotos - Fase 3)
-- Ejecutar en el SQL Editor del proyecto Supabase cuando desees habilitar
-- persistencia relacional dedicada; la app funciona offline/fallback sin error
-- incluso antes de ejecutar este script.
-- ============================================================================

-- 1. Certificados de Impacto Ambiental (Constancias con QR verificable)
CREATE TABLE IF NOT EXISTS public.eco_certificates (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    cert_code TEXT NOT NULL,
    verification_code TEXT NOT NULL,
    client_name TEXT,
    company_name TEXT,
    branch_id TEXT,
    total_weight_kg NUMERIC,
    co2_avoided_kg NUMERIC,
    trees_saved INTEGER,
    period_text TEXT,
    issued_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eco_certificates_db_id ON public.eco_certificates (db_id);
CREATE INDEX IF NOT EXISTS idx_eco_certificates_cert_code ON public.eco_certificates (cert_code);
CREATE INDEX IF NOT EXISTS idx_eco_certificates_created_at ON public.eco_certificates (created_at DESC);

ALTER TABLE public.eco_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eco certificates scoped select" ON public.eco_certificates;
DROP POLICY IF EXISTS "Eco certificates scoped insert" ON public.eco_certificates;
DROP POLICY IF EXISTS "Eco certificates scoped update" ON public.eco_certificates;

CREATE POLICY "Eco certificates scoped select" ON public.eco_certificates
    FOR SELECT USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0);

CREATE POLICY "Eco certificates scoped insert" ON public.eco_certificates
    FOR INSERT WITH CHECK (
        db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0
        AND cert_code IS NOT NULL AND LENGTH(TRIM(cert_code)) > 0
        AND verification_code IS NOT NULL AND LENGTH(TRIM(verification_code)) > 0
    );

CREATE POLICY "Eco certificates scoped update" ON public.eco_certificates
    FOR UPDATE USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0)
    WITH CHECK (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0);


-- 2. Auditoría de Acciones Sensibles (Base Fase 3)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    branch_id TEXT,
    branch_name TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor_name TEXT,
    actor_email TEXT,
    device_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_db_id ON public.audit_logs (db_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs scoped select" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs scoped insert" ON public.audit_logs;

CREATE POLICY "Audit logs scoped select" ON public.audit_logs
    FOR SELECT USING (db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0);

CREATE POLICY "Audit logs scoped insert" ON public.audit_logs
    FOR INSERT WITH CHECK (
        db_id IS NOT NULL AND LENGTH(TRIM(db_id)) > 0
        AND action_type IS NOT NULL AND LENGTH(TRIM(action_type)) > 0
    );


-- 3. Bucket de Supabase Storage 'company-assets' (Logos y fotos - Base Fase 3)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-assets',
    'company-assets',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Company assets public read" ON storage.objects;
    DROP POLICY IF EXISTS "Company assets scoped insert" ON storage.objects;
    DROP POLICY IF EXISTS "Company assets scoped update" ON storage.objects;
    DROP POLICY IF EXISTS "Company assets scoped delete" ON storage.objects;

    CREATE POLICY "Company assets public read" ON storage.objects
        FOR SELECT USING (bucket_id = 'company-assets');

    CREATE POLICY "Company assets scoped insert" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'company-assets'
            AND name IS NOT NULL
            AND LENGTH(TRIM(name)) > 0
        );

    CREATE POLICY "Company assets scoped update" ON storage.objects
        FOR UPDATE USING (bucket_id = 'company-assets' AND name IS NOT NULL)
        WITH CHECK (bucket_id = 'company-assets' AND name IS NOT NULL);

    CREATE POLICY "Company assets scoped delete" ON storage.objects
        FOR DELETE USING (bucket_id = 'company-assets' AND name IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage policies notice: %', SQLERRM;
END $$;
