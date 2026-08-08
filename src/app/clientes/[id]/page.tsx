'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import { OrdenesTable } from '@/components/OrdenesTable';
import Link from 'next/link';
import type { Cliente, EstadoOrden } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ESTADOS_ORDEN } from '@/types';

const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'NIT', label: 'NIT' },
  { value: 'OTRO', label: 'Otro' },
];

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.id as string;
  const supabase = createClient();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstados, setSelectedEstados] = useState<Set<EstadoOrden | 'todas'>>(() => new Set<EstadoOrden | 'todas'>(['todas']));
  const [sortAscending, setSortAscending] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editData, setEditData] = useState({
    nombre: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    email: '',
    direccion: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCliente();
  }, [clienteId]);

  const loadCliente = async () => {
    setLoading(true);

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (clienteData) {
      setCliente(clienteData);
      setEditData({
        nombre: clienteData.nombre || '',
        tipo_documento: clienteData.tipo_documento || 'CC',
        numero_documento: clienteData.numero_documento || '',
        telefono: clienteData.telefono || '',
        email: clienteData.email || '',
        direccion: clienteData.direccion || ''
      });

      const { data: ordenesData } = await supabase
        .from('ordenes')
        .select(`
          *,
          tecnico_asignado:trabajadores!tecnico_asignado_id(id, nombre),
          items:items_orden(precio, cantidad),
          pagos(monto)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      setOrdenes(ordenesData || []);
    }

    setLoading(false);
  };

  const handleEditCliente = async () => {
    if (!editData.nombre || !editData.telefono) return;

    setSaving(true);
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre: editData.nombre,
        tipo_documento: editData.tipo_documento,
        numero_documento: editData.numero_documento || null,
        telefono: editData.telefono,
        email: editData.email || null,
        direccion: editData.direccion || null,
      })
      .eq('id', clienteId);

    if (!error) {
      setCliente({
        ...cliente!,
        nombre: editData.nombre,
        tipo_documento: editData.tipo_documento,
        numero_documento: editData.numero_documento,
        telefono: editData.telefono,
        email: editData.email,
        direccion: editData.direccion,
      });
      setShowEditModal(false);
    }
    setSaving(false);
  };

  const handleDeleteCliente = async () => {
    setDeleting(true);
    try {
      // Primero eliminar todos los datos relacionados con las órdenes del cliente
      for (const orden of ordenes) {
        await supabase.from('archivos_orden').delete().eq('orden_id', orden.id);
        await supabase.from('items_orden').delete().eq('orden_id', orden.id);
        await supabase.from('pagos').delete().eq('orden_id', orden.id);
      }
      // Eliminar todas las órdenes del cliente
      await supabase.from('ordenes').delete().eq('cliente_id', clienteId);
      // Eliminar el cliente
      await supabase.from('clientes').delete().eq('id', clienteId);
      router.push('/clientes');
    } catch (err) {
      console.error('Error al eliminar el cliente:', err);
    } finally {
      setDeleting(false);
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

  const ordenesFiltradas = ordenes
    .filter((orden) => {
      if (selectedEstados.has('todas')) return true;
      return selectedEstados.has(orden.estado);
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortAscending ? dateA - dateB : dateB - dateA;
    });

  const isEstadoSelected = (estado: EstadoOrden | 'todas') => {
    return selectedEstados.has(estado);
  };

  if (loading || !cliente) {
    return (
      <AppShell
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/clientes' },
          { label: loading ? 'Cargando...' : 'No encontrado' },
        ]}
        title={loading ? 'Cargando...' : 'Cliente no encontrado'}
      >
        <div className="p-8 text-center text-[13px] font-medium text-slate-400">
          {loading ? 'Cargando cliente...' : 'Cliente no encontrado'}
        </div>
      </AppShell>
    );
  }

  // Cálculos financieros
  const calcularTotalOrden = (orden: any) => {
    return orden.items?.reduce((sum: number, item: any) => sum + (item.precio * item.cantidad), 0) || 0;
  };

  const calcularPagadoOrden = (orden: any) => {
    return orden.pagos?.reduce((sum: number, pago: any) => sum + pago.monto, 0) || 0;
  };

  const totalComprado = ordenes.reduce((sum, orden) => sum + calcularTotalOrden(orden), 0);
  const totalPagado = ordenes.reduce((sum, orden) => sum + calcularPagadoOrden(orden), 0);
  const deudaActual = totalComprado - totalPagado;

  const kpis = [
    { label: 'Total órdenes', value: String(ordenes.length), valueClass: 'text-slate-900' },
    { label: 'Pendientes', value: String(ordenes.filter(o => o.estado !== 'entregado').length), valueClass: 'text-slate-900' },
    { label: 'Entregadas', value: String(ordenes.filter(o => o.estado === 'entregado').length), valueClass: 'text-[#047857]' },
    { label: 'Total comprado', value: formatCurrency(totalComprado), valueClass: 'text-brand' },
    { label: 'Deuda actual', value: formatCurrency(deudaActual), valueClass: deudaActual > 0 ? 'text-[#b91c1c]' : 'text-[#047857]' },
  ];

  const datoContacto = (label: string, value?: string | null) =>
    value ? (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400">{label}</p>
        <p className="mt-[3px] text-[13px] font-medium text-slate-900">{value}</p>
      </div>
    ) : null;

  const segmentClass = (active: boolean) =>
    cn(
      'px-[11px] py-[6px] rounded-chip font-bold text-xs whitespace-nowrap transition-colors duration-150',
      active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
    );

  return (
    <AppShell
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Clientes', href: '/clientes' },
        { label: cliente.nombre },
      ]}
      title={cliente.nombre}
      count="historial del cliente"
      actions={
        <>
          <Link
            href={`/ordenes/nueva?cliente_id=${clienteId}`}
            className="px-[14px] py-[10px] rounded-field bg-brand hover:bg-brand-hover text-white font-bold text-[13px] whitespace-nowrap transition-colors duration-150"
          >
            + Nueva orden
          </Link>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-3 py-[9px] rounded-field border border-line-strong bg-surface text-slate-600 font-semibold text-[13px] hover:border-slate-300 transition-colors duration-150"
          >
            Editar
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-[9px] rounded-field bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold text-[13px] hover:bg-[#fee2e2] transition-colors duration-150"
          >
            Eliminar
          </button>
        </>
      }
    >
      <div className="p-4 sm:p-6 flex flex-col gap-[14px]">
        {/* Información de contacto */}
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          <div className="px-4 py-[11px] border-b border-line-soft font-bold text-[13px] text-slate-900">
            Información de contacto
          </div>
          <div className="px-4 py-[14px] grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
            {datoContacto(
              'Documento',
              cliente.numero_documento ? `${cliente.tipo_documento}: ${cliente.numero_documento}` : null
            )}
            {datoContacto('Celular', cliente.telefono)}
            {datoContacto('Email', cliente.email)}
            {datoContacto('Dirección', cliente.direccion)}
          </div>
        </div>

        {/* Cifras del cliente */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-[14px]">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-surface border border-line rounded-card px-4 py-[14px] flex flex-col gap-[6px]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                {kpi.label}
              </div>
              <div className={cn('font-mono font-bold text-lg sm:text-[26px] leading-none tracking-tight', kpi.valueClass)}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Historial de órdenes */}
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-sm text-slate-900">Historial de órdenes</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-control rounded-lg p-[3px] gap-[2px] overflow-x-auto">
                <button onClick={() => handleEstadoFilterClick('todas')} className={segmentClass(isEstadoSelected('todas'))}>
                  Todas
                </button>
                {ESTADOS_ORDEN.map((estado) => (
                  <button
                    key={estado.value}
                    onClick={() => handleEstadoFilterClick(estado.value)}
                    className={segmentClass(isEstadoSelected(estado.value))}
                  >
                    {estado.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSortAscending(!sortAscending)}
                className="flex items-center gap-2 h-[34px] px-3 border border-line-strong rounded-field font-semibold text-xs text-slate-600 bg-surface whitespace-nowrap hover:border-slate-300 transition-colors duration-150"
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
          </div>
          <OrdenesTable
            ordenes={ordenesFiltradas}
            hideCliente
            menuVariant="estado"
            onChangeEstado={handleChangeEstado}
            emptyMessage={
              !selectedEstados.has('todas')
                ? 'No hay órdenes con ese estado'
                : 'No hay órdenes registradas para este cliente'
            }
          />
        </div>
      </div>

      {/* Modal editar cliente */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Editar Cliente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Nombre *</label>
                <input
                  type="text"
                  value={editData.nombre}
                  onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Tipo de documento</label>
                <select
                  value={editData.tipo_documento}
                  onChange={(e) => setEditData({ ...editData, tipo_documento: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm bg-surface"
                >
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Número de documento</label>
                <input
                  type="text"
                  value={editData.numero_documento}
                  onChange={(e) => setEditData({ ...editData, numero_documento: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Celular *</label>
                <input
                  type="text"
                  value={editData.telefono}
                  onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">Dirección</label>
                <input
                  type="text"
                  value={editData.direccion}
                  onChange={(e) => setEditData({ ...editData, direccion: e.target.value })}
                  className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditCliente}
                disabled={saving || !editData.nombre || !editData.telefono}
                className={cn(
                  'flex-1 px-4 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                  saving || !editData.nombre || !editData.telefono
                    ? 'bg-brand-disabled cursor-not-allowed'
                    : 'bg-brand hover:bg-brand-hover'
                )}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar cliente */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Eliminar Cliente</h2>
            <p className="text-slate-600 mb-4">
              ¿Estás seguro de que deseas eliminar a <strong>{cliente.nombre}</strong>?
            </p>
            {ordenes.length > 0 && (
              <p className="text-[#b45309] bg-[#fffbeb] border border-[#fde68a] p-3 rounded-field mb-4 text-sm">
                <strong>Atención:</strong> Este cliente tiene {ordenes.length} orden(es) registrada(s).
                Al eliminar el cliente, también se eliminarán todas sus órdenes y datos asociados.
              </p>
            )}
            <p className="text-[#b91c1c] font-medium mb-6">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-surface border border-line-strong hover:border-slate-300 text-slate-600 rounded-field font-semibold text-[13px] transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCliente}
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
