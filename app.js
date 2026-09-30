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
    mostrarResultados(data.response.docs);
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

// Random: 5 discos al azar de todo el catálogo (sort=random de la API, sin filtros)
document.getElementById('btn-random').addEventListener('click', () => {
  buscar('*:*', { rows: 5, orden: 'random' });
});

// Pantalla de inicio: colecciones populares, así no arranca vacío
buscar('collection:(78rpm OR oldtimeradio OR etree)');
