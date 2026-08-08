'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppShell } from '@/components/AppShell';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { BuscadorClientes } from '@/components/BuscadorClientes';
import { BuscadorTrabajadores } from '@/components/BuscadorTrabajadores';
import { ItemsFacturacion } from '@/components/ItemsFacturacion';
import { FirmaDigital } from '@/components/FirmaDigital';
import { GrabadorVideo, subirArchivosTemporales } from '@/components/GrabadorVideo';
import type { Cliente, ItemOrden, Trabajador } from '@/types';
import { parseCurrency, formatCurrency, cn } from '@/lib/utils';

interface ArchivoTemporal {
  id: string;
  tipo: 'video' | 'imagen';
  blob: Blob;
  previewUrl: string;
  nombre: string;
}

const CONDICIONES_SERVICIO = `
1. El cliente autoriza la revisión y diagnóstico del equipo.
2. Los trabajos se realizarán según lo acordado en esta orden.
3. El tiempo de reparación puede variar según la complejidad del trabajo.
4. Los equipos no reclamados después de 30 días serán considerados abandonados.
5. No nos hacemos responsables por pérdida de datos. Se recomienda hacer respaldo.
6. El cliente debe presentar esta orden para recoger su equipo.
7. Garantía de 30 días en reparaciones, no cubre mal uso o daño físico.
`.trim();

