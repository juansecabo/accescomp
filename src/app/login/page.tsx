'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">
      {/* Fondo para móvil - imagen de fondo */}
      <div className="lg:hidden fixed inset-0 z-0">
        <Image
          src="/fondo-elementos.png"
          alt="Fondo"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/50 via-blue-500/40 to-cyan-400/50" />
      </div>

      {/* Lado izquierdo - Imagen de fondo (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Imagen de fondo clara */}
        <div className="absolute inset-0">
          <Image
            src="/fondo-elementos.png"
            alt="Fondo"
            fill
            className="object-cover"
            priority
          />
        </div>
        {/* Overlay suave con transparencia */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 via-blue-500/30 to-cyan-400/40" />
        {/* Decoración - círculos animados */}
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/10 rounded-full animate-pulse-slow" />
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/10 rounded-full animate-pulse-slow delay-1000" />
      </div>

      {/* Lado derecho - Formulario (desktop) / Card centrada (móvil) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:bg-gradient-to-br lg:from-gray-50 lg:to-gray-100 min-h-screen lg:min-h-0 relative z-10">
        <div className="w-full max-w-md animate-fade-in">
          {/* Card blanca para móvil, transparente en desktop */}
          <div className="bg-white lg:bg-transparent rounded-2xl shadow-xl lg:shadow-none p-8 lg:p-0">
            {/* Logo + GESTIÓN */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 transition-transform duration-300 hover:scale-105">
                <Image
                  src="/logo-accescomp.png"
                  alt="Accescomp"
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-wider bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent italic">
                Gestión
              </span>
            </div>

            {/* Card del formulario (solo visible en desktop) */}
            <div className="lg:bg-white lg:rounded-2xl lg:shadow-xl lg:p-8 transition-all duration-300 lg:hover:shadow-2xl">
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Error message */}
                {error && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-700 text-sm animate-shake">
                    {error}
                  </div>
                )}

                {/* Input de contraseña */}
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className={`block text-sm font-medium transition-colors duration-200 ${
                      focused ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingresa la contraseña"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      required
                      autoFocus
                      className={`w-full px-4 py-3 pr-20 border-2 rounded-xl transition-all duration-300 outline-none ${
                        focused
                          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    />
                    {/* Iconos de candado y ojo */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {/* Botón para mostrar/ocultar contraseña */}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`p-1 rounded-full transition-colors duration-200 hover:bg-gray-100 ${
                          focused ? 'text-blue-500' : 'text-gray-400'
                        }`}
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
                      {/* Icono de candado */}
                      <div className={`transition-colors duration-200 ${
                        focused ? 'text-blue-500' : 'text-gray-400'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón de submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 transform ${
                    loading
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0'
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
            </div>
          </div>

          {/* Desarrollado por Cailico - fuera del card blanco */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 -mb-3">Desarrollado por:</p>
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24">
                <Image
                  src="/logo-cailico.png"
                  alt="Cailico"
                  fill
                  className="object-contain"
                />
              </div>
              <a
                href="https://cailico.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors -mt-4 relative z-10"
              >
                cailico.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Versión móvil - Banner superior con gradiente */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 z-20" />
    </div>
  );
}
