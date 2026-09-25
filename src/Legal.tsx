// Términos y condiciones + aviso de privacidad de FotoFarma.
//
// Redactados para el marco mexicano: Ley Federal de Protección de Datos Personales en Posesión
// de los Particulares (los datos de salud son "sensibles" y necesitan consentimiento expreso),
// Ley Federal de Protección al Consumidor y el criterio de COFEPRIS sobre software que NO es
// dispositivo médico (no diagnostica, no dosifica: solo organiza lo que ya recetó un profesional).
//
// Si cambian de forma importante, sube TERMINOS_VERSION: la app volverá a pedir la aceptación.

import { useState, type ReactNode } from 'react';
import { ShieldCheck, Check } from 'lucide-react';

export const TERMINOS_VERSION = '1.1';
export const TERMINOS_FECHA = '25 de septiembre de 2026';

// TODO (para el responsable del proyecto): sustituir por la razón social, el domicilio fiscal
// y el correo de contacto reales antes de cualquier uso comercial o presentación formal.
export const RESPONSABLE = 'FotoFarma (proyecto desarrollado en México)';
export const CONTACTO = 'https://github.com/StrattPllaner/Fotofarma2/issues';

const H = ({ children }: { children: ReactNode }) => (
  <h4 className="mt-6 mb-1.5 text-[0.95rem] font-semibold text-ink">{children}</h4>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="mb-2.5 text-sm leading-relaxed text-muted">{children}</p>
);

const L = ({ children }: { children: ReactNode }) => (
  <li className="mb-1.5 text-sm leading-relaxed text-muted marker:text-faint">{children}</li>
);

