'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import type { ItemOrden } from '@/types';

interface ItemsFacturacionProps {
  items: ItemOrden[];
  onItemsChange: (items: ItemOrden[]) => void;
  readOnly?: boolean;
  sugerenciaDescripcion?: string;
  onDescripcionModificada?: () => void;
}

export function ItemsFacturacion({ items, onItemsChange, readOnly = false, sugerenciaDescripcion, onDescripcionModificada }: ItemsFacturacionProps) {
  const [nuevoItem, setNuevoItem] = useState({ descripcion: '', precio: '', cantidad: '1' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState({ descripcion: '', precio: '', cantidad: '' });
  const descripcionModificadaRef = useRef(false);
  const editRowRef = useRef<HTMLTableRowElement>(null);

  // Autocompletar descripción si hay sugerencia y no se ha modificado manualmente
  useEffect(() => {
    if (sugerenciaDescripcion && !descripcionModificadaRef.current && items.length === 0) {
      setNuevoItem(prev => ({ ...prev, descripcion: sugerenciaDescripcion }));
    }
  }, [sugerenciaDescripcion, items.length]);

  // Guardar automáticamente al hacer clic fuera de la fila de edición
  useEffect(() => {
    if (editingIndex === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editRowRef.current && !editRowRef.current.contains(event.target as Node)) {
        handleSaveEdit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingIndex, editingItem]);

  const handleDescripcionChange = (value: string) => {
    if (!descripcionModificadaRef.current) {
      descripcionModificadaRef.current = true;
      onDescripcionModificada?.();
    }
    setNuevoItem({ ...nuevoItem, descripcion: value });
  };

  const handleAddItem = () => {
    if (!nuevoItem.descripcion) return;

    const precioNumerico = parseCurrency(nuevoItem.precio);

    const item: ItemOrden = {
      id: `temp-${Date.now()}`,
      orden_id: '',
      descripcion: nuevoItem.descripcion,
      precio: precioNumerico, // 0 si no hay precio
      cantidad: parseInt(nuevoItem.cantidad) || 1,
    };

    // Marcar como modificada cuando se agrega un item
    if (!descripcionModificadaRef.current) {
      descripcionModificadaRef.current = true;
      onDescripcionModificada?.();
    }

    onItemsChange([...items, item]);
    setNuevoItem({ descripcion: '', precio: '', cantidad: '1' });
  };

  const handlePrecioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number) => {
    // Si ya estamos editando otro, guardar primero
    if (editingIndex !== null && editingIndex !== index) {
      handleSaveEdit();
    }
    const item = items[index];
    setEditingIndex(index);
    setEditingItem({
      descripcion: item.descripcion,
      precio: item.precio > 0 ? item.precio.toString() : '',
      cantidad: item.cantidad.toString(),
    });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    if (!editingItem.descripcion) {
      setEditingIndex(null);
      return;
    }

    const precioNumerico = parseCurrency(editingItem.precio);

    const newItems = [...items];
    newItems[editingIndex] = {
      ...newItems[editingIndex],
      descripcion: editingItem.descripcion,
      precio: precioNumerico, // 0 si no hay precio
      cantidad: parseInt(editingItem.cantidad) || 1,
    };
    onItemsChange(newItems);
    setEditingIndex(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  const formatPrecio = (precio: number) => {
    if (precio === 0) {
      return <span className="text-amber-600 italic">Por definir</span>;
    }
    return formatCurrency(precio);
  };

  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const hayItemsSinPrecio = items.some(item => item.precio === 0);

  return (
    <div className="space-y-4">
      {/* Lista de items */}
      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Descripción</th>
                <th className="px-1 sm:px-4 py-2 text-center text-xs sm:text-sm font-medium text-gray-700 w-10 sm:w-20">Cant.</th>
                <th className="px-1 sm:px-4 py-2 text-right text-xs sm:text-sm font-medium text-gray-700 w-16 sm:w-28">Precio</th>
                <th className="px-1 sm:px-4 py-2 text-right text-xs sm:text-sm font-medium text-gray-700 w-16 sm:w-28">Subtotal</th>
                {!readOnly && <th className="px-1 py-2 w-8 sm:w-12"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id || index} ref={editingIndex === index ? editRowRef : null}>
                  {editingIndex === index && !readOnly ? (
                    <>
                      <td className="px-1 sm:px-2 py-1">
                        <input
                          type="text"
                          value={editingItem.descripcion}
                          onChange={(e) => setEditingItem({ ...editingItem, descripcion: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                          className="w-full px-1 sm:px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="1"
                          value={editingItem.cantidad}
                          onChange={(e) => setEditingItem({ ...editingItem, cantidad: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                          className="w-full px-1 py-1 text-xs sm:text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="$"
                          value={editingItem.precio}
                          onChange={(e) => setEditingItem({ ...editingItem, precio: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                          className="w-full px-1 py-1 text-xs sm:text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-1 sm:px-2 py-1 text-xs sm:text-sm text-right font-medium">
                        {(parseCurrency(editingItem.precio) || 0) === 0
                          ? <span className="text-amber-600 italic text-xs">Por definir</span>
                          : formatCurrency((parseCurrency(editingItem.precio) || 0) * (parseInt(editingItem.cantidad) || 1))
                        }
                      </td>
                      <td className="px-1 py-1">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800 text-xs p-1"
                        >
                          ✕
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${!readOnly ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        onClick={() => !readOnly && handleStartEdit(index)}
                      >
                        {item.descripcion}
                      </td>
                      <td
                        className={`px-1 sm:px-4 py-2 text-xs sm:text-sm text-center ${!readOnly ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        onClick={() => !readOnly && handleStartEdit(index)}
                      >
                        {item.cantidad}
                      </td>
                      <td
                        className={`px-1 sm:px-4 py-2 text-xs sm:text-sm text-right ${!readOnly ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        onClick={() => !readOnly && handleStartEdit(index)}
                      >
                        {formatPrecio(item.precio)}
                      </td>
                      <td className="px-1 sm:px-4 py-2 text-xs sm:text-sm text-right font-medium">
                        {item.precio === 0
                          ? <span className="text-amber-600 italic text-xs">Por definir</span>
                          : formatCurrency(item.precio * item.cantidad)
                        }
                      </td>
                      {!readOnly && (
                        <td className="px-1 py-2 text-right">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-sm">
                  Total:
                </td>
                <td className="px-1 sm:px-4 py-2 sm:py-3 text-right font-bold text-xs sm:text-lg">
                  {hayItemsSinPrecio ? (
                    <span className="text-amber-600">
                      {total > 0 ? `${formatCurrency(total)}+` : 'Por definir'}
                    </span>
                  ) : (
                    formatCurrency(total)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Formulario nuevo item */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Input
              label="Descripción"
              placeholder="Servicio o producto"
              value={nuevoItem.descripcion}
              onChange={(e) => handleDescripcionChange(e.target.value)}
            />
          </div>
          <div className="w-20 sm:w-24">
            <Input
              label="Cantidad"
              type="number"
              min="1"
              value={nuevoItem.cantidad}
              onChange={(e) => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-32">
            <Input
              label="Precio"
              type="text"
              inputMode="numeric"
              placeholder="$"
              value={nuevoItem.precio}
              onChange={(e) => setNuevoItem({ ...nuevoItem, precio: e.target.value })}
              onKeyDown={handlePrecioKeyDown}
            />
          </div>
          <Button onClick={handleAddItem} disabled={!nuevoItem.descripcion}>
            Agregar
          </Button>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          No hay items agregados
        </p>
      )}
    </div>
  );
}
