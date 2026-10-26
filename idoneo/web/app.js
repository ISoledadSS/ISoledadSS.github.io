// IDóneo, versión web de prueba. La página: elegir el documento, tomar o elegir la foto, revisarla y armar el PDF.
// El motor (motor.js) es el de la aplicación de Android compilado a JavaScript; todo corre aquí, en el navegador.

import * as motor from './motor.js';

const VERSION = '0.1.2';

// Los lados de cada documento, como en la aplicación (lado_anverso, lado_reverso, lado_datos, lado_libreta).
const LADOS = {
  ID1: [
    { nombre: 'Anverso', frase: 'el anverso', indicacion: 'Coloca la credencial sobre una superficie lisa, mate y más oscura que ella. Toma la foto de frente, con el teléfono paralelo a la mesa y cerca, dejando ver un poco de mesa alrededor de las cuatro esquinas.' },
    { nombre: 'Reverso', frase: 'el reverso', indicacion: 'Ahora voltea la credencial y déjala en el mismo lugar. Toma la foto igual que la del anverso.' },
  ],
  ID3: [
    { nombre: 'Página de datos', frase: 'la página de datos', indicacion: 'Abre el pasaporte en la página de datos y colócalo sobre una superficie lisa, mate y más oscura. Toma la foto de frente a la página de datos, con el teléfono paralelo a la mesa, dejando ver un poco de mesa alrededor de sus cuatro esquinas.' },
  ],
  ID3_ABIERTA: [
    { nombre: 'Pasaporte abierto', frase: 'el pasaporte abierto', indicacion: 'Abre el pasaporte en la página de datos y colócalo sobre una superficie lisa, mate y más oscura. Toma la foto de las dos páginas de frente, con el teléfono paralelo a la mesa, dejando ver un poco de mesa alrededor de las cuatro esquinas.' },
  ],
};

// Lo más grande que se le pasa al motor: los navegadores de iPhone no dibujan lienzos de más de 16.7 megapixeles, y el
// motor no necesita más de 12 (rectifica a lo más 9.5). Una foto de 24 o 48 megapixeles se reduce a esto.
const MAX_PIXELES = 12.6e6;
// Renglones que se leen del lienzo a la vez: así la foto no se copia entera una vez más antes de llegar al motor.
const RENGLONES_POR_FRANJA = 256;
// Diagonal del cuadro de 35 mm: la referencia de la distancia focal equivalente (Optica.java).
const DIAGONAL_35MM = 43.27;
const CALIDAD_JPEG = 0.92;
const NOMBRE_POR_OMISION = 'identificacion';
// Una imagen de 8 x 8 conocida: si al leerla del lienzo no da lo que es, el navegador altera lo que la página lee de las
// fotos (lo hace Safari con su protección contra el rastreo). Se avisa, porque el motor mide esos pixeles.
const MUESTRA_LECTURA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAA00lEQVR42gHIADf/A6VNysb/y68LVbYeqM0NDMPI4SgGEKzgYgEXRJS/BajHE/jDYv3AYDjevDfwDhmrl6MAfCmZ/a/lkyU81lSvTfrXFCegrrP+6SMvAg7JiCLv//6gdTWYBglBJQpI85TLzd/b+gLL86xvqPj9Dwa3ipjUH1FYCHO237vIBCEA1r2jQBvpyMvMyTX2zR9hImrhUziuGjQAAE0zug0kasBMgbG68j47+e71958rSTSvhwH1Ugt0Z0Ck3+N4Iycxt1O88dJbEewvQqiEtWP5vJnBWAAAAABJRU5ErkJggg==';
const SUMA_LECTURA = 2992089;

// La cámara del sistema (la casilla con capture) abre otra aplicación. En Chrome para Android, si al teléfono le falta
// memoria mientras está abierta, Android cierra Chrome y la foto no llega a la página («Memoria insuficiente para
// completar la operación anterior»). Donde el navegador da foto fija dentro de la página (ImageCapture), la foto se toma
// aquí mismo y el navegador no deja el frente. Safari no la da: ahí sigue la cámara del sistema.
const CAMARA_EN_PAGINA = typeof window.ImageCapture === 'function'
  && !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
  && window.matchMedia('(pointer: coarse)').matches;
// El ancho de la foto fija que se pide: en 4:3 son 12.6 megapixeles, lo que el motor usa sin reducir.
const ANCHO_FOTO = 4096;
// El marco de la cámara tiene la proporción del documento (el pasaporte abierto, de pie).
const PROPORCION = { ID1: 85.6 / 53.98, ID3: 125 / 88, ID3_ABIERTA: 125 / 176 };
const INDICACION_MARCO = {
  ID1: 'Pon la credencial dentro del marco, con un poco de mesa alrededor y el teléfono paralelo a la mesa.',
  ID3: 'Pon la página de datos dentro del marco, con un poco de mesa alrededor y el teléfono paralelo a la mesa.',
  ID3_ABIERTA: 'Pon las dos páginas dentro del marco, con un poco de mesa alrededor y el teléfono paralelo a la mesa.',
};
// Mientras la cámara del sistema está abierta, la pestaña guarda sólo la hora en que se abrió: si la página se vuelve a
// cargar con eso puesto, el teléfono la cerró mientras tanto, y se avisa en el inicio.
const CLAVE_CAMARA = 'idoneo-camara';
const MINUTOS_AVISO_RECARGA = 15;
// Lo que se espera, al volver de la cámara del sistema, a que llegue la foto o el aviso de que se canceló.
const ESPERA_FOTO_MS = 4000;

const camara = { flujo: null, captura: null, intento: 0 };

