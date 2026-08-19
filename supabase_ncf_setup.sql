-- ================================================================
-- SUPABASE NCF CENTRALIZED SEQUENCE SETUP
-- Execute this SQL in your Supabase SQL Editor
-- ================================================================

-- 1. Create table for tracking NCF sequences per company/account and NCF type
CREATE TABLE IF NOT EXISTS public.ncf_sequences (
    db_id TEXT NOT NULL,
    ncf_type TEXT NOT NULL,
    current_sequence INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (db_id, ncf_type)
);

-- Enable RLS
ALTER TABLE public.ncf_sequences ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anon users to select/update ncf_sequences
DROP POLICY IF EXISTS "Allow all access to ncf_sequences" ON public.ncf_sequences;
CREATE POLICY "Allow all access to ncf_sequences" ON public.ncf_sequences
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Create atomic stored procedure to generate next NCF sequence
CREATE OR REPLACE FUNCTION public.generate_next_ncf(
    p_db_id TEXT,
    p_ncf_type TEXT,
    p_min_seq INT DEFAULT 0
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_type TEXT;
    v_next INT;
    v_total_len INT;
    v_seq_len INT;
    v_padded TEXT;
    v_ncf TEXT;
BEGIN
    IF p_ncf_type IS NULL OR p_ncf_type = '' THEN
        RETURN '';
    END IF;

    v_clean_type := UPPER(TRIM(p_ncf_type));

    -- Row locking with atomic UPSERT to prevent concurrent duplicates across devices
    INSERT INTO public.ncf_sequences (db_id, ncf_type, current_sequence, updated_at)
    VALUES (p_db_id, v_clean_type, GREATEST(1, COALESCE(p_min_seq, 0)), NOW())
    ON CONFLICT (db_id, ncf_type)
    DO UPDATE SET 
        current_sequence = GREATEST(public.ncf_sequences.current_sequence + 1, COALESCE(p_min_seq, 0)),
        updated_at = NOW()
    RETURNING current_sequence INTO v_next;

    -- DGII formatting rules:
    -- Electronic NCFs (starting with 'E') have total length 13 (e.g., E310000000001)
    -- Standard NCFs (starting with 'B') have total length 11 (e.g., B0100000001)
    IF v_clean_type LIKE 'E%' THEN
        v_total_len := 13;
    ELSE
        v_total_len := 11;
    END IF;

    v_seq_len := v_total_len - LENGTH(v_clean_type);
    IF v_seq_len < 1 THEN
        v_seq_len := 8;
    END IF;

    v_padded := LPAD(v_next::text, v_seq_len, '0');
    v_ncf := v_clean_type || v_padded;

    RETURN v_ncf;
END;
$$;

-- Grant execute permissions on function
GRANT EXECUTE ON FUNCTION public.generate_next_ncf(TEXT, TEXT, INT) TO anon, authenticated, service_role;
