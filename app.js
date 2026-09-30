const API_BUSQUEDA = 'https://archive.org/advancedsearch.php';

const buscador = document.getElementById('buscador');
const resultados = document.getElementById('resultados');

// La metadata de archive.org a veces viene como array
function aTexto(valor, porDefecto) {
  if (Array.isArray(valor)) valor = valor[0];
  return valor || porDefecto;
}

// Fisher-Yates: mezcla una copia del array
function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CANTIDAD = 12; // pocos resultados = pocos datos y un solo pedido por acción

async function buscar(texto, { rows = CANTIDAD, page = 1, orden = 'downloads desc', sortear = 0 } = {}) {
  resultados.textContent = '⏳ Buscando...';
  const params = new URLSearchParams({
    q: `(${texto}) AND mediatype:audio`,
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
    let docs = data.response.docs;
    if (sortear) docs = mezclar(docs).slice(0, sortear);
    mostrarResultados(docs);
  } catch (err) {
    resultados.textContent = '❌ No pudimos buscar, probá de nuevo.';
    console.error(err);
  }
}

function mostrarResultados(docs) {
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

buscador.addEventListener('keydown', e => {
  if (e.key === 'Enter' && buscador.value.trim()) buscar(buscador.value.trim());
});

// PRUEBA A: un día al azar; pedimos 40 subidos ese día (sin ranking por fama) y sorteamos 5
document.getElementById('btn-random-fecha').addEventListener('click', () => {
  const anio = 2006 + Math.floor(Math.random() * 20); // 2006-2025
  const mes = 1 + Math.floor(Math.random() * 12);
  const dia = 1 + Math.floor(Math.random() * new Date(anio, mes, 0).getDate());
  const f = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  buscar(`addeddate:[${f} TO ${f}T23:59:59Z]`, { rows: 40, orden: 'addeddate asc', sortear: 5 });
});

// PRUEBA B: 5 discos con orden aleatorio de la API (si archive.org lo soporta)
document.getElementById('btn-random-sort').addEventListener('click', () => {
  buscar('*:*', { rows: 5, orden: 'random' });
});

// Pantalla de inicio: colecciones populares, así no arranca vacío
buscar('collection:(78rpm OR oldtimeradio OR etree)');
