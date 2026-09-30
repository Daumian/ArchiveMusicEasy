const API_BUSQUEDA = 'https://archive.org/advancedsearch.php';
const API_METADATA = 'https://archive.org/metadata';
const CANTIDAD = 3; // un disco trae mucha música: con 3 alcanza

const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');
const discos = document.getElementById('discos');
const etiqueta = document.getElementById('etiqueta');
const audio = document.getElementById('audio');
const progreso = document.getElementById('progreso');
const btnPlay = document.getElementById('btn-play');

let palabra = '';        // palabra clave de la búsqueda actual ('' = todo el catálogo)
let discoActual = null;  // { id, titulo, autor }
let cola = [];           // temas MP3 del disco actual
let indice = -1;         // tema que suena
let pedidoRandom = 0;    // para ignorar respuestas viejas
let pedidoDisco = 0;

// La metadata de archive.org a veces viene como array
function aTexto(valor, porDefecto) {
  if (Array.isArray(valor)) valor = valor[0];
  return valor || porDefecto;
}

function formatearTiempo(seg) {
  if (!Number.isFinite(seg)) return '0:00';
  seg = Math.round(seg);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

// "213.45" o "3:33" -> "3:33"
function formatearDuracion(length) {
  if (!length) return '';
  const seg = String(length).includes(':')
    ? String(length).split(':').reduce((t, n) => t * 60 + Number(n), 0)
    : Number(length);
  return Number.isFinite(seg) ? formatearTiempo(seg) : '';
}

function portada(id) {
  return `https://archive.org/services/img/${encodeURIComponent(id)}`;
}

// ---------- Los 3 discos al azar ----------

async function cargarRandom() {
  const este = ++pedidoRandom;
  actualizarEtiqueta();
  discos.textContent = '';
  const cargando = document.createElement('div');
  cargando.className = 'mensaje';
  cargando.textContent = '⏳ Buscando...';
  discos.appendChild(cargando);

  try {
    // El orden "random" de archive.org es fijo para una misma consulta,
    // así que en cada toque saltamos a una página al azar de ese orden.
    let respuesta = await pedirDiscos(1 + Math.floor(Math.random() * 100));
    if (!respuesta.docs.length && respuesta.numFound > 0) {
      // la palabra tiene pocos resultados: elegimos entre las páginas que sí existen
      const paginas = Math.ceil(respuesta.numFound / CANTIDAD);
      respuesta = await pedirDiscos(1 + Math.floor(Math.random() * paginas));
    }
    if (este !== pedidoRandom) return;
    mostrarSlots(respuesta.docs);
  } catch (err) {
    if (este !== pedidoRandom) return;
    cargando.textContent = '❌ No pudimos buscar, probá de nuevo.';
    console.error(err);
  }
}

async function pedirDiscos(page) {
  const params = new URLSearchParams({
    q: `(${palabra || '*:*'}) AND mediatype:audio AND format:MP3`, // solo discos con algún MP3
    rows: CANTIDAD,
    page,
    output: 'json'
  });
  ['identifier', 'title', 'creator'].forEach(c => params.append('fl[]', c));
  params.append('sort[]', 'random');

  const res = await fetch(`${API_BUSQUEDA}?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).response;
}

function mostrarSlots(docs) {
  discos.textContent = '';
  if (!docs.length) {
    const vacio = document.createElement('div');
    vacio.className = 'mensaje';
    vacio.textContent = '🤷 No encontramos nada.';
    discos.appendChild(vacio);
    return;
  }
  docs.forEach(doc => {
    const slot = document.createElement('button');
    slot.className = 'slot';
    slot.dataset.id = doc.identifier;

    const img = document.createElement('img');
    img.src = portada(doc.identifier);
    img.loading = 'lazy';
    img.alt = '';

    const titulo = document.createElement('span');
    titulo.textContent = aTexto(doc.title, doc.identifier);

    slot.append(img, titulo);
    discos.appendChild(slot);
  });
}

function actualizarEtiqueta() {
  etiqueta.textContent = '';
  const texto = document.createElement('span');
  texto.textContent = palabra ? `🎲 Al azar de: "${palabra}"` : '🎲 Al azar de todo el catálogo';
  etiqueta.appendChild(texto);
  if (palabra) {
    const borrar = document.createElement('button');
    borrar.id = 'btn-borrar';
    borrar.title = 'Quitar palabra';
    borrar.textContent = '✕';
    etiqueta.appendChild(borrar);
  }
}

// ---------- Un disco ----------

// Un mismo tema puede estar en varios MP3: nos quedamos con uno, preferimos VBR MP3
function filtrarTemas(files) {
  const porTema = new Map();
  files.filter(f => (f.format || '').includes('MP3')).forEach(f => {
    const clave = (f.original || f.name).replace(/\.[^.]+$/, '');
    const actual = porTema.get(clave);
    if (!actual || (f.format === 'VBR MP3' && actual.format !== 'VBR MP3')) porTema.set(clave, f);
  });
  return [...porTema.values()].sort((a, b) => {
    // los que tienen track van primero (por número); el resto por nombre
    const ta = parseInt(a.track, 10), tb = parseInt(b.track, 10);
    if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return ta - tb;
    if (!isNaN(ta) !== !isNaN(tb)) return isNaN(ta) ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

async function abrirDisco(id) {
  const este = ++pedidoDisco;
  resultados.textContent = '⏳ Abriendo disco...';
  try {
    const res = await fetch(`${API_METADATA}/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (este !== pedidoDisco) return;
    const temas = filtrarTemas(data.files || []);
    if (!temas.length) {
      resultados.textContent = '🤷 Ese disco no tiene temas MP3. Probá con otro.';
      return;
    }
    const meta = data.metadata || {};
    discoActual = { id, titulo: aTexto(meta.title, id), autor: aTexto(meta.creator, 'Desconocido') };
    cola = temas;
    mostrarDisco();
    reproducir(0);
  } catch (err) {
    if (este !== pedidoDisco) return;
    resultados.textContent = '❌ No pudimos abrir el disco, probá de nuevo.';
    console.error(err);
  }
}

function mostrarDisco() {
  resultados.textContent = '';

  const cabecera = document.createElement('div');
  cabecera.className = 'disco-cabecera';
  const img = document.createElement('img');
  img.src = portada(discoActual.id);
  img.alt = '';
  const info = document.createElement('div');
  const titulo = document.createElement('h2');
  titulo.textContent = discoActual.titulo;
  const autor = document.createElement('div');
  autor.className = 'autor';
  autor.textContent = discoActual.autor;
  info.append(titulo, autor);
  cabecera.append(img, info);

  const lista = document.createElement('div');
  lista.className = 'temas';
  cola.forEach((f, i) => {
    const fila = document.createElement('div');
    fila.className = 'tema';
    fila.dataset.indice = i;

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = i + 1;

    const nombre = document.createElement('span');
    nombre.className = 'nombre';
    nombre.textContent = f.title || f.name.split('/').pop().replace(/\.[^.]+$/, '');

    const dur = document.createElement('span');
    dur.className = 'duracion';
    dur.textContent = formatearDuracion(f.length);

    fila.append(num, nombre, dur);
    lista.appendChild(fila);
  });

  resultados.append(cabecera, lista);
}

// ---------- Reproductor ----------

function reproducir(i) {
  if (i < 0 || i >= cola.length) return;
  indice = i;
  const archivo = cola[i].name.split('/').map(encodeURIComponent).join('/');
  audio.src = `https://archive.org/download/${encodeURIComponent(discoActual.id)}/${archivo}`;
  audio.play().catch(err => console.error(err));
  marcarActual();
}

function marcarActual() {
  resultados.querySelectorAll('.tema').forEach(fila => {
    const suena = Number(fila.dataset.indice) === indice;
    fila.classList.toggle('sonando', suena);
    if (suena) fila.scrollIntoView({ block: 'nearest' });
  });
}

btnPlay.addEventListener('click', () => {
  if (!audio.src) return;
  if (audio.paused) audio.play().catch(err => console.error(err));
  else audio.pause();
});

document.getElementById('btn-siguiente').addEventListener('click', () => reproducir(indice + 1));
document.getElementById('btn-anterior').addEventListener('click', () => {
  if (audio.currentTime > 3) audio.currentTime = 0; // como en un reproductor de verdad
  else reproducir(indice - 1);
});

audio.addEventListener('play', () => { btnPlay.textContent = '⏸'; });
audio.addEventListener('pause', () => { btnPlay.textContent = '▶'; });
audio.addEventListener('loadedmetadata', () => {
  progreso.max = audio.duration;
  document.getElementById('t-total').textContent = formatearTiempo(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  progreso.value = audio.currentTime;
  document.getElementById('t-actual').textContent = formatearTiempo(audio.currentTime);
});
audio.addEventListener('ended', () => reproducir(indice + 1)); // avanza solo
audio.addEventListener('error', () => {
  console.error('No se pudo reproducir', audio.src);
  reproducir(indice + 1); // si un tema falla, seguimos con el próximo
});
progreso.addEventListener('input', () => { audio.currentTime = progreso.value; });

// ---------- Volumen ----------

const volumen = document.getElementById('volumen');
const btnVolumen = document.getElementById('btn-volumen');
const panelVolumen = document.getElementById('panel-volumen');

function iconoVolumen() {
  if (audio.muted || audio.volume === 0) return '🔇';
  return audio.volume < 0.4 ? '🔈' : audio.volume < 0.75 ? '🔉' : '🔊';
}

audio.addEventListener('volumechange', () => {
  btnVolumen.textContent = iconoVolumen();
  volumen.value = audio.muted ? 0 : audio.volume;
  try { localStorage.setItem('volumen', audio.volume); } catch (e) { /* sin storage, no pasa nada */ }
});
volumen.addEventListener('input', () => {
  audio.muted = false;
  audio.volume = Number(volumen.value);
});
// El ícono abre y cierra la barra; tocar en cualquier otro lado la cierra
btnVolumen.addEventListener('click', () => { panelVolumen.hidden = !panelVolumen.hidden; });
document.addEventListener('click', e => {
  if (!e.target.closest('#control-volumen')) panelVolumen.hidden = true;
});

// Arrancamos con el último volumen usado (o 70%, para que no sorprenda)
let volumenInicial = 0.7;
try {
  const guardado = parseFloat(localStorage.getItem('volumen'));
  if (guardado >= 0 && guardado <= 1) volumenInicial = guardado;
} catch (e) { /* sin storage */ }
audio.volume = volumenInicial;

// ---------- Eventos de la pantalla ----------

discos.addEventListener('click', e => {
  const slot = e.target.closest('.slot');
  if (slot) abrirDisco(slot.dataset.id);
});

resultados.addEventListener('click', e => {
  const fila = e.target.closest('.tema');
  if (fila) reproducir(Number(fila.dataset.indice));
});

document.getElementById('btn-random').addEventListener('click', cargarRandom);

etiqueta.addEventListener('click', e => {
  if (e.target.id !== 'btn-borrar') return;
  palabra = '';
  buscador.value = '';
  cargarRandom();
});

document.getElementById('btn-lupa').addEventListener('click', () => {
  buscador.hidden = !buscador.hidden;
  if (!buscador.hidden) buscador.focus();
});

buscador.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  palabra = buscador.value.trim();
  cargarRandom();
});

// Inicio
resultados.textContent = '👇 Elegí un disco para escuchar';
cargarRandom();
