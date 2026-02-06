'use client';

import { ESTADOS_ORDEN, type EstadoOrden as TipoEstado } from '@/types';
import { cn } from '@/lib/utils';

interface EstadoOrdenProps {
  estado: TipoEstado;
  onChange?: (nuevoEstado: TipoEstado) => void;
  readOnly?: boolean;
}

export function EstadoOrden({ estado, onChange, readOnly = false }: EstadoOrdenProps) {
  if (readOnly) {
    const estadoInfo = ESTADOS_ORDEN.find(e => e.value === estado);
    return (
      <div className={cn('px-4 py-2 rounded-full text-white text-sm font-medium inline-block', estadoInfo?.color)}>
        {estadoInfo?.label || estado}
      </div>
    );
  }

  const getShortLabel = (value: string, label: string) => {
    if (value === 'en_proceso') return 'Proceso';
    if (value === 'entregado') return 'Entreg.';
    return label;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Estado de la orden</p>
      <div className="flex items-center gap-1 sm:gap-2">
        {ESTADOS_ORDEN.map((estadoOption) => {
          const isActive = estadoOption.value === estado;

          return (
            <button
              key={estadoOption.value}
              onClick={() => !isActive && onChange?.(estadoOption.value)}
              disabled={isActive}
              className={cn(
                'flex-1 sm:flex-none px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all',
                isActive && `${estadoOption.color} text-white cursor-default`,
                !isActive && 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer border border-gray-300'
              )}
            >
              <span className="hidden sm:inline">{estadoOption.label}</span>
              <span className="sm:hidden">{getShortLabel(estadoOption.value, estadoOption.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
