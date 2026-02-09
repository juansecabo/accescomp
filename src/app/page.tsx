'use client';

import { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { ESTADOS_ORDEN, type EstadoOrden } from '@/types';

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  recibido: { bg: 'bg-blue-500', text: 'text-white' },
  en_proceso: { bg: 'bg-yellow-500', text: 'text-white' },
  listo: { bg: 'bg-green-500', text: 'text-white' },
  entregado: { bg: 'bg-gray-500', text: 'text-white' },
};

const menuItems = [
  {
    href: '/ordenes',
    label: 'ÓRDENES',
    image: '/ordenes.webp',
    bgColor: 'from-blue-600 to-blue-700',
    hoverColor: 'hover:from-blue-500 hover:to-blue-600',
  },
  {
    href: '/clientes',
    label: 'CLIENTES',
    image: '/clientes.webp',
    bgColor: 'from-sky-500 to-sky-600',
    hoverColor: 'hover:from-sky-400 hover:to-sky-500',
  },
  {
    href: '/estadisticas',
    label: 'ESTADÍSTICAS',
    image: '/estadisticas.webp',
    bgColor: 'from-indigo-500 to-indigo-600',
    hoverColor: 'hover:from-indigo-400 hover:to-indigo-500',
  },
];

export default function Dashboard() {
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [estadoMenuOpenId, setEstadoMenuOpenId] = useState<string | null>(null);
  const [pagoMenuOpenId, setPagoMenuOpenId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const estadoMenuRef = useRef<HTMLDivElement>(null);
  const pagoMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadRecentOrders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
      if (estadoMenuRef.current && !estadoMenuRef.current.contains(event.target as Node)) {
        setEstadoMenuOpenId(null);
      }
      if (pagoMenuRef.current && !pagoMenuRef.current.contains(event.target as Node)) {
        setPagoMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecentOrders = async () => {
    const { data } = await supabase
      .from('ordenes')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, tipo_documento, numero_documento),
        items:items_orden(precio, cantidad),
        pagos(monto)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentOrders(data || []);
    setLoading(false);
  };

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
        setRecentOrders(recentOrders.map(o =>
          o.id === orden.id
            ? { ...o, pagos: [...(o.pagos || []), { monto: saldo }] }
            : o
        ));
      }
    }
    setPagoMenuOpenId(null);
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
      setRecentOrders(recentOrders.map(o =>
        o.id === orden.id
          ? { ...o, pagos: o.pagos.filter((_: any, i: number) => i !== o.pagos.length - 1) }
          : o
      ));
    }
    setPagoMenuOpenId(null);
  };

  const handleChangeEstado = async (ordenId: string, nuevoEstado: EstadoOrden) => {
    const { error } = await supabase
      .from('ordenes')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', ordenId);

    if (!error) {
      setRecentOrders(recentOrders.map(o =>
        o.id === ordenId ? { ...o, estado: nuevoEstado } : o
      ));
    }
    setEstadoMenuOpenId(null);
  };

  const handleDeleteOrden = async () => {
    if (!ordenToDelete) return;
    setDeleting(true);
    try {
      await supabase.from('archivos_orden').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('items_orden').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('pagos').delete().eq('orden_id', ordenToDelete.id);
      await supabase.from('ordenes').delete().eq('id', ordenToDelete.id);
      setRecentOrders(recentOrders.filter(o => o.id !== ordenToDelete.id));
      setShowDeleteModal(false);
      setOrdenToDelete(null);
    } catch (err) {
      console.error('Error al eliminar la orden:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Título de bienvenida */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-2">
            Bienvenido(a)
          </h1>
          <p className="text-lg text-gray-600">
            ¿Qué deseas consultar?
          </p>
        </div>

        {/* Grid de botones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative overflow-hidden rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl group h-20 sm:h-24`}
            >
              {/* Imagen de fondo */}
              <div className="absolute inset-0">
                <Image
                  src={item.image}
                  alt={item.label}
                  fill
                  className="object-cover opacity-60 group-hover:opacity-70 transition-opacity duration-300"
                />
              </div>

              {/* Overlay de color */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.bgColor} ${item.hoverColor} opacity-70 group-hover:opacity-60 transition-all duration-300`} />

              {/* Texto */}
              <div className="absolute inset-0 flex items-center justify-center">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wider drop-shadow-lg">
                  {item.label}
                </h2>
              </div>

              {/* Efecto de brillo en hover */}
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            </Link>
          ))}
        </div>

        {/* Órdenes Recientes */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Órdenes Recientes</h2>
            <Link href="/ordenes" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Cargando órdenes...
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay órdenes registradas aún.
                <br />
                <Link href="/ordenes/nueva" className="text-blue-600 hover:underline">
                  Crear primera orden
                </Link>
              </div>
            ) : (
              recentOrders.map((orden) => {
                const estadoInfo = ESTADOS_ORDEN.find(e => e.value === orden.estado);
                const estadoColor = ESTADO_COLORS[orden.estado] || { bg: 'bg-gray-500', text: 'text-white' };
                const total = calcularTotalOrden(orden);
                const pagado = calcularPagadoOrden(orden);
                const esCompleto = esPagoCompleto(orden);

                return (
                  <div
                    key={orden.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors flex justify-between items-start"
                  >
                    <Link href={`/ordenes/${orden.id}`} className="flex-1">
                      {/* Título y badges en la misma línea */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">
                          Orden #{orden.numero_orden}
                        </p>
                        {/* Badges de estado y pago */}
                        {/* Badge de estado - clickeable */}
                          <div className="relative" ref={estadoMenuOpenId === orden.id ? estadoMenuRef : null}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEstadoMenuOpenId(estadoMenuOpenId === orden.id ? null : orden.id);
                                setPagoMenuOpenId(null);
                                setMenuOpenId(null);
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor.bg} ${estadoColor.text} hover:opacity-80 transition-opacity`}
                            >
                              {estadoInfo?.label || orden.estado}
                            </button>

                            {estadoMenuOpenId === orden.id && (
                              <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                                <div className="py-1">
                                  <p className="px-3 py-2 text-xs text-gray-500 font-medium">Cambiar estado a:</p>
                                  {ESTADOS_ORDEN.map((estado) => (
                                    <button
                                      key={estado.value}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleChangeEstado(orden.id, estado.value);
                                      }}
                                      disabled={orden.estado === estado.value}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                        orden.estado === estado.value ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
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

                          {/* Badge de pago - clickeable */}
                          <div className="relative" ref={pagoMenuOpenId === orden.id ? pagoMenuRef : null}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPagoMenuOpenId(pagoMenuOpenId === orden.id ? null : orden.id);
                                setEstadoMenuOpenId(null);
                                setMenuOpenId(null);
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${
                                esCompleto
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {esCompleto
                                ? formatCurrency(total)
                                : `${formatCurrency(pagado)} / ${formatCurrency(total)}`
                              }
                            </button>

                            {pagoMenuOpenId === orden.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                                <div className="py-1">
                                  <p className="px-3 py-2 text-xs text-gray-500 font-medium">Estado de pago:</p>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!esCompleto) {
                                        setPagoMenuOpenId(null);
                                      } else {
                                        handleSetPagoIncompleto(orden);
                                      }
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                      !esCompleto ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                                    }`}
                                  >
                                    <span className="w-3 h-3 rounded-full bg-red-500" />
                                    Pago incompleto
                                    {!esCompleto && (
                                      <span className="ml-auto text-xs text-gray-400">(actual)</span>
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (esCompleto) {
                                        setPagoMenuOpenId(null);
                                      } else {
                                        handleSetPagoCompleto(orden);
                                      }
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                      esCompleto ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                                    }`}
                                  >
                                    <span className="w-3 h-3 rounded-full bg-green-500" />
                                    Pago completo
                                    {esCompleto && (
                                      <span className="ml-auto text-xs text-gray-400">(actual)</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                      </div>
                      <p className="text-gray-900 mt-1">
                        {orden.cliente?.nombre || 'Sin cliente'}
                      </p>
                      {orden.cliente?.numero_documento && (
                        <p className="text-sm text-gray-500">
                          {orden.cliente.tipo_documento}: {orden.cliente.numero_documento}
                        </p>
                      )}
                      {orden.cliente?.telefono && (
                        <p className="text-sm text-gray-500">
                          Cel: {orden.cliente.telefono}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        {orden.equipo_descripcion?.substring(0, 80)}
                        {orden.equipo_descripcion?.length > 80 ? '...' : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDateTime(orden.created_at)}
                      </p>
                    </Link>

                    {/* Menú de tres puntos - solo Ver detalle y Eliminar */}
                    <div className="relative" ref={menuOpenId === orden.id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpenId(menuOpenId === orden.id ? null : orden.id);
                          setEstadoMenuOpenId(null);
                          setPagoMenuOpenId(null);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {menuOpenId === orden.id && (
                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                          <div className="py-1">
                            <Link
                              href={`/ordenes/${orden.id}`}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Ver detalle
                            </Link>
                            <hr className="my-1" />
                            <button
                              onClick={() => {
                                setOrdenToDelete(orden);
                                setShowDeleteModal(true);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal confirmar eliminar */}
        {showDeleteModal && ordenToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Eliminar Orden</h2>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que deseas eliminar la <strong>Orden #{ordenToDelete.numero_orden}</strong>?
                <br /><br />
                <span className="text-red-600 font-medium">Esta acción no se puede deshacer.</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteOrden}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
