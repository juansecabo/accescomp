'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Muestra el próximo número de orden y permite editarlo (persiste en
// configuracion.proximo_numero_orden). Usado en Inicio y Órdenes.
export function ProximaOrden() {
  const [proximoNumeroOrden, setProximoNumeroOrden] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadProximoNumeroOrden();
  }, []);

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

  const handleGuardar = async () => {
    const numero = parseInt(nuevoNumero);
    if (isNaN(numero) || numero < 1) return;

    setSaving(true);
    const { error } = await supabase
      .from('configuracion')
      .update({ proximo_numero_orden: numero })
      .eq('id', 1);

    if (!error) {
      setProximoNumeroOrden(numero);
      setEditando(false);
    }
    setSaving(false);
  };

  if (editando) {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-[13px] font-medium text-slate-600 whitespace-nowrap">Próxima orden #</span>
        <input
          type="number"
          value={nuevoNumero}
          onChange={(e) => setNuevoNumero(e.target.value)}
          className="w-20 px-2 py-1 h-[38px] text-sm font-mono border border-line-strong rounded-field"
          min="1"
          autoFocus
        />
        <button
          onClick={handleGuardar}
          disabled={saving}
          className="px-3 h-[38px] text-xs font-bold bg-brand text-white rounded-field hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? '...' : 'Guardar'}
        </button>
        <button
          onClick={() => setEditando(false)}
          className="px-3 h-[38px] text-xs font-semibold bg-surface border border-line-strong text-slate-600 rounded-field hover:border-slate-300 transition-colors duration-150"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setNuevoNumero(proximoNumeroOrden?.toString() || '1');
        setEditando(true);
      }}
      className="hidden sm:flex items-center gap-2 px-3 py-[9px] border border-line rounded-field text-[13px] font-medium text-slate-600 whitespace-nowrap hover:border-line-strong transition-colors duration-150"
      title="Click para editar"
    >
      Próxima orden{' '}
      <span className="font-mono font-bold text-[13px] text-slate-900">
        #{proximoNumeroOrden || '...'}
      </span>
      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );
}
