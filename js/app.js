// Camadas de desejo, da mais leve à mais profunda.
// O item cai na camada pelo menor preço encontrado ("ate" = limite em reais).
// Para forçar uma camada, use o campo "tipo" no item em itens.json.
const TIPOS = [
  { id: 'mimo',     nivel: 1, nome: 'Mimos',     ate: 50,       desc: 'Pra provar que pensou em mim numa terça qualquer' },
  { id: 'facil',    nivel: 2, nome: 'Fáceis',    ate: 150,      desc: 'Simples de achar, impossível de errar' },
  { id: 'moderado', nivel: 3, nome: 'Moderados', ate: 400,      desc: 'Pra data especial (ou pra pedir desculpa)' },
  { id: 'especial', nivel: 4, nome: 'Especiais', ate: 1000,     desc: 'Aniversário, Natal, dia dos namorados' },
  { id: 'sonho',    nivel: 5, nome: 'Sonhos',    ate: Infinity, obs: '(vai que…)',
    desc: 'Os grandões da lista. Sem pressão nenhuma… mas vai que, né? ✨' },
];

const reais = v => v.toLocaleString('pt-BR');
TIPOS.forEach((t, i) => {
  const de = i ? TIPOS[i - 1].ate : 0;
  t.faixa = t.ate === Infinity ? `acima de R$ ${reais(de)}`
          : de ? `R$ ${reais(de)} a ${reais(t.ate)}`
          : `até R$ ${reais(t.ate)}`;
});

// Direções de identidade em teste (ver css/style.css)
const ESTILOS = [
  { id: 'scrapbook', nome: 'Scrapbook' },
  { id: 'y2k',       nome: 'Y2K' },
  { id: 'cafe',      nome: 'Café' },
];

// Campo "categoria" em itens.json
const CATEGORIAS = {
  joias: 'Joias',
  roupas: 'Roupas',
  calcados: 'Calçados',
  flores: 'Flores',
  beleza: 'Beleza',
  livros: 'Livros',
  doces: 'Doces',
  comidinhas: 'Comidinhas',
  musica: 'Música',
  eletronicos: 'Eletrônicos',
  aleatorio: 'Aleatórios',
  experiencias: 'Experiências',
};

const MAX_LOJAS = 5;

const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Datas só com dia ("2026-11-05") são lidas no fuso local, senão viram o dia anterior
const dataBR = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? dataISO(iso) : new Date(iso))
  .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

// Ofertas disponíveis de um item, da mais barata para a mais cara
function ofertas(precos, id) {
  return (precos.itens[id] || [])
    .filter(o => o.disponivel)
    .sort((a, b) => a.preco - b.preco);
}

// Valor de referência do item: menor preço nas lojas ou, para experiências, o valor estimado
function valorDoItem(item, precos) {
  const menor = ofertas(precos, item.id)[0];
  return menor ? menor.preco : item.estimado;
}

// Camada do item: a escolhida à mão ou a da faixa do valor (sem valor → primeira camada)
function camadaDoItem(item, precos) {
  if (item.tipo) return TIPOS.find(t => t.id === item.tipo);
  const valor = valorDoItem(item, precos);
  return valor ? TIPOS.find(t => valor <= t.ate) : TIPOS[0];
}

// Foto do produto (URL temporária do Storage) ou o emoji, para itens sem foto
const foto = item => item.imagemUrl
  ? `<img src="${esc(item.imagemUrl)}" alt="" loading="lazy">`
  : esc(item.emoji || '♥');

function queda(oferta) {
  if (!oferta || !oferta.preco_anterior || oferta.preco >= oferta.preco_anterior) return 0;
  return Math.round((1 - oferta.preco / oferta.preco_anterior) * 100);
}

/* ---------------- Home ---------------- */

function card(item, precos) {
  const lista = ofertas(precos, item.id);
  const menor = lista[0];
  const caiu = queda(menor);
  return `
    <a class="card" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="thumb">${foto(item)}</div>
      <div class="card-body">
        ${caiu ? `<span class="badge">baixou ${caiu}%</span>` : ''}
        <span class="cat">${esc(CATEGORIAS[item.categoria] || item.categoria)}</span>
        <h3>${esc(item.nome)}</h3>
        ${item.comentario ? `<p class="comentario">“${esc(item.comentario)}”</p>` : ''}
        <p class="preco">${
          menor ? `<small>a partir de</small>${brl(menor.preco)}`
          : item.estimado ? `<small>estimado${item.individual ? '' : ' p/ 2'}</small>~${brl(item.estimado)}`
          : '<small>sem preço no momento</small>'}</p>
        <p class="lojas">${item.estimado && !menor
          ? (item.simulacao ? 'simulação · ' : '') + esc(item.quando || item.estimado_nota || 'experiência')
          : `${lista.length} ${lista.length === 1 ? 'loja' : 'lojas'}`}</p>
      </div>
    </a>`;
}

