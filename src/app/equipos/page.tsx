'use client';

import { AppShell } from '@/components/AppShell';
import Link from 'next/link';

export default function EquiposPage() {
  return (
    <AppShell
      breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Equipos' }]}
      title="Equipos"
      subtitle="Gestión de equipos registrados"
    >
      <div className="p-4 sm:p-6">
        <div className="bg-surface border border-line rounded-card p-10 flex flex-col items-center text-center">
          <div className="w-[46px] h-[46px] rounded-field bg-control flex items-center justify-center text-slate-400">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mt-4 font-bold text-[15px] text-slate-900">Equipos en construcción</h2>
          <p className="mt-2 max-w-sm text-[13px] leading-[1.6] text-slate-500">
            Aquí vivirá el registro de equipos de los clientes. Mientras tanto, la información de cada
            equipo se guarda dentro de su orden.
          </p>
          <Link
            href="/ordenes"
            className="mt-5 px-4 py-[9px] rounded-field border border-line-strong bg-surface text-slate-600 font-semibold text-[13px] hover:border-slate-300 transition-colors duration-150"
          >
            Ir a Órdenes
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
