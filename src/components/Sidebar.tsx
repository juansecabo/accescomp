'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio' },
  { href: '/ordenes', label: 'Órdenes' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/estadisticas', label: 'Estadísticas' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/equipos', label: 'Equipos' },
];

interface SidebarProps {
  onNavigate?: () => void;
  onChangePassword: () => void;
  onInstallApp: () => void;
  isInstalled: boolean;
  onLogout: () => void;
}

export function Sidebar({ onNavigate, onChangePassword, onInstallApp, isInstalled, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="w-[236px] flex-none bg-navy-900 flex flex-col p-[14px] pt-5 pb-5 gap-6 h-full">
      {/* Logo */}
      <div className="px-2">
        <Link href="/" onClick={onNavigate}>
          <Image
            src="/logo-accescomp.webp"
            alt="Accescomp"
            width={140}
            height={34}
            className="h-[34px] w-auto object-contain brightness-0 invert"
            priority
          />
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col gap-[2px]">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'px-3 py-[10px] rounded-field text-sm font-semibold transition-colors duration-150',
              isActive(item.href)
                ? 'bg-brand text-white'
                : 'text-sidenav hover:text-sidenav-strong hover:bg-navy-800'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Acciones inferiores */}
      <div className="mt-auto flex flex-col gap-2">
        {!isInstalled && (
          <button
            onClick={onInstallApp}
            className="flex items-center gap-2 px-3 py-[10px] rounded-field border border-[#22c55e] text-[#86efac] text-[13px] font-semibold text-left transition-colors duration-150 hover:bg-navy-800"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar App
          </button>
        )}
        <button
          onClick={onChangePassword}
          className="px-3 py-[10px] rounded-field text-sidenav text-[13px] font-medium text-left transition-colors duration-150 hover:text-sidenav-strong hover:bg-navy-800"
        >
          Cambiar contraseña
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-[10px] rounded-field bg-navy-800 text-sidenav-strong text-[13px] font-semibold text-left transition-colors duration-150 hover:bg-navy-700"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M9 4H5v16h4" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