/** El texto completo. Se usa en la puerta de entrada y en Perfil. */
export const TextoLegal = () => (
  <div>
    <div className="rounded-2xl bg-sun-soft p-4 text-sm leading-relaxed text-ink">
      <b>Lo más importante en tres líneas:</b> FotoFarma te ayuda a organizar los medicamentos que
      ya te recetó un profesional de la salud. <b>No es un dispositivo médico</b>, no diagnostica y
      puede equivocarse al leer una receta: siempre revisa lo que la app entendió. Tus datos se
      guardan en este dispositivo, no en un servidor nuestro.
    </div>

    <p className="mt-5 text-xs uppercase tracking-[0.12em] text-faint">
      Versión {TERMINOS_VERSION} · {TERMINOS_FECHA}
    </p>

    <h3 className="mt-4 text-lg font-semibold text-ink">Términos y condiciones de uso</h3>

    <H>1. Quién ofrece la app</H>
    <P>
      FotoFarma es una aplicación desarrollada y operada por {RESPONSABLE} (en adelante,
      «nosotros»). Para cualquier duda, queja o solicitud relacionada con estos términos o con tus
      datos, puedes escribirnos por el canal de contacto publicado en el repositorio del proyecto:
      <span className="break-all"> {CONTACTO}</span>.
    </P>

    <H>2. Qué es FotoFarma y qué no es</H>
    <P>
      FotoFarma es una <b>herramienta de apoyo para la adherencia al tratamiento</b>: toma la foto
      de una receta, extrae los medicamentos con ayuda de inteligencia artificial, arma un
      calendario de tomas, te recuerda cada una y te muestra farmacias cercanas.
    </P>
    <ul className="mb-2.5 list-disc pl-5">
      <L><b>No es un dispositivo médico</b> ni pretende serlo.</L>
      <L>No diagnostica enfermedades, no prescribe ni ajusta dosis, y no sustituye la consulta con
        tu médico, tu farmacéutico ni con cualquier otro profesional de la salud.</L>
      <L>No es un servicio de urgencias. <b>Ante una emergencia médica llama al 911</b> o acude al
        servicio de urgencias más cercano.</L>
      <L>No vende medicamentos, no los aparta y no cobra comisión por ninguna compra.</L>
    </ul>

    <H>3. Aceptación y edad mínima</H>
    <P>
      Para usar FotoFarma tienes que aceptar estos términos y el aviso de privacidad. Si no estás de
      acuerdo, no uses la aplicación. La app está pensada para personas <b>mayores de 18 años</b>;
      si eres menor de edad, solo puedes usarla con el acompañamiento y el consentimiento de tu
      madre, padre o tutor, quien será responsable del uso que hagas de ella.
    </P>

    <H>4. Inteligencia artificial y revisión obligatoria</H>
    <P>
      La lectura de la receta la hace un modelo de inteligencia artificial de un tercero. Esa lectura
      <b> puede contener errores</b>: confundir un nombre parecido, una dosis, una frecuencia o pasar
      por alto un medicamento. Por eso:
    </P>
    <ul className="mb-2.5 list-disc pl-5">
      <L>La app <b>siempre</b> te muestra lo que entendió antes de guardar nada.</L>
      <L>Eres tú quien revisa, corrige y confirma cada medicamento, cada dosis y cada horario contra
        lo que indicó el profesional de la salud.</L>
      <L>La revisión de interacciones entre medicamentos busca casos conocidos, es orientativa y
        <b> no cubre todas las interacciones posibles</b>.</L>
      <L>El <b>asistente de medicamentos</b> da información general y orientativa: no diagnostica, no
        indica dosis personalizadas y no sustituye a tu médico ni a tu farmacéutico. Ante una
        emergencia, llama al 911.</L>
    </ul>

    <H>5. Tu responsabilidad al usarla</H>
    <ul className="mb-2.5 list-disc pl-5">
      <L>Capturar información veraz y verificarla antes de guardarla.</L>
      <L>Seguir siempre las indicaciones de tu profesional de la salud por encima de lo que muestre
        la app, y consultarlo ante cualquier diferencia o duda.</L>
      <L>No usar la app con fines distintos de los previstos ni de forma que infrinja la ley.</L>
      <L>Si registras el tratamiento de otra persona (por ejemplo, como cuidador), contar con su
        consentimiento o con la representación legal para hacerlo.</L>
    </ul>

    <H>6. Dónde se guardan tus datos y qué implica</H>
    <P>
      FotoFarma no tiene servidores propios ni cuentas de usuario: tus recetas, tomas, hábitos y
      ajustes se guardan <b>únicamente en el almacenamiento de este dispositivo</b>. En consecuencia:
    </P>
    <ul className="mb-2.5 list-disc pl-5">
      <L>Si borras los datos del navegador, desinstalas la app o cambias de dispositivo,
        <b> la información se pierde y no puede recuperarse</b>.</L>
      <L>No podemos restaurar tu información, porque nunca la tuvimos.</L>
      <L>Mientras no exista una función de respaldo, el resguardo de tus datos depende de ti.</L>
    </ul>

    <H>7. Farmacias, precios y mapas</H>
    <P>
      La ubicación de las farmacias proviene de OpenStreetMap y los precios y existencias, cuando se
      muestran, provienen de los catálogos públicos en línea de cada cadena. Esa información es de
      terceros, <b>es meramente informativa y puede estar desactualizada o ser incorrecta</b>. Te
      sugerimos llamar a la farmacia antes de trasladarte. No garantizamos disponibilidad, precio ni
      horario, y no participamos en la compra.
    </P>

    <H>8. Servicios de terceros</H>
    <P>
      Para funcionar, la app usa servicios de terceros: el modelo de inteligencia artificial que lee
      la receta, el mapa abierto de farmacias, el servicio de rutas para «cómo llegar» y las
      tipografías del sitio. Esos servicios tienen sus propios términos y políticas de privacidad, y
      no somos responsables de su funcionamiento ni de sus interrupciones.
    </P>

    <H>9. Costo</H>
    <P>
      El uso de FotoFarma es <b>gratuito</b>. Si en el futuro se ofrecen funciones de pago, se
      informará su precio, características y forma de contratación <b>antes</b> de cualquier cobro,
      conforme a la Ley Federal de Protección al Consumidor. Las funciones que hoy son gratuitas no
      se volverán de pago de forma retroactiva.
    </P>

    <H>10. Propiedad intelectual</H>
    <P>
      El nombre, el logotipo y el diseño de FotoFarma nos pertenecen. El código de la aplicación es
      público y puede consultarse en su repositorio, bajo la licencia que ahí se indique. El
      contenido que tú capturas —tus recetas y tus datos— es tuyo y se queda en tu dispositivo.
    </P>

    <H>11. La app se ofrece «tal cual»</H>
    <P>
      Hacemos nuestro mejor esfuerzo para que funcione bien, pero la app se ofrece <b>tal cual</b>,
      sin garantía de que esté disponible de forma continua, libre de errores o compatible con todos
      los dispositivos. Los recordatorios dependen del sistema operativo y de la configuración de tu
      teléfono: pueden retrasarse o no mostrarse si el dispositivo está apagado, sin batería, en
      modo de ahorro de energía o si no otorgaste el permiso de notificaciones.
    </P>

    <H>12. Límite de responsabilidad</H>
    <P>
      En la medida en que la ley lo permita, no somos responsables por daños derivados del uso o de
      la imposibilidad de usar la app, incluyendo decisiones de salud tomadas con base en ella,
      tomas omitidas o duplicadas, errores en la lectura de una receta, pérdida de datos o
      información incorrecta de farmacias. <b>Esta limitación no aplica</b> en los casos en que la
      legislación mexicana no permite excluir responsabilidad.
    </P>

    <H>13. Cómo dejar de usarla</H>
    <P>
      Puedes dejar de usar la app en cualquier momento. En «Perfil → Borrar mis datos» eliminas
      recetas, tomas y hábitos de este dispositivo; al desinstalarla o borrar los datos del
      navegador, no queda rastro de tu información.
    </P>

    <H>14. Cambios a estos términos</H>
    <P>
      Podemos actualizar estos términos. Cuando el cambio sea relevante, la app te pedirá aceptar la
      nueva versión antes de seguir usándola. La versión vigente y su fecha aparecen siempre al
      inicio de este documento.
    </P>

    <H>15. Ley aplicable</H>
    <P>
      Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier
      controversia relacionada con el consumo, el consumidor puede acudir a la Procuraduría Federal
      del Consumidor (PROFECO); en lo demás, las partes se someten a los tribunales competentes de
      la Ciudad de México, sin perjuicio del derecho del consumidor a acudir a los de su domicilio.
    </P>

    <h3 className="mt-8 border-t border-line pt-6 text-lg font-semibold text-ink">Aviso de privacidad</h3>

    <H>Responsable</H>
    <P>
      {RESPONSABLE} es responsable del tratamiento de los datos personales que, en su caso, llegue a
      tratar a través de esta aplicación. Canal de contacto:
      <span className="break-all"> {CONTACTO}</span>.
    </P>

    <H>Qué datos se tratan y dónde viven</H>
    <ul className="mb-2.5 list-disc pl-5">
      <L><b>Datos de salud (sensibles):</b> la fotografía de tu receta, los medicamentos, dosis,
        frecuencias, horarios y el registro de tomas y hábitos.</L>
      <L><b>Datos de identificación opcionales:</b> el nombre y la edad que tú decidas escribir.</L>
      <L><b>Ubicación aproximada:</b> solo en el momento en que tocas «buscar farmacias cercanas» o «buscar hospitales cercanos».</L>
      <L><b>Lo que escribes en el asistente de medicamentos</b> y los nombres de tus medicamentos guardados, únicamente mientras dura esa consulta.</L>
      <L>Todos estos datos se guardan <b>en el almacenamiento de tu propio dispositivo</b>. No los
        recibimos, no los alojamos en un servidor nuestro y no podemos consultarlos.</L>
    </ul>

    <H>Para qué se usan</H>
    <P>
      Finalidades primarias, es decir, las necesarias para que la app funcione: leer tu receta, armar
      tu calendario de tomas, recordarte cada toma, llevar tus hábitos y mostrarte farmacias
      cercanas. <b>No hay finalidades secundarias</b>: no se usan para mercadotecnia, publicidad,
      perfilamiento ni se ceden o venden a terceros.
    </P>

    <H>Transferencias y encargados</H>
    <P>
      Para leer la receta, la <b>imagen que tomas se envía al proveedor del modelo de inteligencia
      artificial</b> (Google, a través de su interfaz de programación), únicamente durante esa
      consulta y con la finalidad de extraer los datos del medicamento. Ese envío se rige además por
      las políticas de dicho proveedor.
    </P>
    <P>
      Si usas el <b>asistente de medicamentos</b>, tu pregunta y los nombres, dosis y horarios de los
      medicamentos que tienes guardados se envían al mismo proveedor para generar la respuesta.
      <b>Las conversaciones no se guardan</b>: no se almacenan en tu dispositivo, no se guardan en
      ningún servidor nuestro y no quedan en registros. Al cerrar la ventana, desaparecen.
    </P>
    <P>
      La búsqueda de farmacias y hospitales envía tus coordenadas aproximadas al servicio de mapas
      abierto para obtener los resultados. Fuera de esos casos, tus datos no salen del dispositivo.
    </P>

    <H>Consentimiento expreso para datos sensibles</H>
    <P>
      Los datos de salud son sensibles conforme a la ley mexicana y su tratamiento requiere tu
      consentimiento expreso. Por eso, antes de usar la app, te pedimos marcar de forma separada que
      consientes que la fotografía de tu receta se envíe al proveedor de inteligencia artificial para
      leerla. <b>Puedes usar el resto de la app sin esa función</b>, capturando tus medicamentos a mano.
    </P>

    <H>Cómo limitar el uso de tus datos</H>
    <ul className="mb-2.5 list-disc pl-5">
      <L>No otorgar —o retirar desde el sistema— los permisos de cámara, ubicación o notificaciones.</L>
      <L>Capturar tus medicamentos a mano, sin escanear la receta.</L>
      <L>Borrar tus datos desde «Perfil → Borrar mis datos».</L>
    </ul>

    <H>Tus derechos ARCO</H>
    <P>
      Tienes derecho a <b>acceder</b> a tus datos, <b>rectificarlos</b>, <b>cancelarlos</b> y a
      <b> oponerte</b> a su tratamiento. Como la información vive en tu dispositivo, ejerces esos
      derechos directamente dentro de la app: acceder y rectificar desde el calendario y el perfil, y
      cancelar con «Borrar mis datos». Si tienes dudas o quieres presentar una solicitud formal,
      escríbenos al canal de contacto; responderemos en los plazos que marca la ley. También puedes
      acudir al Instituto u organismo garante que corresponda conforme a la legislación vigente.
    </P>

    <H>Revocación del consentimiento</H>
    <P>
      Puedes revocar tu consentimiento en cualquier momento dejando de usar la función de escaneo y
      borrando tus datos desde el perfil. La revocación no afecta lecturas que ya se hayan realizado.
    </P>

    <H>Rastreo</H>
    <P>
      La app <b>no usa</b> cookies de publicidad, analítica, identificadores de rastreo ni
      herramientas de medición de terceros.
    </P>

    <H>Cambios al aviso</H>
    <P>
      Cualquier cambio a este aviso se publicará dentro de la app y en el sitio del proyecto, con su
      versión y fecha. Si el cambio es relevante, se te pedirá aceptarlo de nuevo.
    </P>
  </div>
);

