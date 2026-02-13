'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ESTADOS_ORDEN, type EstadoOrden } from '@/types';
import { formatDateTime, formatCurrency, normalizeText } from '@/lib/utils';

const SEARCH_OPTIONS = [
  { value: 'numero_orden', label: '# de orden' },
  { value: 'cliente_nombre', label: 'Nombre del cliente' },
  { value: 'cliente_documento', label: 'Documento del cliente' },
  { value: 'cliente_telefono', label: 'Celular del cliente' },
];

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  recibido: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  en_proceso: { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-500' },
  listo: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
  entregado: { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500' },
};

export default function OrdenesPage() {
  const searchParams = useSearchParams();
  const estadoParam = searchParams.get('estado') as EstadoOrden | null;
  const pagoParam = searchParams.get('pago') as 'completo' | 'incompleto' | null;

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('numero_orden');
  const [searchValue, setSearchValue] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedEstados, setSelectedEstados] = useState<Set<EstadoOrden | 'todas'>>(() => {
    if (estadoParam && ['recibido', 'en_proceso', 'listo', 'entregado'].includes(estadoParam)) {
      return new Set<EstadoOrden | 'todas'>([estadoParam]);
    }
    return new Set<EstadoOrden | 'todas'>(['todas']);
  });
  const [filtroPago, setFiltroPago] = useState<'todos' | 'completo' | 'incompleto'>(() => {
    if (pagoParam === 'completo') return 'completo';
    if (pagoParam === 'incompleto') return 'incompleto';
    return 'todos';
  });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [estadoMenuOpenId, setEstadoMenuOpenId] = useState<string | null>(null);
  const [pagoMenuOpenId, setPagoMenuOpenId] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [proximoNumeroOrden, setProximoNumeroOrden] = useState<number | null>(null);
  const [editandoProximoNumero, setEditandoProximoNumero] = useState(false);
  const [nuevoProximoNumero, setNuevoProximoNumero] = useState('');
  const [savingProximoNumero, setSavingProximoNumero] = useState(false);
  const [selectedTrabajador, setSelectedTrabajador] = useState<string>('todos');
  const [showTrabajadorDropdown, setShowTrabajadorDropdown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const estadoMenuRef = useRef<HTMLDivElement>(null);
  const pagoMenuRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const trabajadorDropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadOrdenes();
    loadProximoNumeroOrden();
  }, [sortAscending]);

  const loadProximoNumeroOrden = async () => {
    // Primero intentar obtener de la configuración
    const { data: config } = await supabase
      .from('configuracion')
      .select('proximo_numero_orden')
      .eq('id', 1)
      .single();

    if (config?.proximo_numero_orden) {
      setProximoNumeroOrden(config.proximo_numero_orden);
    } else {
      // Si no existe, calcular basado en las órdenes existentes
      const { data: maxOrden } = await supabase
        .from('ordenes')
        .select('numero_orden')
        .order('numero_orden', { ascending: false })
        .limit(1)
        .single();

      const siguiente = (maxOrden?.numero_orden || 0) + 1;
      setProximoNumeroOrden(siguiente);
    }
  };

  const handleGuardarProximoNumero = async () => {
    const numero = parseInt(nuevoProximoNumero);
    if (isNaN(numero) || numero < 1) return;

    setSavingProximoNumero(true);
    const { error } = await supabase
      .from('configuracion')
      .update({ proximo_numero_orden: numero })
      .eq('id', 1);

    if (!error) {
      setProximoNumeroOrden(numero);
      setEditandoProximoNumero(false);
    }
    setSavingProximoNumero(false);
  };

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
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (trabajadorDropdownRef.current && !trabajadorDropdownRef.current.contains(event.target as Node)) {
        setShowTrabajadorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        // Actualizar estado local sin recargar
        setOrdenes(ordenes.map(o =>
          o.id === orden.id
            ? { ...o, pagos: [...(o.pagos || []), { monto: saldo }] }
            : o
        ));
      }
    }
    setPagoMenuOpenId(null);
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
    setPagoMenuOpenId(null);
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
      setOrdenes(ordenes.filter(o => o.id !== ordenToDelete.id));
      setShowDeleteModal(false);
      setOrdenToDelete(null);
    } catch (err) {
      console.error('Error al eliminar la orden:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Extraer técnicos únicos de las órdenes
  const tecnicosUnicos = Array.from(
    new Map(
      ordenes
        .filter(o => o.tecnico_asignado)
        .map(o => [o.tecnico_asignado.id, o.tecnico_asignado.nombre])
    ).entries()
  )
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

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

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Órdenes' }
      ]} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
            <p className="text-gray-600">Gestiona todas las órdenes</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Próximo número de orden */}
            <div className="flex items-center gap-2">
              {editandoProximoNumero ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Próxima orden #</span>
                  <input
                    type="number"
                    value={nuevoProximoNumero}
                    onChange={(e) => setNuevoProximoNumero(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                  <button
                    onClick={handleGuardarProximoNumero}
                    disabled={savingProximoNumero}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingProximoNumero ? '...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditandoProximoNumero(false)}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNuevoProximoNumero(proximoNumeroOrden?.toString() || '1');
                    setEditandoProximoNumero(true);
                  }}
                  className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
                  title="Click para editar"
                >
                  Próxima orden <span className="font-semibold">#{proximoNumeroOrden || '...'}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <Link href="/ordenes/nueva">
              <Button>+ Nueva Orden</Button>
            </Link>
          </div>
        </div>

        {/* Buscador y filtros */}
        <div className="mb-6 space-y-4">
          {/* Buscador */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Buscar por:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative" ref={searchDropdownRef}>
                <button
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="w-full sm:w-56 px-4 py-2 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center hover:border-gray-400 transition-colors"
                >
                  <span className="text-gray-700 whitespace-nowrap">
                    {SEARCH_OPTIONS.find(o => o.value === searchType)?.label}
                  </span>
                  <svg className="w-4 h-4 text-gray-500 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSearchDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                    {SEARCH_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSearchType(option.value);
                          setShowSearchDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg whitespace-nowrap ${
                          searchType === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={`Buscar por ${SEARCH_OPTIONS.find(o => o.value === searchType)?.label.toLowerCase()}...`}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => setSearchValue('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filtros de estado, trabajador y pago */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            {/* Filtros de estado */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por estado:</p>
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                <button
                  onClick={() => handleEstadoFilterClick('todas')}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
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
                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
                      isEstadoSelected(estado.value)
                        ? `${ESTADO_COLORS[estado.value].bg} ${ESTADO_COLORS[estado.value].text}`
                        : `bg-white text-gray-700 border ${ESTADO_COLORS[estado.value].border} hover:bg-gray-50`
                    }`}
                  >
                    <span className="hidden sm:inline">{estado.label}</span>
                    <span className="sm:hidden">{estado.value === 'en_proceso' ? 'Proceso' : estado.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por técnico */}
            {tecnicosUnicos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por técnico:</p>
                <div className="relative" ref={trabajadorDropdownRef}>
                  <button
                    onClick={() => setShowTrabajadorDropdown(!showTrabajadorDropdown)}
                    className="w-full sm:w-48 px-4 py-2 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center hover:border-gray-400 transition-colors"
                  >
                    <span className="text-gray-700 truncate">
                      {selectedTrabajador === 'todos'
                        ? 'Todos'
                        : tecnicosUnicos.find(t => t.id === selectedTrabajador)?.nombre || 'Todos'}
                    </span>
                    <svg className="w-4 h-4 text-gray-500 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showTrabajadorDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedTrabajador('todos');
                          setShowTrabajadorDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 first:rounded-t-lg text-sm ${
                          selectedTrabajador === 'todos' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        Todos
                      </button>
                      {tecnicosUnicos.map((tecnico) => (
                        <button
                          key={tecnico.id}
                          onClick={() => {
                            setSelectedTrabajador(tecnico.id);
                            setShowTrabajadorDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-gray-100 last:rounded-b-lg text-sm ${
                            selectedTrabajador === tecnico.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {tecnico.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filtros de pago - a la derecha */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por pago:</p>
              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={() => setFiltroPago('todos')}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
                    filtroPago === 'todos'
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroPago('incompleto')}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
                    filtroPago === 'incompleto'
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-700 border border-red-300 hover:bg-red-50'
                  }`}
                >
                  Pago incompleto
                </button>
                <button
                  onClick={() => setFiltroPago('completo')}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
                    filtroPago === 'completo'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-700 border border-green-300 hover:bg-green-50'
                  }`}
                >
                  Pago completo
                </button>
              </div>
            </div>
          </div>

          {/* Botón de ordenamiento */}
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

        {/* Lista de órdenes */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Cargando órdenes...
              </div>
            ) : ordenesFiltradas.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No se encontraron órdenes.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {ordenesFiltradas.map((orden) => {
                  const estadoInfo = ESTADOS_ORDEN.find(e => e.value === orden.estado);
                  const estadoColor = ESTADO_COLORS[orden.estado];
                  const total = calcularTotalOrden(orden);
                  const pagado = calcularPagadoOrden(orden);
                  const esCompleto = esPagoCompleto(orden);

                  return (
                    <div
                      key={orden.id}
                      className="px-6 py-4 hover:bg-gray-50 transition-colors flex justify-between items-start"
                    >
                      <Link href={`/ordenes/${orden.id}`} className="flex-1">
                        {/* Título y badges */}
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
                        {orden.recibido_por && (
                          <p className="text-sm text-gray-500">
                            Recibido por: {orden.recibido_por.nombre}
                          </p>
                        )}
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
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
