'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import { ItemsFacturacion } from '@/components/ItemsFacturacion';
import { GrabadorVideo } from '@/components/GrabadorVideo';
import { FirmaDigital } from '@/components/FirmaDigital';
import { BuscadorTrabajadores } from '@/components/BuscadorTrabajadores';
import { formatDateTime, formatCurrency, parseCurrency, cn } from '@/lib/utils';
import { ESTADO_STYLES, PAGO_STYLES } from '@/lib/estado-styles';
import { ESTADOS_ORDEN, type ItemOrden, type Pago, type ArchivoOrden, type EstadoOrden as TipoEstado, type Trabajador } from '@/types';
import Link from 'next/link';

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

  if (loading || !orden) {
    return (
      <AppShell
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Órdenes', href: '/ordenes' }]}
        title={loading ? 'Cargando...' : 'Orden no encontrada'}
      >
        <div className="p-8 text-center text-[13px] font-medium text-slate-400">
          {loading ? 'Cargando orden...' : 'Orden no encontrada'}
        </div>
      </AppShell>
    );
  }

  const estadoStyle = ESTADO_STYLES[orden.estado as TipoEstado] ?? ESTADO_STYLES.entregado;
  const estadoInfo = ESTADOS_ORDEN.find(e => e.value === orden.estado);
  const pagoCompleto = calcularTotal() > 0 && calcularSaldo() <= 0;
  const pagoStyle = pagoCompleto ? PAGO_STYLES.completo : PAGO_STYLES.incompleto;
  const pctPagado = calcularTotal() > 0 ? Math.min(100, Math.round((calcularPagado() / calcularTotal()) * 100)) : 0;

  const cardClass = 'bg-surface border border-line rounded-card overflow-hidden';
  const cardHeaderClass = 'px-4 py-[11px] border-b border-line-soft font-bold text-[13px] text-slate-900';
  const cardBodyClass = 'px-4 py-[14px]';
  const dataLabelClass = 'text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400';
  const dataValueClass = 'mt-[3px] text-[13px] font-medium text-slate-900 whitespace-pre-wrap';

  const datoCliente = (label: string, value?: string | null) =>
    value ? (
      <div>
        <p className={dataLabelClass}>{label}</p>
        <p className={dataValueClass}>{value}</p>
      </div>
    ) : null;

  return (
    <AppShell
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Órdenes', href: '/ordenes' },
        { label: `#${orden.numero_orden}` },
      ]}
      title={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-xl">#{orden.numero_orden}</span>
          <span className={cn('inline-flex items-center gap-[6px] px-2 py-1 rounded-chip text-[11px] font-semibold', estadoStyle.bg, estadoStyle.fg)}>
            <span className={cn('w-[6px] h-[6px] rounded-full', estadoStyle.dot)} />
            {estadoInfo?.label || orden.estado}
          </span>
          <span className={cn('inline-flex items-center px-2 py-1 rounded-chip text-[11px] font-semibold', pagoStyle.bg, pagoStyle.fg)}>
            {pagoCompleto ? 'Pago completo' : 'Pago incompleto'}
          </span>
        </span>
      }
      subtitle={`Creada el ${formatDateTime(orden.created_at)}`}
      actions={
        <>
          <Link
            href={`/ordenes/${ordenId}/pdf`}
            target="_blank"
            className="px-3 py-[9px] rounded-field border border-line-strong bg-surface text-slate-600 font-semibold text-[13px] hover:border-slate-300 transition-colors duration-150"
          >
            PDF
          </Link>
          <button
            onClick={() => {
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
            }}
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
      {/* Barra de estado */}
      <div className="bg-surface border-b border-line px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400">
          Estado de la orden
        </span>
        <div className="flex bg-control rounded-lg p-[3px] gap-[2px] overflow-x-auto">
          {ESTADOS_ORDEN.map((estado) => (
            <button
              key={estado.value}
              onClick={() => handleEstadoChange(estado.value)}
              disabled={saving}
              className={cn(
                'px-[11px] py-[6px] rounded-chip font-bold text-xs whitespace-nowrap transition-colors duration-150',
                orden.estado === estado.value
                  ? cn(ESTADO_STYLES[estado.value].solid, 'text-white')
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {estado.label}
            </button>
          ))}
        </div>
        {saving && <span className="text-xs text-slate-400">Guardando...</span>}
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_384px] gap-[18px] items-start">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-[14px] min-w-0">
          {/* Cliente */}
          <div className={cardClass}>
            <div className={cn(cardHeaderClass, 'flex items-center justify-between')}>
              Cliente
              <Link href={`/clientes/${orden.cliente?.id}`} className="text-xs font-semibold text-brand hover:text-brand-hover">
                Ver historial →
              </Link>
            </div>
            <div className={cn(cardBodyClass, 'grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3')}>
              {datoCliente('Nombre', orden.cliente?.nombre || 'N/A')}
              {datoCliente(
                'Documento',
                orden.cliente?.numero_documento
                  ? `${orden.cliente.tipo_documento}: ${orden.cliente.numero_documento}`
                  : null
              )}
              {datoCliente('Celular', orden.cliente?.telefono || 'N/A')}
              {datoCliente('Email', orden.cliente?.email)}
              {datoCliente('Dirección', orden.cliente?.direccion)}
              {datoCliente('Recibido por', orden.recibido_por?.nombre)}
              {datoCliente('Técnico asignado', orden.tecnico_asignado?.nombre)}
            </div>
          </div>

          {/* Equipo y servicio */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>Equipo y servicio</div>
            <div className={cn(cardBodyClass, 'space-y-4')}>
              <div>
                <p className={dataLabelClass}>Descripción del equipo</p>
                <p className={dataValueClass}>{orden.equipo_descripcion || 'N/A'}</p>
              </div>
              {orden.observaciones && (
                <div>
                  <p className={dataLabelClass}>Observaciones (estado al llegar)</p>
                  <p className={dataValueClass}>{orden.observaciones}</p>
                </div>
              )}
              <div>
                <p className={dataLabelClass}>Trabajo a realizar</p>
                <p className={dataValueClass}>{orden.trabajo_realizar || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Archivos multimedia */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>Archivos multimedia</div>
            <div className={cn(cardBodyClass, 'space-y-4')}>
              {archivos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {archivos.map((archivo) => (
                    <div
                      key={archivo.id}
                      className="border border-line rounded-field overflow-hidden cursor-pointer hover:shadow-menu transition-shadow duration-150 group"
                      onClick={() => setArchivoModal(archivo)}
                    >
                      {archivo.tipo === 'video' ? (
                        <div className="relative">
                          <video src={archivo.url} className="w-full h-[92px] object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={archivo.url} alt={archivo.nombre} className="w-full h-[92px] object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 p-2 truncate">{archivo.nombre}</p>
                    </div>
                  ))}
                </div>
              )}
              <GrabadorVideo ordenId={ordenId} onArchivoSubido={handleArchivoSubido} />
            </div>
          </div>

          {/* Condiciones del servicio y firma */}
          {(orden.condiciones_servicio || orden.firma_cliente) && (
            <div className={cardClass}>
              <div className={cardHeaderClass}>Condiciones del servicio y firma</div>
              <div className={cn(cardBodyClass, 'space-y-4')}>
                {orden.condiciones_servicio && (
                  <div className="text-[11px] leading-[1.7] text-slate-500 whitespace-pre-line">
                    {orden.condiciones_servicio}
                  </div>
                )}
                {orden.condiciones_aceptadas && (
                  <p className="text-[13px] font-semibold text-[#047857]">
                    ✓ Aceptadas por el cliente
                  </p>
                )}
                {orden.firma_cliente && (
                  <div className="border border-line rounded-field p-3 inline-block">
                    <img
                      src={orden.firma_cliente}
                      alt="Firma del cliente"
                      className="max-h-32"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-[14px] min-w-0">
          {/* Facturación */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>Facturación</div>
            <div className={cardBodyClass}>
              <ItemsFacturacion items={items} onItemsChange={() => {}} readOnly />
              <div className="border-t border-line-soft mt-4 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium text-slate-500">Total</span>
                  <span className="font-mono font-bold text-base text-slate-900">{formatCurrency(calcularTotal())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium text-slate-500">Pagado</span>
                  <span className="font-mono font-bold text-base text-[#047857]">{formatCurrency(calcularPagado())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium text-slate-500">Pendiente</span>
                  <span className={cn('font-mono font-bold text-base', calcularSaldo() > 0 ? 'text-[#b91c1c]' : 'text-[#047857]')}>
                    {formatCurrency(calcularSaldo())}
                  </span>
                </div>
                <div className="mt-2 h-[5px] rounded-full bg-line-soft overflow-hidden">
                  <div className={cn('h-[5px] rounded-full', pagoStyle.bar)} style={{ width: `${pctPagado}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Pagos / abonos */}
          <div className={cardClass}>
            <div className={cn(cardHeaderClass, 'flex items-center justify-between gap-2')}>
              Pagos / abonos
              <div className="flex items-center gap-3">
                {calcularSaldo() > 0 ? (
                  <button
                    onClick={async () => {
                      const saldo = calcularSaldo();
                      if (saldo <= 0) return;
                      const { data, error } = await supabase.from('pagos').insert({
                        orden_id: ordenId,
                        monto: saldo,
                      }).select().single();
                      if (!error && data) {
                        setPagos([data, ...pagos]);
                      }
                    }}
                    className="text-xs text-slate-600 hover:text-[#047857] font-semibold flex items-center gap-1 transition-colors duration-150"
                  >
                    ✓ Pago completo
                  </button>
                ) : (
                  <span className="text-xs text-[#047857] font-semibold">✓ Pago completo</span>
                )}
                {!showAbonoForm && calcularSaldo() > 0 && (
                  <button
                    onClick={() => setShowAbonoForm(true)}
                    className="text-xs text-brand hover:text-brand-hover font-semibold"
                  >
                    + Abono
                  </button>
                )}
              </div>
            </div>
            <div className={cardBodyClass}>
              {/* Formulario de nuevo abono */}
              {showAbonoForm && (
                <div className="bg-[#f1f6ff] border border-[#d6e4ff] rounded-field p-3 mb-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Nuevo abono{' '}
                    <span className="font-normal text-slate-500">
                      (Saldo pendiente: {formatCurrency(calcularSaldo())})
                    </span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nuevoAbono.monto}
                    onChange={(e) => setNuevoAbono({ ...nuevoAbono, monto: e.target.value })}
                    placeholder="$ Monto"
                    className="w-full px-3 h-[38px] border border-line-strong rounded-field text-sm font-mono"
                  />
                  {nuevoAbono.monto && parseCurrency(nuevoAbono.monto) > calcularSaldo() && (
                    <p className="text-[#b91c1c] text-xs mt-1">
                      No puede exceder el saldo ({formatCurrency(calcularSaldo())})
                    </p>
                  )}
                  {nuevoAbono.monto && parseCurrency(nuevoAbono.monto) === 0 && nuevoAbono.monto.trim() !== '' && (
                    <p className="text-[#b91c1c] text-xs mt-1">Valor inválido</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setShowAbonoForm(false);
                        setNuevoAbono({ monto: '' });
                      }}
                      className="flex-1 px-3 py-2 text-[13px] font-semibold text-slate-600 bg-surface border border-line-strong rounded-field hover:border-slate-300 transition-colors duration-150"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAgregarAbono}
                      disabled={savingAbono || !nuevoAbono.monto || parseCurrency(nuevoAbono.monto) <= 0 || parseCurrency(nuevoAbono.monto) > calcularSaldo()}
                      className="flex-1 px-3 py-2 text-[13px] font-bold text-white bg-brand rounded-field hover:bg-brand-hover disabled:bg-brand-disabled transition-colors duration-150"
                    >
                      {savingAbono ? 'Guardando...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              )}

              {pagos.length > 0 ? (
                <div className="divide-y divide-line-row">
                  {pagos.map((pago) => (
                    <div key={pago.id} className="flex justify-between items-center py-2 text-sm group">
                      <span className="font-mono text-xs text-slate-400">
                        {formatDateTime(pago.fecha)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px] text-slate-900">{formatCurrency(pago.monto)}</span>
                        <button
                          onClick={() => handleEliminarPago(pago.id)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-[#b91c1c] hover:bg-[#fef2f2] rounded transition-all duration-150"
                          title="Eliminar pago"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 italic">No hay pagos registrados</p>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {/* Modal editar orden */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Editar Orden <span className="font-mono">#{orden.numero_orden}</span>
            </h2>

            {/* Tabs */}
            <div className="flex border-b border-line mb-4">
              {([
                { value: 'equipo', label: 'Equipo y Servicio' },
                { value: 'facturacion', label: 'Facturación' },
                { value: 'condiciones', label: 'Condiciones y Firma' },
              ] as const).map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setEditTab(tab.value)}
                  className={cn(
                    'px-4 py-2 font-semibold text-sm border-b-2 transition-colors duration-150',
                    editTab === tab.value
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Equipo y Servicio */}
            {editTab === 'equipo' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recibido por</label>
                  <BuscadorTrabajadores
                    onTrabajadorSelect={setEditRecibidoPor}
                    trabajadorSeleccionado={editRecibidoPor}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del equipo</label>
                  <textarea
                    value={editData.equipo_descripcion}
                    onChange={(e) => setEditData({ ...editData, equipo_descripcion: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-line-strong rounded-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones (estado al llegar)</label>
                  <textarea
                    value={editData.observaciones}
                    onChange={(e) => setEditData({ ...editData, observaciones: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-line-strong rounded-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo a realizar</label>
                  <textarea
                    value={editData.trabajo_realizar}
                    onChange={(e) => setEditData({ ...editData, trabajo_realizar: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-line-strong rounded-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Técnico asignado</label>
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
                    <label className="block text-sm font-medium text-slate-700">Condiciones del servicio</label>
                    <div className="relative" ref={condicionesMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowCondicionesMenu(!showCondicionesMenu)}
                        className="p-1.5 hover:bg-control rounded-full transition-colors duration-150"
                      >
                        <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {showCondicionesMenu && (
                        <div className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg shadow-menu z-40">
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => handleEditCondiciones('orden')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#f1f6ff] text-brand font-medium"
                            >
                              Editar solo para esta orden
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditCondiciones('cliente')}
                              disabled={!orden?.cliente?.id}
                              className={cn(
                                'w-full px-4 py-2 text-left text-sm hover:bg-surface-muted',
                                !orden?.cliente?.id ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'
                              )}
                            >
                              Editar para este cliente
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditCondiciones('global')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700"
                            >
                              Editar para todas las órdenes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-surface-muted rounded-field text-sm whitespace-pre-line max-h-48 overflow-y-auto">
                    {editData.condiciones_servicio || 'No hay condiciones definidas'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="condiciones_aceptadas_edit"
                    checked={editData.condiciones_aceptadas}
                    onChange={(e) => setEditData({ ...editData, condiciones_aceptadas: e.target.checked })}
                    className="w-4 h-4 text-brand border-line-strong rounded"
                  />
                  <label htmlFor="condiciones_aceptadas_edit" className="text-sm text-slate-700">
                    El cliente acepta las condiciones del servicio <span className="text-[#b91c1c]">*</span>
                  </label>
                </div>
                <div className="border-t border-line-soft pt-4">
                  <FirmaDigital
                    firmaInicial={editData.firma_cliente}
                    onFirmaChange={(firma) => setEditData({ ...editData, firma_cliente: firma })}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditOrden}
                disabled={savingEdit}
                className={cn(
                  'flex-1 px-4 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                  savingEdit ? 'bg-brand-disabled cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
                )}
              >
                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Eliminar Orden</h2>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar la <strong>Orden #{orden.numero_orden}</strong>?
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

      {/* Modal editar condiciones */}
      {showCondicionesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowCondicionesModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {condicionesModalTipo === 'orden' && 'Editar condiciones de esta orden'}
              {condicionesModalTipo === 'cliente' && 'Editar condiciones del cliente'}
              {condicionesModalTipo === 'global' && 'Editar condiciones globales'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {condicionesModalTipo === 'orden' && 'Estas condiciones solo aplicarán a esta orden.'}
              {condicionesModalTipo === 'cliente' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas de este cliente.'}
              {condicionesModalTipo === 'global' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas.'}
            </p>
            <textarea
              value={condicionesEditTemp}
              onChange={(e) => setCondicionesEditTemp(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-line-strong rounded-field text-sm"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCondicionesModal(false)}
                className="flex-1 px-4 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCondiciones}
                disabled={savingCondiciones}
                className={cn(
                  'flex-1 px-4 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                  savingCondiciones ? 'bg-brand-disabled cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
                )}
              >
                {savingCondiciones ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
