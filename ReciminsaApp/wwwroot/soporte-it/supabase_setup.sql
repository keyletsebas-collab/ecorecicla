/* SCRIPT DE CONFIGURACIÓN DE SUPABASE */
/* Copia y pega este código en el "SQL Editor" de tu panel de Supabase y ejecútalo. */
/* Esto creará las tablas necesarias para el módulo de Soporte IT y el Chat. */

/* 1. Crear tabla de tickets (reclamos) */
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT,
    module TEXT NOT NULL,
    issue_date DATE NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

/* Habilitar RLS para tickets */
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

/* Políticas de seguridad para tickets (permitir lectura y escritura a todos temporalmente) */
CREATE POLICY "Permitir acceso publico a tickets" 
ON public.support_tickets FOR ALL USING (true);


/* 2. Crear tabla de mensajes de chat */
CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    message TEXT NOT NULL,
    image_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

/* Habilitar RLS para chats */
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

/* Políticas de seguridad para chats */
CREATE POLICY "Permitir acceso publico a chats" 
ON public.support_chats FOR ALL USING (true);

/* HABILITAR REALTIME PARA EL CHAT */
/* Esto es obligatorio para que los mensajes lleguen en vivo sin recargar la página */
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;

/* 4. Crear Storage Bucket para imágenes adjuntas (Se recomienda ejecutar esto si usas el dashboard, o crearlo manualmente) */
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support_attachments', 'support_attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Permitir acceso publico a imagenes"
ON storage.objects FOR ALL
USING (bucket_id = 'support_attachments');
