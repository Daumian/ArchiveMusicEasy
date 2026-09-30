const API_BUSQUEDA = 'https://archive.org/advancedsearch.php';

const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');

// La metadata de archive.org a veces viene como array
function aTexto(valor, porDefecto) {
  if (Array.isArray(valor)) valor = valor[0];
  return valor || porDefecto;
}

const CANTIDAD = 12; // pocos resultados = pocos datos y un solo pedido por acción

async function buscar(texto, { rows = CANTIDAD, page = 1, orden = 'downloads desc' } = {}) {
  resultados.textContent = '⏳ Buscando...';
  const params = new URLSearchParams({
    q: `(${texto}) AND mediatype:audio AND format:MP3`, // solo discos con algún MP3
    rows,
    page,
    output: 'json'
  });
  ['identifier', 'title', 'creator'].forEach(c => params.append('fl[]', c));
  params.append('sort[]', orden);

  try {
    const res = await fetch(`${API_BUSQUEDA}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    mostrarResultados(data.response.docs);
  } catch (err) {
    resultados.textContent = '❌ No pudimos buscar, probá de nuevo.';
    console.error(err);
  }
}

let ultimosDocs = []; // para poder volver desde la vista de un disco

function mostrarResultados(docs) {
  ultimosDocs = docs;
  resultados.textContent = '';
  if (!docs.length) {
    resultados.textContent = '🤷 No encontramos nada.';
    return;
  }
  const grilla = document.createElement('div');
  grilla.className = 'grilla';

  docs.forEach(doc => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta';
    tarjeta.dataset.id = doc.identifier;

    const img = document.createElement('img');
    img.src = `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`;
    img.loading = 'lazy';
    img.alt = '';

    const titulo = document.createElement('div');
    titulo.className = 'titulo';
    titulo.textContent = aTexto(doc.title, doc.identifier);

    const autor = document.createElement('div');
    autor.className = 'autor';
    autor.textContent = aTexto(doc.creator, 'Desconocido');

    tarjeta.append(img, titulo, autor);
    grilla.appendChild(tarjeta);
  });

  resultados.appendChild(grilla);
}

// ---------- Vista de un disco ----------

const API_METADATA = 'https://archive.org/metadata';

// "213.45" o "3:33" -> "3:33"
function formatearDuracion(length) {
  if (!length) return '';
  let seg = String(length).includes(':')
    ? String(length).split(':').reduce((t, n) => t * 60 + Number(n), 0)
    : Math.round(Number(length));
  if (!Number.isFinite(seg)) return '';
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

// Un mismo tema puede estar en varios MP3: nos quedamos con uno, preferimos VBR MP3
function filtrarTemas(files) {
  const porTema = new Map();
  files.filter(f => (f.format || '').includes('MP3')).forEach(f => {
    const clave = (f.original || f.name).replace(/\.[^.]+$/, '');
    const actual = porTema.get(clave);
    if (!actual || (f.format === 'VBR MP3' && actual.format !== 'VBR MP3')) porTema.set(clave, f);
  });
  return [...porTema.values()].sort((a, b) => {
    const ta = parseInt(a.track, 10), tb = parseInt(b.track, 10);
    if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });
}

async function abrirDisco(id) {
  resultados.textContent = '⏳ Abriendo disco...';
  try {
    const res = await fetch(`${API_METADATA}/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    mostrarDisco(id, data.metadata || {}, filtrarTemas(data.files || []));
  } catch (err) {
    resultados.textContent = '❌ No pudimos abrir el disco, probá de nuevo.';
    console.error(err);
  }
}

function mostrarDisco(id, meta, temas) {
  resultados.textContent = '';

  const volver = document.createElement('button');
  volver.id = 'btn-volver';
  volver.textContent = '← Volver';
  volver.addEventListener('click', () => mostrarResultados(ultimosDocs));

  const cabecera = document.createElement('div');
  cabecera.className = 'disco-cabecera';

  const img = document.createElement('img');
  img.src = `https://archive.org/services/img/${encodeURIComponent(id)}`;
  img.alt = '';

  const info = document.createElement('div');
  const titulo = document.createElement('h2');
  titulo.textContent = aTexto(meta.title, id);
  const autor = document.createElement('div');
  autor.className = 'autor';
  autor.textContent = aTexto(meta.creator, 'Desconocido');
  info.append(titulo, autor);
  cabecera.append(img, info);

  const lista = document.createElement('div');
  lista.className = 'temas';
  if (!temas.length) {
    lista.textContent = '🤷 Este disco no tiene temas MP3.';
  }
  temas.forEach((f, i) => {
    const fila = document.createElement('div');
    fila.className = 'tema';
    fila.dataset.archivo = f.name;

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

  resultados.append(volver, cabecera, lista);
}

// Tocar una tarjeta abre el disco
resultados.addEventListener('click', e => {
  const tarjeta = e.target.closest('.tarjeta');
  if (tarjeta) abrirDisco(tarjeta.dataset.id);
});

buscador.addEventListener('keydown', e => {
  if (e.key === 'Enter' && buscador.value.trim()) buscar(buscador.value.trim());
});

// Random: 5 discos al azar de todo el catálogo (sort=random de la API, sin filtros)
document.getElementById('btn-random').addEventListener('click', () => {
  buscar('*:*', { rows: 5, orden: 'random' });
});

// Pantalla de inicio: colecciones populares, así no arranca vacío
buscar('collection:(78rpm OR oldtimeradio OR etree)');
