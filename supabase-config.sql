-- =============================================
-- TABLA DE CONFIGURACIÓN (contraseña de acceso)
-- Ejecutar esto en el SQL Editor de Supabase
-- =============================================

CREATE TABLE configuracion (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  nombre_negocio TEXT DEFAULT 'Accescomp',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Habilitar RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede leer (para verificar contraseña)
CREATE POLICY "Lectura pública de configuración" ON configuracion
  FOR SELECT USING (true);

-- Insertar contraseña inicial (cámbiala por la que quieras)
-- La contraseña por defecto es: accescomp2024
INSERT INTO configuracion (password_hash, nombre_negocio)
VALUES ('accescomp2024', 'Accescomp');