const estado = {
  formato: null,
  lado: 0,
  revision: null,      // la revisión que se muestra (JSON del motor)
  conservar: false,
  girado: false,
  escala: 1,
  sinCumplir: [],      // los lados usados sin cumplir, como van en una oración
  ultimo: null,        // lo último que dijo el motor de una toma de este lado que no quedó conforme
  hayRechazada: false, // el motor guarda una toma de este lado que se puede usar así
  rechazadaDeSerie: false,
  serieAbierta: false,
  tomas: 0,
  maxTomas: 4,
  segundos: 0,
  imagenes: [],        // las imágenes de los lados aceptados, para dibujar la hoja
  urls: new Set(),     // direcciones de los archivos descargados, que se revocan al terminar
  mostradoEn: 0,       // cuándo se mostró la pantalla actual: los toques de antes no cuentan
  lecturaAlterada: false,
  camaraEnPagina: CAMARA_EN_PAGINA, // se apaga si la cámara de la página no abre: la siguiente vez, la del sistema
  camaraSistema: 0,    // cuándo se abrió la cámara del sistema, mientras no llega la foto ni se cancela
  avisoCamara: '',     // lo que se dice de la cámara en la pantalla del lado
};

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ pantallas

function ir(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.hidden = s.id !== id;
  const oscura = id === 'revision' || id === 'camara';
  document.body.classList.toggle('oscuro', oscura);
  document.querySelector('meta[name="theme-color"]').content = oscura ? '#000000' : '#FFFFFF';
  // Un toque hecho mientras el motor trabajaba queda en espera y llega después a lo que esté en ese lugar de la pantalla
  // nueva: hasta que se pinte, la pantalla no recibe toques, y los que se hicieron antes de mostrarla no cuentan.
  estado.mostradoEn = performance.now();
  const seccion = $(id);
  seccion.classList.add('entrando');
  requestAnimationFrame(() => requestAnimationFrame(() => seccion.classList.remove('entrando')));
  window.scrollTo(0, 0);
  const titulo = seccion.querySelector('h1');
  if (titulo) titulo.focus({ preventScroll: true });
  if (id !== 'inicio' && !(history.state && history.state.idoneo)) history.pushState({ idoneo: true }, '');
}

// deja que el navegador pinte antes de un trabajo largo en el hilo de la página
function pintar() {
  return new Promise((listo) => requestAnimationFrame(() => setTimeout(listo, 30)));
}

function tiempoDelEvento(e) {
  // en algunos navegadores viejos timeStamp viene en milisegundos desde 1970
  return e.timeStamp > 1e12 ? e.timeStamp - (Date.now() - performance.now()) : e.timeStamp;
}

function capturando() {
  return estado.formato !== null && (estado.lado > 0 || estado.revision !== null || estado.ultimo !== null || estado.hayRechazada);
}

// ------------------------------------------------------------------ inicio

function limpiarPantallas() {
  $('nombre-archivo').value = NOMBRE_POR_OMISION;
  $('revision-tabla').replaceChildren();
  $('revision-aviso').textContent = '';
  $('revision-titulo').textContent = '';
  $('lado-estado').replaceChildren();
  $('resultado-sin-cumplir').textContent = '';
  $('resultado-error').textContent = '';
  vaciarLienzo($('revision-imagen'));
  vaciarLienzo($('franja-imagen'));
  vaciarLienzo($('hoja'));
  soltarImagenes();
  for (const u of estado.urls) URL.revokeObjectURL(u);
  estado.urls.clear();
}

function reiniciarEstado(formato) {
  estado.formato = formato;
  estado.avisoCamara = '';
  estado.lado = 0;
  estado.revision = null;
  estado.sinCumplir = [];
  estado.ultimo = null;
  estado.hayRechazada = false;
  estado.rechazadaDeSerie = false;
  estado.serieAbierta = false;
  estado.tomas = 0;
}

function empezar(formato) {
  motor.empezar(formato);
  limpiarPantallas();
  reiniciarEstado(formato);
  $('aviso-recarga').hidden = true;
  mostrarLado();
}

function alInicio() {
  motor.terminar();
  limpiarPantallas();
  reiniciarEstado(null);
  ir('inicio');
}

// ------------------------------------------------------------------ un lado

function mostrarLado() {
  const lados = LADOS[estado.formato];
  const lado = lados[estado.lado];
  $('lado-titulo').textContent = lado.nombre;
  const paso = estado.serieAbierta ? `Toma ${estado.tomas + 1} de ${estado.maxTomas}`
    : lados.length > 1 ? `Paso ${estado.lado + 1} de ${lados.length}` : '';
  $('lado-paso').textContent = paso;
  $('lado-paso').hidden = paso === '';
  $('lado-indicacion').textContent = lado.indicacion;
  ponerEstado(estado.ultimo);
  $('ver-toma').hidden = !estado.hayRechazada;
  $('ver-toma').textContent = estado.rechazadaDeSerie ? 'Ver lo mejor que tenía la serie' : 'Ver la toma que no pasó';
  $('reiniciar-lado').hidden = !(estado.serieAbierta || estado.hayRechazada);
  $('aviso-lectura').hidden = !estado.lecturaAlterada;
  $('aviso-camara').textContent = estado.avisoCamara;
  $('aviso-camara').hidden = !estado.avisoCamara;
  ir('lado');
}