/* ---------------- Calendário de datas ---------------- */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_MS = 24 * 60 * 60 * 1000;

function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Sexta depois da 4ª quinta-feira de novembro
function blackFriday(ano) {
  const primeiro = new Date(ano, 10, 1).getDay();
  const quinta = 1 + ((4 - primeiro + 7) % 7) + 21;
  return new Date(ano, 10, quinta + 1);
}

function proximaData(d, hoje) {
  if (d.tipo === 'mensal') {
    const neste = new Date(hoje.getFullYear(), hoje.getMonth(), d.dia);
    return neste >= hoje ? neste : new Date(hoje.getFullYear(), hoje.getMonth() + 1, d.dia);
  }
  const noAno = ano =>
    d.tipo === 'pascoa' ? pascoa(ano) :
    d.tipo === 'blackfriday' ? blackFriday(ano) :
    new Date(ano, d.mes - 1, d.dia);
  const neste = noAno(hoje.getFullYear());
  return neste >= hoje ? neste : noAno(hoje.getFullYear() + 1);
}

const dataISO = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const diaMes = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

// Próximo período (ex.: férias) que ainda não terminou
function proximoPeriodo(d, hoje) {
  const p = (d.periodos || []).map(([i, f]) => [dataISO(i), dataISO(f)]).find(([, fim]) => fim >= hoje);
  return p && { inicio: p[0], fim: p[1] };
}

// "faço {n} anos", "{n}º mês juntos"...
function rotulo(d) {
  if (!d.rotulo || !d.desdeAno) return '';
  const n = d.tipo === 'mensal'
    ? (d.quando.getFullYear() - d.desdeAno) * 12 + (d.quando.getMonth() + 1 - d.desdeMes)
    : d.quando.getFullYear() - d.desdeAno;
  return d.rotulo.replace('{n}', n);
}

function renderDatas(datas) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dias = ate => Math.round((ate - hoje) / DIA_MS);
  const semData = d => !['sempre', 'pascoa', 'blackfriday', 'periodo'].includes(d.tipo) && !d.dia;

  const secretas = datas.filter(semData);
  const periodos = datas.filter(d => d.tipo === 'periodo').map(d => ({ ...d, periodo: proximoPeriodo(d, hoje) }));
  const marcadas = datas
    .filter(d => !semData(d) && !['sempre', 'periodo'].includes(d.tipo))
    .map(d => ({ ...d, quando: proximaData(d, hoje) }))
    .map(d => ({ ...d, faltam: dias(d.quando) }));

  // Períodos entram na ordem pela data de início (ou "agora", se já começou)
  const comPeriodo = periodos.filter(d => d.periodo).map(d => {
    const { inicio, fim } = d.periodo;
    const coincide = marcadas.filter(m => m.quando >= inicio && m.quando <= fim).map(m => m.nome);
    return {
      ...d,
      quando: inicio,
      faltam: Math.max(0, dias(inicio)),
      folha: [MESES[inicio.getMonth()], `${inicio.getDate()}–${fim.getDate()}`],
      falta: inicio <= hoje ? `é agora! vai até ${diaMes(fim)}` : `começa em ${dias(inicio)} dias`,
      aviso: coincide.length ? `⚠️ Coincide com: ${coincide.join(', ')}. Boa sorte, mozão 🫡` : '',
    };
  });

  const ordenadas = [...marcadas, ...comPeriodo].sort((a, b) => a.faltam - b.faltam);
  const sempre = [...datas.filter(d => d.tipo === 'sempre'), ...periodos.filter(d => !d.periodo)];

  const contagem = n => n === 0 ? 'é hoje!!' : n === 1 ? 'é amanhã!' : `faltam ${n} dias`;
  // "camada" pode trazer várias, separadas por vírgula ("facil,moderado,especial").
  // Sonhos nunca entra como sugestão: lá é só pra sonhar.
  const camada = ids => {
    const tipos = String(ids || '').split(',').map(id => TIPOS.find(t => t.id === id.trim()))
      .filter(t => t && t.id !== 'sonho');
    return tipos.length
      ? `<span class="sugestoes">sugestão: ${tipos.map(t =>
          `<a class="camada tier-${t.nivel}" href="#camada-${t.id}">${t.nome}</a>`).join('')}</span>`
      : '';
  };
  const linha = (d, mes, dia, falta, classe = '') => `
    <li class="data ${classe}">
      <div class="folha"><span class="mes">${mes}</span><span class="dia${String(dia).length > 2 ? ' longo' : ''}">${dia}</span></div>
      <div>
        <h3>${esc(d.nome)}</h3>
        ${d.extra ? `<span class="extra">${esc(d.extra)}</span>` : ''}
        <p>${esc(d.nota)}</p>
        ${d.aviso ? `<p class="aviso">${d.aviso}</p>` : ''}
        <div class="data-pe">
          <span class="falta">${falta}</span>
          ${camada(d.camada)}
        </div>
      </div>
    </li>`;

  document.getElementById('datas').innerHTML = [
    ...secretas.map(d => linha(d, '?', '??', 'você sabe qual é 😏')),
    ...ordenadas.map((d, n) => {
      const [mes, dia] = d.folha || [d.tipo === 'mensal' ? 'todo dia' : MESES[d.quando.getMonth()], d.quando.getDate()];
      const falta = d.falta || contagem(d.faltam);
      return linha(
        { ...d, extra: rotulo(d) },
        mes, dia,
        n === 0 ? `a próxima! ${falta}` : falta,
        n === 0 ? 'proxima' : '');
    }),
    ...sempre.map(d => linha(d, 'sempre', '∞', d.tipo === 'periodo' ? 'em breve…' : 'a qualquer momento')),
  ].join('');
}

