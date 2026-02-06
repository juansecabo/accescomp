'use client';

import { Navbar } from '@/components/Navbar';

export default function ServiciosPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-gray-600">Catálogo de servicios disponibles</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">Página de servicios en construcción...</p>
        </div>
      </main>
    </div>
  );
}
