'use client';

import { AppShell } from '@/components/AppShell';
import Link from 'next/link';

export default function ServiciosPage() {
  return (
    <AppShell
      breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Servicios' }]}
      title="Servicios"
      subtitle="Catálogo de servicios disponibles"
    >
      <div className="p-4 sm:p-6">
        <div className="bg-surface border border-line rounded-card p-10 flex flex-col items-center text-center">
          <div className="w-[46px] h-[46px] rounded-field bg-control flex items-center justify-center text-slate-400">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="mt-4 font-bold text-[15px] text-slate-900">Servicios en construcción</h2>
          <p className="mt-2 max-w-sm text-[13px] leading-[1.6] text-slate-500">
            Aquí vivirá el catálogo de servicios del taller. Mientras tanto, puedes seguir gestionando
            todo desde las órdenes.
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
