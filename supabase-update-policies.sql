-- =============================================
-- ACTUALIZAR POLÍTICAS RLS PARA ACCESO PÚBLICO
-- (Ya que no usamos Supabase Auth)
-- Ejecutar esto en el SQL Editor de Supabase
-- =============================================

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver técnicos" ON tecnicos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar clientes" ON clientes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar órdenes" ON ordenes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar items" ON items_orden;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar pagos" ON pagos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar archivos" ON archivos_orden;

-- Nuevas políticas de acceso público (la autenticación se maneja en la app)
CREATE POLICY "Acceso público a técnicos" ON tecnicos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público a clientes" ON clientes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público a órdenes" ON ordenes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público a items" ON items_orden
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público a pagos" ON pagos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público a archivos" ON archivos_orden
  FOR ALL USING (true) WITH CHECK (true);
