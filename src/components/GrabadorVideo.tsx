'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { createClient } from '@/lib/supabase/client';

interface ArchivoTemporal {
  id: string;
  tipo: 'video' | 'imagen';
  blob: Blob;
  previewUrl: string;
  nombre: string;
}

interface GrabadorVideoProps {
  ordenId?: string;
  onArchivoSubido?: (archivo: { tipo: string; url: string; nombre: string }) => void;
  onArchivosTemporales?: (archivos: ArchivoTemporal[]) => void;
  archivosTemporales?: ArchivoTemporal[];
}

export function GrabadorVideo({ ordenId, onArchivoSubido, onArchivosTemporales, archivosTemporales = [] }: GrabadorVideoProps) {
  const [grabando, setGrabando] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivosLocales, setArchivosLocales] = useState<ArchivoTemporal[]>(archivosTemporales);
  const [modoFoto, setModoFoto] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const supabase = createClient();

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Asignar stream al video cuando cambie y el elemento exista
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setCamaraLista(true);
      };
    } else {
      setCamaraLista(false);
    }
  }, [stream]);

  useEffect(() => {
    if (onArchivosTemporales) {
      onArchivosTemporales(archivosLocales);
    }
  }, [archivosLocales, onArchivosTemporales]);

  const iniciarCamara = async (paraFoto: boolean = false) => {
    try {
      setError(null);
      setModoFoto(paraFoto);
      setCamaraLista(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: !paraFoto,
      });
      setStream(mediaStream);
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      console.error('Error al acceder a la cámara:', err);
    }
  };

  const tomarFoto = () => {
    if (!videoRef.current || !canvasRef.current || !camaraLista) {
      setError('La cámara aún no está lista. Espera un momento.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Verificar que el video tenga dimensiones válidas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Error al capturar: el video no tiene dimensiones válidas.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          const nuevoArchivo: ArchivoTemporal = {
            id: Date.now().toString(),
            tipo: 'imagen',
            blob: blob,
            previewUrl,
            nombre: `foto_${Date.now()}.jpg`,
          };
          setArchivosLocales(prev => [...prev, nuevoArchivo]);
        }
      }, 'image/jpeg', 0.9);
    }

    // Cerrar cámara
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setModoFoto(false);
  };

  const cancelarCamara = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setModoFoto(false);
    setCamaraLista(false);
  };

  const iniciarGrabacion = () => {
    if (!stream) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoBlob(blob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setGrabando(true);
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const guardarVideoLocal = () => {
    if (!videoUrl || !videoBlob) return;

    const nuevoArchivo: ArchivoTemporal = {
      id: Date.now().toString(),
      tipo: 'video',
      blob: videoBlob,
      previewUrl: videoUrl,
      nombre: `video_${Date.now()}.webm`,
    };

    setArchivosLocales(prev => [...prev, nuevoArchivo]);
    setVideoUrl(null);
    setVideoBlob(null);
  };

  const subirVideo = async () => {
    if (!videoUrl || !ordenId || !videoBlob) return;

    setSubiendo(true);
    try {
      const nombreArchivo = `${ordenId}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('archivos-ordenes')
        .upload(nombreArchivo, videoBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('archivos-ordenes')
        .getPublicUrl(nombreArchivo);

      onArchivoSubido?.({
        tipo: 'video',
        url: urlData.publicUrl,
        nombre: nombreArchivo,
      });

      setVideoUrl(null);
      setVideoBlob(null);
    } catch (err) {
      setError('Error al subir el video');
      console.error(err);
    } finally {
      setSubiendo(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const tipo = file.type.startsWith('video') ? 'video' : 'imagen';

    if (!ordenId) {
      const previewUrl = URL.createObjectURL(file);
      const nuevoArchivo: ArchivoTemporal = {
        id: Date.now().toString(),
        tipo: tipo as 'video' | 'imagen',
        blob: file,
        previewUrl,
        nombre: file.name,
      };
      setArchivosLocales(prev => [...prev, nuevoArchivo]);
      event.target.value = '';
      return;
    }

    setSubiendo(true);
    try {
      const nombreArchivo = `${ordenId}/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from('archivos-ordenes')
        .upload(nombreArchivo, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('archivos-ordenes')
        .getPublicUrl(nombreArchivo);

      onArchivoSubido?.({
        tipo,
        url: urlData.publicUrl,
        nombre: file.name,
      });
    } catch (err) {
      setError('Error al subir el archivo');
      console.error(err);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarArchivoLocal = (id: string) => {
    setArchivosLocales(prev => prev.filter(a => a.id !== id));
  };

  const reiniciar = () => {
    setVideoUrl(null);
    setVideoBlob(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {archivosLocales.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {archivosLocales.map((archivo) => (
            <div key={archivo.id} className="relative border rounded-lg overflow-hidden group">
              {archivo.tipo === 'video' ? (
                <video src={archivo.previewUrl} controls className="w-full h-32 object-cover" />
              ) : (
                <img src={archivo.previewUrl} alt={archivo.nombre} className="w-full h-32 object-cover" />
              )}
              <button
                onClick={() => eliminarArchivoLocal(archivo.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-xs text-gray-500 p-2 truncate">{archivo.nombre}</p>
            </div>
          ))}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {!stream && !videoUrl && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => iniciarCamara(true)} variant="secondary">
              Tomar Foto
            </Button>
            <Button onClick={() => iniciarCamara(false)} variant="secondary">
              Grabar Video
            </Button>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept="video/*,image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={subiendo}
              />
              <span className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 px-4 py-2 text-sm">
                {subiendo ? 'Subiendo...' : 'Subir Archivo'}
              </span>
            </label>
          </div>
        </div>
      )}

      {stream && !videoUrl && (
        <div className="space-y-4">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full max-w-md rounded-lg border border-gray-300"
            />
            {!camaraLista && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <span className="text-white">Cargando cámara...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {modoFoto ? (
              <>
                <Button onClick={tomarFoto} variant="primary" disabled={!camaraLista}>
                  {camaraLista ? 'Capturar Foto' : 'Cargando...'}
                </Button>
                <Button onClick={cancelarCamara} variant="secondary">
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                {!grabando ? (
                  <Button onClick={iniciarGrabacion} variant="primary" disabled={!camaraLista}>
                    {camaraLista ? 'Iniciar Grabación' : 'Cargando...'}
                  </Button>
                ) : (
                  <Button onClick={detenerGrabacion} variant="danger">
                    Detener Grabación
                  </Button>
                )}
                {!grabando && (
                  <Button onClick={cancelarCamara} variant="secondary">
                    Cancelar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="space-y-4">
          <video
            src={videoUrl}
            controls
            className="w-full max-w-md rounded-lg border border-gray-300"
          />
          <div className="flex gap-2">
            {ordenId ? (
              <Button onClick={subirVideo} loading={subiendo}>
                Guardar Video
              </Button>
            ) : (
              <Button onClick={guardarVideoLocal}>
                Agregar Video
              </Button>
            )}
            <Button onClick={reiniciar} variant="secondary">
              Volver a grabar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export async function subirArchivosTemporales(
  ordenId: string,
  archivos: ArchivoTemporal[],
  supabase: ReturnType<typeof createClient>
): Promise<{ tipo: string; url: string; nombre: string }[]> {
  const resultados: { tipo: string; url: string; nombre: string }[] = [];

  for (const archivo of archivos) {
    try {
      const nombreArchivo = `${ordenId}/${Date.now()}_${archivo.nombre}`;

      const { error } = await supabase.storage
        .from('archivos-ordenes')
        .upload(nombreArchivo, archivo.blob);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('archivos-ordenes')
        .getPublicUrl(nombreArchivo);

      resultados.push({
        tipo: archivo.tipo,
        url: urlData.publicUrl,
        nombre: archivo.nombre,
      });
    } catch (err) {
      console.error('Error al subir archivo:', err);
    }
  }

  return resultados;
}
