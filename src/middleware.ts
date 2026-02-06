import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // Middleware simplificado - la autenticación se maneja del lado del cliente
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
