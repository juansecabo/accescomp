import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';

// Función para formatear moneda sin decimales
const formatCurrency = (amount: number): string => {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted}`;
};

// Función para formatear precio con "Por definir" si es 0
const formatPrecio = (amount: number): string => {
  if (amount === 0) return 'Por definir';
  return formatCurrency(amount);
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const ordenId = params.id;

  // Cargar datos de la orden
  const { data: orden } = await supabase
    .from('ordenes')
    .select(`
      *,
      cliente:clientes(*),
      tecnico:tecnicos(*),
      recibido_por:trabajadores(*)
    `)
    .eq('id', ordenId)
    .single();

  if (!orden) {
    return new NextResponse('Orden no encontrada', { status: 404 });
  }

  // Cargar items
  const { data: items } = await supabase
    .from('items_orden')
    .select('*')
    .eq('orden_id', ordenId);

  // Cargar pagos
  const { data: pagos } = await supabase
    .from('pagos')
    .select('*')
    .eq('orden_id', ordenId);

  // Generar PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Cargar logo
  try {
    const logoPath = path.join(process.cwd(), 'referencias', 'logo-accescomp.png');
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    // Agregar logo centrado (ajustar tamaño según necesidad)
    const logoWidth = 50;
    const logoHeight = 20;
    doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
    y += logoHeight + 5;
  } catch {
    // Si no se puede cargar el logo, usar texto
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCESCOMP', pageWidth / 2, y + 10, { align: 'center' });
    y += 18;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Servicio Técnico', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Número de orden y fecha
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`ORDEN DE SERVICIO #${orden.numero_orden}`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const fecha = new Date(orden.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
  doc.text(`Fecha: ${fecha}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  if (orden.recibido_por) {
    doc.text(`Recibido por: ${orden.recibido_por.nombre}`, pageWidth / 2, y, { align: 'center' });
  }
  y += 10;

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Datos del cliente
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${orden.cliente?.nombre || 'N/A'}`, 20, y);
  y += 5;
  doc.text(`Celular: ${orden.cliente?.telefono || 'N/A'}`, 20, y);
  y += 5;
  if (orden.cliente?.email) {
    doc.text(`Email: ${orden.cliente.email}`, 20, y);
    y += 5;
  }
  if (orden.cliente?.direccion) {
    doc.text(`Dirección: ${orden.cliente.direccion}`, 20, y);
    y += 5;
  }
  y += 10;

  // Datos del equipo
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL EQUIPO', 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const equipoLines = doc.splitTextToSize(`Descripción: ${orden.equipo_descripcion || 'N/A'}`, pageWidth - 40);
  doc.text(equipoLines, 20, y);
  y += equipoLines.length * 5 + 3;

  if (orden.observaciones) {
    const obsLines = doc.splitTextToSize(`Observaciones: ${orden.observaciones}`, pageWidth - 40);
    doc.text(obsLines, 20, y);
    y += obsLines.length * 5 + 3;
  }
  y += 7;

  // Servicio
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVICIO', 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const trabajoLines = doc.splitTextToSize(`Trabajo a realizar: ${orden.trabajo_realizar || 'N/A'}`, pageWidth - 40);
  doc.text(trabajoLines, 20, y);
  y += trabajoLines.length * 5 + 3;

  if (orden.tecnico) {
    doc.text(`Técnico: ${orden.tecnico.nombre}`, 20, y);
    y += 5;
  }
  y += 10;

  // Items de facturación
  if (items && items.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE SERVICIOS', 20, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Descripción', 20, y);
    doc.text('Cant.', 130, y);
    doc.text('Precio', 150, y);
    doc.text('Subtotal', 175, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    let total = 0;
    let hayItemsSinPrecio = false;
    items.forEach((item: { descripcion: string; precio: number; cantidad: number }) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;
      if (item.precio === 0) hayItemsSinPrecio = true;

      const descLines = doc.splitTextToSize(item.descripcion, 100);
      doc.text(descLines, 20, y);
      doc.text(item.cantidad.toString(), 130, y);
      doc.text(formatPrecio(item.precio), 150, y);
      doc.text(formatPrecio(subtotal), 175, y);
      y += descLines.length * 4 + 2;
    });

    y += 3;
    doc.setFont('helvetica', 'bold');
    const totalText = hayItemsSinPrecio
      ? (total > 0 ? `TOTAL: ${formatCurrency(total)}+` : 'TOTAL: Por definir')
      : `TOTAL: ${formatCurrency(total)}`;
    doc.text(totalText, 175, y, { align: 'right' });
    y += 8;

    // Pagos
    if (pagos && pagos.length > 0) {
      const totalPagado = pagos.reduce((sum: number, p: { monto: number }) => sum + p.monto, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Pagado: ${formatCurrency(totalPagado)}`, 175, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`SALDO: ${formatCurrency(total - totalPagado)}`, 175, y, { align: 'right' });
      y += 8;
    }
  }

  // Condiciones
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const condiciones = [
    '1. El cliente autoriza la revisión y diagnóstico del equipo.',
    '2. Los trabajos se realizarán según lo acordado en esta orden.',
    '3. El tiempo de reparación puede variar según la complejidad.',
    '4. Equipos no reclamados después de 30 días serán considerados abandonados.',
    '5. No nos hacemos responsables por pérdida de datos.',
    '6. Presentar esta orden para recoger su equipo.',
    '7. Garantía de 30 días en reparaciones, no cubre mal uso.',
  ];

  doc.setFontSize(7);
  condiciones.forEach((cond) => {
    doc.text(cond, 20, y);
    y += 4;
  });

  // Firma
  if (orden.firma_cliente) {
    y += 10;
    doc.setFontSize(10);
    doc.text('Firma del cliente:', 20, y);
    y += 5;

    try {
      doc.addImage(orden.firma_cliente, 'PNG', 20, y, 50, 25);
    } catch {
      doc.text('[Firma digital registrada]', 20, y);
    }
  }

  // Generar buffer
  const pdfBuffer = doc.output('arraybuffer');

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orden-${orden.numero_orden}.pdf"`,
    },
  });
}
