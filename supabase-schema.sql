-- =============================================
-- ESQUEMA DE BASE DE DATOS PARA ACCESCOMP
-- Sistema de Gestión de Órdenes de Servicio
-- =============================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLA: tecnicos
-- Usuarios técnicos del sistema
-- =============================================
CREATE TABLE tecnicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: clientes
-- Clientes que traen equipos a reparar
-- =============================================
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  direccion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: ordenes
-- Órdenes de servicio principal
-- =============================================
CREATE TABLE ordenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_orden SERIAL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tecnico_id UUID REFERENCES tecnicos(id) ON DELETE SET NULL,
  equipo_descripcion TEXT NOT NULL,
  observaciones TEXT,
  motivo_visita TEXT NOT NULL,
  trabajo_realizar TEXT NOT NULL,
  estado TEXT DEFAULT 'recibido' CHECK (estado IN ('recibido', 'en_proceso', 'listo', 'entregado')),
  firma_cliente TEXT,
  condiciones_aceptadas BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLA: items_orden
-- Ítems de facturación por orden
-- =============================================
CREATE TABLE items_orden (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id UUID REFERENCES ordenes(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  cantidad INTEGER DEFAULT 1
);

-- =============================================
-- TABLA: pagos
-- Registro de pagos/abonos
-- =============================================
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id UUID REFERENCES ordenes(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metodo_pago TEXT DEFAULT 'efectivo'
);

-- =============================================
-- TABLA: archivos_orden
-- Videos e imágenes asociados a órdenes
-- =============================================
CREATE TABLE archivos_orden (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id UUID REFERENCES ordenes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('video', 'imagen')),
  url TEXT NOT NULL,
  nombre TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_ordenes_cliente ON ordenes(cliente_id);
CREATE INDEX idx_ordenes_tecnico ON ordenes(tecnico_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado);
CREATE INDEX idx_ordenes_created ON ordenes(created_at DESC);
CREATE INDEX idx_items_orden ON items_orden(orden_id);
CREATE INDEX idx_pagos_orden ON pagos(orden_id);
CREATE INDEX idx_archivos_orden ON archivos_orden(orden_id);
CREATE INDEX idx_clientes_telefono ON clientes(telefono);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_orden ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_orden ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados (acceso completo)
CREATE POLICY "Usuarios autenticados pueden ver técnicos" ON tecnicos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar clientes" ON clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar órdenes" ON ordenes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar items" ON items_orden
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar pagos" ON pagos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar archivos" ON archivos_orden
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET
-- Ejecutar esto en la sección de Storage de Supabase
-- =============================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('archivos-ordenes', 'archivos-ordenes', true);

-- CREATE POLICY "Usuarios autenticados pueden subir archivos" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'archivos-ordenes');

-- CREATE POLICY "Todos pueden ver archivos" ON storage.objects
--   FOR SELECT USING (bucket_id = 'archivos-ordenes');

-- =============================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =============================================

-- Insertar técnico de prueba
-- INSERT INTO tecnicos (nombre, email) VALUES ('Técnico Principal', 'tecnico@accescomp.com');

-- =============================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ordenes_updated_at
  BEFORE UPDATE ON ordenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
