export interface Tecnico {
  id: string;
  nombre: string;
  email: string;
  created_at: string;
}

export interface Trabajador {
  id: string;
  nombre: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  tipo_documento?: string;
  numero_documento?: string;
  telefono: string;
  email?: string;
  direccion?: string;
  created_at: string;
}

export interface Orden {
  id: string;
  numero_orden: number;
  cliente_id: string;
  tecnico_id: string;
  equipo_descripcion: string;
  observaciones?: string;
  motivo_visita: string;
  trabajo_realizar: string;
  estado: 'recibido' | 'en_proceso' | 'listo' | 'entregado';
  recibido_por_id?: string;
  tecnico_asignado_id?: string;
  firma_cliente?: string;
  condiciones_aceptadas: boolean;
  created_at: string;
  updated_at: string;
  // Relaciones
  cliente?: Cliente;
  tecnico?: Tecnico;
  recibido_por?: Trabajador;
  tecnico_asignado?: Trabajador;
  items?: ItemOrden[];
  pagos?: Pago[];
  archivos?: ArchivoOrden[];
}

export interface ItemOrden {
  id: string;
  orden_id: string;
  descripcion: string;
  precio: number;
  cantidad: number;
}

export interface Pago {
  id: string;
  orden_id: string;
  monto: number;
  fecha: string;
}

export interface ArchivoOrden {
  id: string;
  orden_id: string;
  tipo: 'video' | 'imagen';
  url: string;
  nombre: string;
  created_at: string;
}

export type EstadoOrden = 'recibido' | 'en_proceso' | 'listo' | 'entregado';

export const ESTADOS_ORDEN: { value: EstadoOrden; label: string; color: string }[] = [
  { value: 'recibido', label: 'Recibido', color: 'bg-blue-500' },
  { value: 'en_proceso', label: 'En Proceso', color: 'bg-yellow-500' },
  { value: 'listo', label: 'Listo', color: 'bg-green-500' },
  { value: 'entregado', label: 'Entregado', color: 'bg-gray-500' },
];
