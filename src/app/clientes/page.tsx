'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Cliente } from '@/types';
import { formatDate, normalizeText } from '@/lib/utils';

const SEARCH_OPTIONS = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'documento', label: 'Identificación' },
  { value: 'telefono', label: 'Celular' },
];

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('nombre');
  const [searchValue, setSearchValue] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
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
  const searchDropdownRef = useRef<HTMLDivElement>(null);
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
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
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
      .select('*')
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Clientes' }
      ]} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600">Directorio de clientes registrados</p>
          </div>
          <Button onClick={() => setShowNuevoCliente(true)}>+ Agregar Cliente</Button>
        </div>

        {/* Modal nuevo cliente */}
        {showNuevoCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNuevoCliente(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Nuevo Cliente</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
                  <select
                    value={nuevoCliente.tipo_documento}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, tipo_documento: e.target.value })}
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
                    value={nuevoCliente.numero_documento}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, numero_documento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Número de identificación"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
                  <input
                    type="text"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Número de celular"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={nuevoCliente.direccion}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowNuevoCliente(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleCrearCliente}
                  loading={saving}
                  disabled={!nuevoCliente.nombre || !nuevoCliente.telefono}
                  className="flex-1"
                >
                  Crear Cliente
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="mb-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Buscar por:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative" ref={searchDropdownRef}>
                <button
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="w-full sm:w-44 px-4 py-2 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center hover:border-gray-400 transition-colors"
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
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                          searchType === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder={`Buscar por ${SEARCH_OPTIONS.find(o => o.value === searchType)?.label.toLowerCase()}...`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Ordenamiento */}
          <div className="flex justify-end">
            <button
              onClick={() => setSortAscending(!sortAscending)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sortAscending ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                )}
              </svg>
              <span className="text-sm text-gray-700">
                {sortAscending ? 'A → Z' : 'Z → A'}
              </span>
            </button>
          </div>
        </div>

        {/* Lista de clientes */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Cargando clientes...
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No se encontraron clientes
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {clientesFiltrados.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors flex justify-between items-start"
                  >
                    <Link href={`/clientes/${cliente.id}`} className="flex-1">
                      <div>
                        <p className="font-medium text-gray-900">{cliente.nombre}</p>
                        {cliente.numero_documento && (
                          <p className="text-sm text-gray-600">
                            {cliente.tipo_documento}: {cliente.numero_documento}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">Cel: {cliente.telefono}</p>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Registrado: {formatDate(cliente.created_at)}
                      </div>
                    </Link>
                    {/* Menú de tres puntos */}
                    <div className="relative" ref={menuOpenId === cliente.id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpenId(menuOpenId === cliente.id ? null : cliente.id);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {menuOpenId === cliente.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                          <div className="py-1">
                            <Link
                              href={`/clientes/${cliente.id}`}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Ver detalles
                            </Link>
                            <Link
                              href={`/ordenes/nueva?cliente_id=${cliente.id}`}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Nueva orden
                            </Link>
                            <hr className="my-1" />
                            <button
                              onClick={() => {
                                setClienteToDelete(cliente);
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal confirmar eliminar */}
        {showDeleteModal && clienteToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Eliminar Cliente</h2>
              <p className="text-gray-600 mb-4">
                ¿Estás seguro de que deseas eliminar a <strong>{clienteToDelete.nombre}</strong>?
              </p>
              <p className="text-amber-600 bg-amber-50 p-3 rounded-lg mb-4 text-sm">
                <strong>Atención:</strong> Al eliminar este cliente, también se eliminarán todas sus órdenes y datos asociados.
              </p>
              <p className="text-red-600 font-medium mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCliente}
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
