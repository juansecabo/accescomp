'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import { ProximaOrden } from '@/components/ProximaOrden';
import {
  OrdenesTable,
  calcularTotalOrden,
  calcularPagadoOrden,
  esPagoCompleto,
} from '@/components/OrdenesTable';
import Link from 'next/link';
import { ESTADOS_ORDEN, type EstadoOrden } from '@/types';
import { normalizeText, cn } from '@/lib/utils';

const SEARCH_OPTIONS = [
  { value: 'numero_orden', label: '# de orden' },
  { value: 'cliente_nombre', label: 'Nombre del cliente' },
  { value: 'cliente_documento', label: 'Documento del cliente' },
  { value: 'cliente_telefono', label: 'Celular del cliente' },
];

export default function OrdenesPage() {
  const searchParams = useSearchParams();
  const estadoParam = searchParams.get('estado');
  const pagoParam = searchParams.get('pago') as 'completo' | 'incompleto' | null;

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('numero_orden');
  const [searchValue, setSearchValue] = useState('');
  const [selectedEstados, setSelectedEstados] = useState<Set<EstadoOrden | 'todas'>>(() => {
    // Acepta uno o varios estados separados por coma: ?estado=recibido,en_proceso
    const validos = (estadoParam || '')
      .split(',')
      .filter((e): e is EstadoOrden =>
        ['recibido', 'en_proceso', 'listo', 'entregado'].includes(e)
      );
    if (validos.length > 0) {
      return new Set<EstadoOrden | 'todas'>(validos);
    }
    return new Set<EstadoOrden | 'todas'>(['todas']);
  });
  const [filtroPago, setFiltroPago] = useState<'todos' | 'completo' | 'incompleto'>(() => {
    if (pagoParam === 'completo') return 'completo';
    if (pagoParam === 'incompleto') return 'incompleto';
    return 'todos';
  });
  const [sortAscending, setSortAscending] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedTrabajador, setSelectedTrabajador] = useState<string>('todos');
  const [trabajadoresActivos, setTrabajadoresActivos] = useState<{id: string; nombre: string}[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadOrdenes();
    loadTrabajadores();
  }, [sortAscending]);

  const loadTrabajadores = async () => {
    const { data } = await supabase
      .from('trabajadores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    setTrabajadoresActivos(data || []);
  };

  const loadOrdenes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, tipo_documento, numero_documento),
        recibido_por:trabajadores!recibido_por_id(id, nombre),
        tecnico_asignado:trabajadores!tecnico_asignado_id(id, nombre),
        items:items_orden(precio, cantidad),
        pagos(monto)
      `)
      .order('created_at', { ascending: sortAscending });

    if (!error) {
      setOrdenes(data || []);
    }
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
        // Actualizar estado local sin recargar
        setOrdenes(ordenes.map(o =>
          o.id === orden.id
            ? { ...o, pagos: [...(o.pagos || []), { monto: saldo }] }
            : o
        ));
      }
    }
  };

  const handleSetPagoIncompleto = async (orden: any) => {
    // Eliminar el último pago para volver a incompleto
    const { data: ultimoPago } = await supabase
      .from('pagos')
      .select('*')
      .eq('orden_id', orden.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .single();

    if (ultimoPago) {
      await supabase.from('pagos').delete().eq('id', ultimoPago.id);
      // Actualizar estado local sin recargar
      setOrdenes(ordenes.map(o =>
        o.id === orden.id
          ? { ...o, pagos: o.pagos.filter((_: any, i: number) => i !== o.pagos.length - 1) }
          : o
      ));
    }
  };

  const handleEstadoFilterClick = (estado: EstadoOrden | 'todas') => {
    const newSelected = new Set<EstadoOrden | 'todas'>(selectedEstados);

    if (estado === 'todas') {
      setSelectedEstados(new Set<EstadoOrden | 'todas'>(['todas']));
      return;
    }

    if (newSelected.has('todas')) {
      newSelected.delete('todas');
      newSelected.add(estado);
    } else if (newSelected.has(estado)) {
      if (newSelected.size > 1) {
        newSelected.delete(estado);
      }
    } else {
      newSelected.add(estado);
    }

    const allEstados: EstadoOrden[] = ['recibido', 'en_proceso', 'listo', 'entregado'];
    if (allEstados.every(e => newSelected.has(e))) {
      setSelectedEstados(new Set<EstadoOrden | 'todas'>(['todas']));
    } else {
      setSelectedEstados(newSelected);
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

  // Filtrar órdenes
  const ordenesFiltradas = ordenes.filter((orden) => {
    // Filtro por estado
    if (!selectedEstados.has('todas')) {
      if (!selectedEstados.has(orden.estado)) {
        return false;
      }
    }

    // Filtro por pago
    if (filtroPago !== 'todos') {
      const esCompleto = esPagoCompleto(orden);
      if (filtroPago === 'completo' && !esCompleto) return false;
      if (filtroPago === 'incompleto' && esCompleto) return false;
    }

    // Filtro por técnico
    if (selectedTrabajador !== 'todos') {
      if (!orden.tecnico_asignado || orden.tecnico_asignado.id !== selectedTrabajador) {
        return false;
      }
    }

    // Filtro por búsqueda
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase().trim();
      const searchNormalized = normalizeText(searchValue.trim());
      switch (searchType) {
        case 'numero_orden':
          return orden.numero_orden?.toString().includes(searchLower);
        case 'cliente_nombre':
          return normalizeText(orden.cliente?.nombre || '').includes(searchNormalized);
        case 'cliente_telefono':
          return orden.cliente?.telefono?.includes(searchLower);
        case 'cliente_documento':
          return orden.cliente?.numero_documento?.toLowerCase().includes(searchLower);
        default:
          return true;
      }
    }

    return true;
  });

  const isEstadoSelected = (estado: EstadoOrden | 'todas') => {
    return selectedEstados.has(estado);
  };

  const conteoPorEstado = (estado: EstadoOrden | 'todas') =>
    estado === 'todas' ? ordenes.length : ordenes.filter((o) => o.estado === estado).length;

  const segmentClass = (active: boolean) =>
    cn(
      'px-[11px] py-[6px] rounded-chip font-bold text-xs whitespace-nowrap transition-colors duration-150',
      active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
    );

  const toolbar = (
    <div className="bg-surface border-b border-line px-4 sm:px-6 py-3 flex flex-col gap-[10px]">
      {/* Fila 1: buscador combinado + técnico + orden */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center h-[38px] border border-line-strong rounded-field overflow-hidden flex-1 min-w-[220px] bg-surface">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="h-full border-none bg-surface-muted border-r border-line-strong px-2 text-xs font-semibold text-slate-600 cursor-pointer"
            aria-label="Buscar por"
          >
            {SEARCH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-3 flex-1 text-slate-400 border-l border-line-strong h-full">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder={`Buscar por ${SEARCH_OPTIONS.find(o => o.value === searchType)?.label.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex-1 min-w-0 border-none bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus-visible:!outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="flex-none text-slate-400 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <select
          value={selectedTrabajador}
          onChange={(e) => setSelectedTrabajador(e.target.value)}
          className="h-[38px] border border-line-strong rounded-field px-2 text-[13px] font-semibold text-slate-600 bg-surface cursor-pointer"
          aria-label="Filtrar por técnico"
        >
          <option value="todos">Técnico: Todos</option>
          {trabajadoresActivos.map((tecnico) => (
            <option key={tecnico.id} value={tecnico.id}>
              {tecnico.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSortAscending(!sortAscending)}
          className="flex items-center gap-2 h-[38px] px-3 border border-line-strong rounded-field font-semibold text-[13px] text-slate-600 bg-surface whitespace-nowrap hover:border-slate-300 transition-colors duration-150"
        >
          <svg width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24">
            {sortAscending ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            )}
          </svg>
          {sortAscending ? 'Más antiguas' : 'Más recientes'}
        </button>
      </div>

      {/* Fila 2: segmentos de estado y pago */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-[6px] max-w-full">
          <span className="text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 flex-none">
            Estado
          </span>
          <div className="flex bg-control rounded-lg p-[3px] gap-[2px] overflow-x-auto">
            <button onClick={() => handleEstadoFilterClick('todas')} className={segmentClass(isEstadoSelected('todas'))}>
              Todas <span className={cn('font-mono', isEstadoSelected('todas') ? 'text-white/70' : 'text-slate-400')}>{conteoPorEstado('todas')}</span>
            </button>
            {ESTADOS_ORDEN.map((estado) => (
              <button
                key={estado.value}
                onClick={() => handleEstadoFilterClick(estado.value)}
                className={segmentClass(isEstadoSelected(estado.value))}
              >
                {estado.label}{' '}
                <span className={cn('font-mono', isEstadoSelected(estado.value) ? 'text-white/70' : 'text-slate-400')}>
                  {conteoPorEstado(estado.value)}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 flex-none">
            Pago
          </span>
          <div className="flex bg-control rounded-lg p-[3px] gap-[2px]">
            {([
              { value: 'todos', label: 'Todos' },
              { value: 'incompleto', label: 'Incompleto' },
              { value: 'completo', label: 'Completo' },
            ] as const).map((opcion) => (
              <button
                key={opcion.value}
                onClick={() => setFiltroPago(opcion.value)}
                className={segmentClass(filtroPago === opcion.value)}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Órdenes' }]}
      title="Órdenes"
      count={loading ? '...' : `${ordenesFiltradas.length} de ${ordenes.length}`}
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
      toolbar={toolbar}
      fab={{ href: '/ordenes/nueva', label: 'Nueva orden' }}
    >
      <div className="p-4 sm:p-6">
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[13px] font-medium text-slate-400">
              Cargando órdenes...
            </div>
          ) : (
            <OrdenesTable
              ordenes={ordenesFiltradas}
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