// Lo que el motor dijo de la última toma de este lado, si no quedó conforme.
function ponerEstado(r) {
  const caja = $('lado-estado');
  caja.replaceChildren();
  caja.classList.remove('mal');
  if (!r) return;
  const titulo = document.createElement('h2');
  const texto = document.createElement('p');
  if (r.paso === 'FALTA_OTRA') {
    titulo.textContent = 'Falta otra foto';
    // el motor lo dice pensando en la cámara de la aplicación, que toma sola la siguiente; aquí la toma quien captura
    if (r.mensaje === 'Hay un reflejo. Se hará otra toma para eliminarlo.') {
      texto.textContent = 'Hay un reflejo sobre la identificación. Para quitarlo, toma otra foto a la misma distancia, con el teléfono unos centímetros más a un lado o más adelante y sin inclinarlo: se combinan las fotos.';
    } else {
      texto.textContent = `${r.mensaje} Después toma otra foto.`;
    }
  } else {
    caja.classList.add('mal');
    titulo.textContent = 'La foto no pasó';
    texto.textContent = r.paso === 'AGOTADA' ? `${r.mensaje} Este lado se empieza de nuevo.` : r.mensaje;
  }
  caja.append(titulo, texto);
  if (estado.segundos > 0) {
    const tiempo = document.createElement('p');
    tiempo.className = 'tiempo';
    tiempo.textContent = `Revisada en ${estado.segundos.toFixed(1)} s.`;
    caja.append(tiempo);
  }
}

async function alElegirFoto(entrada) {
  const archivo = entrada.files && entrada.files[0];
  entrada.value = '';
  desmarcarCamara();
  if (!archivo) return;
  await procesarFoto(archivo);
}

// La foto, de un archivo o de la cámara de la página, al motor.
async function procesarFoto(archivo) {
  estado.avisoCamara = '';
  ir('procesando');
  await pintar();
  let focal;
  try {
    focal = await decodificarEnElMotor(archivo);
  } catch (e) {
    console.error(e);
    estado.ultimo = { paso: 'DESCARTADA', mensaje: 'No se pudo abrir esa foto. Tómala de nuevo o elige otra en formato JPEG.' };
    estado.segundos = 0;
    mostrarLado();
    return;
  }
  let r;
  const t0 = performance.now();
  try {
    r = JSON.parse(motor.procesar(focal));
  } catch (e) {
    console.error(e);
    estado.ultimo = { paso: 'DESCARTADA', mensaje: 'No se pudo procesar la foto. Si es muy grande, prueba con otra tomada con la cámara del teléfono.' };
    estado.segundos = 0;
    mostrarLado();
    return;
  }
  estado.segundos = (performance.now() - t0) / 1000;
  estado.hayRechazada = r.hayRechazada;
  estado.rechazadaDeSerie = r.rechazadaDeSerie;
  estado.serieAbierta = r.abierta;
  estado.tomas = r.tomas;
  estado.maxTomas = r.maxTomas;
  if (r.paso === 'CONFORME') {
    estado.ultimo = null;
    await mostrarRevision(r.revision);
  } else {
    estado.ultimo = r;
    mostrarLado();
  }
}

function empezarLadoDeNuevo() {
  motor.empezarLado();
  estado.ultimo = null;
  estado.hayRechazada = false;
  estado.rechazadaDeSerie = false;
  estado.serieAbierta = false;
  estado.tomas = 0;
  mostrarLado();
}

// ------------------------------------------------------------------ la cámara

// «Tomar foto»: donde se puede, la cámara de la página; si no, la del sistema (la casilla sigue su curso).
function alTomarFoto(e) {
  if (estado.camaraEnPagina) {
    e.preventDefault();
    abrirCamara();
    return;
  }
  marcarCamara();
}

function marcarCamara() {
  estado.camaraSistema = Date.now();
  try {
    sessionStorage.setItem(CLAVE_CAMARA, String(estado.camaraSistema));
  } catch (e) {
    // sin almacenamiento de la pestaña: sólo no habrá aviso si la página se recarga
  }
}

function desmarcarCamara() {
  estado.camaraSistema = 0;
  try {
    sessionStorage.removeItem(CLAVE_CAMARA);
  } catch (e) {
    // sin almacenamiento de la pestaña
  }
}

// Al volver de la cámara del sistema: si en unos segundos no llegó la foto ni el aviso de que se canceló, el teléfono
// cerró el navegador mientras estaba abierta, y la foto se perdió.
function alVolverDeLaCamara() {
  const marca = estado.camaraSistema;
  if (!marca) return;
  setTimeout(() => {
    if (estado.camaraSistema !== marca || $('lado').hidden) return;
    desmarcarCamara();
    estado.avisoCamara = 'Si tomaste la foto y no llegó a la página, el teléfono cerró el navegador mientras estaba abierta la cámara, casi siempre por falta de memoria. Toma la foto con la cámara del teléfono y súbela con «Elegir una foto guardada».';
    mostrarLado();
  }, ESPERA_FOTO_MS);
}

// El marco va sobre el video tal como se ve: el video se muestra entero (lo que se ve es lo que sale en la foto), así
// que el marco se mide contra lo que ocupa en la pantalla.
function ponerMarco() {
  const video = $('camara-video');
  const anchoPantalla = window.innerWidth;
  const altoPantalla = window.innerHeight;
  let anchoVideo = video.videoWidth;
  let altoVideo = video.videoHeight;
  if (!(anchoVideo > 0 && altoVideo > 0)) {
    // antes de que llegue el video, la pantalla
    anchoVideo = anchoPantalla;
    altoVideo = altoPantalla;
  }
  const k = Math.min(anchoPantalla / anchoVideo, altoPantalla / altoVideo);
  const proporcion = PROPORCION[estado.formato];
  let ancho = anchoVideo * k * 0.86;
  let alto = ancho / proporcion;
  const altoMaximo = Math.min(altoVideo * k * 0.86, altoPantalla * 0.52);
  if (alto > altoMaximo) {
    alto = altoMaximo;
    ancho = alto * proporcion;
  }
  const marco = $('camara-recuadro');
  marco.style.width = `${Math.round(ancho)}px`;
  marco.style.height = `${Math.round(alto)}px`;
}

