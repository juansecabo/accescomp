'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { normalizeText } from '@/lib/utils';
import type { Cliente } from '@/types';

const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'NIT', label: 'NIT' },
  { value: 'OTRO', label: 'Otro' },
];

interface BuscadorClientesProps {
  onClienteSelect: (cliente: Cliente | null) => void;
  clienteSeleccionado: Cliente | null;
}

export function BuscadorClientes({ onClienteSelect, clienteSeleccionado }: BuscadorClientesProps) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    email: '',
    direccion: ''
  });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (busqueda.length >= 2) {
      buscarClientes();
    } else {
      setResultados([]);
    }
  }, [busqueda]);

  const buscarClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .limit(100);

    if (data) {
      const busquedaNormalizada = normalizeText(busqueda);
      const filtrados = data.filter(cliente =>
        normalizeText(cliente.nombre || '').includes(busquedaNormalizada) ||
        (cliente.telefono || '').includes(busqueda) ||
        (cliente.numero_documento || '').toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 5);
      setResultados(filtrados);
    } else {
      setResultados([]);
    }
    setMostrarResultados(true);
  };

  const handleSelectCliente = (cliente: Cliente) => {
    onClienteSelect(cliente);
    setBusqueda('');
    setMostrarResultados(false);
    setModoNuevo(false);
  };

  const handleCrearCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.telefono) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: nuevoCliente.nombre,
        tipo_documento: nuevoCliente.tipo_documento,
        numero_documento: nuevoCliente.numero_documento || null,
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email || null,
        direccion: nuevoCliente.direccion || null,
      })
      .select()
      .single();

    if (!error && data) {
      handleSelectCliente(data);
      setNuevoCliente({
        nombre: '',
        tipo_documento: 'CC',
        numero_documento: '',
        telefono: '',
        email: '',
        direccion: ''
      });
    }
    setLoading(false);
  };

  const handleCambiarCliente = () => {
    onClienteSelect(null);
    setModoNuevo(false);
  };

  const getTipoDocumentoLabel = (tipo: string) => {
    return TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;
  };

  if (clienteSeleccionado) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-gray-900">{clienteSeleccionado.nombre}</p>
            {clienteSeleccionado.numero_documento && (
              <p className="text-sm text-gray-600">
                {getTipoDocumentoLabel(clienteSeleccionado.tipo_documento || 'CC')}: {clienteSeleccionado.numero_documento}
              </p>
            )}
            <p className="text-sm text-gray-600">{clienteSeleccionado.telefono}</p>
            {clienteSeleccionado.email && (
              <p className="text-sm text-gray-600">{clienteSeleccionado.email}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCambiarCliente}>
            Cambiar
          </Button>
        </div>
      </div>
    );
  }

  if (modoNuevo) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Nuevo Cliente</h3>
            <Button variant="ghost" size="sm" onClick={() => setModoNuevo(false)}>
              Cancelar
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              value={nuevoCliente.nombre}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
              placeholder="Nombre completo"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de documento
              </label>
              <select
                value={nuevoCliente.tipo_documento}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, tipo_documento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Número de documento"
              value={nuevoCliente.numero_documento}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, numero_documento: e.target.value })}
              placeholder="Número de identificación"
            />
            <Input
              label="Celular *"
              value={nuevoCliente.telefono}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
              placeholder="Número de celular"
            />
            <Input
              label="Email"
              type="email"
              value={nuevoCliente.email}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
              placeholder="correo@ejemplo.com"
            />
            <Input
              label="Dirección"
              value={nuevoCliente.direccion}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
              placeholder="Dirección"
            />
          </div>
          <Button onClick={handleCrearCliente} loading={loading} disabled={!nuevoCliente.nombre || !nuevoCliente.telefono}>
            Crear Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar cliente por nombre, celular o documento..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => busqueda.length >= 2 && setMostrarResultados(true)}
          />
        </div>
        <Button variant="secondary" onClick={() => setModoNuevo(true)}>
          Nuevo
        </Button>
      </div>

      {mostrarResultados && resultados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {resultados.map((cliente) => (
            <button
              key={cliente.id}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
              onClick={() => handleSelectCliente(cliente)}
            >
              <p className="font-medium">{cliente.nombre}</p>
              <p className="text-sm text-gray-600">
                {cliente.numero_documento && `${cliente.tipo_documento}: ${cliente.numero_documento} • `}
                {cliente.telefono}
              </p>
            </button>
          ))}
        </div>
      )}

      {mostrarResultados && busqueda.length >= 2 && resultados.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <p className="text-gray-500 text-center mb-2">No se encontraron clientes</p>
          <Button variant="secondary" size="sm" className="w-full" onClick={() => {
            setModoNuevo(true);
            setNuevoCliente({ ...nuevoCliente, nombre: busqueda });
            setMostrarResultados(false);
          }}>
            Crear nuevo cliente
          </Button>
        </div>
      )}
    </div>
  );
}
