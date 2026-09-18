import React, { useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  Calendar as CalendarIcon, 
  Image as ImageIcon, 
  X, 
  Check, 
  Bell, 
  User, 
  Lock, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  Loader2,
  Trash2,
  Edit2,
  Download,
  ShieldCheck,
  AlertTriangle,
  Info,
  ShieldAlert,
  Home,
  Pill,
  Sparkle,
  Clock3,
  Settings2,
  ArrowLeft,
  History,
  CalendarDays,
  FileText,
  HelpCircle,
  Search,
  MapPin,
  LocateFixed,
  Store,
  Navigation,
  Phone
} from 'lucide-react';
import {
  auth,
  db,
  onAuthStateChanged,
  handleFirestoreError,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  getDocs,
  writeBatch
} from './localdb';

// --- Types ---
type View = 'login' | 'dashboard' | 'camera' | 'calendar' | 'preview' | 'perfil' | 'gallery' | 'receta' | 'farmacias';

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  comments?: string;
  time: string;
  date: string;
  endDate?: string;
  completed: boolean;
  uid?: string;
  prescriptionId?: string;
}

interface UserSettings {
  uid: string;
  name?: string;
  dayStartTime: string;
  acceptedTerms: boolean;
}

interface Prescription {
  id: string;
  imageUrl: string;
  scannedAt: any;
  medications: any[];
}

// --- Gemini Service ---
// Servidor Express (server.ts). En GitHub Pages no hay backend: define VITE_API_URL al compilar.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const analyzePrescription = async (base64Image: string) => {
  try {
    const response = await fetch(`${API_URL}/api/analyze-prescription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Error en el servidor" }));
      throw new Error(errorData.message || "Error al procesar la imagen");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error analizando receta:", error);
    throw error;
  }
};

const performSecurityAudit = async (newMeds: any[], historyMeds: any[]) => {
  try {
    const response = await fetch(`${API_URL}/api/security-audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newMeds, historyMeds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Error en auditoría" }));
      throw new Error(errorData.message || "Error al realizar auditoría");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error en auditoría de seguridad:", error);
    throw error;
  }
};

// --- Helpers ---
// Safari de iPhone solo expone Notification en la app instalada (iOS 16.4+); sin esta guarda la app se cae
const avisosDisponibles = () => typeof window !== 'undefined' && 'Notification' in window;
const permisoAvisos = (): NotificationPermission => (avisosDisponibles() ? Notification.permission : 'denied');

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseFrequency = (frequency: string, dayStartTime: string = '08:00'): string[] => {
  const freq = frequency.toLowerCase();
  const [startH, startM] = dayStartTime.split(':').map(Number);
  
  const formatTime = (h: number, m: number) => {
    return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // 0. Detección de Dosis Única
  if (
    freq.includes('única') || 
    freq.includes('unica') || 
    freq.includes('una sola vez') || 
    freq.includes('ahora') ||
    freq.includes('momento')
  ) {
    return [dayStartTime];
  }

  // 1. Detecciones de 24 horas / 1 vez al día
  if (
    freq.includes('24 horas') || 
    freq.includes('24h') || 
    freq.includes('una vez') || 
    freq.includes('1 vez') || 
    freq.includes('diario') || 
    freq.includes('cada día') || 
    freq.includes('cada dia')
  ) {
    return [dayStartTime];
  }

  // 2. Detecciones de 12 horas / 2 veces al día
  if (
    freq.includes('12 horas') || 
    freq.includes('12h') || 
    freq.includes('2 veces') || 
    freq.includes('dos veces') ||
    freq.includes('cada mañana y noche')
  ) {
    return [dayStartTime, formatTime(startH + 12, startM)];
  }

  // 3. Detecciones de 8 horas / 3 veces al día
  if (
    freq.includes('8 horas') || 
    freq.includes('8h') || 
    freq.includes('3 veces') || 
    freq.includes('tres veces')
  ) {
    return [dayStartTime, formatTime(startH + 8, startM), formatTime(startH + 16, startM)];
  }

  // 4. Detecciones de 6 horas / 4 veces al día
  if (
    freq.includes('6 horas') || 
    freq.includes('6h') || 
    freq.includes('4 veces') || 
    freq.includes('cuatro veces')
  ) {
    return [
      dayStartTime, 
      formatTime(startH + 6, startM), 
      formatTime(startH + 12, startM), 
      formatTime(startH + 18, startM)
    ];
  }

  // 5. Detecciones de 4 horas / 6 veces al día
  if (
    freq.includes('4 horas') || 
    freq.includes('4h') || 
    freq.includes('6 veces') || 
    freq.includes('seis veces')
  ) {
    return [
      dayStartTime, 
      formatTime(startH + 4, startM), 
      formatTime(startH + 8, startM), 
      formatTime(startH + 12, startM), 
      formatTime(startH + 16, startM), 
      formatTime(startH + 20, startM)
    ];
  }

  return [dayStartTime];
};

// --- Components ---

interface DashboardProps {
  setView: (v: View) => void;
  user: any;
  reminders: Medication[];
  onTestAlarm: () => void;
  onOpenSettings: () => void;
  installPrompt: any;
  onInstall: () => void;
  onToggle: (med: Medication) => void;
  userName?: string;
  key?: string;
}

const AlarmOverlay = ({ med, onConfirm, onStop }: { med: Medication, onConfirm: () => void, onStop: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-brand flex flex-col items-center justify-center p-8 text-white text-center"
    >
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, -5, 5, -5, 0]
        }}
        transition={{ repeat: Infinity, duration: 0.5 }}
        className="w-24 h-24 bg-card/20 rounded-full flex items-center justify-center mb-8"
      >
        <Bell className="w-12 h-12 text-white" />
      </motion.div>
      
      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-soft mb-2">¡Es Hora del Medicamento!</h2>
      <h1 className="text-4xl font-black mb-4">{med.name}</h1>
      <p className="text-xl text-brand-soft mb-12">{med.dosage}</p>
      
      <div className="w-full space-y-4">
        <button 
          onClick={onConfirm}
          className="w-full py-5 bg-card text-brand rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 transition-transform"
        >
          <Check className="w-6 h-6" />
          REGISTRAR TOMA
        </button>
        <button 
          onClick={onStop}
          className="w-full py-4 bg-brand-strong/50 text-white rounded-3xl font-bold flex items-center justify-center gap-2 transition-transform"
        >
           SALTAR / LUEGO
        </button>
      </div>
    </motion.div>
  );
};

// --- Estilo por medicamento (colores de los bocetos) ---
const MED_TONES = [
  { edge: 'bg-brand', tile: 'bg-brand-soft text-brand', pill: 'bg-brand-soft text-brand-strong' },
  { edge: 'bg-lav', tile: 'bg-lav-soft text-lav', pill: 'bg-lav-soft text-lav-strong' },
  { edge: 'bg-mint', tile: 'bg-mint-soft text-mint', pill: 'bg-mint-soft text-mint-strong' },
  { edge: 'bg-sun', tile: 'bg-sun-soft text-sun', pill: 'bg-sun-soft text-sun-strong' },
];

const toneFor = (name: string) => {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MED_TONES[h % MED_TONES.length];
};

// "14:30" -> "02:30 PM"
const formatHora = (t?: string) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return t || '';
  const [h, m] = t.split(':').map(Number);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const haceCuanto = (ts?: number) => {
  if (!ts) return '';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
};

const CheckCircle = ({ done, className = '' }: { done: boolean; className?: string }) => (
  <span
    key={done ? 'si' : 'no'}
    className={`flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${done ? 'pop bg-ok text-white shadow-[0_6px_14px_-6px_rgb(34_197_94/0.8)]' : 'border-2 border-line text-faint'} ${className}`}
  >
    <Check className="h-[55%] w-[55%]" strokeWidth={done ? 3 : 2} />
  </span>
);

// --- Piezas compartidas del diseño (banda de color + tarjetas) ---
const PAD_X = 'px-[clamp(16px,4vw,40px)]';
const SOLAPE = '-mt-[clamp(44px,7vh,64px)]'; // cuánto sube el contenido sobre la banda

const LogoTile = () => (
  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-sm">
    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-8 w-8 rounded-[10px]" />
  </span>
);

const BandaBoton = ({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) => (
  <button onClick={onClick} aria-label={label} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
    {children}
  </button>
);

// Encabezado azul de cada pantalla; el contenido que sigue se monta encima con SOLAPE
const Banda = ({ title, left, right, center = false, children }: { title: ReactNode; left?: ReactNode; right?: ReactNode; center?: boolean; children?: ReactNode }) => (
  <div className="relative overflow-hidden bg-brand text-white">
    <span className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-white/10" />
    <span className="pointer-events-none absolute -bottom-32 left-1/4 h-56 w-56 rounded-full bg-brand-strong/30" />
    <div className={`relative mx-auto max-w-5xl ${PAD_X} pt-[max(16px,env(safe-area-inset-top))] pb-[clamp(64px,10vh,92px)]`}>
      <div className="flex min-h-14 items-center gap-3">
        {left ?? (center && right ? <span className="w-11 shrink-0" aria-hidden="true" /> : null)}
        <h1 className={`min-w-0 flex-1 truncate font-semibold ${center ? 'text-center text-[clamp(1rem,2.2vmin,1.2rem)] uppercase tracking-wide' : 'text-[clamp(1.5rem,3.6vmin,2.1rem)] tracking-tight'}`}>
          {title}
        </h1>
        {right}
      </div>
      {children}
    </div>
  </div>
);

// Anillo de progreso con número al centro
const Ring = ({ value, total, color, label }: { value: number; total: number; color: string; label: string }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[clamp(92px,13vmin,124px)] w-[clamp(92px,13vmin,124px)]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct) }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[clamp(1.6rem,4vmin,2.2rem)] font-bold text-ink tabular-nums">{value}</span>
      </div>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
};

// Hoja inferior (celular) / ventana centrada (pantallas grandes)
const Hoja = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode; key?: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[28px] md:p-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const AvisoLegal = ({ onClose }: { onClose: () => void; key?: string }) => (
  <Hoja title="Aviso legal" onClose={onClose}>
    <div className="space-y-4 text-sm leading-relaxed text-muted">
      <p className="rounded-2xl bg-sun-soft p-4 text-ink">FotoFarma es una herramienta de apoyo. <b>No es un dispositivo médico</b> ni reemplaza la consulta con un profesional de la salud.</p>
      <section>
        <h4 className="font-semibold text-ink">1. Lectura automática</h4>
        <p>La lectura de la foto la hace un modelo de inteligencia artificial y puede equivocarse con la letra o con el nombre de un medicamento.</p>
      </section>
      <section>
        <h4 className="font-semibold text-ink">2. Revisión obligatoria</h4>
        <p>Antes de guardar, comprueba que cada medicamento, dosis y horario coincida con lo que indicó tu médico.</p>
      </section>
      <section>
        <h4 className="font-semibold text-ink">3. Interacciones</h4>
        <p>La revisión de interacciones busca casos conocidos, pero no cubre todos los posibles.</p>
      </section>
      <section>
        <h4 className="font-semibold text-ink">4. Tus datos</h4>
        <p>Tus recetas y recordatorios se guardan solo en este navegador. Si borras los datos del navegador, se pierden.</p>
      </section>
    </div>
    <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-ink py-3.5 font-semibold text-white">Entendido</button>
  </Hoja>
);

