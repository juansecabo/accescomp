import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  // Redondear a entero y formatear con punto como separador de miles
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted}`;
}

// Parsear un string de precio a número
// - 2.000 o 2,000 → 2000 (separador de miles: exactamente 3 dígitos después)
// - 300.0 o 300,0 → 300 (decimal: 1-2 dígitos después, se ignora la parte decimal)
// - 20.021554555 → 0 (inválido: más de 3 dígitos después del separador)
export function parseCurrency(value: string): number {
  if (!value) return 0;

  // Quitar símbolo de peso y espacios
  let cleaned = value.replace(/[$\s]/g, '').trim();
  if (!cleaned) return 0;

  // Verificar que solo contenga números, puntos y comas
  if (!/^[\d.,]+$/.test(cleaned)) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  // Si no hay separadores, parsear directamente
  if (!hasComma && !hasDot) {
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  // Si tiene ambos separadores (ej: 1.234,56 o 1,234.56)
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const lastSepPos = Math.max(lastComma, lastDot);
    const afterLast = cleaned.substring(lastSepPos + 1);

    if (afterLast.length <= 2) {
      // El último es decimal, ignorarlo
      const integerPart = cleaned.substring(0, lastSepPos).replace(/[.,]/g, '');
      const num = parseInt(integerPart, 10);
      return isNaN(num) ? 0 : num;
    } else if (afterLast.length === 3) {
      // Todo son separadores de miles
      const num = parseInt(cleaned.replace(/[.,]/g, ''), 10);
      return isNaN(num) ? 0 : num;
    } else {
      return 0; // Inválido
    }
  }

  // Solo tiene un tipo de separador (punto o coma)
  const separator = hasComma ? ',' : '.';
  const parts = cleaned.split(separator);
  const lastPart = parts[parts.length - 1];

  if (lastPart.length <= 2) {
    // Es decimal (1-2 dígitos después), tomar solo la parte entera
    const integerPart = parts.slice(0, -1).join('');
    if (!integerPart) return 0;
    const num = parseInt(integerPart, 10);
    return isNaN(num) ? 0 : num;
  } else if (lastPart.length === 3) {
    // Es separador de miles (exactamente 3 dígitos después)
    // Verificar que las partes intermedias también tengan 3 dígitos
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].length !== 3) {
        return 0; // Formato inválido
      }
    }
    const num = parseInt(cleaned.replace(/[.,]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  } else {
    // Más de 3 dígitos después del separador = inválido
    return 0;
  }
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}${month}-${random}`;
}

// Normaliza texto removiendo tildes/acentos para búsquedas
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
