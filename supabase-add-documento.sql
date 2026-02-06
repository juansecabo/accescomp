-- =============================================
-- AGREGAR CAMPOS DE IDENTIFICACIÓN A CLIENTES
-- Ejecutar esto en el SQL Editor de Supabase
-- =============================================

-- Agregar columna de tipo de documento (CC por defecto)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'CC';

-- Agregar columna de número de documento
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_documento TEXT;

-- Crear índice para búsquedas por documento (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_clientes_numero_documento ON clientes(numero_documento);
