const API_BUSQUEDA = 'https://archive.org/advancedsearch.php';

async function probarAPI() {
  const params = new URLSearchParams({
    q: 'jazz AND mediatype:audio',
    'fl[]': 'identifier',
    rows: 5,
    output: 'json'
  });
  params.append('fl[]', 'title');

  const res = await fetch(`${API_BUSQUEDA}?${params}`);
  const data = await res.json();
  console.log('✅ La API responde:', data.response.docs);
}

probarAPI();