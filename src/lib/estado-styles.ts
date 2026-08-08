import type { EstadoOrden } from '@/types';

// Mapa de estilos de presentación por estado de orden (rediseño).
// La semántica de los estados sigue viviendo en ESTADOS_ORDEN (src/types/index.ts).
export const ESTADO_STYLES: Record<
  EstadoOrden,
  { fg: string; bg: string; solid: string; dot: string; hex: string }
> = {
  recibido: {
    fg: 'text-estado-recibido',
    bg: 'bg-estado-recibido-soft',
    solid: 'bg-estado-recibido-solid',
    dot: 'bg-estado-recibido',
    hex: '#1d4ed8',
  },
  en_proceso: {
    fg: 'text-estado-proceso',
    bg: 'bg-estado-proceso-soft',
    solid: 'bg-estado-proceso-solid',
    dot: 'bg-estado-proceso',
    hex: '#c2410c',
  },
  listo: {
    fg: 'text-estado-listo',
    bg: 'bg-estado-listo-soft',
    solid: 'bg-estado-listo-solid',
    dot: 'bg-estado-listo',
    hex: '#047857',
  },
  entregado: {
    fg: 'text-estado-entregado',
    bg: 'bg-estado-entregado-soft',
    solid: 'bg-estado-entregado-solid',
    dot: 'bg-estado-entregado',
    hex: '#64748b',
  },
};

export const PAGO_STYLES = {
  completo: { fg: 'text-[#047857]', bg: 'bg-[#ecfdf5]', bar: 'bg-[#047857]' },
  incompleto: { fg: 'text-[#b91c1c]', bg: 'bg-[#fef2f2]', bar: 'bg-[#b91c1c]' },
};
