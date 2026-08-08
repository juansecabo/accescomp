'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthGuard';
import { createClient } from '@/lib/supabase/client';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppShellProps {
  breadcrumb?: BreadcrumbItem[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  fab?: { href: string; label: string };
  children: React.ReactNode;
}

const MOBILE_NAV = [
  {
    href: '/',
    label: 'Inicio',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/ordenes',
    label: 'Órdenes',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/estadisticas',
    label: 'Estadísticas',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export function AppShell({ breadcrumb, title, subtitle, count, actions, toolbar, fab, children }: AppShellProps) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const supabase = createClient();
  const { canInstall, isIOS, isInstalled, installApp } = useInstallPrompt();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInstallApp = () => {
    if (canInstall) {
      installApp();
    } else {
      setShowInstallModal(true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos los campos son obligatorios');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    if (newPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setLoading(true);

    try {
      // Verificar contraseña actual
      const { data, error: dbError } = await supabase
        .from('configuracion')
        .select('password_hash')
        .eq('id', 1)
        .single();

      if (dbError) {
        setError('Error al conectar con el servidor');
        setLoading(false);
        return;
      }

      if (data.password_hash !== currentPassword) {
        setError('La contraseña actual es incorrecta');
        setLoading(false);
        return;
      }

      // Actualizar contraseña
      const { error: updateError } = await supabase
        .from('configuracion')
        .update({ password_hash: newPassword })
        .eq('id', 1);

      if (updateError) {
        setError('Error al actualizar la contraseña');
        setLoading(false);
        return;
      }

      setSuccess('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccess('');
      }, 2000);

    } catch {
      setError('Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const sidebarProps = {
    onChangePassword: () => {
      setDrawerOpen(false);
      setShowPasswordModal(true);
    },
    onInstallApp: () => {
      setDrawerOpen(false);
      handleInstallApp();
    },
    isInstalled,
    onLogout: logout,
  };

  const eyeIcon = (visible: boolean) =>
    visible ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    );

  return (
    <div className="min-h-screen bg-page flex">
      {/* Sidebar desktop */}
      <div className="hidden lg:block sticky top-0 h-screen flex-none">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Drawer móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-in">
            <Sidebar {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Columna de contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior móvil */}
        <div className="lg:hidden bg-navy-900 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
          <Link href="/">
            <Image
              src="/logo-accescomp.webp"
              alt="Accescomp"
              width={120}
              height={28}
              className="h-7 w-auto object-contain brightness-0 invert"
              priority
            />
          </Link>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -mr-2 text-sidenav-strong"
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Cabecera de página */}
        <header className="bg-surface border-b border-line px-4 sm:px-6 py-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="flex items-center gap-[6px] text-[11px] font-medium text-slate-400">
                {breadcrumb.map((item, index) => (
                  <span key={index} className="flex items-center gap-[6px]">
                    {index > 0 && <span>/</span>}
                    {item.href ? (
                      <Link href={item.href} className="hover:text-brand transition-colors duration-150">
                        {item.label}
                      </Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className={cn('font-bold text-[17px] leading-tight text-slate-900 truncate', breadcrumb?.length && 'mt-1')}>
              {title}
              {count && <span className="font-medium text-[13px] text-slate-400"> · {count}</span>}
            </h1>
            {subtitle && <div className="mt-[3px] text-xs font-medium text-slate-400">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-[10px] flex-none">{actions}</div>}
        </header>

        {/* Toolbar opcional (Órdenes / Clientes) */}
        {toolbar}

        {/* Contenido */}
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      </div>

      {/* Barra de navegación inferior móvil */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-line flex">
        {MOBILE_NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-[3px] py-2 min-h-[44px] text-[10px] font-semibold transition-colors duration-150',
                active ? 'text-brand' : 'text-slate-400'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* FAB móvil */}
      {fab && (
        <Link
          href={fab.href}
          aria-label={fab.label}
          className="lg:hidden fixed bottom-20 right-4 z-30 w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shadow-menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      )}

      {/* Modal de instrucciones de instalación */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={() => setShowInstallModal(false)} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Instalar Accescomp</h2>
            {isIOS ? (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">1.</span>
                  <span>Abre esta página en <strong>Safari</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">2.</span>
                  <span>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">3.</span>
                  <span>Selecciona <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">1.</span>
                  <span>Abre el menú de Chrome (los 3 puntos arriba a la derecha)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">2.</span>
                  <span>Selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">3.</span>
                  <span>Confirma tocando <strong>&quot;Instalar&quot;</strong></span>
                </li>
              </ol>
            )}
            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full mt-5 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-semibold rounded-field transition-colors duration-150"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de cambiar contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[rgba(13,27,42,.55)]" onClick={closePasswordModal} />
          <div className="relative bg-surface rounded-modal shadow-modal w-full max-w-md mx-4 p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Cambiar contraseña</h2>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#fef2f2] border-l-[3px] border-[#dc2626] text-[#b91c1c] text-sm rounded-r-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-[#ecfdf5] border-l-[3px] border-[#22c55e] text-[#047857] text-sm rounded-r-lg">
                  {success}
                </div>
              )}

              {[
                {
                  label: 'Contraseña actual',
                  value: currentPassword,
                  setValue: setCurrentPassword,
                  visible: showCurrentPassword,
                  setVisible: setShowCurrentPassword,
                  placeholder: 'Ingresa tu contraseña actual',
                },
                {
                  label: 'Nueva contraseña',
                  value: newPassword,
                  setValue: setNewPassword,
                  visible: showNewPassword,
                  setVisible: setShowNewPassword,
                  placeholder: 'Ingresa la nueva contraseña',
                },
                {
                  label: 'Confirmar nueva contraseña',
                  value: confirmPassword,
                  setValue: setConfirmPassword,
                  visible: showConfirmPassword,
                  setVisible: setShowConfirmPassword,
                  placeholder: 'Repite la nueva contraseña',
                },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-[10px] font-semibold uppercase tracking-[.09em] text-slate-400 mb-[6px]">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type={field.visible ? 'text' : 'password'}
                      value={field.value}
                      onChange={(e) => field.setValue(e.target.value)}
                      className="w-full px-4 py-2 pr-10 h-[42px] border border-line-strong rounded-field text-sm text-slate-900"
                      placeholder={field.placeholder}
                    />
                    <button
                      type="button"
                      onClick={() => field.setVisible(!field.visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {eyeIcon(field.visible)}
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="flex-1 px-4 py-2 h-[42px] bg-surface border border-line-strong hover:border-slate-300 text-slate-600 font-semibold text-[13px] rounded-field transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'flex-1 px-4 py-2 h-[42px] font-bold text-[13px] text-white rounded-field transition-colors duration-150',
                    loading ? 'bg-brand-disabled cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
                  )}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