const SeccionTitulo = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
);

const DashboardView = ({ setView, reminders, onToggle, userName }: DashboardProps) => {
  const total = reminders.length;
  const hechas = reminders.filter(r => r.completed).length;
  const pendientes = reminders.filter(r => !r.completed);
  const siguiente = pendientes[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]"
    >
      <Banda title="FotoFarma" right={<LogoTile />} />

      <div className={`relative mx-auto grid max-w-5xl gap-[clamp(20px,3.5vh,32px)] ${PAD_X} ${SOLAPE} wide:grid-cols-2 wide:items-start wide:gap-8`}>
        {/* Saludo + anillos */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="rounded-[28px] bg-card p-[clamp(20px,3.4vmin,32px)] shadow-soft"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">
            Hola, {userName || 'bienvenido'}
          </p>
          <p className="mt-0.5 text-sm text-muted first-letter:uppercase">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="mt-6 flex justify-around">
            <Ring value={hechas} total={total} color="var(--color-brand)" label="Tomadas hoy" />
            <Ring value={pendientes.length} total={total} color="var(--color-sun)" label="Pendientes" />
          </div>
          <div className="-mx-[clamp(20px,3.4vmin,32px)] -mb-[clamp(20px,3.4vmin,32px)] mt-6 hidden border-t border-line px-[clamp(20px,3.4vmin,32px)] pt-5 pb-[clamp(20px,3.4vmin,32px)] wide:block">
          {/* Próxima toma (solo si hay) */}
          {siguiente && (
            <div>
              <SeccionTitulo>Próxima toma</SeccionTitulo>
              <div className="flex items-center gap-4 rounded-2xl bg-canvas px-4 py-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneFor(siguiente.name).tile}`}><Pill className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{siguiente.name}</span>
                  <span className="block truncate text-sm text-muted">{formatHora(siguiente.time)}{siguiente.dosage ? ` · ${siguiente.dosage}` : ''}</span>
                </span>
                <button onClick={() => onToggle(siguiente)} aria-label={`Marcar ${siguiente.name} como tomado`} className="rounded-full">
                  <CheckCircle done={false} className="h-10 w-10" />
                </button>
              </div>
            </div>
          )}
          {total > 0 && !siguiente && (
            <div className="flex items-center gap-3 rounded-2xl bg-mint-soft px-5 py-4">
              <Sparkle className="h-6 w-6 shrink-0 fill-mint text-mint" />
              <span className="font-semibold text-ink">Todo listo por hoy</span>
            </div>
          )}
          </div>
        </motion.section>

        {/* Acceso rápido */}
        <section className="wide:pt-[clamp(44px,7vh,64px)]">
          <SeccionTitulo>Acceso rápido</SeccionTitulo>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('camera')}
              className="tile flex h-[clamp(120px,19vh,180px)] flex-col items-center justify-center gap-3 rounded-[24px] bg-brand p-4 text-white shadow-[0_16px_30px_-16px_rgb(62_102_214/0.9)]"
            >
              <Camera className="h-[clamp(30px,5vmin,40px)] w-[clamp(30px,5vmin,40px)]" strokeWidth={1.8} />
              <span className="text-[clamp(0.95rem,2vmin,1.1rem)] font-semibold">Escanear receta</span>
            </button>
            <button
              onClick={() => setView('calendar')}
              className="tile flex h-[clamp(120px,19vh,180px)] flex-col items-center justify-center gap-3 rounded-[24px] bg-card p-4 text-ink shadow-soft"
            >
              <CalendarDays className="h-[clamp(30px,5vmin,40px)] w-[clamp(30px,5vmin,40px)] text-brand" strokeWidth={1.8} />
              <span className="text-[clamp(0.95rem,2vmin,1.1rem)] font-semibold">Mis tomas</span>
            </button>
          </div>

          <div className="wide:hidden">
          {/* Próxima toma (solo si hay) */}
          {siguiente && (
            <div className="mt-6">
              <SeccionTitulo>Próxima toma</SeccionTitulo>
              <div className="flex items-center gap-4 rounded-[24px] bg-card px-5 py-4 shadow-soft">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneFor(siguiente.name).tile}`}><Pill className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{siguiente.name}</span>
                  <span className="block truncate text-sm text-muted">{formatHora(siguiente.time)}{siguiente.dosage ? ` · ${siguiente.dosage}` : ''}</span>
                </span>
                <button onClick={() => onToggle(siguiente)} aria-label={`Marcar ${siguiente.name} como tomado`} className="rounded-full">
                  <CheckCircle done={false} className="h-10 w-10" />
                </button>
              </div>
            </div>
          )}
          {total > 0 && !siguiente && (
            <div className="mt-6 flex items-center gap-3 rounded-[24px] bg-mint-soft px-5 py-4">
              <Sparkle className="h-6 w-6 shrink-0 fill-mint text-mint" />
              <span className="font-semibold text-ink">Todo listo por hoy</span>
            </div>
          )}
          </div>
        </section>
      </div>
    </motion.div>
  );
};

interface GalleryViewProps {
  setView: (v: View) => void;
  onOpen: (id: string) => void;
  key?: string;
}

const GalleryView = ({ setView, onOpen }: GalleryViewProps) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'prescriptions'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('scannedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Prescription)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'list', 'prescriptions'));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]">
      <Banda
        title="Mis recetas"
        center
        left={<BandaBoton onClick={() => setView('calendar')} label="Volver"><ChevronLeft className="h-6 w-6" /></BandaBoton>}
        right={<BandaBoton onClick={() => setView('camera')} label="Escanear receta"><Plus className="h-6 w-6" /></BandaBoton>}
      />
      <div className={`relative mx-auto max-w-5xl ${PAD_X} ${SOLAPE}`}>
        {loading ? (
          <div className="flex justify-center rounded-[28px] bg-card p-12 shadow-soft"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
        ) : prescriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[28px] bg-card p-12 text-center shadow-soft">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lav-soft text-lav"><FileText className="h-7 w-7" /></span>
            <p className="font-semibold text-ink">Aún no has escaneado recetas</p>
            <button onClick={() => setView('camera')} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong">Escanear receta</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[clamp(12px,2vmin,20px)] sm:grid-cols-3 lg:grid-cols-4">
            {prescriptions.map((p, i) => (
              <motion.button
                key={p.id}
                onClick={() => onOpen(p.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
                className="tile overflow-hidden rounded-[22px] bg-card text-left shadow-soft"
              >
                <span className="block aspect-[4/3] bg-brand-soft">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="Receta" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    : <span className="flex h-full items-center justify-center text-brand"><FileText className="h-9 w-9" /></span>}
                </span>
                <span className="block px-4 py-3">
                  <span className="block truncate font-semibold text-ink">{p.medications?.length || 0} medicamentos</span>
                  <span className="block text-sm text-muted">{new Date(p.scannedAt?.toDate?.() || p.scannedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const RecetaView = ({ id, setView }: { id: string | null; setView: (v: View) => void; key?: string }) => {
  const [receta, setReceta] = useState<Prescription | null | undefined>(undefined);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (!id) { setReceta(null); return; }
    return onSnapshot(doc(db, 'prescriptions', id), (snap) => {
      setReceta(snap.exists() ? ({ id: snap.id, ...snap.data() } as Prescription) : null);
    });
  }, [id]);

  const eliminar = async () => {
    if (!id || !auth.currentUser) return;
    try {
      const tomas = await getDocs(query(collection(db, 'reminders'), where('uid', '==', auth.currentUser.uid), where('prescriptionId', '==', id)));
      await Promise.all(tomas.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'prescriptions', id));
      setView('gallery');
    } catch (error) {
      handleFirestoreError(error, 'delete', `prescriptions/${id}`);
    }
  };

  const meds: any[] = receta?.medications || [];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]">
      <Banda
        title="Detalle de receta"
        center
        left={<BandaBoton onClick={() => setView('gallery')} label="Volver"><ChevronLeft className="h-6 w-6" /></BandaBoton>}
        right={<LogoTile />}
      />
      <div className={`relative mx-auto max-w-5xl ${PAD_X} ${SOLAPE}`}>
        {receta === undefined ? (
          <div className="flex justify-center rounded-[28px] bg-card p-12 shadow-soft"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
        ) : receta === null ? (
          <div className="rounded-[28px] bg-card p-12 text-center text-muted shadow-soft">Esta receta ya no existe.</div>
        ) : (
          <div className="grid gap-6 wide:grid-cols-[1fr_1.1fr] wide:items-start">
            <section className="rounded-[28px] bg-card p-4 shadow-soft">
              <div className="aspect-[4/3] overflow-hidden rounded-[20px] bg-brand-soft">
                {receta.imageUrl
                  ? <img src={receta.imageUrl} alt="Foto de la receta" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="flex h-full items-center justify-center text-brand"><FileText className="h-12 w-12" /></span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-4 pb-1">
                <div>
                  <p className="font-semibold text-ink">Receta escaneada</p>
                  <p className="text-sm text-muted">{new Date(receta.scannedAt?.toDate?.() || receta.scannedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 text-sm font-semibold text-mint-strong">
                  <Check className="h-4 w-4" /> En tu calendario
                </span>
              </div>
            </section>

            <section className="wide:pt-[clamp(44px,7vh,64px)]">
              <SeccionTitulo>Medicamentos</SeccionTitulo>
              <ul className="overflow-hidden rounded-[24px] bg-card shadow-soft">
                {meds.length === 0 && <li className="p-6 text-center text-sm text-muted">Sin medicamentos</li>}
                {meds.map((m, i) => (
                  <li key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneFor(m.name || '').tile}`}><Pill className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{m.name}</span>
                      <span className="block truncate text-sm text-muted">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-3">
                <button onClick={() => setView('calendar')} className="w-full rounded-2xl bg-brand py-4 font-semibold text-white shadow-[0_16px_30px_-16px_rgb(62_102_214/0.9)] hover:bg-brand-strong">
                  Ver en el calendario
                </button>
                <button onClick={() => setConfirmar(true)} className="w-full rounded-2xl py-3 text-sm font-semibold text-bad hover:bg-bad-soft">
                  Eliminar receta
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={eliminar}
        title="¿Eliminar esta receta?"
        message="También se quitan sus tomas del calendario."
      />
    </motion.div>
  );
};