/** Si no diste consentimiento para mandar la receta a la IA, se pide aquí antes de escanear. */
export const ConsentimientoIA = ({ onAceptar, onCancelar }: { onAceptar: () => void; onCancelar: () => void; key?: string }) => (
  <div className="fixed inset-0 z-[140] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm md:items-center md:p-6">
    <div className="w-full max-w-md rounded-t-[32px] bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[32px] md:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-2xl font-semibold text-ink">Necesitamos tu permiso</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Para leer tu receta, la foto se envía al proveedor de inteligencia artificial. Es un dato de
        salud y la ley pide tu <b>consentimiento expreso</b> para tratarlo. La foto se usa solo para
        esa lectura y no se guarda fuera de tu dispositivo.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Si prefieres no hacerlo, puedes seguir usando la app capturando tus medicamentos a mano.
      </p>
      <div className="mt-6 space-y-3">
        <button onClick={onAceptar} className="w-full rounded-2xl bg-brand py-4 font-semibold text-white hover:bg-brand-strong">
          Acepto, leer mi receta
        </button>
        <button onClick={onCancelar} className="w-full rounded-2xl py-3 text-sm font-semibold text-muted hover:text-ink">
          Mejor la capturo a mano
        </button>
      </div>
    </div>
  </div>
);

/** Puerta de entrada: sin aceptar, la app no se usa. */
export const PuertaTerminos = ({ onAceptar }: { onAceptar: (consienteIA: boolean) => void; key?: string }) => {
  const [terminos, setTerminos] = useState(false);
  const [salud, setSalud] = useState(false);

  const Casilla = ({ valor, alCambiar, children }: { valor: boolean; alCambiar: (v: boolean) => void; children: ReactNode }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-canvas p-4 text-left">
      <span
        role="checkbox"
        aria-checked={valor}
        tabIndex={0}
        onClick={() => alCambiar(!valor)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alCambiar(!valor); } }}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${valor ? 'border-brand bg-brand text-white' : 'border-line bg-card text-transparent'}`}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <span className="text-sm leading-relaxed text-ink">{children}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-canvas">
      <div className="flex items-center gap-3 border-b border-line bg-card px-[clamp(16px,4vw,40px)] py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">Antes de empezar</p>
          <p className="text-sm text-muted">Lee y acepta los términos y el aviso de privacidad</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-[clamp(16px,4vw,40px)] py-6">
          <TextoLegal />
        </div>
      </div>

      <div className="border-t border-line bg-card px-[clamp(16px,4vw,40px)] py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl space-y-3">
          <Casilla valor={terminos} alCambiar={setTerminos}>
            He leído y <b>acepto los términos y condiciones</b> y el aviso de privacidad. Entiendo que
            FotoFarma es una herramienta de apoyo y que <b>no sustituye a un profesional de la salud</b>.
          </Casilla>
          <Casilla valor={salud} alCambiar={setSalud}>
            <b>Consiento</b> que la foto de mi receta se envíe al proveedor de inteligencia artificial
            para leerla (dato de salud, sensible). Si no lo aceptas, puedes usar la app capturando tus
            medicamentos a mano.
          </Casilla>
          <button
            onClick={() => onAceptar(salud)}
            disabled={!terminos}
            className="w-full rounded-2xl bg-brand py-4 font-semibold text-white shadow-[0_16px_30px_-16px_rgb(62_102_214/0.9)] transition-opacity hover:bg-brand-strong disabled:opacity-40"
          >
            Aceptar y entrar
          </button>
          <p className="text-center text-xs text-muted">
            Sin aceptar los términos no es posible usar la aplicación.
          </p>
        </div>
      </div>
    </div>
  );
};
