// Asistente de Medicamentos: ventana de chat de FotoFarma.
//
// La conversación vive solo en memoria mientras la ventana está abierta: no se guarda
// en el dispositivo ni en ningún servidor. La llave de la IA nunca pasa por aquí; se
// habla con el intermediario (Cloudflare Worker), que es quien la tiene.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Send, ShieldAlert, Loader2, Sparkle } from 'lucide-react';
import { CHAT_URL, CHAT_DISPONIBLE, LIMITES_CHAT, AVISO_CHAT, ERRORES_CHAT, sugerenciasChat } from './chatConfig';

export interface MedicamentoChat { nombre: string; dosis?: string; hora?: string }
interface Mensaje { rol: 'yo' | 'bot'; texto: string }

const CLAVE_LIMITE = 'fotofarma:chat-usos';

// Tope local de preguntas por hora, para que nadie se coma la cuota sin querer.
const dentroDelLimite = (): boolean => {
  try {
    const ahora = Date.now();
    const previas: number[] = JSON.parse(localStorage.getItem(CLAVE_LIMITE) || '[]')
      .filter((t: number) => ahora - t < 3600_000);
    if (previas.length >= LIMITES_CHAT.preguntasPorHora) return false;
    previas.push(ahora);
    localStorage.setItem(CLAVE_LIMITE, JSON.stringify(previas));
    return true;
  } catch {
    return true; // sin almacenamiento, no bloqueamos
  }
};

export const Chat = ({ medicamentos, onClose }: { medicamentos: MedicamentoChat[]; onClose: () => void; key?: string }) => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const entrada = useRef<HTMLTextAreaElement>(null);
  const finDeLista = useRef<HTMLDivElement>(null);
  const cancelar = useRef<AbortController | null>(null);

  const nombres = medicamentos.map(m => m.nombre).filter(Boolean);

  useEffect(() => {
    entrada.current?.focus();
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const conexion = () => setEnLinea(navigator.onLine);
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('online', conexion);
    window.addEventListener('offline', conexion);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('online', conexion);
      window.removeEventListener('offline', conexion);
      cancelar.current?.abort();
    };
  }, [onClose]);

  useEffect(() => {
    finDeLista.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, enviando]);

  const preguntar = async (pregunta: string) => {
    const limpio = pregunta.trim().slice(0, LIMITES_CHAT.caracteresPorMensaje);
    if (!limpio || enviando) return;

    if (!CHAT_DISPONIBLE) { setError(ERRORES_CHAT.sin_llave); return; }
    if (!navigator.onLine) { setError(ERRORES_CHAT.sin_conexion); return; }
    if (!dentroDelLimite()) { setError(ERRORES_CHAT.demasiadas); return; }

    setError(null);
    setTexto('');
    const historial = [...mensajes, { rol: 'yo', texto: limpio } as Mensaje];
    setMensajes([...historial, { rol: 'bot', texto: '' }]);
    setEnviando(true);

    cancelar.current?.abort();
    const control = new AbortController();
    cancelar.current = control;

    try {
      const respuesta = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: control.signal,
        body: JSON.stringify({
          mensajes: historial.slice(-LIMITES_CHAT.mensajesDeHistorial),
          medicamentos: medicamentos.slice(0, 20),
        }),
      });

      if (!respuesta.ok || !respuesta.body) {
        let clave = 'general';
        try { clave = (await respuesta.json())?.error || 'general'; } catch { /* sin cuerpo */ }
        setMensajes(historial);
        setError(ERRORES_CHAT[clave] || ERRORES_CHAT.general);
        return;
      }

      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let acumulado = '';
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        acumulado += decodificador.decode(value, { stream: true });
        setMensajes([...historial, { rol: 'bot', texto: acumulado }]);
      }
      if (!acumulado.trim()) {
        setMensajes(historial);
        setError(ERRORES_CHAT.general);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setMensajes(historial);
      setError(navigator.onLine ? ERRORES_CHAT.general : ERRORES_CHAT.sin_conexion);
    } finally {
      setEnviando(false);
    }
  };

  const restantes = LIMITES_CHAT.caracteresPorMensaje - texto.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Asistente de medicamentos"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="flex h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] bg-canvas shadow-2xl md:h-[80dvh] md:rounded-[32px]"
      >
        {/* Encabezado */}
        <div className="flex items-center gap-3 border-b border-line bg-card px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lav-soft text-lav">
            <Sparkle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Asistente de medicamentos</p>
            <p className="truncate text-sm text-muted">Dudas de cómo tomarlos, qué contienen y sus efectos</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar el asistente" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Aviso permanente */}
        <p className="flex items-start gap-2 bg-sun-soft px-5 py-2.5 text-[13px] leading-snug text-ink">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-strong" />
          <span>{AVISO_CHAT}</span>
        </p>

        {!CHAT_DISPONIBLE && (
          <p className="flex items-start gap-2 border-b border-line bg-lav-soft px-5 py-3 text-[13px] leading-snug text-ink">
            <Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-lav" />
            <span>
              <b>Así se va a ver el asistente.</b> Todavía no está conectado, así que no puede
              responder: falta publicar el intermediario que guarda la llave.
            </span>
          </p>
        )}

        {/* Conversación */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {mensajes.length === 0 && (
            <div className="text-center">
              <p className="text-base font-semibold text-ink">¿Qué quieres saber de tus medicinas?</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                Pregúntame cómo tomarlas, qué contienen, sus efectos secundarios o qué hacer si se te pasó una toma.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {sugerenciasChat(nombres).map(s => (
                  <button
                    key={s}
                    onClick={() => preguntar(s)}
                    className="rounded-2xl bg-card px-4 py-3 text-left text-sm font-medium text-ink shadow-soft hover:bg-brand-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="space-y-3" aria-live="polite" aria-atomic="false">
            {mensajes.map((m, i) => (
              <li key={i} className={m.rol === 'yo' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-3 text-[15px] leading-relaxed ${
                    m.rol === 'yo' ? 'bg-brand text-white' : 'bg-card text-ink shadow-soft'
                  }`}
                >
                  <span className="sr-only">{m.rol === 'yo' ? 'Tú: ' : 'Asistente: '}</span>
                  {m.texto || (enviando ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null)}
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-4 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-ink">{error}</p>
          )}
          {!enLinea && !error && (
            <p role="status" className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">{ERRORES_CHAT.sin_conexion}</p>
          )}

          <div ref={finDeLista} />
        </div>

        {/* Escribir */}
        <form
          onSubmit={(e) => { e.preventDefault(); preguntar(texto); }}
          className="border-t border-line bg-card px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="pregunta-chat">Escribe tu pregunta sobre un medicamento</label>
            <textarea
              id="pregunta-chat"
              ref={entrada}
              rows={1}
              value={texto}
              maxLength={LIMITES_CHAT.caracteresPorMensaje}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(texto); } }}
              disabled={!CHAT_DISPONIBLE}
              placeholder={CHAT_DISPONIBLE ? 'Pregunta sobre un medicamento…' : 'Todavía no está conectado'}
              className="max-h-28 min-h-[46px] flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:bg-card"
            />
            <button
              type="submit"
              disabled={!texto.trim() || enviando || !CHAT_DISPONIBLE}
              aria-label="Enviar pregunta"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-brand text-white hover:bg-brand-strong disabled:opacity-40"
            >
              {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-faint">
            {CHAT_DISPONIBLE
              ? <>Esta conversación no se guarda{restantes < 100 ? ` · te quedan ${restantes} caracteres` : ''}</>
              : <>Vista previa · sin conectar</>}
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
};