async function abrirCamara() {
  const intento = ++camara.intento;
  estado.avisoCamara = '';
  $('camara-titulo').textContent = LADOS[estado.formato][estado.lado].nombre;
  $('camara-indicacion').textContent = INDICACION_MARCO[estado.formato];
  $('camara-estado').textContent = 'Abriendo la cámara…';
  $('camara-disparar').disabled = true;
  $('camara-cancelar').disabled = false;
  ir('camara');
  ponerMarco();
  let flujo;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
    });
  } catch (e) {
    console.error(e);
    if (intento !== camara.intento || $('camara').hidden) return;
    // la siguiente vez se usa la cámara del sistema
    estado.camaraEnPagina = false;
    salirDeLaCamara(e && e.name === 'NotAllowedError'
      ? 'No se dio permiso para usar la cámara en la página. La próxima vez «Tomar foto» abre la cámara del teléfono; también puedes darle el permiso al sitio en los ajustes del navegador.'
      : 'No se pudo abrir la cámara en la página. La próxima vez «Tomar foto» abre la cámara del teléfono.');
    return;
  }
  // si mientras se pedía el permiso se canceló o se salió de la pantalla, la cámara no se queda prendida
  if (intento !== camara.intento || $('camara').hidden) {
    detenerFlujo(flujo);
    return;
  }
  camara.flujo = flujo;
  const pista = flujo.getVideoTracks()[0];
  pista.addEventListener('ended', () => {
    if (camara.flujo === flujo) salirDeLaCamara('La cámara se cerró. Vuelve a tocar «Tomar foto».');
  });
  const video = $('camara-video');
  video.srcObject = flujo;
  try {
    await video.play();
  } catch (e) {
    console.error(e);
  }
  camara.captura = new ImageCapture(pista);
  $('camara-estado').textContent = '';
  $('camara-disparar').disabled = false;
}

function detenerFlujo(flujo) {
  if (flujo) for (const pista of flujo.getTracks()) pista.stop();
}

// Apaga la cámara: la pista se detiene (el teléfono deja de mostrar que la cámara está en uso) y el video se suelta.
function cerrarCamara() {
  camara.intento++;
  detenerFlujo(camara.flujo);
  camara.flujo = null;
  camara.captura = null;
  const video = $('camara-video');
  video.pause();
  video.srcObject = null;
}

function salirDeLaCamara(aviso) {
  cerrarCamara();
  estado.avisoCamara = aviso || '';
  mostrarLado();
}

async function disparar() {
  const captura = camara.captura;
  if (!captura) return;
  $('camara-disparar').disabled = true;
  $('camara-cancelar').disabled = true;
  $('camara-estado').textContent = 'Tomando la foto…';
  let foto = null;
  try {
    foto = await fotoFija(captura);
  } catch (e) {
    console.error(e);
    // sin foto fija, el cuadro del video, que tiene menos resolución
    try {
      foto = await cuadroDelVideo($('camara-video'));
    } catch (e2) {
      console.error(e2);
    }
  }
  if ($('camara').hidden) return; // se salió mientras se tomaba
  cerrarCamara();
  if (!foto) {
    estado.avisoCamara = 'No se pudo tomar la foto. Vuelve a intentarlo o súbela con «Elegir una foto guardada».';
    mostrarLado();
    return;
  }
  await procesarFoto(foto);
}

// La foto fija de la cámara, sin flash y de a lo más ANCHO_FOTO de ancho.
async function fotoFija(captura) {
  const ajustes = {};
  try {
    const puede = await captura.getPhotoCapabilities();
    if (Array.isArray(puede.fillLightMode) && puede.fillLightMode.includes('off')) ajustes.fillLightMode = 'off';
    if (puede.imageWidth && puede.imageWidth.max > 0) {
      ajustes.imageWidth = Math.max(puede.imageWidth.min || 0, Math.min(puede.imageWidth.max, ANCHO_FOTO));
    }
  } catch (e) {
    // sin las capacidades de la cámara: la foto que dé
  }
  return captura.takePhoto(ajustes);
}

async function cuadroDelVideo(video) {
  const lienzo = document.createElement('canvas');
  lienzo.width = video.videoWidth;
  lienzo.height = video.videoHeight;
  if (!(lienzo.width > 0 && lienzo.height > 0)) throw new Error('sin cuadro');
  try {
    lienzo.getContext('2d').drawImage(video, 0, 0);
    return await new Promise((listo, mal) =>
      lienzo.toBlob((b) => (b ? listo(b) : mal(new Error('sin JPEG'))), 'image/jpeg', 0.95));
  } finally {
    vaciarLienzo(lienzo);
  }
}

// ------------------------------------------------------------------ la foto

// Decodifica la foto como la ve el navegador (ya al derecho, según su orientación), la reduce si pasa de MAX_PIXELES y
// la deja en el arreglo del motor, por franjas, sin otra copia entera de por medio. Devuelve la distancia focal.
async function decodificarEnElMotor(archivo) {
  const cabeza = await archivo.slice(0, 256 * 1024).arrayBuffer();
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  try {
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!(w0 > 0 && h0 > 0)) throw new Error('imagen vacía');
    const k = Math.min(1, Math.sqrt(MAX_PIXELES / (w0 * h0)));
    const ancho = Math.max(1, Math.round(w0 * k));
    const alto = Math.max(1, Math.round(h0 * k));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    try {
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, ancho, alto);
      img.removeAttribute('src');
      const destino = motor.lienzo(ancho, alto);
      for (let y = 0; y < alto; y += RENGLONES_POR_FRANJA) {
        const filas = Math.min(RENGLONES_POR_FRANJA, alto - y);
        const datos = ctx.getImageData(0, y, ancho, filas).data;
        rgbaAArgb(datos, destino, y * ancho);
      }
    } finally {
      vaciarLienzo(lienzo);
    }
    return focalDeExif(cabeza, ancho, alto);
  } finally {
    img.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}

