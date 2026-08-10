'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ProximaOrden } from '@/components/ProximaOrden';
import {
  OrdenesTable,
  calcularTotalOrden,
  calcularPagadoOrden,
  esPagoCompleto,
} from '@/components/OrdenesTable';
import { formatCurrency, cn } from '@/lib/utils';
import { type EstadoOrden } from '@/types';

export default function Dashboard() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadOrdenes();
  }, []);

  const loadOrdenes = async () => {
    const { data } = await supabase
      .from('ordenes')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, tipo_documento, numero_documento),
        tecnico_asignado:trabajadores!tecnico_asignado_id(id, nombre),
        items:items_orden(precio, cantidad),
        pagos(monto)
      `)
      .order('created_at', { ascending: false });

    setOrdenes(data || []);
    setLoading(false);
  };

  const handleSetPagoCompleto = async (orden: any) => {
    const total = calcularTotalOrden(orden);
    const pagado = calcularPagadoOrden(orden);
    const saldo = total - pagado;

    if (saldo > 0) {
      const { data: nuevoPago } = await supabase.from('pagos').insert({
        orden_id: orden.id,
        monto: saldo,
      }).select().single();

      if (nuevoPago) {
        setOrdenes(ordenes.map(o =>
          o.id === orden.id
            ? { ...o, pagos: [...(o.pagos || []), { monto: saldo }] }
            : o
        ));
      }
    }
  };

  const handleSetPagoIncompleto = async (orden: any) => {
    const { data: ultimoPago } = await supabase
      .from('pagos')
      .select('*')
      .eq('orden_id', orden.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .single();

    if (ultimoPago) {
      await supabase.from('pagos').delete().eq('id', ultimoPago.id);
      setOrdenes(ordenes.map(o =>
        o.id === orden.id
          ? { ...o, pagos: o.pagos.filter((_: any, i: number) => i !== o.pagos.length - 1) }
          : o
      ));
    }
  };

  const handleChangeEstado = async (ordenId: string, nuevoEstado: EstadoOrden) => {
    const { error } = await supabase
      .from('ordenes')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', ordenId);

    if (!error) {
      setOrdenes(ordenes.map(o =>
        o.id === ordenId ? { ...o, estado: nuevoEstado } : o
      ));
    }
  };

  const handleDeleteOrden = async () => {
    if (!ordenToDelete) return;
    setDeleting(true);
    try {
      await supabase.from('archivos_orden').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('items_orden').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('pagos').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('ordenes').delete().eq('id', ordenToDelete.id);
      setOrdenes(ordenes.filter(o => o.id !== ordenToDelete.id));
      setShowDeleteModal(false);
      setOrdenToDelete(null);
    } catch (err) {
      console.error('Error al eliminar la orden:', err);
    } finally {
      setDeleting(false);
    }
  };

  // KPIs
  const recibidas = ordenes.filter(o => o.estado === 'recibido').length;
  const enProceso = ordenes.filter(o => o.estado === 'en_proceso').length;
  const listas = ordenes.filter(o => o.estado === 'listo').length;
  const facturado = ordenes.reduce((sum, o) => sum + calcularTotalOrden(o), 0);
  const cobrado = ordenes.reduce((sum, o) => sum + calcularPagadoOrden(o), 0);
  const saldoPendiente = facturado - cobrado;
  const conDeuda = ordenes.filter(o => calcularTotalOrden(o) > 0 && !esPagoCompleto(o)).length;
  const pctCobrado = facturado > 0 ? Math.round((cobrado / facturado) * 100) : 0;

  const kpis = [
    {
      label: 'Órdenes activas',
      value: String(recibidas + enProceso),
      context: `${recibidas} recibidas · ${enProceso} en proceso`,
      contextClass: 'text-slate-500',
      href: '/ordenes?estado=recibido,en_proceso',
    },
    {
      label: 'Listas para entregar',
      value: String(listas),
      context: 'Avisar al cliente →',
      contextClass: 'text-[#047857]',
      href: '/ordenes?estado=listo',
    },
    {
      label: 'Cobrado (histórico)',
      value: formatCurrency(cobrado),
      context: `${pctCobrado}% de lo facturado`,
      contextClass: 'text-slate-500',
      href: '/estadisticas',
    },
    {
      label: 'Saldo pendiente',
      value: formatCurrency(saldoPendiente),
      context: `${conDeuda} ${conDeuda === 1 ? 'orden' : 'órdenes'} con deuda →`,
      contextClass: 'text-[#b91c1c]',
      href: '/ordenes?pago=incompleto',
    },
  ];

  const recientes = ordenes.slice(0, 5);

  const hoyTexto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppShell
      title="Bienvenido(a)"
      subtitle={hoyTexto.charAt(0).toUpperCase() + hoyTexto.slice(1)}
      actions={
        <>
          <ProximaOrden />
          <Link
            href="/ordenes/nueva"
            className="px-[14px] py-[10px] rounded-field bg-brand hover:bg-brand-hover text-white font-bold text-[13px] whitespace-nowrap transition-colors duration-150"
          >
            + Nueva orden
          </Link>
        </>
      }
      fab={{ href: '/ordenes/nueva', label: 'Nueva orden' }}
    >
      <div className="p-4 sm:p-6 flex flex-col gap-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="bg-surface border border-line rounded-card px-4 py-[14px] flex flex-col gap-[6px] hover:border-line-strong hover:shadow-menu transition-all duration-150"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                {kpi.label}
              </div>
              <div className="font-mono font-bold text-xl sm:text-[26px] leading-none text-slate-900 tracking-tight">
                {loading ? '—' : kpi.value}
              </div>
              <div className={cn('text-xs font-medium leading-[1.3]', kpi.contextClass)}>
                {loading ? '' : kpi.context}
              </div>
            </Link>
          ))}
        </div>

        {/* Órdenes recientes */}
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">Órdenes recientes</h2>
            <Link href="/ordenes" className="text-[13px] font-semibold text-brand hover:text-brand-hover">
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[13px] font-medium text-slate-400">
              Cargando órdenes...
            </div>
          ) : recientes.length === 0 ? (
            <div className="p-8 text-center text-[13px] font-medium text-slate-400">
              No hay órdenes registradas aún.{' '}
              <Link href="/ordenes/nueva" className="text-brand hover:underline">
                Crear primera orden
              </Link>
            </div>
          ) : (
            <OrdenesTable
              ordenes={recientes}
              onChangeEstado={handleChangeEstado}
              onSetPagoCompleto={handleSetPagoCompleto}
              onSetPagoIncompleto={handleSetPagoIncompleto}
              onDelete={(orden) => {
                setOrdenToDelete(orden);
                setShowDeleteModal(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Modal confirmar eliminar */}
      {showDeleteModal && ordenToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Eliminar Orden</h2>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar la <strong>Orden #{ordenToDelete.numero_orden}</strong>?
              <br /><br />
              <span className="text-[#b91c1c] font-medium">Esta acción no se puede deshacer.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-surface border border-line-strong hover:border-slate-300 text-slate-600 rounded-field font-semibold text-[13px] transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteOrden}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] rounded-field hover:bg-[#fee2e2] font-bold text-[13px] disabled:opacity-50 transition-colors duration-150"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
