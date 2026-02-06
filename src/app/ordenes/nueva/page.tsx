'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { BuscadorClientes } from '@/components/BuscadorClientes';
import { ItemsFacturacion } from '@/components/ItemsFacturacion';
import { FirmaDigital } from '@/components/FirmaDigital';
import { GrabadorVideo, subirArchivosTemporales } from '@/components/GrabadorVideo';
import type { Cliente, ItemOrden, Tecnico } from '@/types';
import { Breadcrumb } from '@/components/Breadcrumb';
import { parseCurrency, formatCurrency } from '@/lib/utils';

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
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
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
    tecnico_id: '',
    condiciones_aceptadas: false,
    abono: '',
  });

  useEffect(() => {
    loadTecnicos();
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

  const loadTecnicos = async () => {
    const { data } = await supabase.from('tecnicos').select('*');
    setTecnicos(data || []);
    if (data && data.length > 0) {
      setFormData(prev => ({ ...prev, tecnico_id: data[0].id }));
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
          tecnico_id: formData.tecnico_id || null,
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <Breadcrumb items={[
        { label: 'Inicio', href: '/' },
        { label: 'Órdenes', href: '/ordenes' },
        { label: 'Nueva Orden' }
      ]} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Servicio</h1>
          <p className="text-gray-600">Complete los datos para registrar una nueva orden</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sección 1: Cliente */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">1. Cliente</h2>
            </CardHeader>
            <CardContent>
              <BuscadorClientes
                onClienteSelect={setCliente}
                clienteSeleccionado={cliente}
              />
            </CardContent>
          </Card>

          {/* Sección 2: Equipo */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">2. Equipo</h2>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fotos / Videos del equipo
                </label>
                <GrabadorVideo
                  onArchivosTemporales={setArchivosTemporales}
                  archivosTemporales={archivosTemporales}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sección 3: Servicio */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">3. Servicio</h2>
            </CardHeader>
            <CardContent className="space-y-4">
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
              {tecnicos.length > 0 && (
                <Select
                  id="tecnico_id"
                  name="tecnico_id"
                  label="Técnico asignado"
                  value={formData.tecnico_id}
                  onChange={handleChange}
                  options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))}
                />
              )}
            </CardContent>
          </Card>

          {/* Sección 4: Facturación */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">4. Facturación</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <ItemsFacturacion
                items={items}
                onItemsChange={setItems}
                sugerenciaDescripcion={!facturacionModificada ? formData.trabajo_realizar : undefined}
                onDescripcionModificada={() => setFacturacionModificada(true)}
              />

              {items.length > 0 && (
                <div className="border-t pt-4 space-y-2">
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
                        <p className="text-red-500 text-sm mt-1">
                          El abono no puede exceder el total ({formatCurrency(calcularTotal())})
                        </p>
                      )}
                      {formData.abono && parseCurrency(formData.abono) === 0 && formData.abono.trim() !== '' && (
                        <p className="text-red-500 text-sm mt-1">
                          Valor inválido
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg">
                      Saldo pendiente:{' '}
                      <span className="font-bold text-xl">
                        {formatCurrency(Math.max(0, calcularSaldo()))}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sección 5: Contrato */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">5. Condiciones del Servicio</h2>
                <div className="relative" ref={condicionesMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowCondicionesMenu(!showCondicionesMenu)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {showCondicionesMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => handleEditCondiciones('orden')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                        >
                          Editar condiciones de esta orden
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCondiciones('cliente')}
                          disabled={!cliente}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${!cliente ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'}`}
                        >
                          Editar condiciones de este cliente
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCondiciones('global')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                        >
                          Editar condiciones de todas las órdenes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-line">
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
                <span className="text-sm text-gray-700">
                  El cliente acepta las condiciones del servicio y autoriza el trabajo descrito <span className="text-red-500">*</span>
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Modal editar condiciones */}
          {showCondicionesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowCondicionesModal(false)} />
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {condicionesModalTipo === 'orden' && 'Editar condiciones de esta orden'}
                  {condicionesModalTipo === 'cliente' && 'Editar condiciones del cliente'}
                  {condicionesModalTipo === 'global' && 'Editar condiciones globales'}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {condicionesModalTipo === 'orden' && 'Estas condiciones solo aplicarán a esta orden.'}
                  {condicionesModalTipo === 'cliente' && 'Estas condiciones se usarán por defecto en todas las órdenes de este cliente.'}
                  {condicionesModalTipo === 'global' && 'Estas condiciones se usarán por defecto en todas las órdenes nuevas.'}
                </p>
                <textarea
                  value={condicionesEditTemp}
                  onChange={(e) => setCondicionesEditTemp(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="secondary" onClick={() => setShowCondicionesModal(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleSaveCondiciones} loading={savingCondiciones} className="flex-1">
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!formData.condiciones_aceptadas}
              title={!formData.condiciones_aceptadas ? 'Debe aceptar las condiciones del servicio' : ''}
            >
              Crear Orden
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