// --- Farmacias: dónde comprar tus medicinas (no vendemos nada) ---
// Las farmacias cercanas vienen de OpenStreetMap (servicio Overpass). No hay datos
// públicos de existencias, así que la app lo dice y ofrece llamar o ir.
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

interface Farmacia {
  id: string;
  nombre: string;
  direccion: string;
  lat: number;
  lon: number;
  distancia: number; // metros
  horario?: string;
  telefono?: string;
}

const distanciaM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const formatDistancia = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

const DIAS: Record<string, string> = { Mo: 'Lu', Tu: 'Ma', We: 'Mi', Th: 'Ju', Fr: 'Vi', Sa: 'Sá', Su: 'Do', PH: 'Festivos' };
const formatHorario = (h?: string) => {
  if (!h) return undefined;
  if (h.trim() === '24/7') return 'Abierta 24 horas';
  return h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => DIAS[d]).replace(/;\s*/g, ' · ').replace(/\boff\b/g, 'cerrado');
};

const buscarFarmacias = async (lat: number, lon: number, radio: number): Promise<Farmacia[]> => {
  const q = `[out:json][timeout:20];(node["amenity"="pharmacy"](around:${radio},${lat},${lon});way["amenity"="pharmacy"](around:${radio},${lat},${lon}););out center 60;`;
  let ultimoError: unknown;
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.elements || [])
        .map((e: any): Farmacia | null => {
          const p = e.type === 'node' ? { lat: e.lat, lon: e.lon } : e.center;
          if (!p) return null;
          const tg = e.tags || {};
          const calle = [tg['addr:street'], tg['addr:housenumber']].filter(Boolean).join(' ');
          return {
            id: `${e.type}/${e.id}`,
            nombre: tg.name || tg.brand || 'Farmacia',
            direccion: [calle, tg['addr:suburb'] || tg['addr:city']].filter(Boolean).join(', '),
            lat: p.lat,
            lon: p.lon,
            distancia: distanciaM({ lat, lon }, p),
            horario: formatHorario(tg.opening_hours),
            telefono: tg.phone || tg['contact:phone'],
          };
        })
        .filter(Boolean)
        .sort((a: Farmacia, b: Farmacia) => a.distancia - b.distancia)
        .slice(0, 25);
    } catch (err) {
      ultimoError = err;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoError;
};

// --- Disponibilidad en cadenas (precio y existencia reales de sus tiendas en línea) ---
// Farmacias del Ahorro se consulta directo (su servicio permite llamadas desde el navegador).
// Similares y Benavides pasan por el intermediario de proxy/worker.js (VITE_PROXY_URL).
const PROXY_URL = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');

// Capitales para buscar sucursales por estado cuando no se comparte la ubicación (Morelos primero)
const ESTADOS: { nombre: string; lat: number; lon: number }[] = [
  { nombre: 'Morelos', lat: 18.9218, lon: -99.2346 },
  { nombre: 'Ciudad de México', lat: 19.4326, lon: -99.1332 },
  { nombre: 'Estado de México', lat: 19.2826, lon: -99.6557 },
  { nombre: 'Guerrero', lat: 17.5515, lon: -99.5006 },
  { nombre: 'Puebla', lat: 19.0414, lon: -98.2063 },
  { nombre: 'Aguascalientes', lat: 21.8818, lon: -102.2916 },
  { nombre: 'Baja California', lat: 32.6245, lon: -115.4523 },
  { nombre: 'Baja California Sur', lat: 24.1426, lon: -110.3128 },
  { nombre: 'Campeche', lat: 19.8301, lon: -90.5349 },
  { nombre: 'Chiapas', lat: 16.7521, lon: -93.1152 },
  { nombre: 'Chihuahua', lat: 28.6353, lon: -106.0889 },
  { nombre: 'Coahuila', lat: 25.4232, lon: -101.0053 },
  { nombre: 'Colima', lat: 19.2452, lon: -103.7241 },
  { nombre: 'Durango', lat: 24.0277, lon: -104.6532 },
  { nombre: 'Guanajuato', lat: 21.019, lon: -101.2574 },
  { nombre: 'Hidalgo', lat: 20.1011, lon: -98.7591 },
  { nombre: 'Jalisco', lat: 20.6597, lon: -103.3496 },
  { nombre: 'Michoacán', lat: 19.706, lon: -101.195 },
  { nombre: 'Nayarit', lat: 21.5042, lon: -104.8946 },
  { nombre: 'Nuevo León', lat: 25.6866, lon: -100.3161 },
  { nombre: 'Oaxaca', lat: 17.0732, lon: -96.7266 },
  { nombre: 'Querétaro', lat: 20.5888, lon: -100.3899 },
  { nombre: 'Quintana Roo', lat: 18.5001, lon: -88.2961 },
  { nombre: 'San Luis Potosí', lat: 22.1565, lon: -100.9855 },
  { nombre: 'Sinaloa', lat: 24.8091, lon: -107.394 },
  { nombre: 'Sonora', lat: 29.0729, lon: -110.9559 },
  { nombre: 'Tabasco', lat: 17.9869, lon: -92.9303 },
  { nombre: 'Tamaulipas', lat: 23.7369, lon: -99.1411 },
  { nombre: 'Tlaxcala', lat: 19.3182, lon: -98.2375 },
  { nombre: 'Veracruz', lat: 19.5438, lon: -96.9102 },
  { nombre: 'Yucatán', lat: 20.9674, lon: -89.5926 },
  { nombre: 'Zacatecas', lat: 22.7709, lon: -102.5832 },
];

interface ProductoCadena { id: string; nombre: string; precio: number | null; disponible: boolean; imagen: string | null; url: string }
interface SucursalSimilares { id: string; nombre: string; direccion: string; estado?: string; lat: number; lon: number; distanciaKm: number; surte: boolean | null }

const buscarAhorro = async (q: string, intento = 0): Promise<ProductoCadena[]> => {
  try {
    return await buscarAhorroUnaVez(q);
  } catch (err) {
    if (intento < 1) return buscarAhorro(q, intento + 1); // a veces tarda en responder la primera vez
    throw err;
  }
};

const buscarAhorroUnaVez = async (q: string): Promise<ProductoCadena[]> => {
  const query = `{ products(search: ${JSON.stringify(q)}, pageSize: 3) { items { name sku stock_status url_key url_suffix small_image { url } price_range { minimum_price { final_price { value } } } } } }`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  const r = await fetch('https://www.fahorro.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), signal: ctrl.signal }).finally(() => clearTimeout(t));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return (d.data?.products?.items || []).map((p: any) => ({
    id: p.sku,
    nombre: p.name,
    precio: p.price_range?.minimum_price?.final_price?.value ?? null,
    disponible: p.stock_status === 'IN_STOCK',
    imagen: p.small_image?.url || null,
    url: `https://www.fahorro.com/${p.url_key}${p.url_suffix || '.html'}`,
  }));
};

const proxyGet = async (ruta: string) => {
  const r = await fetch(`${PROXY_URL}${ruta}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const formatPrecio = (n: number | null) => (n == null ? '' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }));

type Carga<T> = { estado: 'cargando' | 'listo' | 'error'; datos: T };

const ProductoFila = ({ p }: { p: ProductoCadena; key?: string }) => (
  <li className="flex items-center gap-3 py-3">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas">
      {p.imagen ? <img src={p.imagen} alt="" loading="lazy" className="h-full w-full object-contain" referrerPolicy="no-referrer" /> : <Pill className="h-5 w-5 text-faint" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">{p.nombre}</span>
      <span className="mt-0.5 flex items-center gap-2 text-sm">
        {p.precio != null && <span className="font-semibold text-ink tabular-nums">{formatPrecio(p.precio)}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.disponible ? 'bg-mint-soft text-mint-strong' : 'bg-bad-soft text-bad'}`}>{p.disponible ? 'Disponible' : 'Agotado'}</span>
      </span>
    </span>
    <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${p.nombre} en la tienda`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:text-brand">
      <ChevronRight className="h-5 w-5" />
    </a>
  </li>
);

const CadenaTarjeta = ({ nombre, sitio, carga, children }: { nombre: string; sitio: string; carga: Carga<ProductoCadena[]>; children?: ReactNode }) => (
  <div className="rounded-[22px] bg-card p-4 shadow-soft">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-semibold text-ink"><Store className="h-4 w-4 text-brand" /> {nombre}</p>
      <span className="text-xs text-faint">{sitio}</span>
    </div>
    {carga.estado === 'cargando' && <div className="mt-3 h-14 animate-pulse rounded-xl bg-canvas" />}
    {carga.estado === 'error' && <p className="mt-2 text-sm text-muted">No pudimos consultar esta tienda ahora.</p>}
    {carga.estado === 'listo' && (carga.datos.length === 0
      ? <p className="mt-2 text-sm text-muted">No lo encontramos en su catálogo.</p>
      : <ul className="divide-y divide-line">{carga.datos.map(p => <ProductoFila key={p.id} p={p} />)}</ul>)}
    {children}
  </div>
);

const DisponibilidadCadenas = ({ med, coords, onUbicar }: { med: string; coords: { lat: number; lon: number } | null; onUbicar: () => void }) => {
  const [estadoMx, setEstadoMx] = useState('Morelos');
  const [ahorro, setAhorro] = useState<Carga<ProductoCadena[]>>({ estado: 'cargando', datos: [] });
  const [similares, setSimilares] = useState<Carga<ProductoCadena[]>>({ estado: 'cargando', datos: [] });
  const [benavides, setBenavides] = useState<Carga<ProductoCadena[]>>({ estado: 'cargando', datos: [] });
  const [sucursales, setSucursales] = useState<Carga<SucursalSimilares[]>>({ estado: 'cargando', datos: [] });

  // Buscar en cada cadena (con una pequeña espera mientras se escribe)
  useEffect(() => {
    if (med.length < 3) return;
    let vivo = true;
    const t = setTimeout(() => {
      const cargar = <T,>(fn: () => Promise<T>, set: (c: Carga<T>) => void, vacio: T) => {
        set({ estado: 'cargando', datos: vacio });
        fn().then(d => vivo && set({ estado: 'listo', datos: d })).catch(() => vivo && set({ estado: 'error', datos: vacio }));
      };
      cargar(() => buscarAhorro(med), setAhorro, []);
      if (PROXY_URL) {
        cargar(() => proxyGet(`/similares/buscar?q=${encodeURIComponent(med)}`), setSimilares, []);
        cargar(() => proxyGet(`/benavides/buscar?q=${encodeURIComponent(med)}`), setBenavides, []);
      }
    }, 500);
    return () => { vivo = false; clearTimeout(t); };
  }, [med]);

  // Sucursales de Similares cerca de ti (o de la capital del estado elegido) que pueden surtir el producto
  const centro = coords || ESTADOS.find(e => e.nombre === estadoMx)!;
  const sku = similares.estado === 'listo' ? similares.datos.find(p => p.disponible)?.id : undefined;
  useEffect(() => {
    if (!PROXY_URL || !sku) return;
    let vivo = true;
    setSucursales({ estado: 'cargando', datos: [] });
    proxyGet(`/similares/sucursales?lat=${centro.lat}&lon=${centro.lon}&sku=${sku}`)
      .then(d => vivo && setSucursales({ estado: 'listo', datos: d }))
      .catch(() => vivo && setSucursales({ estado: 'error', datos: [] }));
    return () => { vivo = false; };
  }, [sku, centro.lat, centro.lon]);

  if (med.length < 3) return null;

  return (
    <section className="mb-8">
      <SeccionTitulo>Precio y existencia de {med}</SeccionTitulo>
      <div className="space-y-3">
        <CadenaTarjeta nombre="Farmacias del Ahorro" sitio="fahorro.com" carga={ahorro} />

        {PROXY_URL && (
          <CadenaTarjeta nombre="Farmacias Similares" sitio="farmaciasdesimilares.com" carga={similares}>
            {sku && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Sucursales {coords ? 'cerca de ti' : `en ${estadoMx}`}</p>
                  {coords ? (
                    <span className="flex items-center gap-1 text-xs text-muted"><LocateFixed className="h-3.5 w-3.5" /> Tu ubicación</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select value={estadoMx} onChange={e => setEstadoMx(e.target.value)} className="rounded-full border border-line bg-canvas px-3 py-1.5 text-sm text-ink outline-none focus:border-brand" aria-label="Estado">
                        {ESTADOS.map(e => <option key={e.nombre}>{e.nombre}</option>)}
                      </select>
                      <button onClick={onUbicar} aria-label="Usar mi ubicación" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand"><LocateFixed className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                {sucursales.estado === 'cargando' && <div className="h-14 animate-pulse rounded-xl bg-canvas" />}
                {sucursales.estado === 'error' && <p className="text-sm text-muted">No pudimos ver las sucursales ahora.</p>}
                {sucursales.estado === 'listo' && (
                  <ul className="space-y-2">
                    {[...sucursales.datos].sort((a, b) => Number(b.surte) - Number(a.surte) || a.distanciaKm - b.distanciaKm).slice(0, 6).map(s => (
                      <li key={s.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold capitalize text-ink">{s.nombre.toLowerCase()}</span>
                          <span className="block truncate text-xs capitalize text-muted">{s.direccion.toLowerCase()} · {formatDistancia(s.distanciaKm * 1000)}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.surte ? 'bg-mint-soft text-mint-strong' : 'bg-line text-muted'}`}>{s.surte ? 'Lo puede surtir' : 'Sin confirmar'}</span>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a ${s.nombre}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                          <Navigation className="h-4 w-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CadenaTarjeta>
        )}

        {PROXY_URL && <CadenaTarjeta nombre="Farmacias Benavides" sitio="benavides.com.mx" carga={benavides} />}
      </div>
      <p className="mt-3 text-xs text-faint">Precios y existencias de las tiendas en línea de cada cadena; en sucursal pueden variar. FotoFarma no vende medicamentos.</p>
    </section>
  );
};

