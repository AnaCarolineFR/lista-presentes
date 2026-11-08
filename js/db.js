// Acesso ao Supabase: login, lista do usuário e carregamento dos dados.
// Usado pelo site (app.js) e pela página de admin (admin.js).

const db = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
const BUCKET = 'fotos';

// Escapa texto vindo do banco antes de ir pro HTML
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Sem sessão → manda pro login (e volta pra página atual depois)
async function exigirLogin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    location.href = 'login.html?volta=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    throw new Error('sem sessão');
  }
  return session;
}

async function sair() {
  await db.auth.signOut();
  location.href = 'login.html';
}

// Listas que o usuário pode abrir, com o papel dele em cada uma (dono primeiro)
async function minhasListas() {
  const { data, error } = await db.from('acessos').select('papel, listas(*)');
  if (error) throw error;
  return data
    .map(a => ({ ...a.listas, papel: a.papel }))
    .sort((a, b) => (a.papel === 'dono' ? -1 : 0) - (b.papel === 'dono' ? -1 : 0));
}

// Lista escolhida no seletor (lembrada no navegador) ou a primeira disponível
function escolherLista(listas) {
  let slug = null;
  try { slug = localStorage.getItem('lista'); } catch (e) {}
  return listas.find(l => l.slug === slug) || listas[0];
}

function lembrarLista(slug) {
  try { localStorage.setItem('lista', slug); } catch (e) {}
}

// URLs temporárias (1h) das fotos privadas: { caminho: url }
async function urlsDasFotos(caminhos) {
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (!unicos.length) return {};
  const { data } = await db.storage.from(BUCKET).createSignedUrls(unicos, 3600);
  return Object.fromEntries((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
}

// Itens, preços e datas de uma lista, no mesmo formato que o site já usava
async function carregarLista(lista) {
  const [itens, precos, datas] = await Promise.all([
    db.from('itens').select('*').eq('lista_id', lista.id).order('ordem'),
    db.from('precos').select('*').eq('lista_id', lista.id),
    db.from('datas').select('*').eq('lista_id', lista.id).order('ordem'),
  ]);
  for (const r of [itens, precos, datas]) if (r.error) throw r.error;

  const fotos = await urlsDasFotos([lista.foto, ...itens.data.map(i => i.imagem)]);

  const porItem = {};
  let atualizado = null;
  for (const p of precos.data) {
    (porItem[p.item_id] ||= []).push({ ...p, preco: Number(p.preco), preco_anterior: p.preco_anterior && Number(p.preco_anterior) });
    if (!atualizado || p.atualizado_em > atualizado) atualizado = p.atualizado_em;
  }

  return {
    lista: { ...lista, fotoUrl: fotos[lista.foto] },
    itens: itens.data.map(i => ({
      ...i,
      estimado: i.estimado && Number(i.estimado),
      imagemUrl: fotos[i.imagem],
    })),
    precos: { atualizado_em: atualizado || new Date().toISOString(), itens: porItem },
    datas: datas.data.map(d => ({ ...d, desdeAno: d.desde_ano, desdeMes: d.desde_mes })),
  };
}
