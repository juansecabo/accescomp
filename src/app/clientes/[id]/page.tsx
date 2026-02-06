'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Cliente, EstadoOrden } from '@/types';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { ESTADOS_ORDEN } from '@/types';

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  recibido: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  en_proceso: { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-500' },
  listo: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
  entregado: { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500' },
};

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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCliente();
  }, [clienteId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setMenuOpenId(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Breadcrumb items={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/clientes' },
          { label: 'Cargando...' }
        ]} />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Cargando cliente...</p>
        </main>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Breadcrumb items={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/clientes' },
          { label: 'No encontrado' }
        ]} />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Cliente no encontrado</p>
        </main>
      </div>
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

  const stats = {
    total: ordenes.length,
    pendientes: ordenes.filter(o => o.estado !== 'entregado').length,
    completadas: ordenes.filter(o => o.estado === 'entregado').length,
    totalComprado,
    deudaActual,
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Clientes', href: '/clientes' },
        { label: cliente.nombre }
      ]} />

      {/* Modal editar cliente */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Editar Cliente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editData.nombre}
                  onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
                <select
                  value={editData.tipo_documento}
                  onChange={(e) => setEditData({ ...editData, tipo_documento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de documento</label>
                <input
                  type="text"
                  value={editData.numero_documento}
                  onChange={(e) => setEditData({ ...editData, numero_documento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
                <input
                  type="text"
                  value={editData.telefono}
                  onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={editData.direccion}
                  onChange={(e) => setEditData({ ...editData, direccion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleEditCliente}
                loading={saving}
                disabled={!editData.nombre || !editData.telefono}
                className="flex-1"
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
            <p className="text-gray-600">Historial del cliente</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/ordenes/nueva?cliente_id=${clienteId}`}>
              <Button>+ Nueva Orden</Button>
            </Link>
            <Button variant="secondary" onClick={() => setShowEditModal(true)}>
              Editar
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Eliminar
            </Button>
          </div>
        </div>

        {/* Modal confirmar eliminar cliente */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Eliminar Cliente</h2>
              <p className="text-gray-600 mb-4">
                ¿Estás seguro de que deseas eliminar a <strong>{cliente.nombre}</strong>?
              </p>
              {ordenes.length > 0 && (
                <p className="text-amber-600 bg-amber-50 p-3 rounded-lg mb-4 text-sm">
                  <strong>Atención:</strong> Este cliente tiene {ordenes.length} orden(es) registrada(s).
                  Al eliminar el cliente, también se eliminarán todas sus órdenes y datos asociados.
                </p>
              )}
              <p className="text-red-600 font-medium mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="danger" onClick={handleDeleteCliente} loading={deleting} className="flex-1">
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Datos del cliente */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Información de Contacto</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cliente.numero_documento && (
                  <div>
                    <p className="text-sm text-gray-500">Documento</p>
                    <p className="font-medium">{cliente.tipo_documento}: {cliente.numero_documento}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Celular</p>
                  <p className="font-medium">{cliente.telefono}</p>
                </div>
                {cliente.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{cliente.email}</p>
                  </div>
                )}
                {cliente.direccion && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="font-medium">{cliente.direccion}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Órdenes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
                <p className="text-sm text-gray-600">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.completadas}</p>
                <p className="text-sm text-gray-600">Entregadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalComprado)}</p>
                <p className="text-sm text-gray-600">Total Comprado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className={`text-xl font-bold ${stats.deudaActual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(stats.deudaActual)}
                </p>
                <p className="text-sm text-gray-600">Deuda Actual</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros de estado y ordenamiento */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleEstadoFilterClick('todas')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isEstadoSelected('todas')
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Todas
              </button>
              {ESTADOS_ORDEN.map((estado) => (
                <button
                  key={estado.value}
                  onClick={() => handleEstadoFilterClick(estado.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isEstadoSelected(estado.value)
                      ? `${ESTADO_COLORS[estado.value].bg} ${ESTADO_COLORS[estado.value].text}`
                      : `bg-white text-gray-700 border ${ESTADO_COLORS[estado.value].border} hover:bg-gray-50`
                  }`}
                >
                  {estado.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortAscending(!sortAscending)}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sortAscending ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                )}
              </svg>
              <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                {sortAscending ? 'Más antiguas primero' : 'Más recientes primero'}
              </span>
            </button>
          </div>

          {/* Historial de órdenes */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Historial de Órdenes</h2>
            </CardHeader>
            <CardContent className="p-0">
              {ordenesFiltradas.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No hay órdenes {!selectedEstados.has('todas') ? 'con ese estado' : 'registradas para este cliente'}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {ordenesFiltradas.map((orden) => {
                    const estadoInfo = ESTADOS_ORDEN.find(e => e.value === orden.estado);
                    const estadoColor = ESTADO_COLORS[orden.estado];
                    return (
                      <div
                        key={orden.id}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors flex justify-between items-start"
                      >
                        <Link href={`/ordenes/${orden.id}`} className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              #{orden.numero_orden}
                            </p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor.bg} ${estadoColor.text}`}>
                              {estadoInfo?.label || orden.estado}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {orden.equipo_descripcion?.substring(0, 80)}
                            {orden.equipo_descripcion?.length > 80 ? '...' : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(orden.created_at)}
                          </p>
                        </Link>

                        {/* Menú de tres puntos */}
                        <div className="relative" ref={menuOpenId === orden.id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setMenuOpenId(menuOpenId === orden.id ? null : orden.id);
                            }}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                          >
                            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>

                          {menuOpenId === orden.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                              <div className="py-1">
                                <p className="px-4 py-2 text-xs text-gray-500 font-medium">Cambiar estado a:</p>
                                {ESTADOS_ORDEN.map((estado) => (
                                  <button
                                    key={estado.value}
                                    onClick={() => handleChangeEstado(orden.id, estado.value)}
                                    disabled={orden.estado === estado.value}
                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                      orden.estado === estado.value ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    <span className={`w-3 h-3 rounded-full ${ESTADO_COLORS[estado.value].bg}`} />
                                    {estado.label}
                                    {orden.estado === estado.value && (
                                      <span className="ml-auto text-xs text-gray-400">(actual)</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
