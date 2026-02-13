'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ESTADOS_ORDEN } from '@/types';

const ESTADO_COLORS: Record<string, { bg: string; text: string; hover: string }> = {
  recibido: { bg: 'bg-blue-500', text: 'text-white', hover: 'hover:bg-blue-600' },
  en_proceso: { bg: 'bg-yellow-500', text: 'text-white', hover: 'hover:bg-yellow-600' },
  listo: { bg: 'bg-green-500', text: 'text-white', hover: 'hover:bg-green-600' },
  entregado: { bg: 'bg-gray-500', text: 'text-white', hover: 'hover:bg-gray-600' },
};

type PeriodoFiltro = 'este_mes' | 'mes_anterior' | 'este_ano' | 'todo';

export default function EstadisticasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('este_mes');
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono),
        items:items_orden(precio, cantidad),
        pagos(monto)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      setOrdenes(data || []);
    }
    setLoading(false);
  };

  // Filtrar por período (solo para estadísticas de ventas)
  const filtrarPorPeriodo = (ordenes: any[]) => {
    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
    const inicioAno = new Date(ahora.getFullYear(), 0, 1);

    return ordenes.filter(orden => {
      const fechaOrden = new Date(orden.created_at);
      switch (periodo) {
        case 'este_mes':
          return fechaOrden >= inicioMesActual;
        case 'mes_anterior':
          return fechaOrden >= inicioMesAnterior && fechaOrden <= finMesAnterior;
        case 'este_ano':
          return fechaOrden >= inicioAno;
        case 'todo':
        default:
          return true;
      }
    });
  };

  // Órdenes filtradas por período (solo para resumen de ventas)
  const ordenesPeriodo = filtrarPorPeriodo(ordenes);

  // Cálculos
  const calcularTotalOrden = (orden: any) => {
    return orden.items?.reduce((sum: number, item: any) => sum + (item.precio * item.cantidad), 0) || 0;
  };

  const calcularPagadoOrden = (orden: any) => {
    return orden.pagos?.reduce((sum: number, pago: any) => sum + pago.monto, 0) || 0;
  };

  const esPagoCompleto = (orden: any) => {
    const total = calcularTotalOrden(orden);
    const pagado = calcularPagadoOrden(orden);
    return total > 0 && pagado >= total;
  };

  // ===== ESTADÍSTICAS DEL PERÍODO (solo estas cambian con el filtro) =====
  const ordenesPeriodoCount = ordenesPeriodo.length;
  const ingresosPeriodo = ordenesPeriodo.reduce((sum, orden) => sum + calcularTotalOrden(orden), 0);
  const cobradoPeriodo = ordenesPeriodo.reduce((sum, orden) => sum + calcularPagadoOrden(orden), 0);

  // ===== ESTADÍSTICAS ACTUALES (siempre todas las órdenes) =====
  const totalOrdenesGlobal = ordenes.length;

  // Estados de orden (estado ACTUAL de todas las órdenes)
  const estadisticasEstado = ESTADOS_ORDEN.map(estado => {
    const cantidad = ordenes.filter(o => o.estado === estado.value).length;
    const porcentaje = totalOrdenesGlobal > 0 ? ((cantidad / totalOrdenesGlobal) * 100).toFixed(1) : '0';
    return { ...estado, cantidad, porcentaje };
  });

  // Estado de pagos (estado ACTUAL de todas las órdenes)
  const ordenesCompletas = ordenes.filter(o => esPagoCompleto(o)).length;
  const ordenesIncompletas = totalOrdenesGlobal - ordenesCompletas;
  const ingresosTotalesGlobal = ordenes.reduce((sum, orden) => sum + calcularTotalOrden(orden), 0);
  const totalCobradoGlobal = ordenes.reduce((sum, orden) => sum + calcularPagadoOrden(orden), 0);
  const porcentajeCobro = ingresosTotalesGlobal > 0 ? ((totalCobradoGlobal / ingresosTotalesGlobal) * 100).toFixed(1) : '0';

  // Top 10 clientes (histórico total)
  const clientesMap = new Map<string, {
    id: string;
    nombre: string;
    ordenes: number;
    totalComprado: number;
    totalPagado: number;
  }>();

  ordenes.forEach(orden => {
    if (orden.cliente) {
      const clienteId = orden.cliente.id;
      const existing = clientesMap.get(clienteId) || {
        id: clienteId,
        nombre: orden.cliente.nombre,
        ordenes: 0,
        totalComprado: 0,
        totalPagado: 0,
      };
      existing.ordenes++;
      existing.totalComprado += calcularTotalOrden(orden);
      existing.totalPagado += calcularPagadoOrden(orden);
      clientesMap.set(clienteId, existing);
    }
  });

  const topClientes = Array.from(clientesMap.values())
    .sort((a, b) => b.totalComprado - a.totalComprado)
    .slice(0, 10);

  // Órdenes con saldo pendiente (TODAS las que actualmente tienen deuda)
  const ordenesConSaldo = ordenes
    .map(orden => ({
      ...orden,
      total: calcularTotalOrden(orden),
      pagado: calcularPagadoOrden(orden),
      pendiente: calcularTotalOrden(orden) - calcularPagadoOrden(orden),
    }))
    .filter(orden => orden.pendiente > 0)
    .sort((a, b) => b.pendiente - a.pendiente);

  const getPeriodoLabel = () => {
    switch (periodo) {
      case 'este_mes': return 'este mes';
      case 'mes_anterior': return 'el mes anterior';
      case 'este_ano': return 'este año';
      default: return 'todo el tiempo';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Cargando estadísticas...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Estadísticas' }
      ]} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-gray-600">Resumen del negocio</p>
        </div>

        {/* Resumen de ventas del período */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-semibold">Resumen de Ventas</h2>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'este_mes', label: 'Este mes' },
                  { value: 'mes_anterior', label: 'Mes anterior' },
                  { value: 'este_ano', label: 'Este año' },
                  { value: 'todo', label: 'Todo' },
                ].map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriodo(p.value as PeriodoFiltro)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                      periodo === p.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Órdenes creadas {getPeriodoLabel()}</p>
                <p className="text-3xl font-bold text-gray-900">{ordenesPeriodoCount}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Ingresos {getPeriodoLabel()}</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(ingresosPeriodo)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Cobrado {getPeriodoLabel()}</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(cobradoPeriodo)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Estados de orden - CLICKEABLES */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Órdenes por Estado</h2>
              <p className="text-sm text-gray-500">Estado actual de todas las órdenes</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {estadisticasEstado.map((estado) => (
                  <Link
                    key={estado.value}
                    href={`/ordenes?estado=${estado.value}`}
                    className={`p-4 rounded-lg ${ESTADO_COLORS[estado.value].bg} ${ESTADO_COLORS[estado.value].text} ${ESTADO_COLORS[estado.value].hover} transition-colors cursor-pointer block`}
                  >
                    <p className="text-sm opacity-90">{estado.label}</p>
                    <p className="text-2xl font-bold">{estado.cantidad}</p>
                    <p className="text-sm opacity-75">{estado.porcentaje}%</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Estado de pagos - CLICKEABLES */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Estado de Pagos</h2>
              <p className="text-sm text-gray-500">Estado actual de todas las órdenes</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Link
                  href="/ordenes?pago=completo"
                  className="flex justify-between items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer block"
                >
                  <div>
                    <p className="text-sm text-gray-600">Pagos Completos</p>
                    <p className="text-2xl font-bold text-green-600">{ordenesCompletas}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {totalOrdenesGlobal > 0 ? ((ordenesCompletas / totalOrdenesGlobal) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </Link>
                <Link
                  href="/ordenes?pago=incompleto"
                  className="flex justify-between items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer block"
                >
                  <div>
                    <p className="text-sm text-gray-600">Pagos Incompletos</p>
                    <p className="text-2xl font-bold text-red-600">{ordenesIncompletas}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {totalOrdenesGlobal > 0 ? ((ordenesIncompletas / totalOrdenesGlobal) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </Link>
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500">Porcentaje de cobro total</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${porcentajeCobro}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-gray-900">{porcentajeCobro}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top 10 Clientes */}
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-lg font-semibold">Top 10 Clientes</h2>
            <p className="text-sm text-gray-500">Clientes con mayor total comprado (histórico)</p>
          </CardHeader>
          <CardContent>
            {topClientes.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">#</th>
                      <th className="text-left py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-center py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Órdenes</th>
                      <th className="text-right py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Comprado</th>
                      <th className="text-right py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClientes.map((cliente, index) => (
                      <tr key={cliente.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-1 sm:px-2 text-xs sm:text-sm text-gray-500">{index + 1}</td>
                        <td className="py-2 px-1 sm:px-2">
                          <Link href={`/clientes/${cliente.id}`} className="text-blue-600 hover:underline font-medium text-xs sm:text-sm">
                            {cliente.nombre}
                          </Link>
                        </td>
                        <td className="py-2 px-1 sm:px-2 text-center text-xs sm:text-sm">{cliente.ordenes}</td>
                        <td className="py-2 px-1 sm:px-2 text-right font-medium text-xs sm:text-sm">{formatCurrency(cliente.totalComprado)}</td>
                        <td className={`py-2 px-1 sm:px-2 text-right font-medium text-xs sm:text-sm ${
                          cliente.totalComprado - cliente.totalPagado > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(cliente.totalComprado - cliente.totalPagado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No hay datos de clientes</p>
            )}
          </CardContent>
        </Card>

        {/* Órdenes con saldo pendiente - TODAS */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Órdenes con Saldo Pendiente</h2>
            <p className="text-sm text-gray-500">{ordenesConSaldo.length} órdenes con deuda actualmente</p>
          </CardHeader>
          <CardContent>
            {ordenesConSaldo.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">#</th>
                      <th className="text-left py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-right py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Total</th>
                      <th className="text-right py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Pagado</th>
                      <th className="text-right py-2 px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-600">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesConSaldo.map((orden) => (
                      <tr key={orden.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-1 sm:px-2">
                          <Link href={`/ordenes/${orden.id}`} className="text-blue-600 hover:underline font-medium text-xs sm:text-sm">
                            #{orden.numero_orden}
                          </Link>
                        </td>
                        <td className="py-2 px-1 sm:px-2 text-xs sm:text-sm">{orden.cliente?.nombre || 'Sin cliente'}</td>
                        <td className="py-2 px-1 sm:px-2 text-right text-xs sm:text-sm">{formatCurrency(orden.total)}</td>
                        <td className="py-2 px-1 sm:px-2 text-right text-xs sm:text-sm text-green-600">{formatCurrency(orden.pagado)}</td>
                        <td className="py-2 px-1 sm:px-2 text-right font-medium text-xs sm:text-sm text-red-600">{formatCurrency(orden.pendiente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No hay órdenes con saldo pendiente</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
