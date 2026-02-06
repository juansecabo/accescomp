'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/Button';

interface FirmaDigitalProps {
  onFirmaChange: (firma: string | null) => void;
  firmaInicial?: string | null;
}

export function FirmaDigital({ onFirmaChange, firmaInicial }: FirmaDigitalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [firmada, setFirmada] = useState(!!firmaInicial);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setFirmada(false);
    onFirmaChange(null);
  };

  const handleEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      setFirmada(true);
      onFirmaChange(dataUrl);
    }
  };

  if (firmaInicial) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Firma del cliente</p>
        <div className="border border-gray-300 rounded-lg p-2 bg-white">
          <img src={firmaInicial} alt="Firma del cliente" className="max-h-32 mx-auto" />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onFirmaChange(null)}>
          Nueva firma
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Firma del cliente</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: 'w-full h-40',
            style: { width: '100%', height: '160px' },
          }}
          onEnd={handleEnd}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handleClear}>
          Limpiar
        </Button>
        {firmada && (
          <span className="text-sm text-green-600 flex items-center">
            ✓ Firmado
          </span>
        )}
      </div>
    </div>
  );
}