export default function NuevaOrdenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const clienteIdParam = searchParams.get('cliente_id');

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [recibidoPor, setRecibidoPor] = useState<Trabajador | null>(null);
  const [tecnicoAsignado, setTecnicoAsignado] = useState<Trabajador | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [facturacionModificada, setFacturacionModificada] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [archivosTemporales, setArchivosTemporales] = useState<ArchivoTemporal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [condicionesTexto, setCondicionesTexto] = useState(CONDICIONES_SERVICIO);
  const [showCondicionesMenu, setShowCondicionesMenu] = useState(false);
  const [showCondicionesModal, setShowCondicionesModal] = useState(false);
  const [condicionesModalTipo, setCondicionesModalTipo] = useState<'orden' | 'cliente' | 'global'>('orden');
  const [condicionesEditTemp, setCondicionesEditTemp] = useState('');
  const [savingCondiciones, setSavingCondiciones] = useState(false);
  const condicionesMenuRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    equipo_descripcion: '',
    observaciones: '',
    motivo_visita: '',
    trabajo_realizar: '',
    condiciones_aceptadas: false,
    abono: '',
  });

  useEffect(() => {
    loadCondicionesGlobales();
    if (clienteIdParam) {
      loadClientePreseleccionado(clienteIdParam);
    }
  }, [clienteIdParam]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (condicionesMenuRef.current && !condicionesMenuRef.current.contains(event.target as Node)) {
        setShowCondicionesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCondicionesGlobales = async () => {
    const { data } = await supabase
      .from('configuracion')
      .select('condiciones_servicio')
      .eq('id', 1)
      .single();

    if (data?.condiciones_servicio) {
      setCondicionesTexto(data.condiciones_servicio);
    }
  };

  const loadClientePreseleccionado = async (clienteId: string) => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (data) {
      setCliente(data);
      if (data.condiciones_servicio) {
        setCondicionesTexto(data.condiciones_servicio);
      }
    }
  };

  const handleEditCondiciones = (tipo: 'orden' | 'cliente' | 'global') => {
    setCondicionesModalTipo(tipo);
    setCondicionesEditTemp(condicionesTexto);
    setShowCondicionesModal(true);
    setShowCondicionesMenu(false);
  };

  const handleSaveCondiciones = async () => {
    setSavingCondiciones(true);
    try {
      if (condicionesModalTipo === 'global') {
        await supabase
          .from('configuracion')
          .update({ condiciones_servicio: condicionesEditTemp })
          .eq('id', 1);
      } else if (condicionesModalTipo === 'cliente' && cliente) {
        await supabase
          .from('clientes')
          .update({ condiciones_servicio: condicionesEditTemp })
          .eq('id', cliente.id);
      }
      setCondicionesTexto(condicionesEditTemp);
      setShowCondicionesModal(false);
    } catch (err) {
      console.error('Error al guardar condiciones:', err);
    } finally {
      setSavingCondiciones(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const calcularTotal = () => items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const calcularSaldo = () => calcularTotal() - parseCurrency(formData.abono);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) {
      setError('Selecciona un cliente');
      return;
    }

    const abonoIngresado = parseCurrency(formData.abono);
    const total = calcularTotal();

    if (formData.abono && abonoIngresado === 0 && formData.abono.trim() !== '') {
      setError('El valor del abono es inválido');
      return;
    }

    if (abonoIngresado > total) {
      setError(`El abono no puede exceder el total (${formatCurrency(total)})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Obtener el próximo número de orden de la configuración
      const { data: config } = await supabase
        .from('configuracion')
        .select('proximo_numero_orden')
        .eq('id', 1)
        .single();

      let numeroOrden = config?.proximo_numero_orden;

      // Si no hay configuración, obtener el máximo + 1
      if (!numeroOrden) {
        const { data: maxOrden } = await supabase
          .from('ordenes')
          .select('numero_orden')
          .order('numero_orden', { ascending: false })
          .limit(1)
          .single();
        numeroOrden = (maxOrden?.numero_orden || 0) + 1;
      }

      // Crear la orden con el número específico
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes')
        .insert({
          numero_orden: numeroOrden,
          cliente_id: cliente.id,
          recibido_por_id: recibidoPor?.id || null,
          tecnico_asignado_id: tecnicoAsignado?.id || null,
          equipo_descripcion: formData.equipo_descripcion,
          observaciones: formData.observaciones,
          motivo_visita: formData.motivo_visita,
          trabajo_realizar: formData.trabajo_realizar,
          estado: 'recibido',
          firma_cliente: firma,
          condiciones_aceptadas: formData.condiciones_aceptadas,
          condiciones_servicio: condicionesTexto,
        })
        .select()
        .single();

      if (ordenError) throw ordenError;

      // Incrementar el próximo número de orden en la configuración
      await supabase
        .from('configuracion')
        .update({ proximo_numero_orden: numeroOrden + 1 })
        .eq('id', 1);

      // Crear items
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          orden_id: orden.id,
          descripcion: item.descripcion,
          precio: item.precio,
          cantidad: item.cantidad,
        }));

        const { error: itemsError } = await supabase
          .from('items_orden')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Crear pago/abono si existe
      const abonoNumerico = parseCurrency(formData.abono);
      if (abonoNumerico > 0) {
        const { error: pagoError } = await supabase
          .from('pagos')
          .insert({
            orden_id: orden.id,
            monto: abonoNumerico,
          });

        if (pagoError) throw pagoError;
      }

      // Subir archivos temporales (fotos/videos)
      if (archivosTemporales.length > 0) {
        const archivosSubidos = await subirArchivosTemporales(orden.id, archivosTemporales, supabase);

        // Guardar referencias en la base de datos
        for (const archivo of archivosSubidos) {
          await supabase.from('archivos_orden').insert({
            orden_id: orden.id,
            tipo: archivo.tipo,
            url: archivo.url,
            nombre: archivo.nombre,
          });
        }
      }

      router.push(`/ordenes/${orden.id}`);
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  const cardClass = 'bg-surface border border-line rounded-card overflow-hidden';

  const seccionHeader = (numero: string, titulo: string, extra?: React.ReactNode) => (
    <div className="px-4 py-[11px] border-b border-line-soft flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded bg-navy-900 text-white font-mono font-bold text-[11px] flex items-center justify-center">
          {numero}
        </span>
        <h2 className="font-bold text-[13px] text-slate-900">{titulo}</h2>
      </div>
      {extra}
    </div>
  );

  // Requisitos para el checklist "Falta por completar"
  const requisitos = [
    { label: 'Cliente seleccionado', ok: !!cliente },
    { label: 'Descripción del equipo', ok: !!formData.equipo_descripcion.trim() },
    { label: 'Trabajo a realizar', ok: !!formData.trabajo_realizar.trim() },
    { label: 'Condiciones aceptadas', ok: formData.condiciones_aceptadas },
  ];

  const resumenFila = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between items-baseline gap-3 py-[6px] border-b border-navy-700 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-sidenav flex-none">{label}</span>
      <span className="text-[13px] font-medium text-sidenav-strong text-right truncate">{value}</span>
    </div>
  );

  return (
    <AppShell
      breadcrumb={[
        { label: 'Inicio', href: '/' },
        { label: 'Órdenes', href: '/ordenes' },
        { label: 'Nueva orden' },
      ]}
      title="Nueva orden de servicio"
      subtitle="Complete los datos para registrar una nueva orden"
    >
      <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-[18px] items-start">
        <form id="nueva-orden-form" onSubmit={handleSubmit} className="flex flex-col gap-[14px] min-w-0">
          {error && (
            <div className="p-4 bg-[#fef2f2] border-l-[3px] border-[#dc2626] text-[#b91c1c] text-sm rounded-r-lg animate-shake">
              {error}
            </div>
          )}

          {/* Sección 1: Cliente */}
          <div className={cardClass}>
            {seccionHeader('1', 'Cliente')}
            <div className="px-4 py-[14px]">
              <BuscadorClientes
                onClienteSelect={setCliente}
                clienteSeleccionado={cliente}
              />
            </div>
          </div>

          {/* Sección 2: Recibido por */}
          <div className={cardClass}>
            {seccionHeader('2', 'Recibido por')}
            <div className="px-4 py-[14px]">
              <BuscadorTrabajadores
                onTrabajadorSelect={setRecibidoPor}
                trabajadorSeleccionado={recibidoPor}
              />
            </div>
          </div>

          {/* Sección 3: Equipo */}
          <div className={cardClass}>
            {seccionHeader('3', 'Equipo')}
            <div className="px-4 py-[14px] space-y-4">
              <Textarea
                id="equipo_descripcion"
                name="equipo_descripcion"
                label="Descripción del equipo"
                placeholder="Ej: Laptop HP Pavilion, modelo 15-dk1056wm, color negro..."
                rows={3}
                value={formData.equipo_descripcion}
                onChange={handleChange}
                required
              />
              <Textarea
                id="observaciones"
                name="observaciones"
                label="Observaciones (estado al llegar)"
                placeholder="Ej: Rayones en la tapa, falta una tecla, pantalla rota en esquina..."
                rows={3}
                value={formData.observaciones}
                onChange={handleChange}
              />

              {/* Fotos y Videos */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fotos / Videos del equipo
                </label>
                <GrabadorVideo
                  onArchivosTemporales={setArchivosTemporales}
                  archivosTemporales={archivosTemporales}
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Servicio */}
          <div className={cardClass}>
            {seccionHeader('4', 'Servicio')}
            <div className="px-4 py-[14px] space-y-4">
              <Textarea
                id="trabajo_realizar"
                name="trabajo_realizar"
                label="Trabajo a realizar"
                placeholder="Ej: Diagnóstico general, formateo, cambio de pasta térmica..."
                rows={3}
                value={formData.trabajo_realizar}
                onChange={handleChange}
                required
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Técnico asignado</label>
                <BuscadorTrabajadores
                  onTrabajadorSelect={setTecnicoAsignado}
                  trabajadorSeleccionado={tecnicoAsignado}
                />
              </div>
            </div>
          </div>

          {/* Sección 5: Facturación */}
          <div className={cardClass}>
            {seccionHeader('5', 'Facturación')}
            <div className="px-4 py-[14px] space-y-4">
              <ItemsFacturacion
                items={items}
                onItemsChange={setItems}
                sugerenciaDescripcion={!facturacionModificada ? formData.trabajo_realizar : undefined}
                onDescripcionModificada={() => setFacturacionModificada(true)}
              />

              {items.length > 0 && (
                <div className="border-t border-line-soft pt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="max-w-xs">
                      <Input
                        id="abono"
                        name="abono"
                        label="Abono"
                        type="text"
                        inputMode="numeric"
                        placeholder="$"
                        value={formData.abono}
                        onChange={handleChange}
                      />
                      {formData.abono && parseCurrency(formData.abono) > calcularTotal() && (
                        <p className="text-[#b91c1c] text-sm mt-1">
                          El abono no puede exceder el total ({formatCurrency(calcularTotal())})
                        </p>
                      )}
                      {formData.abono && parseCurrency(formData.abono) === 0 && formData.abono.trim() !== '' && (
                        <p className="text-[#b91c1c] text-sm mt-1">
                          Valor inválido
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium text-slate-500">
                      Saldo pendiente:{' '}
                      <span className="font-mono font-bold text-[22px] text-slate-900">
                        {formatCurrency(Math.max(0, calcularSaldo()))}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sección 6: Condiciones */}
          <div className={cardClass}>
            {seccionHeader(
              '6',
              'Condiciones del servicio',
              <div className="relative" ref={condicionesMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowCondicionesMenu(!showCondicionesMenu)}
                  className="p-2 hover:bg-control rounded-full transition-colors duration-150"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {showCondicionesMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg shadow-menu z-30">
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => handleEditCondiciones('orden')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700"
                      >
                        Editar condiciones de esta orden
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditCondiciones('cliente')}
                        disabled={!cliente}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm hover:bg-surface-muted',
                          !cliente ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'
                        )}
                      >
                        Editar condiciones de este cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditCondiciones('global')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted text-slate-700"
                      >
                        Editar condiciones de todas las órdenes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="px-4 py-[14px] space-y-4">
              <div className="p-4 bg-surface-muted rounded-field text-[11px] leading-[1.7] text-slate-500 whitespace-pre-line">
                {condicionesTexto}
              </div>

              <FirmaDigital onFirmaChange={setFirma} />

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="condiciones_aceptadas"
                  checked={formData.condiciones_aceptadas}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4"
                  required
                />
                <span className="text-sm text-slate-700">
                  El cliente acepta las condiciones del servicio y autoriza el trabajo descrito{' '}
                  <span className="text-[#b91c1c]">*</span>
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Columna derecha sticky: resumen */}
        <div className="flex flex-col gap-[14px] xl:sticky xl:top-6">
          <div className="bg-navy-900 rounded-card p-4">
            <h3 className="font-bold text-[13px] text-white mb-2">Resumen de la orden</h3>
            {resumenFila('Cliente', cliente?.nombre || '—')}
            {resumenFila('Recibido por', recibidoPor?.nombre || '—')}
            {resumenFila('Técnico', tecnicoAsignado?.nombre || '—')}
            {resumenFila('Ítems', <span className="font-mono">{items.length}</span>)}
            {resumenFila('Total', <span className="font-mono">{formatCurrency(calcularTotal())}</span>)}
            {resumenFila('Abono', <span className="font-mono">{formatCurrency(parseCurrency(formData.abono))}</span>)}
            <div className="flex justify-between items-baseline gap-3 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-sidenav">Saldo</span>
              <span className="font-mono font-bold text-xl text-[#fca5a5]">
                {formatCurrency(Math.max(0, calcularSaldo()))}
              </span>
            </div>
            <button
              type="submit"
              form="nueva-orden-form"
              disabled={loading || !formData.condiciones_aceptadas}
              title={!formData.condiciones_aceptadas ? 'Debe aceptar las condiciones del servicio' : ''}
              className={cn(
                'w-full mt-4 h-[42px] rounded-field font-bold text-[13px] text-white transition-colors duration-150',
                loading || !formData.condiciones_aceptadas
                  ? 'bg-brand-disabled cursor-not-allowed'
                  : 'bg-brand hover:bg-brand-hover'
              )}
            >
              {loading ? 'Creando orden...' : 'Crear orden'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full mt-2 h-[38px] rounded-field font-semibold text-[13px] text-sidenav hover:text-sidenav-strong hover:bg-navy-800 transition-colors duration-150"
            >
              Cancelar
            </button>
          </div>

          {/* Falta por completar */}
          <div className="bg-surface border border-line rounded-card p-4">
            <h3 className="font-bold text-[13px] text-slate-900 mb-3">Falta por completar</h3>
            <div className="space-y-2">
              {requisitos.map((req) => (
                <div key={req.label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-none',
                      req.ok ? 'bg-[#22c55e]' : 'bg-[#dc2626]'
                    )}
                  />
                  <span className={cn('text-[13px] font-medium', req.ok ? 'text-slate-400 line-through' : 'text-slate-700')}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal editar condiciones */}
      {showCondicionesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowCondicionesModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {condicionesModalTipo === 'orden' && 'Editar condiciones de esta orden'}
              {condicionesModalTipo === 'cliente' && 'Editar condiciones del cliente'}
              {condicionesModalTipo === 'global' && 'Editar condiciones globales'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {condicionesModalTipo === 'orden' && 'Estas condiciones solo aplicarán a esta orden.'}
              {condicionesModalTipo === 'cliente' && 'Estas condiciones se usarán por defecto en todas las órdenes de este cliente.'}
              {condicionesModalTipo === 'global' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas.'}
            </p>
            <textarea
              value={condicionesEditTemp}
              onChange={(e) => setCondicionesEditTemp(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-line-strong rounded-field text-sm"
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCondicionesModal(false)}
                className="flex-1 px-4 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCondiciones}
                disabled={savingCondiciones}
                className={cn(
                  'flex-1 px-4 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                  savingCondiciones ? 'bg-brand-disabled cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
                )}
              >
                {savingCondiciones ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
