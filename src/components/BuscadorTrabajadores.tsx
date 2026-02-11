'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { normalizeText } from '@/lib/utils';
import type { Trabajador } from '@/types';

interface BuscadorTrabajadoresProps {
  onTrabajadorSelect: (trabajador: Trabajador | null) => void;
  trabajadorSeleccionado: Trabajador | null;
}

export function BuscadorTrabajadores({ onTrabajadorSelect, trabajadorSeleccionado }: BuscadorTrabajadoresProps) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Trabajador[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGestion, setShowGestion] = useState(false);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (busqueda.length >= 1) {
      buscarTrabajadores();
    } else {
      setResultados([]);
    }
  }, [busqueda]);

  const buscarTrabajadores = async () => {
    const { data } = await supabase
      .from('trabajadores')
      .select('*')
      .order('nombre');

    if (data) {
      const busquedaNormalizada = normalizeText(busqueda);
      const filtrados = data.filter(t =>
        normalizeText(t.nombre).includes(busquedaNormalizada)
      ).slice(0, 5);
      setResultados(filtrados);
    } else {
      setResultados([]);
    }
    setMostrarResultados(true);
  };

  const handleSelectTrabajador = (trabajador: Trabajador) => {
    onTrabajadorSelect(trabajador);
    setBusqueda('');
    setMostrarResultados(false);
    setModoNuevo(false);
  };

  const handleCrearTrabajador = async () => {
    if (!nuevoNombre.trim()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('trabajadores')
      .insert({ nombre: nuevoNombre.trim() })
      .select()
      .single();

    if (!error && data) {
      handleSelectTrabajador(data);
      setNuevoNombre('');
    }
    setLoading(false);
  };

  const handleCambiarTrabajador = () => {
    onTrabajadorSelect(null);
    setModoNuevo(false);
  };

  const loadTrabajadores = async () => {
    const { data } = await supabase
      .from('trabajadores')
      .select('*')
      .order('nombre');
    setTrabajadores(data || []);
  };

  const handleOpenGestion = () => {
    loadTrabajadores();
    setShowGestion(true);
  };

  const handleEditSave = async (id: string) => {
    if (!editNombre.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from('trabajadores')
      .update({ nombre: editNombre.trim() })
      .eq('id', id);

    if (!error) {
      setTrabajadores(trabajadores.map(t =>
        t.id === id ? { ...t, nombre: editNombre.trim() } : t
      ));
      // Si el trabajador editado es el seleccionado, actualizar
      if (trabajadorSeleccionado?.id === id) {
        onTrabajadorSelect({ ...trabajadorSeleccionado, nombre: editNombre.trim() });
      }
      setEditandoId(null);
    }
    setSavingEdit(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase
      .from('trabajadores')
      .delete()
      .eq('id', id);

    if (!error) {
      setTrabajadores(trabajadores.filter(t => t.id !== id));
      if (trabajadorSeleccionado?.id === id) {
        onTrabajadorSelect(null);
      }
    }
    setDeletingId(null);
  };

  if (trabajadorSeleccionado) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
          <p className="font-medium text-gray-900">{trabajadorSeleccionado.nombre}</p>
          <Button variant="ghost" size="sm" onClick={handleCambiarTrabajador}>
            Cambiar
          </Button>
        </div>
        <button
          type="button"
          onClick={handleOpenGestion}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Gestionar trabajadores"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Modal de gestión */}
        {showGestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowGestion(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Gestionar Trabajadores</h2>
              {trabajadores.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay trabajadores registrados</p>
              ) : (
                <div className="space-y-2">
                  {trabajadores.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 border rounded-lg">
                      {editandoId === t.id ? (
                        <>
                          <input
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleEditSave(t.id)}
                            disabled={savingEdit}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingEdit ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{t.nombre}</span>
                          <button
                            onClick={() => {
                              setEditandoId(t.id);
                              setEditNombre(t.nombre);
                            }}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button variant="secondary" onClick={() => setShowGestion(false)} className="w-full">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (modoNuevo) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Nuevo Trabajador</h3>
            <Button variant="ghost" size="sm" onClick={() => setModoNuevo(false)}>
              Cancelar
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre del trabajador"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
            />
            <Button onClick={handleCrearTrabajador} loading={loading} disabled={!nuevoNombre.trim()}>
              Crear
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenGestion}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Gestionar trabajadores"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Modal de gestión */}
        {showGestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowGestion(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Gestionar Trabajadores</h2>
              {trabajadores.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay trabajadores registrados</p>
              ) : (
                <div className="space-y-2">
                  {trabajadores.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 border rounded-lg">
                      {editandoId === t.id ? (
                        <>
                          <input
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleEditSave(t.id)}
                            disabled={savingEdit}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingEdit ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{t.nombre}</span>
                          <button
                            onClick={() => {
                              setEditandoId(t.id);
                              setEditNombre(t.nombre);
                            }}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button variant="secondary" onClick={() => setShowGestion(false)} className="w-full">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Buscar trabajador por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onFocus={() => busqueda.length >= 1 && setMostrarResultados(true)}
            />
          </div>
          <Button variant="secondary" onClick={() => setModoNuevo(true)}>
            Nuevo
          </Button>
        </div>

        {mostrarResultados && resultados.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {resultados.map((trabajador) => (
              <button
                key={trabajador.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                onClick={() => handleSelectTrabajador(trabajador)}
              >
                <p className="font-medium">{trabajador.nombre}</p>
              </button>
            ))}
          </div>
        )}

        {mostrarResultados && busqueda.length >= 1 && resultados.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <p className="text-gray-500 text-center mb-2">No se encontraron trabajadores</p>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => {
              setModoNuevo(true);
              setNuevoNombre(busqueda);
              setMostrarResultados(false);
            }}>
              Crear nuevo trabajador
            </Button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleOpenGestion}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Gestionar trabajadores"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {/* Modal de gestión */}
      {showGestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowGestion(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Gestionar Trabajadores</h2>
            {trabajadores.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay trabajadores registrados</p>
            ) : (
              <div className="space-y-2">
                {trabajadores.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    {editandoId === t.id ? (
                      <>
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditSave(t.id)}
                          disabled={savingEdit}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingEdit ? '...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => setEditandoId(null)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{t.nombre}</span>
                        <button
                          onClick={() => {
                            setEditandoId(t.id);
                            setEditNombre(t.nombre);
                          }}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Button variant="secondary" onClick={() => setShowGestion(false)} className="w-full">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