// RGBA del navegador a ARGB del motor, en el arreglo del motor desde la posición dada.
function rgbaAArgb(rgba, destino, desde) {
  const u = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength >>> 2);
  for (let i = 0; i < u.length; i++) {
    const v = u[i];
    destino[desde + i] = 0xFF000000 | ((v & 0xFF) << 16) | (v & 0xFF00) | ((v >>> 16) & 0xFF);
  }
}

// ARGB del motor a un lienzo.
function ponerArgb(lienzo, px, ancho, alto) {
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const img = ctx.createImageData(ancho, alto);
  const u = new Uint32Array(img.data.buffer);
  for (let i = 0; i < u.length; i++) {
    const a = px[i];
    u[i] = 0xFF000000 | ((a & 0xFF) << 16) | (a & 0xFF00) | ((a >>> 16) & 0xFF);
  }
  ctx.putImageData(img, 0, 0);
}

function vaciarLienzo(lienzo) {
  if (!lienzo) return;
  lienzo.width = 0;
  lienzo.height = 0;
}

// La distancia focal de la foto en pixeles, de la que anota la cámara en su EXIF como equivalente de 35 mm
// (FocalLengthIn35mmFilm). Sin ese dato, cero: el motor supone una típica de teléfono (0.75 del lado largo).
function focalDeExif(buf, ancho, alto) {
  try {
    const d = new DataView(buf);
    if (d.byteLength < 4 || d.getUint16(0) !== 0xFFD8) return 0;
    let p = 2;
    while (p + 4 <= d.byteLength) {
      if (d.getUint8(p) !== 0xFF) return 0;
      const marca = d.getUint8(p + 1);
      if (marca === 0xFF) {
        p++;            // relleno entre marcadores, que la norma permite
        continue;
      }
      if (marca === 0xDA || marca === 0xD9) return 0;
      const largo = d.getUint16(p + 2);
      if (largo < 2) return 0;
      if (marca === 0xE1 && p + 10 <= d.byteLength && d.getUint32(p + 4) === 0x45786966) {
        const f35 = focal35(d, p + 10, Math.min(d.byteLength, p + 2 + largo));
        if (!(f35 > 0)) return 0;
        const focal = f35 / DIAGONAL_35MM * Math.hypot(ancho, alto);
        const r = focal / Math.max(ancho, alto);
        return r > 0.35 && r < 3.0 ? focal : 0;
      }
      p += 2 + largo;
    }
  } catch (e) {
    // un EXIF que no se entiende: como si no hubiera
  }
  return 0;
}

function focal35(d, t, fin) {
  const le = d.getUint16(t) === 0x4949;
  const u16 = (o) => d.getUint16(t + o, le);
  const u32 = (o) => d.getUint32(t + o, le);
  const entrada = (ifd, etiqueta) => {
    if (t + ifd + 2 > fin) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + 12 * i;
      if (t + e + 12 > fin) return null;
      if (u16(e) === etiqueta) return e;
    }
    return null;
  };
  const exif = entrada(u32(4), 0x8769);
  if (exif === null) return 0;
  const e = entrada(u32(exif + 8), 0xA405);
  if (e === null) return 0;
  const tipo = u16(e + 2);
  if (tipo === 3) return u16(e + 8);       // SHORT, que es lo normal
  if (tipo === 4) return u32(e + 8);       // LONG
  return 0;
}

// ------------------------------------------------------------------ revisión

async function mostrarRevision(rev) {
  estado.revision = rev;
  estado.conservar = false;
  estado.girado = false;
  const lado = LADOS[estado.formato][estado.lado];
  const avisos = [];
  if (rev.mismoLado) avisos.push('Este lado se parece mucho al anterior. Comprueba que la imagen sea la del reverso.');
  if (rev.sinCumplir) for (const c of rev.criterios) if (c.estado === 'FALLA') avisos.push(c.detalle);
  for (const c of rev.criterios) if (c.estado === 'AVISO') avisos.push(c.detalle);
  $('revision-titulo').textContent = rev.sinCumplir ? `${lado.nombre} no conforme`
    : avisos.length ? `${lado.nombre} conforme, con avisos` : `${lado.nombre} conforme`;
  $('revision-aviso').removeAttribute('role');
  $('revision-aviso').textContent = avisos.join('\n\n');
  $('revision-aviso').hidden = avisos.length === 0;
  $('revision-dictamen').textContent = rev.sinCumplir
    ? 'Lo mejor es repetir la toma. Si la imagen te sirve así, puedes usarla. El PDF no lleva ninguna marca, y en el resultado verás que este lado no cumple.'
    : 'Si la imagen se ve bien, continúa. Si no, repite la toma.';
  $('revision-dictamen').hidden = avisos.length === 0;
  llenarTabla(rev);
  let salida = `Salida a ${rev.dpiSalida} dpi, a tamaño real`;
  if (rev.tomasCombinadas > 1) salida += `. Reflejo eliminado combinando ${rev.tomasCombinadas} tomas`;
  if (estado.segundos > 0) salida += `. Revisada en ${estado.segundos.toFixed(1)} s`;
  $('revision-salida').textContent = `${salida}.`;
  $('revision-izquierda').textContent = rev.sinCumplir ? 'Usarla así' : 'Repetir';
  $('revision-derecha').textContent = rev.sinCumplir ? 'Repetir' : 'Continuar';
  ponerDocumento();
  ponerFranja();
  // los botones se encienden después de que la revisión se pinta: un toque hecho antes no la acepta sin verla
  botonesRevision(false);
  ir('revision');
  await pintar();
  botonesRevision(true);
}

