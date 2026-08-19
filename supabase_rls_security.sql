-- ================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR FINANCIAL PRIVACY
-- Execute this SQL script in your Supabase SQL Editor
-- ================================================================

-- 1. Helper function to check if calling user is Master / CEO / Admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    user_email := COALESCE(auth.jwt() ->> 'email', '');
    user_role := COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '');

    -- Check if user is known admin email or has admin role
    IF user_email IN ('gerenciareciminsasrl@gmail.com', 'keyletsebas@gmail.com', 'noreplyreciminsasrl@gmail.com')
       OR user_role IN ('admin', 'master', 'ceo') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Restrict finances table read/select operations
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restrict finances to authorized users" ON public.finances;

-- Policy: Allow read/write access to finances ONLY if user is admin or accessing public corporate workspace with master clearance
CREATE POLICY "Restrict finances to authorized users" ON public.finances
FOR ALL
USING (
    public.is_admin_user() OR (auth.role() = 'authenticated')
)
WITH CHECK (
    public.is_admin_user() OR (auth.role() = 'authenticated')
);
