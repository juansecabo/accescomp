'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ItemsFacturacion } from '@/components/ItemsFacturacion';
import { EstadoOrden } from '@/components/EstadoOrden';
import { GrabadorVideo } from '@/components/GrabadorVideo';
import { FirmaDigital } from '@/components/FirmaDigital';
import { BuscadorTrabajadores } from '@/components/BuscadorTrabajadores';
import { formatDateTime, formatCurrency, parseCurrency } from '@/lib/utils';
import { ESTADOS_ORDEN, type ItemOrden, type Pago, type ArchivoOrden, type EstadoOrden as TipoEstado, type Trabajador } from '@/types';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function OrdenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<any>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [archivos, setArchivos] = useState<ArchivoOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivoModal, setArchivoModal] = useState<ArchivoOrden | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTab, setEditTab] = useState<'equipo' | 'facturacion' | 'condiciones'>('equipo');
  const [editData, setEditData] = useState({
    equipo_descripcion: '',
    observaciones: '',
    trabajo_realizar: '',
    condiciones_servicio: '',
    condiciones_aceptadas: false,
    firma_cliente: null as string | null,
  });
  const [editItems, setEditItems] = useState<ItemOrden[]>([]);
  const [editRecibidoPor, setEditRecibidoPor] = useState<Trabajador | null>(null);
  const [editTecnicoAsignado, setEditTecnicoAsignado] = useState<Trabajador | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para el menú de condiciones en edición
  const [showCondicionesMenu, setShowCondicionesMenu] = useState(false);
  const [showCondicionesModal, setShowCondicionesModal] = useState(false);
  const [condicionesModalTipo, setCondicionesModalTipo] = useState<'orden' | 'cliente' | 'global'>('orden');
  const [condicionesEditTemp, setCondicionesEditTemp] = useState('');
  const [savingCondiciones, setSavingCondiciones] = useState(false);
  const condicionesMenuRef = useRef<HTMLDivElement>(null);

  // Estados para agregar abono
  const [showAbonoForm, setShowAbonoForm] = useState(false);
  const [nuevoAbono, setNuevoAbono] = useState({ monto: '' });
  const [savingAbono, setSavingAbono] = useState(false);

  useEffect(() => {
    loadOrden();
  }, [ordenId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (condicionesMenuRef.current && !condicionesMenuRef.current.contains(event.target as Node)) {
        setShowCondicionesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEditCondiciones = (tipo: 'orden' | 'cliente' | 'global') => {
    setCondicionesModalTipo(tipo);
    setCondicionesEditTemp(editData.condiciones_servicio);
    setShowCondicionesModal(true);
    setShowCondicionesMenu(false);
  };

  const handleSaveCondiciones = async () => {
    setSavingCondiciones(true);
    try {
      if (condicionesModalTipo === 'global') {
        await supabase
          .from('configuracion')
          .update({ condiciones_servicio: condicionesEditTemp })
          .eq('id', 1);
      } else if (condicionesModalTipo === 'cliente' && orden?.cliente?.id) {
        await supabase
          .from('clientes')
          .update({ condiciones_servicio: condicionesEditTemp })
          .eq('id', orden.cliente.id);
      }
      // Siempre actualizar el texto local de la orden
      setEditData(prev => ({ ...prev, condiciones_servicio: condicionesEditTemp }));
      setShowCondicionesModal(false);
    } catch (err) {
      console.error('Error al guardar condiciones:', err);
    } finally {
      setSavingCondiciones(false);
    }
  };

  const loadOrden = async () => {
    setLoading(true);

    const { data: ordenData } = await supabase
      .from('ordenes')
      .select(`
        *,
        cliente:clientes(*),
        tecnico:tecnicos(*),
        recibido_por:trabajadores!recibido_por_id(*),
        tecnico_asignado:trabajadores!tecnico_asignado_id(*)
      `)
      .eq('id', ordenId)
      .single();

    if (ordenData) {
      setOrden(ordenData);
      setEditData({
        equipo_descripcion: ordenData.equipo_descripcion || '',
        observaciones: ordenData.observaciones || '',
        trabajo_realizar: ordenData.trabajo_realizar || '',
        condiciones_servicio: ordenData.condiciones_servicio || '',
        condiciones_aceptadas: ordenData.condiciones_aceptadas || false,
        firma_cliente: ordenData.firma_cliente || null,
      });
      setEditRecibidoPor(ordenData.recibido_por || null);
      setEditTecnicoAsignado(ordenData.tecnico_asignado || null);

      // Cargar items
      const { data: itemsData } = await supabase
        .from('items_orden')
        .select('*')
        .eq('orden_id', ordenId);
      setItems(itemsData || []);
      setEditItems(itemsData || []);

      // Cargar pagos
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('*')
        .eq('orden_id', ordenId)
        .order('fecha', { ascending: false });
      setPagos(pagosData || []);

      // Cargar archivos
      const { data: archivosData } = await supabase
        .from('archivos_orden')
        .select('*')
        .eq('orden_id', ordenId);
      setArchivos(archivosData || []);
    }

    setLoading(false);
  };

  const handleEstadoChange = async (nuevoEstado: TipoEstado) => {
    setSaving(true);
    const { error } = await supabase
      .from('ordenes')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', ordenId);

    if (!error) {
      setOrden({ ...orden, estado: nuevoEstado });
    }
    setSaving(false);
  };

  const handleArchivoSubido = async (archivo: { tipo: string; url: string; nombre: string }) => {
    const { data, error } = await supabase
      .from('archivos_orden')
      .insert({
        orden_id: ordenId,
        tipo: archivo.tipo,
        url: archivo.url,
        nombre: archivo.nombre,
      })
      .select()
      .single();

    if (!error && data) {
      setArchivos([...archivos, data]);
    }
  };

  const handleEditOrden = async () => {
    // Validar que se hayan aceptado las condiciones si hay condiciones
    if (editData.condiciones_servicio && !editData.condiciones_aceptadas) {
      alert('El cliente debe aceptar las condiciones del servicio');
      return;
    }

    setSavingEdit(true);

    // Actualizar orden
    const { error } = await supabase
      .from('ordenes')
      .update({
        equipo_descripcion: editData.equipo_descripcion,
        observaciones: editData.observaciones,
        trabajo_realizar: editData.trabajo_realizar,
        recibido_por_id: editRecibidoPor?.id || null,
        tecnico_asignado_id: editTecnicoAsignado?.id || null,
        condiciones_servicio: editData.condiciones_servicio,
        condiciones_aceptadas: editData.condiciones_aceptadas,
        firma_cliente: editData.firma_cliente,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ordenId);

    if (!error) {
      // Actualizar items: eliminar existentes y crear nuevos
      await supabase.from('items_orden').delete().eq('orden_id', ordenId);

      if (editItems.length > 0) {
        const itemsToInsert = editItems
          .filter(item => item.descripcion.trim())
          .map(item => ({
            orden_id: ordenId,
            descripcion: item.descripcion,
            precio: item.precio,
            cantidad: item.cantidad,
          }));

        if (itemsToInsert.length > 0) {
          await supabase.from('items_orden').insert(itemsToInsert);
        }
      }

      setOrden({
        ...orden,
        equipo_descripcion: editData.equipo_descripcion,
        observaciones: editData.observaciones,
        trabajo_realizar: editData.trabajo_realizar,
        recibido_por: editRecibidoPor,
        recibido_por_id: editRecibidoPor?.id || null,
        tecnico_asignado: editTecnicoAsignado,
        tecnico_asignado_id: editTecnicoAsignado?.id || null,
        condiciones_servicio: editData.condiciones_servicio,
        condiciones_aceptadas: editData.condiciones_aceptadas,
        firma_cliente: editData.firma_cliente,
      });
      setItems(editItems.filter(item => item.descripcion.trim()));
      setShowEditModal(false);
      loadOrden(); // Recargar para obtener los IDs correctos de items
    }
    setSavingEdit(false);
  };

  const handleDeleteOrden = async () => {
    setDeleting(true);
    try {
      // Eliminar archivos, items y pagos relacionados
      await supabase.from('archivos_orden').delete().eq('orden_id', ordenId);
      await supabase.from('items_orden').delete().eq('orden_id', ordenId);
      await supabase.from('pagos').delete().eq('orden_id', ordenId);
      // Eliminar la orden
      await supabase.from('ordenes').delete().eq('id', ordenId);
      router.push('/ordenes');
    } catch (err) {
      console.error('Error al eliminar la orden:', err);
    } finally {
      setDeleting(false);
    }
  };

  const calcularTotal = () => items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const calcularPagado = () => pagos.reduce((sum, pago) => sum + pago.monto, 0);
  const calcularSaldo = () => calcularTotal() - calcularPagado();

  const handleAgregarAbono = async () => {
    const monto = parseCurrency(nuevoAbono.monto);
    if (monto <= 0) return;

    const saldo = calcularSaldo();
    if (monto > saldo) return;

    setSavingAbono(true);
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        orden_id: ordenId,
        monto: monto,
      })
      .select()
      .single();

    if (!error && data) {
      setPagos([data, ...pagos]);
      setNuevoAbono({ monto: '' });
      setShowAbonoForm(false);
    }
    setSavingAbono(false);
  };

  const handleEliminarPago = async (pagoId: string) => {
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pagoId);

    if (!error) {
      setPagos(pagos.filter(p => p.id !== pagoId));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Cargando orden...</p>
        </main>
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Orden no encontrada</p>
        </main>
      </div>
    );
  }

  const estadoInfo = ESTADOS_ORDEN.find(e => e.value === orden.estado);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Órdenes', href: '/ordenes' },
        { label: `#${orden.numero_orden}` }
      ]} />

      {/* Modal para ver archivo en grande */}
      {archivoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setArchivoModal(null)}
        >
          <button
            onClick={() => setArchivoModal(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="max-w-4xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {archivoModal.tipo === 'video' ? (
              <video
                src={archivoModal.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg"
              />
            ) : (
              <img
                src={archivoModal.url}
                alt={archivoModal.nombre}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
            <p className="text-white text-center mt-2 text-sm">{archivoModal.nombre}</p>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Orden #{orden.numero_orden}
              </h1>
              <Badge
                variant={
                  orden.estado === 'recibido' ? 'info' :
                  orden.estado === 'en_proceso' ? 'warning' :
                  orden.estado === 'listo' ? 'success' : 'default'
                }
              >
                {estadoInfo?.label || orden.estado}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">
              Creada el {formatDateTime(orden.created_at)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/ordenes/${ordenId}/pdf`} target="_blank">
              <Button variant="secondary">PDF</Button>
            </Link>
            <Button variant="secondary" onClick={() => {
              // Reiniciar datos de edición
              setEditData({
                equipo_descripcion: orden.equipo_descripcion || '',
                observaciones: orden.observaciones || '',
                trabajo_realizar: orden.trabajo_realizar || '',
                condiciones_servicio: orden.condiciones_servicio || '',
                condiciones_aceptadas: orden.condiciones_aceptadas || false,
                firma_cliente: orden.firma_cliente || null,
              });
              setEditItems([...items]);
              setEditRecibidoPor(orden.recibido_por || null);
              setEditTecnicoAsignado(orden.tecnico_asignado || null);
              setEditTab('equipo');
              setShowEditModal(true);
            }}>
              Editar
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Eliminar
            </Button>
          </div>
        </div>

        {/* Modal editar orden */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Editar Orden #{orden.numero_orden}</h2>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setEditTab('equipo')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    editTab === 'equipo'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Equipo y Servicio
                </button>
                <button
                  onClick={() => setEditTab('facturacion')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    editTab === 'facturacion'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Facturación
                </button>
                <button
                  onClick={() => setEditTab('condiciones')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    editTab === 'condiciones'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Condiciones y Firma
                </button>
              </div>

              {/* Tab: Equipo y Servicio */}
              {editTab === 'equipo' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recibido por</label>
                    <BuscadorTrabajadores
                      onTrabajadorSelect={setEditRecibidoPor}
                      trabajadorSeleccionado={editRecibidoPor}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del equipo</label>
                    <textarea
                      value={editData.equipo_descripcion}
                      onChange={(e) => setEditData({ ...editData, equipo_descripcion: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (estado al llegar)</label>
                    <textarea
                      value={editData.observaciones}
                      onChange={(e) => setEditData({ ...editData, observaciones: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trabajo a realizar</label>
                    <textarea
                      value={editData.trabajo_realizar}
                      onChange={(e) => setEditData({ ...editData, trabajo_realizar: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Técnico asignado</label>
                    <BuscadorTrabajadores
                      onTrabajadorSelect={setEditTecnicoAsignado}
                      trabajadorSeleccionado={editTecnicoAsignado}
                    />
                  </div>
                </div>
              )}

              {/* Tab: Facturación */}
              {editTab === 'facturacion' && (
                <div className="space-y-4">
                  <ItemsFacturacion items={editItems} onItemsChange={setEditItems} />
                </div>
              )}

              {/* Tab: Condiciones y Firma */}
              {editTab === 'condiciones' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Condiciones del servicio</label>
                      <div className="relative" ref={condicionesMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowCondicionesMenu(!showCondicionesMenu)}
                          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {showCondicionesMenu && (
                          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => handleEditCondiciones('orden')}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 text-blue-700 font-medium"
                              >
                                Editar solo para esta orden
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCondiciones('cliente')}
                                disabled={!orden?.cliente?.id}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${!orden?.cliente?.id ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'}`}
                              >
                                Editar para este cliente
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCondiciones('global')}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                              >
                                Editar para todas las órdenes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-line max-h-48 overflow-y-auto">
                      {editData.condiciones_servicio || 'No hay condiciones definidas'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="condiciones_aceptadas_edit"
                      checked={editData.condiciones_aceptadas}
                      onChange={(e) => setEditData({ ...editData, condiciones_aceptadas: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="condiciones_aceptadas_edit" className="text-sm text-gray-700">
                      El cliente acepta las condiciones del servicio <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="border-t pt-4">
                    <FirmaDigital
                      firmaInicial={editData.firma_cliente}
                      onFirmaChange={(firma) => setEditData({ ...editData, firma_cliente: firma })}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleEditOrden} loading={savingEdit} className="flex-1">
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmar eliminar */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Eliminar Orden</h2>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que deseas eliminar la <strong>Orden #{orden.numero_orden}</strong>?
                <br /><br />
                <span className="text-red-600 font-medium">Esta acción no se puede deshacer.</span>
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button variant="danger" onClick={handleDeleteOrden} loading={deleting} className="flex-1">
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal editar condiciones */}
        {showCondicionesModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCondicionesModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {condicionesModalTipo === 'orden' && 'Editar condiciones de esta orden'}
                {condicionesModalTipo === 'cliente' && 'Editar condiciones del cliente'}
                {condicionesModalTipo === 'global' && 'Editar condiciones globales'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {condicionesModalTipo === 'orden' && 'Estas condiciones solo aplicarán a esta orden.'}
                {condicionesModalTipo === 'cliente' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas de este cliente.'}
                {condicionesModalTipo === 'global' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas.'}
              </p>
              <textarea
                value={condicionesEditTemp}
                onChange={(e) => setCondicionesEditTemp(e.target.value)}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowCondicionesModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleSaveCondiciones} loading={savingCondiciones} className="flex-1">
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Estado */}
          <Card>
            <CardContent className="pt-4">
              <EstadoOrden
                estado={orden.estado}
                onChange={handleEstadoChange}
              />
              {saving && <p className="text-sm text-gray-500 mt-2">Guardando...</p>}
            </CardContent>
          </Card>

          {/* Cliente */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Cliente</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium">{orden.cliente?.nombre || 'N/A'}</p>
                </div>
                {orden.cliente?.numero_documento && (
                  <div>
                    <p className="text-sm text-gray-500">Documento</p>
                    <p className="font-medium">{orden.cliente.tipo_documento}: {orden.cliente.numero_documento}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Celular</p>
                  <p className="font-medium">{orden.cliente?.telefono || 'N/A'}</p>
                </div>
                {orden.cliente?.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{orden.cliente.email}</p>
                  </div>
                )}
                {orden.cliente?.direccion && (
                  <div>
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="font-medium">{orden.cliente.direccion}</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Link href={`/clientes/${orden.cliente?.id}`} className="text-blue-600 hover:underline text-sm">
                  Ver historial del cliente
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recibido por */}
          {orden.recibido_por && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Recibido por</h2>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{orden.recibido_por.nombre}</p>
              </CardContent>
            </Card>
          )}

          {/* Equipo */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Equipo</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Descripción del equipo</p>
                <p className="whitespace-pre-wrap">{orden.equipo_descripcion || 'N/A'}</p>
              </div>
              {orden.observaciones && (
                <div>
                  <p className="text-sm text-gray-500">Observaciones (estado al llegar)</p>
                  <p className="whitespace-pre-wrap">{orden.observaciones}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Servicio */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Servicio</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Trabajo a realizar</p>
                <p className="whitespace-pre-wrap">{orden.trabajo_realizar || 'N/A'}</p>
              </div>
              {orden.tecnico_asignado && (
                <div>
                  <p className="text-sm text-gray-500">Técnico asignado</p>
                  <p className="font-medium">{orden.tecnico_asignado.nombre}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Archivos multimedia */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Archivos Multimedia</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {archivos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {archivos.map((archivo) => (
                    <div
                      key={archivo.id}
                      className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                      onClick={() => setArchivoModal(archivo)}
                    >
                      {archivo.tipo === 'video' ? (
                        <div className="relative">
                          <video src={archivo.url} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={archivo.url} alt={archivo.nombre} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 p-2 truncate">{archivo.nombre}</p>
                    </div>
                  ))}
                </div>
              )}
              <GrabadorVideo ordenId={ordenId} onArchivoSubido={handleArchivoSubido} />
            </CardContent>
          </Card>

          {/* Facturación */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Facturación</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <ItemsFacturacion items={items} onItemsChange={() => {}} readOnly />

              {/* Pagos registrados */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-medium text-gray-700">Pagos / Abonos</p>
                  {!showAbonoForm && calcularSaldo() > 0 && (
                    <button
                      onClick={() => setShowAbonoForm(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar abono
                    </button>
                  )}
                </div>

                {/* Formulario de nuevo abono */}
                {showAbonoForm && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-blue-800 mb-3">
                      Nuevo abono <span className="font-normal text-blue-600">(Saldo pendiente: {formatCurrency(calcularSaldo())})</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">Monto</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={nuevoAbono.monto}
                          onChange={(e) => setNuevoAbono({ ...nuevoAbono, monto: e.target.value })}
                          placeholder="$"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        {nuevoAbono.monto && parseCurrency(nuevoAbono.monto) > calcularSaldo() && (
                          <p className="text-red-500 text-xs mt-1">
                            No puede exceder el saldo ({formatCurrency(calcularSaldo())})
                          </p>
                        )}
                        {nuevoAbono.monto && parseCurrency(nuevoAbono.monto) === 0 && nuevoAbono.monto.trim() !== '' && (
                          <p className="text-red-500 text-xs mt-1">
                            Valor inválido
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setShowAbonoForm(false);
                          setNuevoAbono({ monto: '' });
                        }}
                        className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAgregarAbono}
                        disabled={savingAbono || !nuevoAbono.monto || parseCurrency(nuevoAbono.monto) <= 0 || parseCurrency(nuevoAbono.monto) > calcularSaldo()}
                        className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingAbono ? 'Guardando...' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                )}

                {pagos.length > 0 ? (
                  <div className="space-y-2">
                    {pagos.map((pago) => (
                      <div key={pago.id} className="flex justify-between items-center text-sm group">
                        <span className="text-gray-600">
                          {formatDateTime(pago.fecha)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(pago.monto)}</span>
                          <button
                            onClick={() => handleEliminarPago(pago.id)}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                            title="Eliminar pago"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No hay pagos registrados</p>
                )}
              </div>

              <div className="border-t pt-4 space-y-1 text-right">
                <p>Total: <span className="font-bold">{formatCurrency(calcularTotal())}</span></p>
                <p>Pagado: <span className="font-medium text-green-600">{formatCurrency(calcularPagado())}</span></p>
                <p>
                  Pendiente:{' '}
                  <span className={`font-bold ${calcularSaldo() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(calcularSaldo())}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Condiciones del Servicio */}
          {orden.condiciones_servicio && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Condiciones del Servicio</h2>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-line">
                  {orden.condiciones_servicio}
                </div>
                {orden.condiciones_aceptadas && (
                  <p className="text-sm text-green-600 mt-4">
                    ✓ El cliente aceptó las condiciones del servicio
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Firma */}
          {orden.firma_cliente && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Firma del Cliente</h2>
              </CardHeader>
              <CardContent>
                <img
                  src={orden.firma_cliente}
                  alt="Firma del cliente"
                  className="max-h-32 border rounded"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
