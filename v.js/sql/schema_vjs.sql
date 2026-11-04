-- =============================================================================
-- ESQUEMA SQL CORREGIDO Y BLINDADO: RECIMINSA OPS & RECIMINSA FIELD (v.js)
-- Basado en "Documentacion v.js.pdf" + "Auditoria de posibles errores.pdf" (15 puntos)
-- =============================================================================

-- 1. Catálogo central de colaboradores operativos (Incluye pairing_code para evitar error NOT NULL en android_id)
CREATE TABLE IF NOT EXISTS colaboradores (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL DEFAULT 1,
    db_id VARCHAR(120) NOT NULL DEFAULT 'default',
    external_id VARCHAR(100) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL DEFAULT '',
    estado_activo BOOLEAN NOT NULL DEFAULT TRUE,
    pairing_code VARCHAR(32),
    pairing_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Catálogos maestros sincronizados hacia dispositivos de campo (Sin exponer precios contables sensibles)
CREATE TABLE IF NOT EXISTS materiales (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL DEFAULT 1,
    db_id VARCHAR(120) NOT NULL DEFAULT 'default',
    external_id VARCHAR(100) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50),
    unidad_medida VARCHAR(20) NOT NULL DEFAULT 'kg',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL DEFAULT 1,
    db_id VARCHAR(120) NOT NULL DEFAULT 'default',
    external_id VARCHAR(100) UNIQUE,
    nombre_comercial VARCHAR(150) NOT NULL,
    rnc_cedula VARCHAR(20),
    direccion TEXT,
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dispositivos móviles autorizados y estado de enlace en tiempo real
-- Soporta revocación lógica (activo = FALSE, revoked_at) y UPSERT por android_id
CREATE TABLE IF NOT EXISTS dispositivos_campo (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL DEFAULT 1,
    db_id VARCHAR(120) NOT NULL DEFAULT 'default',
    colaborador_id BIGINT NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
    android_id VARCHAR(64) UNIQUE NOT NULL,
    device_model VARCHAR(100),
    api_token_hash VARCHAR(128) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_latitude NUMERIC(10, 7),
    last_longitude NUMERIC(10, 7),
    last_speed NUMERIC(6, 2),
    last_accuracy NUMERIC(6, 2),
    is_mock_location BOOLEAN DEFAULT FALSE,
    battery_level SMALLINT,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Registro histórico de telemetría (Insertar solo si desplazamiento Haversine > 15m o > 5 min)
CREATE TABLE IF NOT EXISTS tracking_ubicaciones (
    id BIGSERIAL PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL REFERENCES dispositivos_campo(id) ON DELETE CASCADE,
    latitud NUMERIC(10, 7) NOT NULL,
    longitud NUMERIC(10, 7) NOT NULL,
    velocidad NUMERIC(6, 2),
    precision_gps NUMERIC(6, 2),
    is_mock BOOLEAN DEFAULT FALSE,
    timestamp_gps TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Transacciones de recolección de material (Inmutable desde Campo, Idempotente por client_record_uuid)
-- NOTA: Solo se inserta en Supabase cuando es ACEPTADA en el panel de Bitácoras de Recogida de Reciminsa Ops
CREATE TABLE IF NOT EXISTS bitacora_recogida (
    id BIGSERIAL PRIMARY KEY,
    client_record_uuid UUID UNIQUE NOT NULL,
    empresa_id BIGINT NOT NULL DEFAULT 1,
    db_id VARCHAR(120) NOT NULL DEFAULT 'default',
    colaborador_id BIGINT NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
    dispositivo_id BIGINT NOT NULL REFERENCES dispositivos_campo(id) ON DELETE RESTRICT,
    material_id BIGINT NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
    cliente_origen_id BIGINT REFERENCES clientes(id) ON DELETE RESTRICT,
    peso_kg NUMERIC(10, 2) NOT NULL CHECK (peso_kg > 0),
    latitud_captura NUMERIC(10, 7),
    longitud_captura NUMERIC(10, 7),
    precision_gps NUMERIC(6, 2),
    notas TEXT,
    timestamp_captura TIMESTAMP WITH TIME ZONE NOT NULL,
    sincronizado_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES DE RENDIMIENTO (Anexo Auditoría de Posibles Errores)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_dispositivos_campo_last_seen
    ON dispositivos_campo(last_seen_at) WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_tracking_ubicaciones_disp_ts
    ON tracking_ubicaciones(dispositivo_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_recogida_empresa_ts
    ON bitacora_recogida(empresa_id, colaborador_id, timestamp_captura DESC);
