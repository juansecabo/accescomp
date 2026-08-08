'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import Link from 'next/link';
import type { Cliente } from '@/types';
import { formatDateShort, normalizeText, cn } from '@/lib/utils';

const SEARCH_OPTIONS = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'documento', label: 'Identificación' },
  { value: 'telefono', label: 'Celular' },
];

const GRID = 'grid grid-cols-[44px_minmax(0,1.4fr)_190px_150px_90px_130px_34px]';

const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('nombre');
  const [searchValue, setSearchValue] = useState('');
  const [sortAscending, setSortAscending] = useState(true);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    email: '',
    direccion: ''
  });
  const [saving, setSaving] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const TIPOS_DOCUMENTO = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PA', label: 'Pasaporte' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'NIT', label: 'NIT' },
    { value: 'OTRO', label: 'Otro' },
  ];

  useEffect(() => {
    loadClientes();
  }, [sortAscending]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clientes')
      .select('*, ordenes(count)')
      .order('nombre', { ascending: sortAscending });

    setClientes(data || []);
    setLoading(false);
  };

  const handleCrearCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.telefono) return;

    setSaving(true);
    const { error } = await supabase
      .from('clientes')
      .insert({
        nombre: nuevoCliente.nombre,
        tipo_documento: nuevoCliente.tipo_documento,
        numero_documento: nuevoCliente.numero_documento || null,
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email || null,
        direccion: nuevoCliente.direccion || null,
      });

    if (!error) {
      setNuevoCliente({
        nombre: '',
        tipo_documento: 'CC',
        numero_documento: '',
        telefono: '',
        email: '',
        direccion: ''
      });
      setShowNuevoCliente(false);
      loadClientes();
    }
    setSaving(false);
  };

  const handleDeleteCliente = async () => {
    if (!clienteToDelete) return;
    setDeleting(true);
    try {
      // Primero obtener las órdenes del cliente para eliminar datos relacionados
      const { data: ordenes } = await supabase
        .from('ordenes')
        .select('id')
        .eq('cliente_id', clienteToDelete.id);

      if (ordenes) {
        for (const orden of ordenes) {
          await supabase.from('archivos_orden').delete().eq('orden_id', orden.id);
          await supabase.from('items_orden').delete().eq('orden_id', orden.id);
          await supabase.from('pagos').delete().eq('orden_id', orden.id);
        }
      }
      await supabase.from('ordenes').delete().eq('cliente_id', clienteToDelete.id);
      await supabase.from('clientes').delete().eq('id', clienteToDelete.id);
      setClientes(clientes.filter(c => c.id !== clienteToDelete.id));
      setShowDeleteModal(false);
      setClienteToDelete(null);
    } catch (err) {
      console.error('Error al eliminar el cliente:', err);
    } finally {
      setDeleting(false);
    }
  };

  const clientesFiltrados = clientes.filter((cliente) => {
    if (!searchValue.trim()) return true;
    const searchLower = searchValue.toLowerCase().trim();
    const searchNormalized = normalizeText(searchValue.trim());

    switch (searchType) {
      case 'nombre':
        return normalizeText(cliente.nombre || '').includes(searchNormalized);
      case 'documento':
        return cliente.numero_documento?.toLowerCase().includes(searchLower);
      case 'telefono':
        return cliente.telefono?.includes(searchLower);
      default:
        return true;
    }
  });

  const conteoOrdenes = (cliente: any) => cliente.ordenes?.[0]?.count ?? 0;

  const clienteMenu = (cliente: any) => (
    <div className="relative flex justify-end" ref={menuOpenId === cliente.id ? menuRef : null}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setMenuOpenId(menuOpenId === cliente.id ? null : cliente.id);
        }}
        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-control rounded-full transition-colors duration-150"
        aria-label="Opciones del cliente"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {menuOpenId === cliente.id && (
        <div className="absolute right-0 top-7 w-48 bg-surface border border-line rounded-lg shadow-menu z-30">
          <div className="py-1">
            <Link
              href={`/clientes/${cliente.id}`}
              className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver detalles
            </Link>
            <Link
              href={`/ordenes/nueva?cliente_id=${cliente.id}`}
              className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nueva orden
            </Link>
            <hr className="my-1 border-line-soft" />
            <button
              onClick={() => {
                setClienteToDelete(cliente);
                setShowDeleteModal(true);
                setMenuOpenId(null);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[#fef2f2] text-[#b91c1c] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const toolbar = (
    <div className="bg-surface border-b border-line px-4 sm:px-6 py-3 flex flex-wrap gap-2 items-center">
      <div className="flex items-center h-[38px] border border-line-strong rounded-field overflow-hidden flex-1 min-w-[220px] bg-surface">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          className="h-full border-none bg-surface-muted px-2 text-xs font-semibold text-slate-600 cursor-pointer"
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
      <button
        onClick={() => setSortAscending(!sortAscending)}
        className="flex items-center gap-2 h-[38px] px-3 border border-line-strong rounded-field font-semibold text-[13px] font-mono text-slate-600 bg-surface whitespace-nowrap hover:border-slate-300 transition-colors duration-150"
      >
        <svg width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24">
          {sortAscending ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          )}
        </svg>
        {sortAscending ? 'A → Z' : 'Z → A'}
      </button>
    </div>
  );

  return (
    <AppShell
      breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Clientes' }]}
      title="Clientes"
      count={loading ? '...' : `${clientes.length} registros`}
      actions={
        <button
          onClick={() => setShowNuevoCliente(true)}
          className="px-[14px] py-[10px] rounded-field bg-brand hover:bg-brand-hover text-white font-bold text-[13px] whitespace-nowrap transition-colors duration-150"
        >
          + Agregar cliente
        </button>
      }
      toolbar={toolbar}
    >
      <div className="p-4 sm:p-6">
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[13px] font-medium text-slate-400">
              Cargando clientes...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-[13px] font-medium text-slate-400">
              No se encontraron clientes
            </div>
          ) : (
            <>
              {/* Tabla desktop */}
              <div className="hidden lg:block">
                <div
                  className={cn(
                    GRID,
                    'px-4 py-[9px] bg-surface-muted border-b border-line-soft text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400'
                  )}
                >
                  <div></div>
                  <div>Cliente</div>
                  <div>Documento</div>
                  <div>Celular</div>
                  <div className="text-center">Órdenes</div>
                  <div>Registrado</div>
                  <div></div>
                </div>
                {clientesFiltrados.map((cliente) => (
                  <div
                    key={cliente.id}
                    className={cn(GRID, 'items-center px-4 py-[11px] border-b border-line-row hover:bg-surface-muted transition-colors duration-150')}
                  >
                    <div className="w-8 h-8 rounded-field bg-control flex items-center justify-center text-xs font-bold text-slate-600">
                      {iniciales(cliente.nombre || '?')}
                    </div>
                    <Link href={`/clientes/${cliente.id}`} className="min-w-0 pr-2">
                      <div className="font-semibold text-[13px] text-slate-900 truncate hover:text-brand transition-colors duration-150">
                        {cliente.nombre}
                      </div>
                      {cliente.email && (
                        <div className="font-mono font-medium text-[11px] text-slate-400 truncate">{cliente.email}</div>
                      )}
                    </Link>
                    <div className="font-mono text-xs text-slate-600 truncate pr-2">
                      {cliente.numero_documento
                        ? `${cliente.tipo_documento || ''} ${cliente.numero_documento}`.trim()
                        : '—'}
                    </div>
                    <div className="font-mono text-xs text-slate-600 truncate pr-2">{cliente.telefono}</div>
                    <div className="text-center font-mono font-bold text-[13px] text-slate-900">
                      {conteoOrdenes(cliente)}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDateShort(cliente.created_at)}
                    </div>
                    {clienteMenu(cliente)}
                  </div>
                ))}
              </div>

              {/* Tarjetas móvil */}
              <div className="lg:hidden divide-y divide-line-row">
                {clientesFiltrados.map((cliente) => (
                  <div key={cliente.id} className="p-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-field bg-control flex items-center justify-center text-xs font-bold text-slate-600 flex-none">
                      {iniciales(cliente.nombre || '?')}
                    </div>
                    <Link href={`/clientes/${cliente.id}`} className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">{cliente.nombre}</div>
                      <div className="mt-[2px] font-mono text-[11px] text-slate-400 truncate">
                        {[
                          cliente.numero_documento &&
                            `${cliente.tipo_documento || ''} ${cliente.numero_documento}`.trim(),
                          cliente.telefono,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="mt-[2px] text-[11px] text-slate-400">
                        {conteoOrdenes(cliente)} {conteoOrdenes(cliente) === 1 ? 'orden' : 'órdenes'} · {formatDateShort(cliente.created_at)}
                      </div>
                    </Link>
                    {clienteMenu(cliente)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo cliente */}
      {showNuevoCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowNuevoCliente(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Nuevo Cliente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: 'Nombre *', key: 'nombre', span: true, placeholder: 'Nombre completo' },
                { label: 'Tipo de documento', key: 'tipo_documento', select: true },
                { label: 'Número de documento', key: 'numero_documento', placeholder: 'Número de identificación' },
                { label: 'Celular *', key: 'telefono', placeholder: 'Número de celular' },
                { label: 'Email', key: 'email', placeholder: 'correo@ejemplo.com', type: 'email' },
                { label: 'Dirección', key: 'direccion', span: true, placeholder: 'Dirección' },
              ] as const).map((field) => (
                <div key={field.key} className={cn('span' in field && field.span && 'sm:col-span-2')}>
                  <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">
                    {field.label}
                  </label>
                  {'select' in field && field.select ? (
                    <select
                      value={nuevoCliente.tipo_documento}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, tipo_documento: e.target.value })}
                      className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm bg-surface"
                    >
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={'type' in field ? field.type : 'text'}
                      value={nuevoCliente[field.key as keyof typeof nuevoCliente]}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, [field.key]: e.target.value })}
                      className="w-full px-3 h-[40px] border border-line-strong rounded-field text-sm"
                      placeholder={'placeholder' in field ? field.placeholder : ''}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNuevoCliente(false)}
                className="flex-1 px-4 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearCliente}
                disabled={saving || !nuevoCliente.nombre || !nuevoCliente.telefono}
                className={cn(
                  'flex-1 px-4 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                  saving || !nuevoCliente.nombre || !nuevoCliente.telefono
                    ? 'bg-brand-disabled cursor-not-allowed'
                    : 'bg-brand hover:bg-brand-hover'
                )}
              >
                {saving ? 'Creando...' : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {showDeleteModal && clienteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Eliminar Cliente</h2>
            <p className="text-slate-600 mb-4">
              ¿Estás seguro de que deseas eliminar a <strong>{clienteToDelete.nombre}</strong>?
            </p>
            <p className="text-[#b45309] bg-[#fffbeb] border border-[#fde68a] p-3 rounded-field mb-4 text-sm">
              <strong>Atención:</strong> Al eliminar este cliente, también se eliminarán todas sus órdenes y datos asociados.
            </p>
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