function ponerDocumento() {
  const rev = estado.revision;
  ponerArgb($('revision-imagen'), motor.documento(), rev.ancho, rev.alto);
}

function ponerFranja() {
  const caja = $('franja');
  const filas = estado.revision.franjaEnBlanco ? motor.filasOrilla() : 0;
  caja.hidden = filas <= 0;
  if (filas <= 0) {
    vaciarLienzo($('franja-imagen'));
    return;
  }
  const px = motor.orilla(Math.ceil(2 * filas / 112));
  if (px) ponerArgb($('franja-imagen'), px, estado.revision.ancho, filas);
  $('conservar').textContent = estado.conservar ? 'Quitar la franja' : 'Conservar la franja';
  $('franja-conservada').hidden = !estado.conservar;
}

// La medida de un criterio como se escribe en la tabla (CapturaActivity.valorDe).
function valorDe(c) {
  if (c.valor === null) return '';
  const n = (v, d) => v.toFixed(d);
  switch (c.clave) {
    case 'inclinacion': return `${n(c.valor, 1)}°`;
    case 'giro': return `${n(Math.abs(c.valor), 1)}°`;
    case 'proporcion': return `${n(c.valor, 1)} %`;
    case 'planitud':
    case 'nitidez': return `${n(c.valor, 2)} mm`;
    case 'bordes': return `${n(c.valor, 1)} mm`;
    case 'resolucion': return `${n(c.valor, 0)} dpi`;
    case 'reflejo': return `${n(c.valor, 1)} ${c.unidad}`;
    case 'iluminacion': return `${n(c.valor, 0)} %`;
    default: return '';
  }
}

function llenarTabla(rev) {
  const cuerpo = $('revision-tabla');
  cuerpo.replaceChildren();
  for (const c of rev.criterios) {
    const fila = document.createElement('tr');
    const nombre = document.createElement('th');
    nombre.scope = 'row';
    nombre.textContent = c.nombre;
    const valor = document.createElement('td');
    valor.textContent = valorDe(c);
    const est = document.createElement('td');
    est.textContent = c.estado === 'PASA' ? 'pasa' : c.estado === 'AVISO' ? 'aviso' : 'falla';
    est.className = c.estado === 'PASA' ? 'pasa' : c.estado === 'AVISO' ? 'aviso-e' : 'falla';
    fila.append(nombre, valor, est);
    cuerpo.append(fila);
  }
}

function botonesRevision(activos) {
  for (const id of ['girar', 'conservar', 'revision-izquierda', 'revision-derecha']) $(id).disabled = !activos;
}

async function cambiarRevision(conservar, girado) {
  botonesRevision(false);
  await pintar();
  try {
    motor.cambiar(conservar, girado);
    estado.conservar = conservar;
    estado.girado = girado;
    ponerDocumento();
    ponerFranja();
  } finally {
    botonesRevision(true);
  }
}

async function aceptar() {
  botonesRevision(false);
  const lado = LADOS[estado.formato][estado.lado];
  const sinCumplir = estado.revision.sinCumplir;
  try {
    const blob = await new Promise((listo, mal) =>
      $('revision-imagen').toBlob((b) => (b ? listo(b) : mal(new Error('sin JPEG'))), 'image/jpeg', CALIDAD_JPEG));
    const bytes = new Int8Array(await blob.arrayBuffer());
    motor.aceptar(bytes, lado.nombre);
  } catch (e) {
    console.error(e);
    botonesRevision(true);
    const aviso = $('revision-aviso');
    aviso.setAttribute('role', 'alert');
    aviso.textContent = 'No se pudo guardar este lado. Vuelve a intentarlo; si sigue fallando, repite la toma.';
    aviso.hidden = false;
    return;
  }
  if (sinCumplir) estado.sinCumplir.push(lado.frase);
  estado.revision = null;
  estado.ultimo = null;
  estado.hayRechazada = false;
  estado.rechazadaDeSerie = false;
  estado.serieAbierta = false;
  estado.tomas = 0;
  vaciarLienzo($('revision-imagen'));
  vaciarLienzo($('franja-imagen'));
  estado.lado++;
  if (estado.lado < LADOS[estado.formato].length) mostrarLado();
  else await mostrarResultado();
}

function repetir() {
  const rev = estado.revision;
  estado.revision = null;
  vaciarLienzo($('revision-imagen'));
  vaciarLienzo($('franja-imagen'));
  if (rev && rev.sinCumplir) {
    // la toma que no cumple sigue a la mano, como en la aplicación
    motor.repetir();
    mostrarLado();
  } else {
    empezarLadoDeNuevo();
  }
}

// ------------------------------------------------------------------ resultado

function soltarImagenes() {
  for (const img of estado.imagenes) if (img) img.removeAttribute('src');
  estado.imagenes = [];
}

