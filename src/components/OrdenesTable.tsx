'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ESTADOS_ORDEN, type EstadoOrden } from '@/types';
import { ESTADO_STYLES, PAGO_STYLES } from '@/lib/estado-styles';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

export const calcularTotalOrden = (orden: any) =>
  orden.items?.reduce((sum: number, item: any) => sum + item.precio * item.cantidad, 0) || 0;

export const calcularPagadoOrden = (orden: any) =>
  orden.pagos?.reduce((sum: number, pago: any) => sum + pago.monto, 0) || 0;

export const esPagoCompleto = (orden: any) => {
  const total = calcularTotalOrden(orden);
  const pagado = calcularPagadoOrden(orden);
  return total > 0 && pagado >= total;
};

const GRID = 'grid grid-cols-[88px_120px_minmax(0,1.2fr)_minmax(0,1.5fr)_120px_160px_120px_34px]';

interface OrdenesTableProps {
  ordenes: any[];
  onChangeEstado: (ordenId: string, nuevoEstado: EstadoOrden) => void;
  onSetPagoCompleto: (orden: any) => void;
  onSetPagoIncompleto: (orden: any) => void;
  onDelete: (orden: any) => void;
  emptyMessage?: string;
}

export function OrdenesTable({
  ordenes,
  onChangeEstado,
  onSetPagoCompleto,
  onSetPagoIncompleto,
  onDelete,
  emptyMessage = 'No se encontraron órdenes con esos filtros.',
}: OrdenesTableProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [estadoMenuOpenId, setEstadoMenuOpenId] = useState<string | null>(null);
  const [pagoMenuOpenId, setPagoMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const estadoMenuRef = useRef<HTMLDivElement>(null);
  const pagoMenuRef = useRef<HTMLDivElement>(null);

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

  const closeAll = () => {
    setMenuOpenId(null);
    setEstadoMenuOpenId(null);
    setPagoMenuOpenId(null);
  };

  const estadoBadge = (orden: any) => {
    const style = ESTADO_STYLES[orden.estado as EstadoOrden] ?? ESTADO_STYLES.entregado;
    const label = ESTADOS_ORDEN.find((e) => e.value === orden.estado)?.label || orden.estado;
    return (
      <div className="relative" ref={estadoMenuOpenId === orden.id ? estadoMenuRef : null}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = estadoMenuOpenId === orden.id ? null : orden.id;
            closeAll();
            setEstadoMenuOpenId(next);
          }}
          className={cn(
            'inline-flex items-center gap-[6px] px-2 py-1 rounded-chip text-[11px] font-semibold whitespace-nowrap hover:opacity-85 transition-opacity duration-150',
            style.bg,
            style.fg
          )}
        >
          <span className={cn('w-[6px] h-[6px] rounded-full', style.dot)} />
          {label}
        </button>

        {estadoMenuOpenId === orden.id && (
          <div className="absolute left-0 mt-2 w-44 bg-surface border border-line rounded-lg shadow-menu z-30">
            <div className="py-1">
              <p className="px-3 py-2 text-xs text-slate-500 font-medium">Cambiar estado a:</p>
              {ESTADOS_ORDEN.map((estado) => (
                <button
                  key={estado.value}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChangeEstado(orden.id, estado.value);
                    setEstadoMenuOpenId(null);
                  }}
                  disabled={orden.estado === estado.value}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-surface-muted flex items-center gap-2',
                    orden.estado === estado.value && 'opacity-50 cursor-not-allowed bg-surface-muted'
                  )}
                >
                  <span className={cn('w-3 h-3 rounded-full', ESTADO_STYLES[estado.value].dot)} />
                  {estado.label}
                  {orden.estado === estado.value && (
                    <span className="ml-auto text-xs text-slate-400">(actual)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const pagoBadge = (orden: any, alignRight = true) => {
    const total = calcularTotalOrden(orden);
    const pagado = calcularPagadoOrden(orden);
    const completo = esPagoCompleto(orden);
    const style = completo ? PAGO_STYLES.completo : PAGO_STYLES.incompleto;
    const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;

    return (
      <div className="relative" ref={pagoMenuOpenId === orden.id ? pagoMenuRef : null}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = pagoMenuOpenId === orden.id ? null : orden.id;
            closeAll();
            setPagoMenuOpenId(next);
          }}
          className={cn('block hover:opacity-85 transition-opacity duration-150', alignRight && 'ml-auto text-right')}
        >
          <span className={cn('font-mono font-bold text-[13px] whitespace-nowrap', style.fg)}>
            {completo ? formatCurrency(total) : `${formatCurrency(pagado)} / ${formatCurrency(total)}`}
          </span>
          <span className={cn('mt-[5px] block w-[88px] h-1 rounded-full bg-line-soft overflow-hidden', alignRight && 'ml-auto')}>
            <span className={cn('block h-1 rounded-full', style.bar)} style={{ width: `${pct}%` }} />
          </span>
        </button>

        {pagoMenuOpenId === orden.id && (
          <div className="absolute right-0 mt-2 w-48 bg-surface border border-line rounded-lg shadow-menu z-30">
            <div className="py-1">
              <p className="px-3 py-2 text-xs text-slate-500 font-medium">Estado de pago:</p>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!completo) {
                    setPagoMenuOpenId(null);
                  } else {
                    onSetPagoIncompleto(orden);
                    setPagoMenuOpenId(null);
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-surface-muted flex items-center gap-2',
                  !completo && 'opacity-50 cursor-not-allowed bg-surface-muted'
                )}
              >
                <span className="w-3 h-3 rounded-full bg-[#b91c1c]" />
                Pago incompleto
                {!completo && <span className="ml-auto text-xs text-slate-400">(actual)</span>}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (completo) {
                    setPagoMenuOpenId(null);
                  } else {
                    onSetPagoCompleto(orden);
                    setPagoMenuOpenId(null);
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-surface-muted flex items-center gap-2',
                  completo && 'opacity-50 cursor-not-allowed bg-surface-muted'
                )}
              >
                <span className="w-3 h-3 rounded-full bg-[#047857]" />
                Pago completo
                {completo && <span className="ml-auto text-xs text-slate-400">(actual)</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const rowMenu = (orden: any) => (
    <div className="relative flex justify-end" ref={menuOpenId === orden.id ? menuRef : null}>
      <button
        onClick={(e) => {
          e.preventDefault();
          const next = menuOpenId === orden.id ? null : orden.id;
          closeAll();
          setMenuOpenId(next);
        }}
        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-control rounded-full transition-colors duration-150"
        aria-label="Opciones de la orden"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {menuOpenId === orden.id && (
        <div className="absolute right-0 top-7 w-40 bg-surface border border-line rounded-lg shadow-menu z-30">
          <div className="py-1">
            <Link
              href={`/ordenes/${orden.id}`}
              className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver detalle
            </Link>
            <hr className="my-1 border-line-soft" />
            <button
              onClick={() => {
                onDelete(orden);
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

  if (ordenes.length === 0) {
    return (
      <div className="p-8 text-center text-[13px] font-medium text-slate-400">{emptyMessage}</div>
    );
  }

  return (
    <>
      {/* Tabla desktop */}
      <div className="hidden lg:block">
        <div
          className={cn(
            GRID,
            'px-4 py-[9px] bg-surface-muted border-b border-line-soft text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400'
          )}
        >
          <div>Orden</div>
          <div>Estado</div>
          <div>Cliente</div>
          <div>Equipo</div>
          <div>Técnico</div>
          <div className="text-right">Pago</div>
          <div className="text-right">Ingreso</div>
          <div></div>
        </div>
        {ordenes.map((orden) => (
          <div
            key={orden.id}
            className={cn(GRID, 'items-center px-4 py-[11px] border-b border-line-row hover:bg-surface-muted transition-colors duration-150')}
          >
            <Link
              href={`/ordenes/${orden.id}`}
              className="font-mono font-bold text-[13px] text-brand hover:text-brand-hover"
            >
              #{orden.numero_orden}
            </Link>
            <div>{estadoBadge(orden)}</div>
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-[13px] text-slate-900 truncate">
                {orden.cliente?.nombre || 'Sin cliente'}
              </div>
              {(orden.cliente?.numero_documento || orden.cliente?.telefono) && (
                <div className="font-mono font-medium text-[11px] text-slate-400 truncate">
                  {[
                    orden.cliente?.numero_documento &&
                      `${orden.cliente.tipo_documento || ''} ${orden.cliente.numero_documento}`.trim(),
                    orden.cliente?.telefono,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            <div className="min-w-0 pr-2 text-xs text-slate-500 leading-[1.4] truncate">
              {orden.equipo_descripcion}
            </div>
            <div className="text-xs font-medium text-slate-600 truncate pr-2">
              {orden.tecnico_asignado?.nombre || '—'}
            </div>
            <div className="text-right">{pagoBadge(orden)}</div>
            <div className="text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
              {formatDate(orden.created_at)}
            </div>
            {rowMenu(orden)}
          </div>
        ))}
      </div>

      {/* Tarjetas móvil */}
      <div className="lg:hidden flex flex-col divide-y divide-line-row">
        {ordenes.map((orden) => (
          <div key={orden.id} className="p-3 bg-surface">
            <div className="flex items-center gap-2">
              <Link
                href={`/ordenes/${orden.id}`}
                className="font-mono font-bold text-[13px] text-brand"
              >
                #{orden.numero_orden}
              </Link>
              {estadoBadge(orden)}
              <div className="ml-auto flex items-center gap-1">
                {pagoBadge(orden)}
                {rowMenu(orden)}
              </div>
            </div>
            <Link href={`/ordenes/${orden.id}`} className="block mt-2">
              <div className="font-semibold text-sm text-slate-900">
                {orden.cliente?.nombre || 'Sin cliente'}
              </div>
              <div className="mt-[2px] text-xs text-slate-500 truncate">{orden.equipo_descripcion}</div>
              <div className="mt-[2px] font-mono text-[11px] text-slate-400">
                {[orden.cliente?.telefono, formatDate(orden.created_at)].filter(Boolean).join(' · ')}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
