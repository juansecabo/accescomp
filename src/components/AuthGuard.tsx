'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // No verificar en la página de login
    if (pathname === '/login') {
      setIsAuthenticated(true);
      return;
    }

    const auth = localStorage.getItem('accescomp_auth');
    const authTime = localStorage.getItem('accescomp_auth_time');

    if (auth === 'true' && authTime) {
      // Verificar que la sesión no haya expirado (24 horas)
      const elapsed = Date.now() - parseInt(authTime);
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas

      if (elapsed < maxAge) {
        setIsAuthenticated(true);
      } else {
        // Sesión expirada
        localStorage.removeItem('accescomp_auth');
        localStorage.removeItem('accescomp_auth_time');
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [pathname, router]);

  // Mostrar loading mientras verifica
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth() {
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('accescomp_auth');
    localStorage.removeItem('accescomp_auth_time');
    router.push('/login');
  };

  const isAuthenticated = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('accescomp_auth') === 'true';
  };

  return { logout, isAuthenticated };
}
