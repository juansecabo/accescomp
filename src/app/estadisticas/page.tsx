'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { ESTADOS_ORDEN } from '@/types';
import { ESTADO_STYLES } from '@/lib/estado-styles';

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
  const maxCantidadEstado = Math.max(1, ...estadisticasEstado.map(e => e.cantidad));

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

  const cardClass = 'bg-surface border border-line rounded-card overflow-hidden';
  const cardHeaderClass = 'px-4 py-[11px] border-b border-line-soft';
  const thClass = 'py-[9px] px-2 text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400';

  return (
    <AppShell
      breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Estadísticas' }]}
      title="Estadísticas"
      subtitle="Resumen del negocio"
      actions={
        <div className="flex bg-control rounded-lg p-[3px] gap-[2px] overflow-x-auto">
          {([
            { value: 'este_mes', label: 'Este mes' },
            { value: 'mes_anterior', label: 'Mes anterior' },
            { value: 'este_ano', label: 'Este año' },
            { value: 'todo', label: 'Todo' },
          ] as const).map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                'px-[11px] py-[6px] rounded-chip font-bold text-xs whitespace-nowrap transition-colors duration-150',
                periodo === p.value ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="p-8 text-center text-[13px] font-medium text-slate-400">
          Cargando estadísticas...
        </div>
      ) : (
        <div className="p-4 sm:p-6 flex flex-col gap-[14px]">
          {/* Resumen del período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
            <div className="bg-surface border border-line rounded-card px-4 py-[14px] flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Órdenes {getPeriodoLabel()}
              </div>
              <div className="font-mono font-bold text-[30px] leading-none text-slate-900 tracking-tight">
                {ordenesPeriodoCount}
              </div>
            </div>
            <div className="bg-surface border border-line rounded-card px-4 py-[14px] flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Ingresos {getPeriodoLabel()}
              </div>
              <div className="font-mono font-bold text-xl sm:text-[30px] leading-none text-brand tracking-tight">
                {formatCurrency(ingresosPeriodo)}
              </div>
            </div>
            <div className="bg-surface border border-line rounded-card px-4 py-[14px] flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                Cobrado {getPeriodoLabel()}
              </div>
              <div className="font-mono font-bold text-xl sm:text-[30px] leading-none text-[#047857] tracking-tight">
                {formatCurrency(cobradoPeriodo)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] items-start">
            {/* Órdenes por estado - barras clickeables */}
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <h2 className="font-bold text-[13px] text-slate-900">Órdenes por estado</h2>
                <p className="text-xs text-slate-400 mt-[2px]">Estado actual de todas las órdenes</p>
              </div>
              <div className="px-4 py-[14px] flex flex-col gap-3">
                {estadisticasEstado.map((estado) => (
                  <Link
                    key={estado.value}
                    href={`/ordenes?estado=${estado.value}`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="w-24 flex-none text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors duration-150">
                      {estado.label}
                    </span>
                    <span className="flex-1 h-[22px] rounded-chip bg-control overflow-hidden">
                      <span
                        className={cn('block h-full rounded-chip transition-all group-hover:opacity-85', ESTADO_STYLES[estado.value].solid)}
                        style={{ width: `${(estado.cantidad / maxCantidadEstado) * 100}%` }}
                      />
                    </span>
                    <span className="flex-none font-mono text-xs text-slate-500 whitespace-nowrap">
                      {estado.cantidad} · {estado.porcentaje}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Estado de pagos */}
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <h2 className="font-bold text-[13px] text-slate-900">Estado de pagos</h2>
                <p className="text-xs text-slate-400 mt-[2px]">Estado actual de todas las órdenes</p>
              </div>
              <div className="px-4 py-[14px] flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/ordenes?pago=completo"
                    className="p-4 bg-[#ecfdf5] rounded-card hover:opacity-85 transition-opacity duration-150"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-[#047857]">Pagos completos</p>
                    <p className="mt-1 font-mono font-bold text-[26px] text-[#047857]">{ordenesCompletas}</p>
                    <p className="text-xs font-medium text-[#047857]/70">
                      {totalOrdenesGlobal > 0 ? ((ordenesCompletas / totalOrdenesGlobal) * 100).toFixed(1) : 0}%
                    </p>
                  </Link>
                  <Link
                    href="/ordenes?pago=incompleto"
                    className="p-4 bg-[#fef2f2] rounded-card hover:opacity-85 transition-opacity duration-150"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-[#b91c1c]">Pagos incompletos</p>
                    <p className="mt-1 font-mono font-bold text-[26px] text-[#b91c1c]">{ordenesIncompletas}</p>
                    <p className="text-xs font-medium text-[#b91c1c]/70">
                      {totalOrdenesGlobal > 0 ? ((ordenesIncompletas / totalOrdenesGlobal) * 100).toFixed(1) : 0}%
                    </p>
                  </Link>
                </div>
                <div className="pt-3 border-t border-line-soft">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-control rounded-full h-[10px] overflow-hidden">
                      <div
                        className="bg-[#047857] h-[10px] rounded-full transition-all"
                        style={{ width: `${porcentajeCobro}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-base text-slate-900">{porcentajeCobro}%</span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    Facturado {formatCurrency(ingresosTotalesGlobal)} · Saldo {formatCurrency(ingresosTotalesGlobal - totalCobradoGlobal)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top 10 Clientes */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <h2 className="font-bold text-[13px] text-slate-900">Top 10 clientes</h2>
              <p className="text-xs text-slate-400 mt-[2px]">Clientes con mayor total comprado (histórico)</p>
            </div>
            {topClientes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="bg-surface-muted border-b border-line-soft">
                      <th className={cn(thClass, 'text-left pl-4')}>#</th>
                      <th className={cn(thClass, 'text-left')}>Cliente</th>
                      <th className={cn(thClass, 'text-center')}>Órdenes</th>
                      <th className={cn(thClass, 'text-right')}>Comprado</th>
                      <th className={cn(thClass, 'text-right pr-4')}>Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClientes.map((cliente, index) => (
                      <tr key={cliente.id} className="border-b border-line-row hover:bg-surface-muted transition-colors duration-150">
                        <td className="py-[11px] px-2 pl-4 font-mono text-xs text-slate-400">{index + 1}</td>
                        <td className="py-[11px] px-2">
                          <Link href={`/clientes/${cliente.id}`} className="text-brand hover:text-brand-hover font-semibold text-[13px]">
                            {cliente.nombre}
                          </Link>
                        </td>
                        <td className="py-[11px] px-2 text-center font-mono text-[13px] text-slate-600">{cliente.ordenes}</td>
                        <td className="py-[11px] px-2 text-right font-mono font-bold text-[13px] text-slate-900">
                          {formatCurrency(cliente.totalComprado)}
                        </td>
                        <td className={cn(
                          'py-[11px] px-2 pr-4 text-right font-mono font-bold text-[13px]',
                          cliente.totalComprado - cliente.totalPagado > 0 ? 'text-[#b91c1c]' : 'text-[#047857]'
                        )}>
                          {formatCurrency(cliente.totalComprado - cliente.totalPagado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-8 text-center text-[13px] font-medium text-slate-400">No hay datos de clientes</p>
            )}
          </div>

          {/* Órdenes con saldo pendiente */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <h2 className="font-bold text-[13px] text-slate-900">Órdenes con saldo pendiente</h2>
              <p className="text-xs text-slate-400 mt-[2px]">{ordenesConSaldo.length} órdenes con deuda actualmente</p>
            </div>
            {ordenesConSaldo.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="bg-surface-muted border-b border-line-soft">
                      <th className={cn(thClass, 'text-left pl-4')}>Orden</th>
                      <th className={cn(thClass, 'text-left')}>Cliente</th>
                      <th className={cn(thClass, 'text-right')}>Total</th>
                      <th className={cn(thClass, 'text-right')}>Pagado</th>
                      <th className={cn(thClass, 'text-right pr-4')}>Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesConSaldo.map((orden) => (
                      <tr key={orden.id} className="border-b border-line-row hover:bg-surface-muted transition-colors duration-150">
                        <td className="py-[11px] px-2 pl-4">
                          <Link href={`/ordenes/${orden.id}`} className="text-brand hover:text-brand-hover font-mono font-bold text-[13px]">
                            #{orden.numero_orden}
                          </Link>
                        </td>
                        <td className="py-[11px] px-2 text-[13px] font-medium text-slate-700">
                          {orden.cliente?.nombre || 'Sin cliente'}
                        </td>
                        <td className="py-[11px] px-2 text-right font-mono text-[13px] text-slate-600">{formatCurrency(orden.total)}</td>
                        <td className="py-[11px] px-2 text-right font-mono text-[13px] text-[#047857]">{formatCurrency(orden.pagado)}</td>
                        <td className="py-[11px] px-2 pr-4 text-right font-mono font-bold text-[13px] text-[#b91c1c]">
                          {formatCurrency(orden.pendiente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-8 text-center text-[13px] font-medium text-slate-400">No hay órdenes con saldo pendiente</p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
