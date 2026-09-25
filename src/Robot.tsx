// Carita del Asistente de Medicamentos.
//
// Es un SVG propio, con los colores de la app (lila → azul), para que no parezca
// un icono genérico. Si el sistema pide menos animación, se queda quieto.

import { motion, useReducedMotion } from 'motion/react';

export const Robot = ({ className = '', animado = false }: { className?: string; animado?: boolean }) => {
  const quieto = useReducedMotion();
  const mueve = animado && !quieto;

  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" role="img" aria-label="Asistente">
      <defs>
        <linearGradient id="robotCara" x1="10" y1="12" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9d8cf5" />
          <stop offset="1" stopColor="#5b86f0" />
        </linearGradient>
      </defs>

      {/* antena */}
      <path d="M24 11V7" stroke="#8a79f0" strokeWidth="2.4" strokeLinecap="round" />
      <motion.circle
        cx="24" cy="5" r="2.8" fill="#3fc49b"
        animate={mueve ? { opacity: [1, 0.35, 1], scale: [1, 1.18, 1] } : undefined}
        transition={mueve ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
        style={{ transformOrigin: '24px 5px' }}
      />

      {/* orejas */}
      <rect x="3.5" y="20.5" width="4" height="9" rx="2" fill="#c3cff7" />
      <rect x="40.5" y="20.5" width="4" height="9" rx="2" fill="#c3cff7" />

      {/* cabeza */}
      <rect x="7.5" y="11" width="33" height="27" rx="10.5" fill="url(#robotCara)" />

      {/* ojos, con parpadeo */}
      <motion.g
        animate={mueve ? { scaleY: [1, 1, 0.12, 1] } : undefined}
        transition={mueve ? { duration: 4.2, times: [0, 0.82, 0.88, 0.94], repeat: Infinity, ease: 'easeInOut' } : undefined}
        style={{ transformOrigin: '24px 23px' }}
      >
        <circle cx="17.5" cy="23" r="3.1" fill="#ffffff" />
        <circle cx="30.5" cy="23" r="3.1" fill="#ffffff" />
      </motion.g>

      {/* sonrisa */}
      <path d="M19 30.5c1.6 1.9 3.1 2.8 5 2.8s3.4-.9 5-2.8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
};