/* ---------------- Home ---------------- */

function renderTopo(lista) {
  const [legenda, sub] = (lista.legenda || '').split(' · ');
  document.getElementById('frase-lista').textContent = lista.frase || '';
  document.getElementById('nome-lista').textContent = lista.nome;
  document.getElementById('legenda-lista').innerHTML = `${esc(legenda)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  const img = document.getElementById('foto-lista');
  if (lista.fotoUrl) {
    img.src = lista.fotoUrl;
    img.alt = `Foto de ${lista.nome}`;
    img.hidden = false;
  }
}

function renderHome({ lista, itens, precos, datas }) {
  renderTopo(lista);
  renderDatas(datas);
  let categoria = 'todas';

  document.getElementById('atalhos').innerHTML = TIPOS.map(t =>
    `<a class="tier-${t.nivel}" href="#camada-${t.id}">${t.nome}</a>`).join('');

  const filtros = document.getElementById('filters');
  const usadas = Object.keys(CATEGORIAS).filter(c => itens.some(i => i.categoria === c));
  filtros.innerHTML = ['todas', ...usadas].map(c => `
    <button class="chip" data-cat="${c}" aria-pressed="${c === categoria}">
      ${c === 'todas' ? 'Todas' : CATEGORIAS[c]}
    </button>`).join('');

  filtros.addEventListener('click', e => {
    const botao = e.target.closest('.chip');
    if (!botao) return;
    categoria = botao.dataset.cat;
    filtros.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b === botao));
    desenhar();
  });

  function desenhar() {
    const visiveis = itens.filter(i => categoria === 'todas' || i.categoria === categoria);
    const html = TIPOS.map(t => {
      const doTipo = visiveis.filter(i => camadaDoItem(i, precos) === t);
      if (!doTipo.length) return '';
      return `
        <section class="tier tier-${t.nivel}" id="camada-${t.id}">
          <header class="tier-head">
            <span class="tier-num">${t.nivel}</span>
            <div>
              <h2>${t.nome}${t.obs ? ` <small class="tier-obs">${t.obs}</small>` : ''}</h2>
              <p>${t.desc} · <span class="faixa">${t.faixa}</span></p>
            </div>
          </header>
          <div class="grid">${doTipo.map(i => card(i, precos)).join('')}</div>
        </section>`;
    }).join('');
    document.getElementById('tiers').innerHTML = html || '<p class="vazio">Nenhum desejo nessa categoria (ainda).</p>';
  }

  desenhar();
}

/* ---------------- Página do item ---------------- */

function renderItem({ lista, itens, precos }) {
  const el = document.getElementById('item');
  const id = new URLSearchParams(location.search).get('id');
  const item = itens.find(i => i.id === id);
  if (!item) {
    el.innerHTML = '<p class="vazio">Desejo não encontrado. <a href="index.html">Voltar para a lista</a></p>';
    return;
  }

  document.title = `${item.nome} · Desejos da ${lista.nome}`;
  const tipo = camadaDoItem(item, precos);
  const top = ofertas(precos, item.id).slice(0, MAX_LOJAS);
  const indisponiveis = (precos.itens[item.id] || []).filter(o => !o.disponivel);
  const menor = top[0] && top[0].preco;

  const linhas = top.map((o, n) => {
    const caiu = queda(o);
    const extra = n === 0
      ? '<span class="badge">melhor preço</span>'
      : `<small>+ ${brl(o.preco - menor)}</small>`;
    return `
      <li class="${n === 0 ? 'melhor' : ''}">
        <span class="pos">${n + 1}</span>
        <div class="loja">
          <strong>${esc(o.loja)}</strong>
          ${extra}
          ${caiu ? `<small>${caiu}% abaixo do preço anterior</small>` : ''}
        </div>
        <span class="valor">${brl(o.preco)}</span>
        ${o.url ? `<a class="btn" href="${esc(o.url)}" target="_blank" rel="noopener">ver na loja</a>` : '<span></span>'}
      </li>`;
  }).join('');

  el.innerHTML = `
    <a class="voltar" href="index.html">← todos os desejos</a>

    <div class="item-hero tier-${tipo.nivel}">
      <div class="thumb grande">${foto(item)}</div>
      <div>
        <div class="tags">
          <span class="tag">Nível ${tipo.nivel} · ${tipo.nome}</span>
          <span class="tag">${esc(CATEGORIAS[item.categoria] || item.categoria)}</span>
        </div>
        <h1>${esc(item.nome)}</h1>
        <p class="lead">${esc(item.descricao)}</p>
        ${item.detalhes ? `<p class="detalhes">${esc(item.detalhes)}</p>` : ''}
        ${item.comentario ? `<div class="nota-carol"><span>nota da ${esc(lista.nome)}</span><p>${esc(item.comentario)}</p></div>` : ''}
      </div>
    </div>

    ${!top.length && item.estimado ? secaoExperiencia(item) : `
    <section class="ofertas">
      <h2>Onde encontrar</h2>
      <p class="ofertas-sub">
        ${top.length
          ? `${top.length === 1 ? 'A opção encontrada' : `As ${top.length} opções mais em conta`}, da mais barata para a mais cara`
          : 'Ainda não encontramos esse item em nenhuma loja.'}
      </p>
      <ol class="lista">${linhas}</ol>
      ${indisponiveis.length ? `<p class="indisp">Indisponível no momento em: ${indisponiveis.map(o => o.loja).join(', ')}</p>` : ''}
      <p class="nota">Preços atualizados em ${dataBR(precos.atualizado_em)}. Confira sempre na loja antes de comprar ♡</p>
    </section>`}`;
}

// Itens de valor estimado (lugares, shows, viagens, delivery): pra 2 pessoas, salvo "individual": true (ex.: flores)
function secaoExperiencia(item) {
  const links = (item.links || []).map((l, n) => `
    <li class="${n === 0 ? 'melhor' : ''}">
      <span class="pos">${n + 1}</span>
      <div class="loja">
        <strong>${esc(l.nome)}</strong>
        ${l.obs ? `<small>${esc(l.obs)}</small>` : ''}
      </div>
      <span class="valor"></span>
      <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">ver</a>
    </li>`).join('');
  return `
    <section class="ofertas">
      <h2>${item.titulo_links || 'Como realizar'}</h2>
      ${item.simulacao ? `<p class="simulacao">✈️ Isto é uma <strong>simulação</strong>: os valores podem mudar até a viagem acontecer, mas o sonho continua firme na lista de desejos ♥</p>` : ''}
      <div class="estimativa">
        <div><span>valor estimado${item.individual ? '' : ' pra 2 pessoas'}</span><strong>~${brl(item.estimado)}</strong>${item.estimado_nota ? `<small>${esc(item.estimado_nota)}</small>` : ''}</div>
        <div><span>quando</span><strong class="quando">${esc(item.quando || 'sem data definida')}</strong></div>
      </div>
      ${item.custos ? `
      <h3 class="sub-secao">De onde vem esse valor</h3>
      <ul class="custos">
        ${item.custos.map(c => `
          <li><span>${esc(c.item)}${c.obs ? `<small>${esc(c.obs)}</small>` : ''}</span><strong>${brl(c.valor)}</strong></li>`).join('')}
        <li class="total"><span>Total estimado</span><strong>~${brl(item.estimado)}</strong></li>
      </ul>` : ''}
      ${item.roteiro ? `
      <h3 class="sub-secao">Sugestão de roteiro</h3>
      <ol class="roteiro">
        ${item.roteiro.map(r => `<li><span class="quando-dia">${esc(r.dia)}</span><div><strong>${esc(r.titulo)}</strong><p>${esc(r.texto)}</p></div></li>`).join('')}
      </ol>` : ''}
      ${links ? `<h3 class="sub-secao">Links úteis</h3><ol class="lista">${links}</ol>` : ''}
      <p class="nota">Valores aproximados${item.pesquisado_em ? `, pesquisados em ${dataBR(item.pesquisado_em)}` : ''}. Confirme no site antes de reservar ♡</p>
    </section>`;
}

/* ---------------- Seletor de estilo ---------------- */

function montarSeletorDeEstilo() {
  const atual = document.documentElement.dataset.theme;
  const barra = document.createElement('div');
  barra.className = 'estilos';
  barra.innerHTML = '<span>estilo:</span>' + ESTILOS.map(e =>
    `<button type="button" data-estilo="${e.id}" aria-pressed="${e.id === atual}">${e.nome}</button>`).join('');
  barra.addEventListener('click', e => {
    const botao = e.target.closest('button');
    if (!botao) return;
    document.documentElement.dataset.theme = botao.dataset.estilo;
    try { localStorage.setItem('estilo', botao.dataset.estilo); } catch (err) {}
    barra.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === botao));
  });
  document.body.appendChild(barra);
}

/* ---------------- Início ---------------- */

// Barra do topo: troca de lista (se tiver mais de uma), atalho do admin e sair
function montarConta(listas, atual) {
  const conta = document.getElementById('conta');
  const seletor = listas.length > 1
    ? `<select id="trocar-lista" aria-label="Trocar de lista">${listas.map(l =>
        `<option value="${esc(l.slug)}" ${l.slug === atual.slug ? 'selected' : ''}>lista: ${esc(l.nome)}</option>`).join('')}</select>`
    : '';
  conta.innerHTML = `${seletor}
    ${atual.papel === 'dono' ? '<a class="admin-link" href="admin.html">admin</a>' : ''}
    <button type="button" id="sair">sair</button>`;
  document.getElementById('sair').addEventListener('click', sair);
  document.getElementById('trocar-lista')?.addEventListener('change', e => {
    lembrarLista(e.target.value);
    location.href = 'index.html';
  });
  document.getElementById('brand').textContent = `desejos da ${atual.nome.toLowerCase()} ♥`;
  document.title = document.body.dataset.page === 'home' ? `Desejos da ${atual.nome}` : document.title;
}

async function iniciar() {
  await exigirLogin();
  const listas = await minhasListas();
  if (!listas.length) {
    document.querySelector('main').innerHTML = '<p class="vazio">Seu usuário ainda não tem nenhuma lista liberada.</p>';
    return;
  }
  const lista = escolherLista(listas);
  montarConta(listas, lista);
  const dados = await carregarLista(lista);
  document.getElementById('footer').textContent =
    `feito com carinho (e um pouco de teimosia) · preços de ${dataBR(dados.precos.atualizado_em)}`;
  if (document.body.dataset.page === 'item') renderItem(dados);
  else renderHome(dados);
}

montarSeletorDeEstilo();
// A página de admin reaproveita as constantes daqui, mas tem a própria inicialização
if (['home', 'item'].includes(document.body.dataset.page)) {
  iniciar().catch(err => {
    if (err.message === 'sem sessão') return;
    console.error(err);
    document.querySelector('main').innerHTML = '<p class="vazio">Não consegui carregar a lista agora. Tenta recarregar a página?</p>';
  });
}
