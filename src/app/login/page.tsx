'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
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

      if (data.password_hash === password) {
        localStorage.setItem('accescomp_auth', 'true');
        localStorage.setItem('accescomp_auth_time', Date.now().toString());
        router.push('/');
        router.refresh();
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error al verificar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const formulario = (
    <form onSubmit={handleLogin} className="flex flex-col gap-2">
      {error && (
        <div className="mb-4 p-4 bg-[#fef2f2] border-l-[3px] border-[#dc2626] text-[#b91c1c] text-sm rounded-r-lg animate-shake">
          {error}
        </div>
      )}

      <label
        htmlFor="password"
        className="text-[11px] font-semibold uppercase tracking-[.09em] text-slate-400"
      >
        Contraseña
      </label>
      <div className="flex items-center gap-[10px] h-12 px-[14px] border border-line-strong rounded-[10px] bg-white focus-within:border-brand transition-colors duration-150">
        {/* Candado */}
        <svg width="16" height="16" viewBox="0 0 20 20" fill="#94a3b8" className="flex-none">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Ingresa la contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="flex-1 min-w-0 border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus-visible:!outline-none"
        />
        {/* Mostrar/ocultar */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="flex-none text-slate-400 hover:text-slate-600 transition-colors duration-150"
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`mt-4 h-12 rounded-[10px] font-bold text-[15px] text-white transition-colors duration-150 ${
          loading ? 'bg-brand-disabled cursor-not-allowed' : 'bg-brand hover:bg-brand-hover'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Verificando...
          </span>
        ) : (
          'Ingresar'
        )}
      </button>
    </form>
  );

  const pieCailico = (
    <div className="mt-10 flex flex-col items-center text-center">
      <p className="text-xs text-slate-500 -mb-3">Desarrollado por:</p>
      <div className="relative w-24 h-24">
        <Image src="/logo-cailico.webp" alt="Cailico" fill className="object-contain" />
      </div>
      <a
        href="https://cailico.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-brand hover:text-brand-hover hover:underline transition-colors -mt-4 relative z-10"
      >
        cailico.com
      </a>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-navy-900">
      {/* Columna izquierda (solo desktop) */}
      <div className="hidden lg:block w-[44%] relative overflow-hidden">
        <Image
          src="/fondo-elementos.webp"
          alt="Fondo"
          fill
          className="object-cover opacity-35"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(13,27,42,.55)] to-[rgba(13,27,42,.95)]" />
        <div className="absolute inset-0 p-10 flex flex-col justify-between">
          <Image
            src="/logo-accescomp.webp"
            alt="Accescomp"
            width={140}
            height={34}
            className="h-[34px] w-auto object-contain brightness-0 invert"
            priority
          />
          <div>
            <div className="font-bold text-[30px] leading-[1.2] text-white max-w-[300px]">
              Gestión de órdenes de servicio técnico
            </div>
            <div className="mt-3 font-medium text-sm leading-[1.6] text-sidenav max-w-[300px]">
              Órdenes, clientes, pagos y firmas en un solo lugar.
            </div>
          </div>
        </div>
      </div>

      {/* Columna derecha (desktop) */}
      <div className="hidden lg:flex flex-1 bg-white flex-col justify-center p-16">
        <div className="max-w-[380px] w-full">
          <h1 className="font-bold text-2xl leading-tight text-slate-900">Ingresar</h1>
          <p className="mt-2 font-medium text-sm text-slate-500">
            Escribe la contraseña del taller para continuar.
          </p>
          <div className="mt-7">{formulario}</div>
          {pieCailico}
        </div>
      </div>

      {/* Versión móvil: imagen de fondo + tarjeta blanca */}
      <div className="lg:hidden flex-1 relative flex items-center justify-center p-6">
        <div className="fixed inset-0">
          <Image src="/fondo-elementos.webp" alt="Fondo" fill className="object-cover opacity-35" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(13,27,42,.55)] to-[rgba(13,27,42,.95)]" />
        </div>
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-accescomp.webp"
              alt="Accescomp"
              width={180}
              height={44}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="font-bold text-xl text-slate-900">Ingresar</h1>
          <p className="mt-1 mb-6 font-medium text-sm text-slate-500">
            Escribe la contraseña del taller para continuar.
          </p>
          {formulario}
          {pieCailico}
        </div>
      </div>
    </div>
  );
}
