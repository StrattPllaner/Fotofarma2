// Ajustes del Asistente de Medicamentos (lado del navegador).
//
// Aquí NO hay ninguna llave: la llave de Gemini vive como secreto del Cloudflare Worker.
// Lo único que sabe la app es la dirección del Worker, que es pública.
//
// El prompt de sistema del chatbot está en proxy/chat-prompt.js, del lado del servidor.

// ⬇️ PEGA AQUÍ la dirección del worker después de desplegarlo (ver proxy/README.md).
// No es un secreto: es una URL pública. Ejemplo:
//   export const URL_INTERMEDIARIO = 'https://fotofarma-proxy.tucuenta.workers.dev';
// Mientras esté vacía, el asistente no aparece en la app y las recetas se leen como antes.
export const URL_INTERMEDIARIO = '';

/** Dirección del intermediario: la constante de arriba o, si se prefiere, la variable VITE_IA_URL. */
export const IA_URL = (URL_INTERMEDIARIO || import.meta.env.VITE_IA_URL || import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');

export const CHAT_URL = `${IA_URL}/chat`;

/** Si no se configuró el Worker, el asistente no se muestra. */
export const CHAT_DISPONIBLE = CHAT_URL.length > '/chat'.length;

export const LIMITES_CHAT = {
  caracteresPorMensaje: 500,   // lo que se puede escribir de una vez
  mensajesDeHistorial: 12,     // lo que se manda al modelo (controla el costo)
  preguntasPorHora: 20,        // tope local, para no gastar cuota sin darse cuenta
};

/** Aviso permanente, visible en la ventana del chat. */
export const AVISO_CHAT =
  'Información orientativa. No sustituye a tu médico ni a tu farmacéutico.';

/** Mensajes de error en cristiano; la clave la manda el Worker. */
export const ERRORES_CHAT: Record<string, string> = {
  sin_conexion: 'No tienes internet. El asistente necesita conexión para responder; tus tomas y tus hábitos sí funcionan sin ella.',
  sin_llave: 'El asistente todavía no está configurado. Avísale a quien cuida la app.',
  demasiadas: 'Has preguntado muchas veces seguidas. Espera unos minutos y vuelve a intentarlo.',
  cuota: 'El asistente está saturado en este momento. Intenta de nuevo en un rato.',
  muy_largo: 'Ese mensaje es muy largo. Intenta preguntarlo más corto.',
  proveedor: 'No pudimos obtener la respuesta. Revisa tu conexión e intenta otra vez.',
  formato: 'Algo salió mal al enviar tu pregunta. Intenta de nuevo.',
  general: 'No pudimos obtener la respuesta. Intenta de nuevo en un momento.',
};

/** Preguntas de arranque. Si hay medicamentos guardados, se personaliza la primera. */
export const sugerenciasChat = (medicamentos: string[]): string[] => {
  const uno = medicamentos[0];
  return [
    uno ? `¿Cómo debo tomar ${uno}?` : '¿Cómo debo tomar el ibuprofeno?',
    uno ? `¿Qué efectos secundarios tiene ${uno}?` : '¿Qué efectos secundarios tiene el paracetamol?',
    '¿Qué hago si se me pasó una toma?',
    '¿Puedo tomar mis medicinas con leche?',
  ];
};