const FarmaciasView = (_: { key?: string }) => {
  const [busqueda, setBusqueda] = useState('');
  const [misMeds, setMisMeds] = useState<string[]>([]);
  const [estado, setEstado] = useState<'inicio' | 'ubicando' | 'buscando' | 'listo' | 'sin-permiso' | 'error'>('inicio');
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Nombres de las medicinas que ya tienes en tus tomas, para buscarlas con un toque
  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(query(collection(db, 'reminders'), where('uid', '==', auth.currentUser.uid)), (snap) => {
      const nombres = new Map<string, string>();
      snap.docs.forEach((d: any) => {
        const n = String(d.data().name || '').trim();
        if (n) nombres.set(n.toLowerCase(), n);
      });
      setMisMeds([...nombres.values()].sort((a, b) => a.localeCompare(b, 'es')));
    });
  }, []);

  const localizar = () => {
    if (!('geolocation' in navigator)) { setEstado('sin-permiso'); return; }
    setEstado('ubicando');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setCoords({ lat: coords.latitude, lon: coords.longitude });
        setEstado('buscando');
        try {
          let lista = await buscarFarmacias(coords.latitude, coords.longitude, 3000);
          if (lista.length < 3) lista = await buscarFarmacias(coords.latitude, coords.longitude, 10000);
          setFarmacias(lista);
          setEstado('listo');
        } catch {
          setEstado('error');
        }
      },
      () => setEstado('sin-permiso'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  };

  const med = busqueda.trim();
  const mapsBusqueda = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(med ? `farmacia ${med}` : 'farmacia')}`;
  const cargando = estado === 'ubicando' || estado === 'buscando';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]">
      <Banda title="Farmacias" center right={<LogoTile />}>
        <label className="mt-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-ink shadow-[0_10px_24px_-14px_rgb(20_40_110/0.6)]">
          <Search className="h-5 w-5 shrink-0 text-muted" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="¿Qué medicamento necesitas?"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
            enterKeyHint="search"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </Banda>

      <div className={`relative mx-auto grid max-w-5xl grid-cols-1 gap-6 ${PAD_X} ${SOLAPE} wide:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] wide:items-start [&>*]:min-w-0`}>
        {/* Columna izquierda: qué buscas y dónde estás */}
        <div className="space-y-6">
          <section className="rounded-[28px] bg-card p-[clamp(20px,3.4vmin,28px)] shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><MapPin className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-semibold text-ink">¿Te quedaste sin {med || 'medicinas'}?</h2>
            <p className="mt-1 text-sm text-muted">Te mostramos las farmacias más cercanas para que vayas a comprarlo. Usamos tu ubicación solo para esta búsqueda.</p>
            <button
              onClick={localizar}
              disabled={cargando}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-semibold text-white shadow-[0_16px_30px_-16px_rgb(62_102_214/0.9)] hover:bg-brand-strong disabled:opacity-70"
            >
              {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
              {estado === 'ubicando' ? 'Buscando tu ubicación…' : estado === 'buscando' ? 'Buscando farmacias…' : estado === 'listo' ? 'Actualizar' : 'Buscar farmacias cercanas'}
            </button>
          </section>

          {misMeds.length > 0 && (
            <section>
              <SeccionTitulo>Tus medicamentos</SeccionTitulo>
              <div className="flex flex-wrap gap-2">
                {misMeds.map(n => {
                  const on = n.toLowerCase() === med.toLowerCase();
                  return (
                    <button
                      key={n}
                      onClick={() => setBusqueda(on ? '' : n)}
                      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${on ? 'bg-brand text-white' : 'bg-card text-ink shadow-soft hover:bg-brand-soft'}`}
                    >
                      <Pill className={`h-4 w-4 ${on ? 'text-white' : toneFor(n).tile.split(' ')[1]}`} /> {n}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Columna derecha: resultados */}
        <section className="wide:pt-[clamp(44px,7vh,64px)]">
          <DisponibilidadCadenas med={med} coords={coords} onUbicar={localizar} />

          {estado === 'inicio' && (
            <div className="rounded-[24px] border-2 border-dashed border-line p-8 text-center text-sm text-muted">
              {med.length < 3 && <>Escribe o elige un medicamento para ver su precio y existencia. </>}Toca <b className="text-ink">Buscar farmacias cercanas</b> para ver todas las farmacias a tu alrededor.
            </div>
          )}

          {cargando && (
            <ul className="space-y-3">
              {[0, 1, 2].map(i => <li key={i} className="h-24 animate-pulse rounded-[22px] bg-card shadow-soft" />)}
            </ul>
          )}

          {(estado === 'sin-permiso' || estado === 'error') && (
            <div className="rounded-[24px] bg-card p-6 text-center shadow-soft">
              <p className="font-semibold text-ink">{estado === 'sin-permiso' ? 'No pudimos ver tu ubicación' : 'No pudimos cargar las farmacias'}</p>
              <p className="mt-1 text-sm text-muted">{estado === 'sin-permiso' ? 'Permite el acceso a tu ubicación o busca directamente en el mapa.' : 'Revisa tu conexión e intenta de nuevo, o busca en el mapa.'}</p>
              <a href={mapsBusqueda} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-5 py-2.5 text-sm font-semibold text-brand-strong hover:bg-[#dde6fc]">
                <MapPin className="h-4 w-4" /> Abrir en Google Maps
              </a>
            </div>
          )}

          {estado === 'listo' && (
            <>
              <SeccionTitulo>{farmacias.length ? `${farmacias.length} farmacias cerca de ti` : 'Farmacias cerca de ti'}</SeccionTitulo>
              <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sun-soft px-4 py-3 text-sm text-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-strong" />
                <span>No conocemos la existencia de cada tienda. {med ? <>Llama y pregunta por <b>{med}</b> antes de ir.</> : 'Llama antes de ir para confirmar que lo tengan.'}</span>
              </p>
              {farmacias.length === 0 ? (
                <div className="rounded-[24px] bg-card p-6 text-center shadow-soft">
                  <p className="text-sm text-muted">No encontramos farmacias registradas cerca.</p>
                  <a href={mapsBusqueda} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand">Buscar en Google Maps <ChevronRight className="h-4 w-4" /></a>
                </div>
              ) : (
                <ul className="space-y-3">
                  {farmacias.map((f, i) => {
                    const tono = toneFor(f.nombre);
                    return (
                      <motion.li
                        key={f.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
                        className="rounded-[22px] bg-card p-4 shadow-soft"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tono.tile}`}><Store className="h-5 w-5" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-ink">{f.nombre}</p>
                            {f.direccion && <p className="truncate text-sm text-muted">{f.direccion}</p>}
                            {f.horario && <p className={`mt-1 truncate text-xs ${f.horario.startsWith('Abierta 24') ? 'font-semibold text-mint-strong' : 'text-muted'}`}>{f.horario}</p>}
                          </div>
                          <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted tabular-nums">{formatDistancia(f.distancia)}</span>
                        </div>
                        <div className="mt-3 flex gap-2 pl-14">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
                          >
                            <Navigation className="h-4 w-4" /> Cómo llegar
                          </a>
                          {f.telefono && (
                            <a href={`tel:${f.telefono.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong hover:bg-[#dde6fc]">
                              <Phone className="h-4 w-4" /> Llamar
                            </a>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 text-center text-xs text-faint">Datos de farmacias: © colaboradores de OpenStreetMap</p>
            </>
          )}
        </section>
      </div>
    </motion.div>
  );
};

interface PerfilViewProps {
  userSettings: UserSettings | null;
  onUpdate: (data: Partial<UserSettings>) => void;
  notificationPermission: NotificationPermission;
  requestPermission: () => void;
  onTestAlarm: () => void;
  installPrompt: any;
  onInstall: () => void;
  onBorrar: (col: 'reminders' | 'prescriptions') => void;
  key?: string;
}

const PerfilView = ({ userSettings, onUpdate, notificationPermission, requestPermission, onTestAlarm, installPrompt, onInstall, onBorrar }: PerfilViewProps) => {
  const [hoja, setHoja] = useState<null | 'nombre' | 'horario' | 'aviso' | 'borrar'>(null);
  const nombre = userSettings?.name?.trim();
  const avisos = notificationPermission === 'granted';
  const field = 'w-full rounded-2xl border border-line bg-canvas px-4 py-3.5 text-lg text-ink outline-none placeholder:text-faint focus:border-brand focus:bg-card';

  const filas: { Icon: any; label: string; detalle?: string; onClick: () => void; hide?: boolean }[] = [
    { Icon: User, label: 'Datos personales', detalle: nombre || 'Sin nombre', onClick: () => setHoja('nombre') },
    { Icon: Clock3, label: 'Inicio de tu día', detalle: formatHora(userSettings?.dayStartTime || '08:00'), onClick: () => setHoja('horario') },
    { Icon: Bell, label: 'Notificaciones', detalle: avisos ? 'Activadas' : 'Desactivadas', onClick: () => (avisos ? onTestAlarm() : requestPermission()) },
    { Icon: Download, label: 'Instalar la app', onClick: onInstall, hide: !installPrompt },
    { Icon: HelpCircle, label: 'Aviso legal', onClick: () => setHoja('aviso') },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]">
      <Banda title="Perfil" center right={<LogoTile />}>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex h-[clamp(60px,9vmin,76px)] w-[clamp(60px,9vmin,76px)] shrink-0 items-center justify-center rounded-full bg-white/95 text-[clamp(1.5rem,3.5vmin,2rem)] font-bold text-brand">
            {nombre ? nombre[0].toUpperCase() : <User className="h-1/2 w-1/2" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[clamp(1.15rem,2.6vmin,1.5rem)] font-semibold">{nombre || 'Tu perfil'}</p>
            <p className="text-sm text-white/80">Tus datos se guardan en este dispositivo</p>
          </div>
        </div>
      </Banda>

      <div className={`relative mx-auto max-w-2xl ${PAD_X} -mt-[clamp(36px,6vh,52px)]`}>
        <ul className="overflow-hidden rounded-[24px] bg-card shadow-soft">
          {filas.filter(f => !f.hide).map(({ Icon, label, detalle, onClick }) => (
            <li key={label} className="border-b border-line last:border-0">
              <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-canvas">
                <Icon className="h-5 w-5 shrink-0 text-ink" />
                <span className="flex-1 font-medium text-ink">{label}</span>
                {detalle && <span className="truncate text-sm text-muted">{detalle}</span>}
                <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>

        <button onClick={() => setHoja('borrar')} className="mt-8 w-full rounded-full bg-line/70 py-3.5 font-semibold text-ink hover:bg-line">
          Borrar mis datos
        </button>
      </div>

      <AnimatePresence>
        {hoja === 'nombre' && (
          <Hoja key="nombre" title="Datos personales" onClose={() => setHoja(null)}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">¿Cómo te llamas?</span>
              <input autoFocus maxLength={30} className={field} placeholder="Tu nombre" value={userSettings?.name || ''} onChange={e => onUpdate({ name: e.target.value })} />
            </label>
            <button onClick={() => setHoja(null)} className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-semibold text-white hover:bg-brand-strong">Listo</button>
          </Hoja>
        )}
        {hoja === 'horario' && (
          <Hoja key="horario" title="Inicio de tu día" onClose={() => setHoja(null)}>
            <p className="mb-4 text-sm text-muted">Es la base para programar tus medicinas: si tomas algo cada 8 horas, la primera toma será a esta hora.</p>
            <input type="time" className={`${field} text-center text-2xl font-semibold tabular-nums text-brand-strong`} value={userSettings?.dayStartTime || '08:00'} onChange={e => onUpdate({ dayStartTime: e.target.value })} />
            <button onClick={() => setHoja(null)} className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-semibold text-white hover:bg-brand-strong">Listo</button>
          </Hoja>
        )}
        {hoja === 'aviso' && <AvisoLegal key="aviso" onClose={() => setHoja(null)} />}
        {hoja === 'borrar' && (
          <Hoja key="borrar" title="Borrar mis datos" onClose={() => setHoja(null)}>
            <p className="mb-5 text-sm text-muted">Se eliminan todas las tomas guardadas en este dispositivo. No se pueden recuperar.</p>
            <button onClick={() => { onBorrar('reminders'); onBorrar('prescriptions'); setHoja(null); }} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-bad-soft px-4 py-3.5 font-semibold text-bad hover:bg-[#fbdde1]">
              <Trash2 className="h-5 w-5" /> Borrar todo
            </button>
          </Hoja>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-[32px] p-8 max-w-sm w-full shadow-2xl"
      >
        <h3 className="text-xl font-bold text-ink mb-2">{title}</h3>
        <p className="text-muted mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-canvas text-ink font-semibold rounded-2xl hover:bg-line transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-4 bg-bad text-white font-semibold rounded-2xl shadow-lg shadow-bad-soft hover:bg-bad transition-colors"
          >
            Eliminar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const STARTED_KEY = 'fotofarma:started';

const hasStarted = () => {
  try { return localStorage.getItem(STARTED_KEY) === '1'; } catch { return false; }
};

const markStarted = () => {
  try { localStorage.setItem(STARTED_KEY, '1'); } catch {}
};

const PASOS = [
  { Icon: Camera, tono: 'bg-brand-soft text-brand', titulo: 'Fotografía la receta', texto: 'La que te dio tu médico, tal cual.' },
  { Icon: Pill, tono: 'bg-lav-soft text-lav', titulo: 'Revisa lo que leímos', texto: 'Medicamento, dosis y cada cuánto.' },
  { Icon: Bell, tono: 'bg-mint-soft text-mint', titulo: 'Recibe tus avisos', texto: 'Te recordamos cada toma a su hora.' },
];

// Vista previa decorativa de la app para la portada en pantallas grandes
const PortadaMuestra = () => (
  <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-[36px] bg-gradient-to-br from-[#b3c8fb] via-[#94b3f8] to-[#7a9ff3] p-10 shadow-[0_30px_60px_-30px_rgb(62_102_214/0.8)]"
    >
      <svg viewBox="0 0 220 120" className="mx-auto w-3/4">
        <g className="flash-l" stroke="white" strokeWidth="9" strokeLinecap="round" opacity="0.9"><line x1="22" y1="44" x2="38" y2="53" /><line x1="18" y1="72" x2="38" y2="72" /></g>
        <g className="flash-r" stroke="white" strokeWidth="9" strokeLinecap="round" opacity="0.9"><line x1="198" y1="44" x2="182" y2="53" /><line x1="202" y1="72" x2="182" y2="72" /></g>
        <path d="M84 22c2-6 7-10 14-10h24c7 0 12 4 14 10l3 7h19c9 0 16 7 16 16v50c0 9-7 16-16 16H62c-9 0-16-7-16-16V45c0-9 7-16 16-16h19z" fill="white" />
        <circle cx="110" cy="71" r="26" fill="#94b3f8" /><circle cx="110" cy="71" r="15" fill="white" />
      </svg>
    </motion.div>
    {[
      { n: 'Ibuprofeno', d: '400 mg · 1 tableta', h: '08:00 AM', t: MED_TONES[0], ok: true, pos: '-left-10 top-[62%] rotate-[-4deg]' },
      { n: 'Amoxicilina', d: '500 mg · 1 cápsula', h: '12:30 PM', t: MED_TONES[1], ok: false, pos: '-right-8 top-[88%] rotate-[3deg]' },
    ].map((c, i) => (
      <motion.div
        key={c.n}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
        className={`absolute flex w-72 items-center gap-3 overflow-hidden rounded-[20px] bg-card py-3 pr-4 pl-5 shadow-[0_18px_40px_-18px_rgb(28_38_69/0.35)] ${c.pos}`}
      >
        <span className={`absolute inset-y-0 left-0 w-1.5 ${c.t.edge}`} />
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.t.tile}`}><Pill className="h-5 w-5 " /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{c.n}</span><span className="block text-xs text-muted">{c.d}</span></span>
        <span className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.t.pill}`}>{c.h}</span>
          <CheckCircle done={c.ok} className="h-5 w-5" />
        </span>
      </motion.div>
    ))}
  </div>
);

const Portada = ({ onStart }: { onStart: () => void; key?: string }) => {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-dvh overflow-hidden bg-canvas text-ink"
    >
      <span className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-soft blur-2xl" />
      <span className="pointer-events-none absolute -bottom-48 -left-40 h-[420px] w-[420px] rounded-full bg-mint-soft/70 blur-2xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 pt-[max(24px,env(safe-area-inset-top))] pb-8 sm:px-10 lg:px-16">
        <header className="flex items-center gap-3 py-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-10 w-10 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">FotoFarma</span>
        </header>

        <main className="mx-auto grid w-full max-w-xl flex-1 content-center gap-10 py-10 lg:max-w-none lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
          <section>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-tight"
            >
              Tus medicinas,<br /><span className="text-brand">a su hora.</span>
            </motion.h1>
            <p className="mt-5 max-w-md text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-muted">
              Toma una foto de tu receta y arma tu calendario de tomas. Todo se guarda en este dispositivo; no necesitas cuenta.
            </p>

            <ol className="mt-8 space-y-3">
              {PASOS.map(({ Icon, tono, titulo, texto }, i) => (
                <motion.li
                  key={titulo}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                  className="flex items-center gap-4 rounded-[20px] bg-card/80 p-3 pr-5 shadow-soft"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tono}`}><Icon className="h-6 w-6" /></span>
                  <span>
                    <span className="block font-semibold">{titulo}</span>
                    <span className="block text-sm text-muted">{texto}</span>
                  </span>
                </motion.li>
              ))}
            </ol>

            <div className="mt-8 space-y-4">
              <button
                onClick={onStart}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-lg font-semibold text-white shadow-[0_16px_30px_-14px_rgb(62_102_214/0.9)] hover:bg-brand-strong lg:max-w-sm"
              >
                Empezar
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <p className="text-center text-sm text-muted lg:max-w-sm">
                FotoFarma no sustituye a tu médico ni a tu farmacéutico.{' '}
                <button onClick={() => setShowTerms(true)} className="font-medium text-ink underline underline-offset-2">Aviso legal</button>
              </p>
            </div>
          </section>

          <div className="hidden pb-24 lg:block">
            <PortadaMuestra />
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showTerms && <AvisoLegal key="aviso" onClose={() => setShowTerms(false)} />}
      </AnimatePresence>
    </motion.div>
  );
};

const CameraView = ({ setView, setCapturedImage }: { setView: (v: View) => void, setCapturedImage: (img: string) => void, key?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setView('preview');
      }
    }
  };

  return (
    <div className="relative h-dvh bg-black overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[8%] w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-lg" />
        <div className="absolute top-[12%] right-[8%] w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-lg" />
        <div className="absolute bottom-[22%] left-[8%] w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-lg" />
        <div className="absolute bottom-[22%] right-[8%] w-16 h-16 border-b-4 border-r-4 border-white rounded-br-lg" />
      </div>

      <button
        onClick={() => setView('dashboard')}
        aria-label="Cerrar"
        className="absolute top-[max(16px,env(safe-area-inset-top))] left-4 z-10 w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 px-8 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/60 to-transparent">
      <div className="mx-auto max-w-md flex items-center justify-between">
        <span className="w-14 h-14" aria-hidden="true" />

        <button 
          onClick={takePhoto}
          className="w-20 h-20 bg-card rounded-full border-4 border-white/30 shadow-2xl transition-transform"
        />

        <button 
          onClick={() => setView('calendar')}
          className="w-14 h-14 bg-card/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-card/30 transition-all"
        >
          <CalendarIcon className="w-7 h-7" />
        </button>
      </div>
      </div>
    </div>
  );
};

interface CalendarViewProps {
  setView: (v: View) => void;
  requestPermission: () => void;
  notificationPermission: NotificationPermission;
  toggleComplete: (med: Medication) => Promise<void>;
  key?: string;
}

type Draft = { id?: string; name: string; dosage: string; time: string };

const MedSheet = ({ draft, date, onClose }: { draft: Draft; date: string; onClose: () => void; key?: string }) => {
  const [form, setForm] = useState<Draft>(draft);
  const editing = !!draft.id;
  const valid = form.name.trim() !== '' && /^\d{2}:\d{2}$/.test(form.time);

  const save = async () => {
    if (!valid || !auth.currentUser) return;
    const data = { name: form.name.trim(), dosage: form.dosage.trim(), time: form.time };
    try {
      if (editing) await updateDoc(doc(db, 'reminders', draft.id!), data);
      else await addDoc(collection(db, 'reminders'), { ...data, uid: auth.currentUser.uid, date, completed: false, comments: '' });
      onClose();
    } catch (error) {
      handleFirestoreError(error, editing ? 'update' : 'create', 'reminders');
    }
  };

  const remove = async () => {
    try {
      await deleteDoc(doc(db, 'reminders', draft.id!));
      onClose();
    } catch (error) {
      handleFirestoreError(error, 'delete', `reminders/${draft.id}`);
    }
  };

  const field = 'w-full rounded-2xl border border-line bg-canvas px-4 py-3.5 text-base text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:bg-card';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.form
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onSubmit={(e) => { e.preventDefault(); save(); }}
        className="w-full max-w-md rounded-t-[32px] bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[32px] md:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-ink">{editing ? 'Editar toma' : 'Nueva toma'}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Medicamento</span>
            <input autoFocus className={field} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Ibuprofeno" />
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Dosis</span>
              <input className={field} value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} placeholder="400 mg · 1 tableta" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Hora</span>
              <input type="time" className={`${field} font-semibold tabular-nums`} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          {editing && (
            <button type="button" onClick={remove} className="flex items-center justify-center gap-2 rounded-2xl bg-bad-soft px-5 py-4 font-semibold text-bad hover:bg-[#fbdde1]">
              <Trash2 className="h-5 w-5" /> <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}
          <button type="submit" disabled={!valid} className="flex-1 rounded-2xl bg-brand py-4 font-semibold text-white shadow-[0_12px_24px_-12px_rgb(62_102_214/0.8)] hover:bg-brand-strong disabled:opacity-40">
            {editing ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const CalendarView = ({ setView, requestPermission, notificationPermission, toggleComplete }: CalendarViewProps) => {
  const [reminders, setReminders] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const todayStr = getLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'reminders'),
      where('uid', '==', auth.currentUser.uid),
      where('date', '==', selectedDate),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          name: d.name || d.medicationName || 'Medicamento'
        } as Medication;
      });
      setReminders(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'list', 'reminders');
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const dayStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Mantener el día elegido centrado en la tira de fechas
    const el = dayStripRef.current?.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`);
    const strip = dayStripRef.current;
    if (el && strip) {
      strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
    }
  }, [selectedDate]);

  const days = Array.from({ length: 31 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 15); // 15 días antes y 15 después de hoy
    return getLocalDateString(d);
  });

  const [y, m, d] = selectedDate.split('-').map(Number);
  const titulo = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const hechas = reminders.filter(r => r.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      className="min-h-dvh bg-canvas pb-[calc(var(--nav-h)+28px)]"
    >
      <Banda
        title={<span className="block first-letter:uppercase">{titulo}</span>}
        center
        left={<BandaBoton onClick={() => setView('dashboard')} label="Volver"><ChevronLeft className="h-6 w-6" /></BandaBoton>}
        right={<BandaBoton onClick={() => setDraft({ name: '', dosage: '', time: '08:00' })} label="Agregar toma"><Plus className="h-6 w-6" /></BandaBoton>}
      >
        <p className="-mt-1 text-center text-sm text-white/80">
          {reminders.length === 0 ? 'Sin tomas' : `${hechas} de ${reminders.length} tomadas`}
        </p>
        <div ref={dayStripRef} className="relative -mx-2 mt-4 flex gap-2 overflow-x-auto px-2 py-1 scrollbar-hide">
          {days.map(dateStr => {
            const [yy, mm, dd] = dateStr.split('-').map(Number);
            const dt = new Date(yy, mm - 1, dd);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                data-date={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex h-[clamp(64px,8.5vmin,84px)] w-[clamp(50px,6.5vmin,64px)] shrink-0 flex-col items-center justify-center rounded-2xl ${isSelected ? 'bg-card text-brand-strong shadow-[0_10px_20px_-10px_rgb(20_40_110/0.6)]' : 'bg-white/12 text-white hover:bg-white/20'}`}
              >
                <span className={`text-[11px] font-medium uppercase ${isSelected ? 'text-muted' : 'text-white/75'}`}>{dt.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</span>
                <span className="text-xl font-semibold">{dt.getDate()}</span>
                {isToday && <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-brand' : 'bg-white'}`} />}
              </button>
            );
          })}
        </div>
      </Banda>

      <div className={`relative mx-auto max-w-5xl ${PAD_X} ${SOLAPE}`}>


        {loading ? (
          <div className="flex justify-center rounded-[24px] bg-card p-12 shadow-soft"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[24px] bg-card p-12 text-center shadow-soft">
            <p className="font-semibold text-ink">No hay tomas este día</p>
            <button onClick={() => setDraft({ name: '', dosage: '', time: '08:00' })} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong">Agregar toma</button>
          </div>
        ) : (
          // Lista para palomear: una columna en celular, rejilla con divisores en iPad y compu
          <div className="overflow-hidden rounded-[24px] bg-card shadow-soft">
            <ul className="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3">
              {reminders.map(med => (
                <li key={med.id} className="flex items-center gap-3 px-[clamp(18px,2.6vmin,28px)] py-[clamp(16px,2.6vmin,26px)] shadow-[inset_-1px_0_0_var(--color-line),inset_0_-1px_0_var(--color-line)]">
                  <button onClick={() => setDraft({ id: med.id, name: med.name, dosage: med.dosage, time: med.time })} className="min-w-0 flex-1 text-left">
                    <span className={`block text-[clamp(1.05rem,2.2vmin,1.3rem)] font-medium leading-snug ${med.completed ? 'text-muted' : 'text-ink'}`}>{med.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${toneFor(med.name).edge}`} />
                      <span className="tabular-nums">{formatHora(med.time)}</span>
                      {med.dosage && <span className="truncate">· {med.dosage}</span>}
                    </span>
                  </button>
                  <button onClick={() => toggleComplete(med)} aria-label={med.completed ? `Desmarcar ${med.name}` : `Marcar ${med.name} como tomado`} className="rounded-full">
                    <CheckCircle done={med.completed} className="h-[clamp(40px,5.5vmin,52px)] w-[clamp(40px,5.5vmin,52px)]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={() => setView('gallery')} className="tile mt-5 flex w-full items-center gap-4 rounded-[22px] bg-card px-5 py-4 text-left shadow-soft">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lav-soft text-lav"><FileText className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block font-semibold text-ink">Mis recetas</span>
            <span className="block text-sm text-muted">Las recetas que has escaneado</span>
          </span>
          <ChevronRight className="h-5 w-5 text-faint" />
        </button>
        {notificationPermission !== 'granted' && 'Notification' in window && (
          <button onClick={requestPermission} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-sun-soft px-4 py-3 text-left">
            <Bell className="h-5 w-5 shrink-0 text-sun-strong" />
            <span className="flex-1 text-sm text-ink"><b className="font-semibold">Activa los avisos</b> para que te recordemos cada toma.</span>
            <ChevronRight className="h-5 w-5 text-sun-strong" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {draft && <MedSheet key="sheet" draft={draft} date={selectedDate} onClose={() => setDraft(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

interface PreviewViewProps {
  setView: (v: View) => void;
  capturedImage: string;
  userSettings: UserSettings | null;
  key?: string;
}

const PreviewView = ({ setView, capturedImage, userSettings }: PreviewViewProps) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [auditResults, setAuditResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processImageAndAudit = async () => {
      try {
        setError(null);
        // 1. Analizar imagen
        const meds = await analyzePrescription(capturedImage);
        
        if (meds.length === 0) {
          setError("No se detectaron medicamentos en la imagen. Intenta con una foto más clara.");
          setIsProcessing(false);
          return;
        }

        const enhancedResults = meds.map((m: any) => ({
          ...m,
          times: parseFrequency(m.frequency, userSettings?.dayStartTime)
        }));
        setResults(enhancedResults);
        setIsProcessing(false);

        // 2. Realizar auditoría de seguridad
        if (auth.currentUser) {
          setIsAuditing(true);
          // Obtener medicamentos actuales del usuario para comparar
          const q = query(collection(db, 'reminders'), where('uid', '==', auth.currentUser.uid));
          const snapshot = await getDocs(q);
          const historyMeds = snapshot.docs.map(d => d.data());
          
          // Filtrar por medicamentos únicos para no enviar duplicados de cada toma
          const uniqueHistoryMeds = Array.from(new Set(historyMeds.map(m => (m.name || '').toLowerCase())))
            .map(name => historyMeds.find(m => (m.name || '').toLowerCase() === name));

          const audit = await performSecurityAudit(enhancedResults, uniqueHistoryMeds);
          setAuditResults(audit);
          setIsAuditing(false);
        }

      } catch (err: any) {
        console.error("Gemini error:", err);
        setError(`Ocurrió un error: ${err.message || 'Error desconocido'}`);
        setIsProcessing(false);
        setIsAuditing(false);
      }
    };
    processImageAndAudit();
  }, [capturedImage]);

  const saveReminders = async () => {
    if (!auth.currentUser || isSaving) return;
    setIsSaving(true);

    try {
      const batch = writeBatch(db);

      // Save prescription
      const pRef = doc(collection(db, 'prescriptions'));
      batch.set(pRef, {
        uid: auth.currentUser.uid,
        imageUrl: capturedImage,
        scannedAt: serverTimestamp(),
        medications: results
      });

      // Generate reminders
      const today = new Date();
      
      for (const med of results) {
        // Calcular duración
        let daysToGenerate = 7; // Default
        if (med.duration) {
          const num = parseInt(med.duration.match(/\d+/)?.[0] || "7");
          if (!isNaN(num)) daysToGenerate = num;
        }

        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysToGenerate - 1);
        const endDateStr = getLocalDateString(endDate);

        for (let i = 0; i < daysToGenerate; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dateStr = getLocalDateString(date);

          // Si es dosis única, solo lo guardamos para el primer día (i === 0)
          const isSingleDose = 
            med.frequency.toLowerCase().includes('única') || 
            med.frequency.toLowerCase().includes('unica') ||
            med.frequency.toLowerCase().includes('una sola vez');
            
          if (isSingleDose && i > 0) continue;

          const times = med.times || parseFrequency(med.frequency, userSettings?.dayStartTime);
          for (const time of times) {
            const rRef = doc(collection(db, 'reminders'));
            batch.set(rRef, {
              uid: auth.currentUser.uid,
              name: med.name,
              dosage: med.dosage,
              time: time,
              date: dateStr,
              endDate: endDateStr,
              comments: med.comments || '',
              completed: false,
              prescriptionId: pRef.id
            });
          }
        }
      }

      await batch.commit();
      setView('calendar');
    } catch (error) {
      handleFirestoreError(error, 'write', 'prescriptions/reminders');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="flex-1 relative">
        <img 
          src={capturedImage} 
          alt="Captured Prescription" 
          className="w-full h-full object-cover md:object-contain opacity-60"
          referrerPolicy="no-referrer"
        />
        
        {isProcessing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <Loader2 className="w-16 h-16 text-brand animate-spin mb-4" />
            <p className="text-lg font-medium">IA Analizando receta...</p>
            <p className="text-sm text-faint">Extrayendo medicamentos con Gemini</p>
          </div>
        ) : error ? (
          <div className="absolute inset-x-0 bottom-0 p-8 bg-card rounded-t-[32px] text-center md:inset-x-auto md:right-8 md:bottom-8 md:w-[420px] md:rounded-[32px] md:shadow-2xl">
            <div className="w-16 h-16 bg-bad-soft text-bad rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Error de Análisis</h3>
            <p className="text-muted mb-8">{error}</p>
            <button 
              onClick={() => setView('camera')}
              className="w-full py-4 bg-brand text-white font-semibold rounded-2xl shadow-lg hover:bg-brand-strong transition-colors"
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 bottom-0 p-6 bg-card rounded-t-[32px] max-h-[85dvh] overflow-y-auto md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[min(560px,50vw)] md:rounded-none md:rounded-l-[32px] md:p-8"
          >
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-6 md:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-ink">Configurar Horarios</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-brand-soft text-brand-strong rounded-lg">IA Detectado</span>
            </div>

            {/* IA Security Audit Section */}
            <div className="mb-8">
              {isAuditing ? (
                <div className="p-4 bg-lav-soft rounded-2xl border border-lav-soft flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-lav animate-spin" />
                  <p className="text-sm font-semibold text-lav">Verificando seguridad con IA...</p>
                </div>
              ) : auditResults ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className={`p-4 rounded-3xl border ${auditResults.safetyScore > 80 ? 'bg-brand-soft border-brand-soft' : auditResults.safetyScore > 50 ? 'bg-sun-soft border-sun-soft' : 'bg-bad-soft border-bad-soft'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {auditResults.safetyScore > 80 ? <ShieldCheck className="w-5 h-5 text-brand" /> : <ShieldAlert className="w-5 h-5 text-sun-strong" />}
                        <span className="font-bold text-ink">Auditoría de Seguridad</span>
                      </div>
                      <span className={`text-lg font-black ${auditResults.safetyScore > 80 ? 'text-brand' : auditResults.safetyScore > 50 ? 'text-sun-strong' : 'text-bad'}`}>
                        {auditResults.safetyScore}%
                      </span>
                    </div>

                    {auditResults.warnings?.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {auditResults.warnings.map((w: string, i: number) => (
                          <div key={i} className="flex gap-2 text-xs text-bad font-medium bg-bad-soft/50 p-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    {auditResults.interactions?.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {auditResults.interactions.map((inter: any, i: number) => (
                          <div key={i} className="p-3 bg-card/50 rounded-xl border border-canvas">
                             <div className="flex items-center gap-2 mb-1">
                               <AlertTriangle className={`w-4 h-4 ${inter.risk === 'high' ? 'text-bad' : 'text-sun-strong'}`} />
                               <span className="text-xs font-bold text-ink capitalize">Riesgo {inter.risk}: {inter.medA} + {inter.medB}</span>
                             </div>
                             <p className="text-[10px] text-muted">{inter.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {auditResults.recommendations?.length > 0 && (
                      <div className="space-y-1">
                        {auditResults.recommendations.map((rec: string, i: number) => (
                          <div key={i} className="flex gap-2 text-[10px] text-lav-strong font-semibold italic">
                            <Info className="w-3 h-3 flex-shrink-0" />
                            {rec}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </div>
            
            <div className="space-y-4 mb-8">
              {results.map((med, idx) => (
                <div key={idx} className="p-4 bg-canvas rounded-2xl border border-canvas space-y-3">
                  <div className="flex items-center justify-between">
                    <input 
                      type="text" 
                      value={med.name} 
                      onChange={(e) => {
                        const newResults = [...results];
                        newResults[idx].name = e.target.value;
                        setResults(newResults);
                      }}
                      className="bg-transparent font-bold text-ink border-none p-0 focus:ring-0 w-full text-lg"
                    />
                    <Edit2 className="w-4 h-4 text-brand" />
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={med.dosage} 
                      onChange={(e) => {
                        const newResults = [...results];
                        newResults[idx].dosage = e.target.value;
                        setResults(newResults);
                      }}
                      className="flex-1 bg-card px-3 py-1.5 rounded-lg text-sm text-muted border border-line focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                      placeholder="Dosis"
                    />
                    <input 
                      type="text" 
                      value={med.frequency} 
                      readOnly
                      className="flex-1 bg-canvas px-3 py-1.5 rounded-lg text-xs text-faint border border-transparent outline-none cursor-default"
                      placeholder="Frecuencia"
                    />
                  </div>

                  {med.comments && (
                    <div className="flex gap-2 p-2 bg-lav-soft rounded-xl border border-lav-soft">
                      <Info className="w-4 h-4 text-lav mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-lav-strong italic leading-relaxed">
                        <b>Nota del doctor:</b> {med.comments}
                      </p>
                    </div>
                  )}

                  {/* Edición de Horarios Individuales */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider">Horas de las tomas</p>
                    <div className="flex flex-wrap gap-2">
                      {med.times?.map((time: string, timeIdx: number) => (
                        <div key={timeIdx} className="relative group">
                          <input 
                            type="time" 
                            value={time}
                            onChange={(e) => {
                              const newResults = [...results];
                              newResults[idx].times[timeIdx] = e.target.value;
                              setResults(newResults);
                            }}
                            className="bg-card border border-line rounded-xl px-2 py-1.5 text-sm font-medium text-brand focus:ring-2 focus:ring-brand outline-none"
                          />
                          <button 
                            onClick={() => {
                              const newResults = [...results];
                              newResults[idx].times.splice(timeIdx, 1);
                              setResults(newResults);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-bad text-white rounded-full flex items-center justify-center text-[10px] shadow-sm hover:bg-bad"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newResults = [...results];
                          const lastTime = med.times[med.times.length - 1] || '08:00';
                          const [h, m] = lastTime.split(':').map(Number);
                          const nextH = (h + 4) % 24;
                          newResults[idx].times.push(`${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                          setResults(newResults);
                        }}
                        className="w-10 h-8 border-2 border-dashed border-line rounded-xl flex items-center justify-center text-faint hover:border-brand hover:text-brand transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setView('camera')}
                className="flex-1 py-4 bg-canvas text-ink font-semibold rounded-2xl hover:bg-line transition-colors"
              >
                Reintentar
              </button>
              <button 
                onClick={saveReminders}
                disabled={isSaving}
                className="flex-[2] py-4 bg-brand text-white font-semibold rounded-2xl shadow-lg shadow-brand-soft hover:bg-brand-strong transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Confirmar y Guardar'
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// --- Pantalla de arranque de la app instalada ---
const isInstalledApp = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (navigator as any).standalone === true
      || new URLSearchParams(location.search).has('splash');
  } catch {
    return false;
  }
};

const SPLASH_MS = 1800;

const Splash = (_: { key?: string }) => (
  <motion.div
    initial={{ opacity: 1 }}
    exit={{ opacity: 0, scale: 1.03 }}
    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-canvas px-6 text-ink"
    aria-label="Cargando FotoFarma"
  >
    <motion.img
      src={`${import.meta.env.BASE_URL}logo.svg`}
      alt=""
      initial={{ scale: 0.8, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
      className="h-[clamp(88px,18vmin,144px)] w-[clamp(88px,18vmin,144px)] rounded-[26%] shadow-[0_18px_40px_-16px_rgb(62_102_214/0.6)]"
    />
    <motion.h1
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="mt-[clamp(20px,4vmin,36px)] text-[clamp(2rem,6vmin,3.5rem)] font-bold tracking-tight"
    >
      FotoFarma
    </motion.h1>
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className="mt-2 text-[clamp(0.95rem,2.2vmin,1.2rem)] text-muted"
    >
      Tus medicinas, a su hora.
    </motion.p>
    <div className="absolute bottom-[max(56px,calc(env(safe-area-inset-bottom)+40px))] h-[3px] w-[clamp(120px,22vmin,200px)] overflow-hidden rounded-full bg-ink/10">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: (SPLASH_MS - 300) / 1000, ease: [0.4, 0, 0.2, 1] }}
        className="h-full origin-left rounded-full bg-brand"
      />
    </div>
  </motion.div>
);

export default function App() {
  const [view, setView] = useState<View>('login');
  const [showSplash, setShowSplash] = useState(isInstalledApp);

  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, [showSplash]);

  // Barra de estado del teléfono del mismo color que la pantalla visible
  useEffect(() => {
    const color = view === 'camera' || view === 'preview' ? '#000000' : '#f3f6fd';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [showSplash, view]);
  const [user, setUser] = useState<any>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [recetaId, setRecetaId] = useState<string | null>(null);

  const actualizarAjustes = (data: Partial<UserSettings>) => {
    if (!user) return;
    updateDoc(doc(db, 'user_settings', user.uid), { ...data, updatedAt: serverTimestamp() })
      .catch(error => handleFirestoreError(error, 'update', 'user_settings'));
  };

  const borrarTodo = async (col: 'reminders' | 'prescriptions') => {
    if (!auth.currentUser) return;
    try {
      const snapshot = await getDocs(query(collection(db, col), where('uid', '==', auth.currentUser.uid)));
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    } catch (error) {
      handleFirestoreError(error, 'delete', `${col}/all`);
    }
  };
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [remindersToday, setRemindersToday] = useState<Medication[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch User Settings
    const settingsRef = doc(db, 'user_settings', user.uid);
    return onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings(docSnap.data() as UserSettings);
      } else {
        // Default settings
        const defaultSettings: UserSettings = {
          uid: user.uid,
          dayStartTime: '08:00',
          acceptedTerms: true
        };
        setUserSettings(defaultSettings);
        // Persist default settings
        setDoc(settingsRef, {
          ...defaultSettings,
          updatedAt: serverTimestamp()
        });
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = getLocalDateString(new Date());
    const q = query(
      collection(db, 'reminders'),
      where('uid', '==', user.uid),
      where('date', '==', today),
      orderBy('time', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setRemindersToday(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication)));
    });
  }, [user]);

  useEffect(() => {
    if (user && permisoAvisos() === 'granted') {
      subscribeUserToPush(user.uid);
    }
  }, [user]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!avisosDisponibles()) {
      const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      alert(iPhone
        ? "En iPhone los avisos solo funcionan con la app instalada: toca Compartir → «Agregar a inicio» y ábrela desde el ícono."
        : "Tu navegador no permite notificaciones.");
      return;
    }
    
    try {
      const permission = await new Promise<NotificationPermission>((resolve) => {
        const result = Notification.requestPermission(resolve);
        if (result) {
          result.then(resolve);
        }
      });
      
      setNotificationPermission(permission);
      
      if (permission === 'denied') {
        alert("Has bloqueado las notificaciones. Por favor, actívalas en los ajustes de tu navegador para recibir alertas.");
      } else if (permission === 'granted') {
        const aviso = { body: "Te avisaremos cuando sea hora de tu medicina.", icon: `${import.meta.env.BASE_URL}logo.svg` };
        try {
          // En iPhone (app instalada) solo funcionan los avisos del service worker
          if ('serviceWorker' in navigator) (await navigator.serviceWorker.ready).showNotification("¡Notificaciones activadas!", aviso);
          else new Notification("¡Notificaciones activadas!", aviso);
        } catch (err) {
          console.error('No se pudo mostrar el aviso de prueba:', err);
        }
        
        // Iniciamos suscripción persistente al servidor
        if (user) {
          subscribeUserToPush(user.uid);
        }
      }
    } catch (err) {
      console.error("Error requesting notifications:", err);
    }
  };

  const subscribeUserToPush = async (userId: string) => {
    if (!API_URL || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Suscribirse al Push Manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array("BMSBMHIHH8YkhmEbHrAZGb2N4kQfVSoQ4XemexmJaT7tDVq_Ft7y1TQ2UkiQWQW2mSTfZWCm6ctsNYRUQqVc8js")
      });

      // Enviar la suscripción a nuestro servidor con el offset de zona horaria
      await fetch(`${API_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription, 
          userId,
          timezoneOffset: new Date().getTimezoneOffset() // Minutos de diferencia con UTC
        })
      });

      console.log("Suscripción Push exitosa");
    } catch (err) {
      console.error("Fallo al suscribir a push:", err);
    }
  };

  // Helper para convertir la llave VAPID
  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const [activeAlarm, setActiveAlarm] = useState<Medication | null>(null);
  const notifiedIds = useRef<Set<string>>(new Set());
  const alarmSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Inicializar sonido de alarma con un tono profesional
    alarmSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    alarmSound.current.loop = true;
  }, []);

  const stopAlarm = () => {
    if (alarmSound.current) {
      alarmSound.current.pause();
      alarmSound.current.currentTime = 0;
    }
    setActiveAlarm(null);
  };

  // Notification Check Effect
  useEffect(() => {
    if (!user || notificationPermission !== 'granted') return;

    const checkReminders = async () => {
      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const dateStr = getLocalDateString(now);

      const q = query(
        collection(db, 'reminders'),
        where('uid', '==', user.uid),
        where('date', '==', dateStr),
        where('time', '==', timeStr),
        where('completed', '==', false)
      );

      try {
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
          if (notifiedIds.current.has(docSnap.id)) return;
          
          const med = docSnap.data() as Medication;
          med.id = docSnap.id;
          
          notifiedIds.current.add(docSnap.id);
          setActiveAlarm(med);
          
          // Sonar alarma (solo si el usuario interactuó antes con la web)
          alarmSound.current?.play().catch(e => console.log("Audio bloqueado esperando interacción", e));

          const title = `¡Hora de tu medicina!`;
          const options = {
            body: `Es momento de tomar: ${med.name} (${med.dosage})`,
            icon: `${import.meta.env.BASE_URL}logo.svg`,
            badge: `${import.meta.env.BASE_URL}logo.svg`,
            tag: `med-${docSnap.id}`,
            renotify: true,
            requireInteraction: true
          };

          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification(title, options);
          } else if (avisosDisponibles()) {
            new Notification(title, options);
          }
        });

        // Limpiar IDs antiguos de la lista de notificados después de 1 minuto
        if (now.getSeconds() === 0) {
          // Opcional: limpiar IDs que ya no están en el rango de tiempo actual
        }

      } catch (err) {
        console.error("Error checking notifications:", err);
      }
    };

    const interval = setInterval(checkReminders, 10000); // Revisar cada 10 segundos
    return () => clearInterval(interval);
  }, [user, notificationPermission]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setView(hasStarted() ? 'dashboard' : 'login');
    });
    return () => unsubscribe();
  }, []);

  const toggleComplete = async (med: Medication) => {
    if (!med.id) return;

    // No intentar actualizar en Firestore si es la medicina de demo
    if (med.id === 'demo-med') {
      const newReminders = remindersToday.map(r => 
        r.id === 'demo-med' ? { ...r, completed: !r.completed } : r
      );
      setRemindersToday(newReminders);
      
      if (!med.completed) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5b86f0', '#8a79f0', '#3fc49b', '#f4a53d']
        });
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'reminders', med.id), {
        completed: !med.completed,
        completedAt: !med.completed ? Date.now() : null
      });
      
      if (!med.completed) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5b86f0', '#8a79f0', '#3fc49b', '#f4a53d']
        });
      }
    } catch (error) {
      handleFirestoreError(error, 'update', `reminders/${med.id}`);
    }
  };

  const handleTestAlarm = async () => {
    // Para la demo: activamos la alarma visual y sonora inmediatamente
    const testMed: Medication = {
      id: 'demo-med',
      uid: user.uid,
      name: 'Medicina Demo',
      dosage: '1 pastilla de prueba',
      frequency: 'Cada 24 horas',
      time: 'AHORA',
      date: '',
      completed: false
    };
    setActiveAlarm(testMed);
    alarmSound.current?.play().catch(() => {});
    
    // También enviamos notificación push
    const title = "¡Prueba de FotoFarma!";
    const options = { 
      body: "Así llegará el aviso de tu medicina 💊",
      icon: `${import.meta.env.BASE_URL}logo.svg`,
      tag: 'test-notification'
    };
    if ('serviceWorker' in navigator && permisoAvisos() === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, options);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas font-sans text-ink selection:bg-brand-soft selection:text-brand-strong">
      <AnimatePresence>
        {showSplash && <Splash key="splash" />}
      </AnimatePresence>

      <AnimatePresence>
        {activeAlarm && (
          <AlarmOverlay 
            med={activeAlarm} 
            onStop={() => stopAlarm()} 
            onConfirm={() => {
              toggleComplete(activeAlarm);
              stopAlarm();
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'login' && <Portada key="login" onStart={() => { markStarted(); setView('dashboard'); }} />}
        {view === 'dashboard' && (
          <DashboardView 
            key="dashboard" 
            setView={setView} 
            user={user} 
            reminders={remindersToday} 
            onTestAlarm={handleTestAlarm} 
            onOpenSettings={() => setShowSettings(true)}
            installPrompt={installPrompt}
            onInstall={handleInstall}
            onToggle={toggleComplete}
            userName={userSettings?.name}
          />
        )}
        {view === 'camera' && <CameraView key="camera" setView={setView} setCapturedImage={setCapturedImage} />}
        {view === 'calendar' && <CalendarView key="calendar" setView={setView} requestPermission={requestPermission} notificationPermission={notificationPermission} toggleComplete={toggleComplete} />}
        {view === 'gallery' && <GalleryView key="gallery" setView={setView} onOpen={(id) => { setRecetaId(id); setView('receta'); }} />}
        {view === 'receta' && <RecetaView key="receta" id={recetaId} setView={setView} />}
        {view === 'farmacias' && <FarmaciasView key="farmacias" />}
        {view === 'perfil' && (
          <PerfilView
            key="perfil"
            userSettings={userSettings}
            onUpdate={actualizarAjustes}
            notificationPermission={notificationPermission}
            requestPermission={requestPermission}
            onTestAlarm={handleTestAlarm}
            installPrompt={installPrompt}
            onInstall={handleInstall}
            onBorrar={borrarTodo}
          />
        )}
        {view === 'preview' && <PreviewView key="preview" setView={setView} capturedImage={capturedImage} userSettings={userSettings} />}
      </AnimatePresence>

      {/* Barra inferior con 4 pestañas */}
      {view !== 'login' && view !== 'camera' && view !== 'preview' && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          <div className="mx-auto grid h-[var(--nav-bar)] max-w-xl grid-cols-4">
            {([
              { v: 'dashboard', label: 'Inicio', Icon: Home, activo: ['dashboard'] },
              { v: 'calendar', label: 'Tomas', Icon: CalendarDays, activo: ['calendar', 'gallery', 'receta'] },
              { v: 'farmacias', label: 'Farmacias', Icon: Store, activo: ['farmacias'] },
              { v: 'perfil', label: 'Perfil', Icon: User, activo: ['perfil'] },
            ] as const).map(({ v, label, Icon, activo }) => {
              const on = (activo as readonly string[]).includes(view);
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`relative flex flex-col items-center justify-center gap-1 ${on ? 'text-brand' : 'text-faint hover:text-ink'}`}
                >
                  {on && <motion.span layoutId="nav-indicador" className="absolute top-0 h-[3px] w-10 rounded-b-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <Icon className="h-6 w-6" strokeWidth={on ? 2.3 : 1.9} />
                  <span className={`text-[11px] ${on ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
