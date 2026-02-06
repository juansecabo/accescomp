-- =============================================
-- AGREGAR CAMPO PARA PRÓXIMO NÚMERO DE ORDEN
-- Ejecutar esto en el SQL Editor de Supabase
-- =============================================

-- Agregar columna para el próximo número de orden
ALTER TABLE configuracion
ADD COLUMN IF NOT EXISTS proximo_numero_orden INTEGER DEFAULT 1;

-- Actualizar el valor inicial basado en las órdenes existentes
UPDATE configuracion
SET proximo_numero_orden = COALESCE((SELECT MAX(numero_orden) + 1 FROM ordenes), 1)
WHERE id = 1;

-- Crear política para actualizar configuración (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'configuracion' AND policyname = 'Usuarios autenticados pueden actualizar configuración'
  ) THEN
    CREATE POLICY "Usuarios autenticados pueden actualizar configuración" ON configuracion
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;