async function imagenDeLado(i) {
  if (!estado.imagenes[i]) {
    const blob = new Blob([motor.jpegDeLado(i)], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      estado.imagenes[i] = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return estado.imagenes[i];
}

function cabe(escala) {
  const d = JSON.parse(motor.distribucion(escala));
  return d.lados.every((l) => l.hoja === 0 && !l.reducida);
}

async function mostrarResultado() {
  const usados = estado.sinCumplir;
  const caja = $('resultado-sin-cumplir');
  if (usados.length) {
    caja.textContent = usados.length === 1
      ? `Usaste ${usados[0]} aunque no cumple todos los criterios. El PDF no lo indica. Revisa la hoja antes de enviarla.`
      : `Usaste ${usados[0]} y ${usados[1]} aunque no cumplen todos los criterios. El PDF no lo indica. Revisa la hoja antes de enviarla.`;
  }
  caja.hidden = usados.length === 0;
  $('resultado-error').textContent = '';
  const cabe150 = cabe(1.5);
  const cabe200 = cabe(2);
  for (const b of document.querySelectorAll('.segmentos button')) {
    const e = Number(b.dataset.escala);
    b.disabled = (e === 1.5 && !cabe150) || (e === 2 && !cabe200);
  }
  const nota = $('escala-nota');
  nota.hidden = cabe200;
  nota.textContent = !cabe150 ? 'Las ampliaciones no caben en la hoja.' : 'La ampliación al 200 % no cabe en la hoja.';
  estado.escala = 1;
  marcarEscala();
  $('compartir').hidden = !puedeCompartir();
  ir('resultado');
  await dibujarHoja();
}

function marcarEscala() {
  for (const b of document.querySelectorAll('.segmentos button')) {
    const elegido = Number(b.dataset.escala) === estado.escala;
    b.setAttribute('aria-checked', String(elegido));
    b.tabIndex = elegido ? 0 : -1;
  }
}

async function elegirEscala(escala) {
  estado.escala = escala;
  marcarEscala();
  await dibujarHoja();
}

async function dibujarHoja() {
  const d = JSON.parse(motor.distribucion(estado.escala));
  const lienzo = $('hoja');
  const ancho = Math.round(Math.min(300, lienzo.parentElement.clientWidth - 36) * (window.devicePixelRatio || 1));
  const k = ancho / d.hojaAncho;
  lienzo.width = ancho;
  lienzo.height = Math.round(d.hojaAlto * k);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < d.lados.length; i++) {
    const l = d.lados[i];
    if (l.hoja !== 0) continue;
    const img = await imagenDeLado(i);
    // como en el PDF: la imagen sobresale del lugar del documento lo que mide su margen blanco, recortada
    ctx.save();
    ctx.beginPath();
    ctx.rect((l.x - l.recorte) * k, (l.y - l.recorte) * k, (l.ancho + 2 * l.recorte) * k, (l.alto + 2 * l.recorte) * k);
    ctx.clip();
    ctx.drawImage(img, (l.x - l.orla) * k, (l.y - l.orla) * k, (l.ancho + 2 * l.orla) * k, (l.alto + 2 * l.orla) * k);
    ctx.restore();
  }
}

function nombreArchivo(extension) {
  let base = ($('nombre-archivo').value || '').normalize('NFC').trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').replace(/\s+/g, ' ').replace(/^\.+/, '').slice(0, 80);
  if (!base) base = NOMBRE_POR_OMISION;
  return `${base}.${extension}`;
}

function errorResultado(texto) {
  $('resultado-error').textContent = texto;
}

function pdfBlob() {
  return new Blob([motor.pdf(estado.escala)], { type: 'application/pdf' });
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  estado.urls.add(url);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    estado.urls.delete(url);
  }, 60000);
}

function guardarPdf() {
  errorResultado('');
  try {
    descargar(pdfBlob(), nombreArchivo('pdf'));
  } catch (e) {
    console.error(e);
    errorResultado('No se pudo armar el PDF en este navegador. Prueba con Safari o Chrome actualizados.');
  }
}

function guardarMediciones() {
  errorResultado('');
  try {
    descargar(new Blob([motor.registro(fechaLocal())], { type: 'application/json' }), nombreArchivo('json'));
  } catch (e) {
    console.error(e);
    errorResultado('No se pudieron guardar las mediciones.');
  }
}

function puedeCompartir() {
  try {
    const f = new File([new Uint8Array(1)], 'prueba.pdf', { type: 'application/pdf' });
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] }));
  } catch (e) {
    return false;
  }
}

async function compartir() {
  errorResultado('');
  let archivo;
  try {
    archivo = new File([pdfBlob()], nombreArchivo('pdf'), { type: 'application/pdf' });
  } catch (e) {
    console.error(e);
    errorResultado('No se pudo armar el PDF en este navegador. Prueba con Safari o Chrome actualizados.');
    return;
  }
  try {
    await navigator.share({ files: [archivo] });
  } catch (e) {
    if (e && e.name !== 'AbortError') descargar(archivo, archivo.name);
  }
}

function fechaLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const m = -d.getTimezoneOffset();
  const s = m >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${s}${p(Math.floor(Math.abs(m) / 60))}:${p(Math.abs(m) % 60)}`;
}

// ------------------------------------------------------------------ el navegador

// Lo que la página necesita del navegador: sin eso, se dice en el inicio en lugar de fallar a la mitad.
function navegadorSuficiente() {
  return typeof BigInt64Array === 'function' && typeof Blob === 'function' && typeof Blob.prototype.arrayBuffer === 'function'
    && typeof HTMLCanvasElement.prototype.toBlob === 'function' && typeof HTMLImageElement.prototype.decode === 'function';
}

// Si el navegador altera lo que la página lee de un lienzo, la imagen de 8 x 8 no da lo que es.
async function comprobarLectura() {
  try {
    const img = new Image();
    img.src = MUESTRA_LECTURA;
    await img.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = 8;
    lienzo.height = 8;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let suma = 0;
    for (let i = 0; i < 64; i++) suma += (i + 1) * (d[4 * i] + 3 * d[4 * i + 1] + 7 * d[4 * i + 2]);
    vaciarLienzo(lienzo);
    return suma !== SUMA_LECTURA;
  } catch (e) {
    return false;
  }
}

// ------------------------------------------------------------------ eventos

function pedirSalir() {
  if (!capturando()) {
    alInicio();
    return;
  }
  const dialogo = $('salir');
  if (typeof dialogo.showModal !== 'function') {
    if (confirm('Si vuelves al inicio se pierde lo que llevas capturado.')) alInicio();
    return;
  }
  if (!dialogo.open) dialogo.showModal();
}

function enlazar() {
  $('version').textContent = VERSION;
  // los toques hechos antes de que se mostrara la pantalla actual no cuentan (ver ir)
  document.addEventListener('click', (e) => {
    if (tiempoDelEvento(e) < estado.mostradoEn) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  for (const b of document.querySelectorAll('.documento')) b.addEventListener('click', () => empezar(b.dataset.formato));
  for (const b of document.querySelectorAll('[data-accion="inicio"]')) b.addEventListener('click', pedirSalir);
  for (const id of ['foto-camara', 'foto-archivo']) $(id).addEventListener('change', (e) => alElegirFoto(e.target));
  $('foto-camara').addEventListener('click', alTomarFoto);
  $('foto-camara').addEventListener('cancel', desmarcarCamara);
  $('camara-disparar').addEventListener('click', disparar);
  $('camara-cancelar').addEventListener('click', () => salirDeLaCamara(''));
  window.addEventListener('resize', () => {
    if (!$('camara').hidden) ponerMarco();
  });
  // el tamaño del video llega con sus datos y cambia si el teléfono gira
  for (const ev of ['loadedmetadata', 'resize']) {
    $('camara-video').addEventListener(ev, () => {
      if (!$('camara').hidden) ponerMarco();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // la cámara de la página no se queda prendida con la página oculta
      if (!$('camara').hidden) salirDeLaCamara('');
    } else {
      alVolverDeLaCamara();
    }
  });
  $('ver-toma').addEventListener('click', async () => {
    const rev = motor.verRechazada();
    if (rev) await mostrarRevision(JSON.parse(rev));
  });
  $('reiniciar-lado').addEventListener('click', empezarLadoDeNuevo);
  $('girar').addEventListener('click', () => cambiarRevision(estado.conservar, !estado.girado));
  $('conservar').addEventListener('click', () => cambiarRevision(!estado.conservar, estado.girado));
  $('revision-izquierda').addEventListener('click', () => (estado.revision && estado.revision.sinCumplir ? aceptar() : repetir()));
  $('revision-derecha').addEventListener('click', () => (estado.revision && estado.revision.sinCumplir ? repetir() : aceptar()));
  const escalas = [...document.querySelectorAll('.segmentos button')];
  for (const b of escalas) {
    b.addEventListener('click', () => {
      if (!b.disabled) elegirEscala(Number(b.dataset.escala));
    });
    // un grupo de opciones se recorre con las flechas
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const activas = escalas.filter((x) => !x.disabled);
      const i = activas.indexOf(b);
      const otra = activas[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + activas.length) % activas.length];
      otra.focus();
      elegirEscala(Number(otra.dataset.escala));
    });
  }
  $('guardar').addEventListener('click', guardarPdf);
  $('compartir').addEventListener('click', compartir);
  $('mediciones').addEventListener('click', guardarMediciones);
  $('terminar').addEventListener('click', alInicio);
  $('salir').addEventListener('click', (e) => {
    const r = e.target.closest('[data-respuesta]');
    if (!r) return;
    $('salir').close();
    if (r.dataset.respuesta === 'si') alInicio();
  });
  // el gesto o el botón de atrás no sale de la página: vuelve al inicio, preguntando si hay algo capturado
  window.addEventListener('popstate', () => {
    if (!$('camara').hidden) {
      // en la cámara, atrás la cierra y vuelve al lado
      history.pushState({ idoneo: true }, '');
      salirDeLaCamara('');
      return;
    }
    if ($('inicio').hidden) {
      history.pushState({ idoneo: true }, '');
      pedirSalir();
    }
  });
  // al cerrar o recargar la página con algo capturado, el navegador pregunta (Safari en iPhone no lo hace)
  window.addEventListener('beforeunload', (e) => {
    if (capturando()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// Si la página se volvió a cargar mientras estaba abierta la cámara del sistema, lo capturado se perdió: se dice en el
// inicio, para que no parezca un error de la página.
function avisarSiSeRecargo() {
  try {
    const abierta = Number(sessionStorage.getItem(CLAVE_CAMARA));
    sessionStorage.removeItem(CLAVE_CAMARA);
    const minutos = (Date.now() - abierta) / 60000;
    if (abierta > 0 && minutos >= 0 && minutos < MINUTOS_AVISO_RECARGA) $('aviso-recarga').hidden = false;
  } catch (e) {
    // sin almacenamiento de la pestaña
  }
}

async function arrancar() {
  enlazar();
  avisarSiSeRecargo();
  if (history.state && history.state.idoneo) history.replaceState(null, '');
  if (!navegadorSuficiente()) {
    $('aviso-navegador').hidden = false;
    for (const b of document.querySelectorAll('.documento')) b.disabled = true;
    return;
  }
  estado.lecturaAlterada = await comprobarLectura();
}

arrancar();
