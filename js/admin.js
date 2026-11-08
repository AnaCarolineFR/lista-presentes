// Página de admin: só a dona da lista entra. Cadastra, edita e apaga desejos,
// troca o topo da lista e envia fotos pro Storage.

const painel = document.getElementById('admin');
let lista;
let itens = [];
let precos = { itens: {} };
let datas = [];

// Tipos de data do calendário (coluna "tipo"; vazio = data fixa no ano)
const TIPOS_DATA = [
  { id: '',            nome: 'data fixa (todo ano)' },
  { id: 'mensal',      nome: 'todo mês' },
  { id: 'periodo',     nome: 'período (datas que mudam)' },
  { id: 'pascoa',      nome: 'Páscoa (calculada todo ano)' },
  { id: 'blackfriday', nome: 'Black Friday (calculada todo ano)' },
  { id: 'sempre',      nome: 'a qualquer momento' },
];
// Camadas que podem ser sugeridas numa data (Sonhos fica de fora)
const CAMADAS_DATA = TIPOS.filter(t => t.id !== 'sonho');
const MESES_NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'desejo';
// Aceita "1.234,56", "49,90" e "49.90"
function num(v) {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
}
const ext = arquivo => (arquivo.name.split('.').pop() || 'jpg').toLowerCase();

function lerJson(texto, campo) {
  if (!texto.trim()) return null;
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw new Error(`O campo "${campo}" não é um JSON válido.`);
  }
}

function slugUnico(base) {
  let id = base;
  for (let n = 2; itens.some(i => i.id === id); n++) id = `${base}-${n}`;
  return id;
}

async function enviarFoto(caminho, arquivo) {
  const { error } = await db.storage.from(BUCKET).upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) throw error;
}

async function recarregar() {
  const dados = await carregarLista(lista);
  lista = { ...lista, ...dados.lista };
  itens = dados.itens;
  precos = dados.precos;
  datas = dados.datas;
  renderPainel();
}

/* ---------------- Painel ---------------- */

function linhaItem(i) {
  const t = camadaDoItem(i, precos);
  const lojas = ofertas(precos, i.id);
  const valor = lojas.length ? brl(lojas[0].preco) : i.estimado ? `~${brl(i.estimado)}` : 'sem preço';
  const semFoto = i.imagem && !i.imagemUrl ? ' · <em>foto não enviada</em>' : '';
  return `
    <li>
      <div class="thumb mini tier-${t.nivel}">${foto(i)}</div>
      <div class="admin-info">
        <strong>${esc(i.nome)}</strong>
        <small>${esc(CATEGORIAS[i.categoria] || i.categoria)} · ${t.nome} · ${valor}${semFoto}</small>
      </div>
      <div class="admin-acoes">
        <button type="button" data-editar="${esc(i.id)}">editar</button>
        <button type="button" data-apagar="${esc(i.id)}">apagar</button>
      </div>
    </li>`;
}

const dd = n => String(n).padStart(2, '0');
const isoParaBR = s => s.split('-').reverse().slice(0, 2).join('/');

// Resumo de quando a data acontece, pra lista do admin
function quandoData(d) {
  switch (d.tipo) {
    case 'mensal': return d.dia ? `todo dia ${d.dia}` : 'todo mês (sem dia)';
    case 'periodo': return (d.periodos || []).map(([i, f]) => `${isoParaBR(i)}–${isoParaBR(f)}`).join(', ') || 'nenhum período cadastrado';
    case 'pascoa': return 'Páscoa (muda todo ano)';
    case 'blackfriday': return 'Black Friday (muda todo ano)';
    case 'sempre': return 'a qualquer momento';
    default: return d.dia && d.mes ? `${dd(d.dia)}/${dd(d.mes)}` : 'sem data';
  }
}

// Rótulo curtinho pro quadradinho da lista
function curtoData(d) {
  switch (d.tipo) {
    case 'mensal': return d.dia ? `dia ${d.dia}` : 'mês';
    case 'periodo': return d.periodos?.[0] ? isoParaBR(d.periodos[0][0]) : '?';
    case 'pascoa': return '🐣';
    case 'blackfriday': return '🛍️';
    case 'sempre': return '∞';
    default: return d.dia && d.mes ? `${dd(d.dia)}/${dd(d.mes)}` : '?';
  }
}

function linhaData(d) {
  const sugestao = String(d.camada || '').split(',')
    .map(id => CAMADAS_DATA.find(t => t.id === id)?.nome).filter(Boolean).join(' · ');
  return `
    <li>
      <div class="thumb mini data-mini">${esc(curtoData(d))}</div>
      <div class="admin-info">
        <strong>${esc(d.nome)}</strong>
        <small>${esc(quandoData(d))}${sugestao ? ` · sugestão: ${sugestao}` : ''}</small>
      </div>
      <div class="admin-acoes">
        <button type="button" data-editar-data="${d.id}">editar</button>
        <button type="button" data-apagar-data="${d.id}">apagar</button>
      </div>
    </li>`;
}

function renderPainel() {
  const faltando = itens.filter(i => i.imagem && !i.imagemUrl).length + (lista.foto && !lista.fotoUrl ? 1 : 0);
  painel.innerHTML = `
    <section class="admin-bloco">
      <div class="admin-titulo">
        <h1>Desejos <small>${itens.length}</small></h1>
        <button type="button" class="btn" id="novo">+ novo desejo</button>
      </div>
      <ul class="admin-itens">${itens.map(linhaItem).join('')}</ul>
    </section>

    <section class="admin-bloco">
      <div class="admin-titulo">
        <h1>Calendário de datas <small>${datas.length}</small></h1>
        <button type="button" class="btn" id="nova-data">+ nova data</button>
      </div>
      <ul class="admin-itens">${datas.map(linhaData).join('') || '<li class="vazio">Nenhuma data ainda.</li>'}</ul>
    </section>

    <section class="admin-bloco">
      <h2>Topo da lista</h2>
      <form class="admin-form grade" id="form-topo">
        <label>nome <input name="nome" required value="${esc(lista.nome)}"></label>
        <label>frase do topo <input name="frase" value="${esc(lista.frase)}"></label>
        <label class="largo">legenda da foto <small>(use " · " pra quebrar em duas linhas)</small>
          <input name="legenda" value="${esc(lista.legenda)}"></label>
        <label>foto <input type="file" name="foto" accept="image/*"></label>
        <div class="admin-botoes"><button class="btn" type="submit">salvar topo</button></div>
      </form>
    </section>

    <section class="admin-bloco">
      <h2>Enviar fotos em lote ${faltando ? `<small>${faltando} faltando</small>` : ''}</h2>
      <p class="lead">Selecione várias fotos de uma vez: cada arquivo vai pro desejo que tem o mesmo nome de arquivo
        (ex.: <code>lindor.jpg</code>). Serve pra subir as fotos que já existiam antes do banco.</p>
      <form class="admin-form" id="form-lote">
        <input type="file" name="fotos" accept="image/*" multiple>
        <p class="nota" id="resultado-lote"></p>
        <div class="admin-botoes"><button class="btn" type="submit">enviar fotos</button></div>
      </form>
    </section>`;
}

/* ---------------- Formulário do desejo ---------------- */

function linhaLoja(o = {}) {
  return `
    <tr>
      <td><input name="loja" value="${esc(o.loja)}" placeholder="Amazon" aria-label="loja"></td>
      <td><input name="url" value="${esc(o.url)}" placeholder="https://…" aria-label="link"></td>
      <td><input name="preco" inputmode="decimal" value="${o.preco ?? ''}" placeholder="49,90" aria-label="preço"></td>
      <td><input name="preco_anterior" inputmode="decimal" value="${o.preco_anterior ?? ''}" aria-label="preço anterior"></td>
      <td><input type="checkbox" name="disponivel" ${o.disponivel !== false ? 'checked' : ''} aria-label="disponível"></td>
      <td><button type="button" class="link" data-remover-loja aria-label="remover loja">×</button></td>
    </tr>`;
}

function renderForm(item) {
  const novo = !item;
  item = item || { categoria: 'aleatorio' };
  const lojas = novo ? [] : (precos.itens[item.id] || []);
  const modo = item.estimado && !lojas.length ? 'estimado' : 'lojas';
  const jsonBonito = v => (v ? esc(JSON.stringify(v, null, 2)) : '');

  painel.innerHTML = `
    <section class="admin-bloco">
      <form class="admin-form" id="form-item" data-id="${esc(item.id || '')}">
        <div class="admin-titulo">
          <h1>${novo ? 'Novo desejo' : 'Editar desejo'}</h1>
          <button type="button" class="link" id="voltar">← voltar</button>
        </div>

        <div class="grade">
          <label class="largo">nome * <input name="nome" required value="${esc(item.nome)}"></label>
          <label>categoria
            <select name="categoria">${Object.entries(CATEGORIAS).map(([k, v]) =>
              `<option value="${k}" ${k === item.categoria ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>camada
            <select name="tipo"><option value="">automática (pelo preço)</option>${TIPOS.map(t =>
              `<option value="${t.id}" ${t.id === item.tipo ? 'selected' : ''}>${t.nome}</option>`).join('')}</select></label>
          <label class="largo">descrição <textarea name="descricao" rows="2">${esc(item.descricao)}</textarea></label>
          <label class="largo">detalhes (tamanho, cor…) <input name="detalhes" value="${esc(item.detalhes)}"></label>
          <label class="largo">nota da ${esc(lista.nome)} <input name="comentario" value="${esc(item.comentario)}"></label>
          <label>foto ${item.imagemUrl ? '<small>(já tem; envie outra pra trocar)</small>' : ''}
            <input type="file" name="foto" accept="image/*"></label>
          <label>emoji (se não tiver foto) <input name="emoji" maxlength="8" value="${esc(item.emoji)}"></label>
        </div>

        <fieldset class="modo">
          <legend>preço</legend>
          <label class="radio"><input type="radio" name="modo" value="lojas" ${modo === 'lojas' ? 'checked' : ''}> comparar lojas</label>
          <label class="radio"><input type="radio" name="modo" value="estimado" ${modo === 'estimado' ? 'checked' : ''}> valor estimado (viagens, experiências)</label>
        </fieldset>

        <div id="bloco-lojas" ${modo !== 'lojas' ? 'hidden' : ''}>
          <div class="tabela-rolagem">
            <table class="lojas-form">
              <thead><tr><th>loja</th><th>link</th><th>preço</th><th>preço anterior</th><th>disponível</th><th></th></tr></thead>
              <tbody id="linhas-lojas">${(lojas.length ? lojas : [{}]).map(linhaLoja).join('')}</tbody>
            </table>
          </div>
          <button type="button" class="link" id="add-loja">+ adicionar loja</button>
        </div>

        <div id="bloco-estimado" class="grade" ${modo !== 'estimado' ? 'hidden' : ''}>
          <label>valor estimado (R$) <input name="estimado" inputmode="decimal" value="${item.estimado ?? ''}"></label>
          <label>o que inclui <input name="estimado_nota" value="${esc(item.estimado_nota)}"></label>
          <label>quando <input name="quando" value="${esc(item.quando)}"></label>
          <label>título da seção <input name="titulo_links" placeholder="Como realizar" value="${esc(item.titulo_links)}"></label>
          <label class="check"><input type="checkbox" name="individual" ${item.individual ? 'checked' : ''}> valor pra 1 pessoa (o padrão é 2)</label>
          <label class="check"><input type="checkbox" name="simulacao" ${item.simulacao ? 'checked' : ''}> é uma simulação (viagem)</label>
          <details class="largo">
            <summary>avançado: links, custos e roteiro (JSON)</summary>
            <label>links <textarea name="links" rows="4" placeholder='[{"nome": "Site", "obs": "", "url": "https://…"}]'>${jsonBonito(item.links)}</textarea></label>
            <label>custos <small>(se preencher, o valor estimado vira a soma)</small>
              <textarea name="custos" rows="4" placeholder='[{"item": "Hotel", "obs": "2 noites", "valor": 600}]'>${jsonBonito(item.custos)}</textarea></label>
            <label>roteiro <textarea name="roteiro" rows="4" placeholder='[{"dia": "Dia 1", "titulo": "Chegada", "texto": "…"}]'>${jsonBonito(item.roteiro)}</textarea></label>
          </details>
        </div>

        <p class="login-erro" id="erro-form" role="alert" hidden></p>
        <div class="admin-botoes"><button class="btn" type="submit">salvar</button></div>
      </form>
    </section>`;
  window.scrollTo(0, 0);
}

async function salvarItem(form) {
  const f = form.elements;
  const original = itens.find(i => i.id === form.dataset.id);
  const modo = form.modo.value;
  const id = original ? original.id : slugUnico(slugify(f.nome.value));

  const registro = {
    lista_id: lista.id,
    id,
    ordem: original ? original.ordem : Math.max(-1, ...itens.map(i => i.ordem)) + 1,
    nome: f.nome.value.trim(),
    categoria: f.categoria.value,
    tipo: f.tipo.value || null,
    descricao: f.descricao.value.trim() || null,
    detalhes: f.detalhes.value.trim() || null,
    comentario: f.comentario.value.trim() || null,
    emoji: f.emoji.value.trim() || null,
    imagem: original ? original.imagem : null,
    estimado: null, estimado_nota: null, quando: null, titulo_links: null,
    individual: false, simulacao: false, links: null, custos: null, roteiro: null,
  };

  if (modo === 'estimado') {
    Object.assign(registro, {
      estimado: num(f.estimado.value),
      estimado_nota: f.estimado_nota.value.trim() || null,
      quando: f.quando.value.trim() || null,
      titulo_links: f.titulo_links.value.trim() || null,
      individual: f.individual.checked,
      simulacao: f.simulacao.checked,
      links: lerJson(f.links.value, 'links'),
      custos: lerJson(f.custos.value, 'custos'),
      roteiro: lerJson(f.roteiro.value, 'roteiro'),
    });
    if (registro.custos) registro.estimado = registro.custos.reduce((s, c) => s + Number(c.valor || 0), 0);
    if (!registro.estimado) throw new Error('Informe o valor estimado (ou os custos).');
  }

  const lojas = modo === 'lojas'
    ? [...form.querySelectorAll('#linhas-lojas tr')].map(tr => ({
        loja: tr.querySelector('[name=loja]').value.trim(),
        url: tr.querySelector('[name=url]').value.trim() || null,
        preco: num(tr.querySelector('[name=preco]').value),
        preco_anterior: num(tr.querySelector('[name=preco_anterior]').value),
        disponivel: tr.querySelector('[name=disponivel]').checked,
      })).filter(o => o.loja)
    : [];
  if (lojas.some(o => o.disponivel && !o.preco)) throw new Error('Toda loja disponível precisa de um preço.');

  const arquivo = f.foto.files[0];
  if (arquivo) {
    registro.imagem = `${lista.id}/itens/${id}.${ext(arquivo)}`;
    await enviarFoto(registro.imagem, arquivo);
  }

  const { error } = await db.from('itens').upsert(registro);
  if (error) throw error;

  // Preços: troca todos os do item pelos do formulário
  const apagou = await db.from('precos').delete().eq('lista_id', lista.id).eq('item_id', id);
  if (apagou.error) throw apagou.error;
  if (lojas.length) {
    const { error: erroPrecos } = await db.from('precos')
      .insert(lojas.map(o => ({ ...o, preco: o.preco || 0, lista_id: lista.id, item_id: id })));
    if (erroPrecos) throw erroPrecos;
  }
}

async function apagarItem(id) {
  const item = itens.find(i => i.id === id);
  if (!item || !confirm(`Apagar "${item.nome}"? Não dá pra desfazer.`)) return;
  const { error } = await db.from('itens').delete().eq('lista_id', lista.id).eq('id', id);
  if (error) throw error;
  if (item.imagem) await db.storage.from(BUCKET).remove([item.imagem]);
  await recarregar();
}

async function salvarTopo(form) {
  const f = form.elements;
  const mudancas = { nome: f.nome.value.trim(), frase: f.frase.value.trim() || null, legenda: f.legenda.value.trim() || null };
  const arquivo = f.foto.files[0];
  if (arquivo) {
    mudancas.foto = `${lista.id}/topo.${ext(arquivo)}`;
    await enviarFoto(mudancas.foto, arquivo);
  }
  const { error } = await db.from('listas').update(mudancas).eq('id', lista.id);
  if (error) throw error;
  Object.assign(lista, mudancas);
  await recarregar();
}

// Cada arquivo vai pro item (ou pro topo) cujo caminho termina com o mesmo nome
async function enviarLote(form) {
  const saida = document.getElementById('resultado-lote');
  const destinos = [
    ...itens.filter(i => i.imagem).map(i => i.imagem),
    ...(lista.foto ? [lista.foto] : []),
  ];
  let enviadas = 0;
  const ignoradas = [];
  for (const arquivo of form.elements.fotos.files) {
    const caminho = destinos.find(c => c.split('/').pop() === arquivo.name);
    if (!caminho) { ignoradas.push(arquivo.name); continue; }
    saida.textContent = `enviando ${arquivo.name}…`;
    await enviarFoto(caminho, arquivo);
    enviadas++;
  }
  await recarregar();
  document.getElementById('resultado-lote').textContent =
    `${enviadas} foto(s) enviada(s).` + (ignoradas.length ? ` Sem desejo correspondente: ${ignoradas.join(', ')}` : '');
}

/* ---------------- Formulário de data ---------------- */

function linhaPeriodo([inicio, fim] = ['', '']) {
  return `
    <tr>
      <td><input type="date" name="inicio" value="${esc(inicio)}" aria-label="início"></td>
      <td><input type="date" name="fim" value="${esc(fim)}" aria-label="fim"></td>
      <td><button type="button" class="link" data-remover-periodo aria-label="remover período">×</button></td>
    </tr>`;
}

// Mostra só os campos que fazem sentido pro tipo escolhido (data-campos="fixa mensal")
function mostrarCamposData(form) {
  const chave = form.tipo.value || 'fixa';
  form.querySelectorAll('[data-campos]').forEach(el => {
    el.hidden = !el.dataset.campos.split(' ').includes(chave);
  });
}

function renderFormData(d) {
  const nova = !d;
  d = d || { tipo: null, camada: 'mimo,facil' };
  const sugeridas = String(d.camada || '').split(',');

  painel.innerHTML = `
    <section class="admin-bloco">
      <form class="admin-form" id="form-data" data-id="${d.id ?? ''}">
        <div class="admin-titulo">
          <h1>${nova ? 'Nova data' : 'Editar data'}</h1>
          <button type="button" class="link" id="voltar">← voltar</button>
        </div>

        <div class="grade">
          <label class="largo">nome * <input name="nome" required value="${esc(d.nome)}" placeholder="Dia do Sorvete"></label>
          <label class="largo">texto (aparece na folhinha) <input name="nota" value="${esc(d.nota)}" placeholder="Sorvete conta como presente, sim."></label>
          <label class="largo">tipo
            <select name="tipo">${TIPOS_DATA.map(t =>
              `<option value="${t.id}" ${t.id === (d.tipo || '') ? 'selected' : ''}>${t.nome}</option>`).join('')}</select></label>

          <label data-campos="fixa mensal">dia <input name="dia" type="number" min="1" max="31" value="${d.dia ?? ''}"></label>
          <label data-campos="fixa">mês
            <select name="mes"><option value="">—</option>${MESES_NOMES.map((m, i) =>
              `<option value="${i + 1}" ${i + 1 === d.mes ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>

        <div data-campos="periodo">
          <p class="nota">Cadastre os próximos períodos. O site mostra o primeiro que ainda não terminou.</p>
          <table class="lojas-form periodos-form">
            <thead><tr><th>início</th><th>fim</th><th></th></tr></thead>
            <tbody id="linhas-periodos">${(d.periodos?.length ? d.periodos : [undefined]).map(p => linhaPeriodo(p)).join('')}</tbody>
          </table>
          <button type="button" class="link" id="add-periodo">+ adicionar período</button>
        </div>

        <details data-campos="fixa mensal" ${d.desdeAno ? 'open' : ''}>
          <summary>contagem (opcional): "faço 28 anos", "12º mês juntos"…</summary>
          <div class="grade">
            <label>ano em que começou <input name="desde_ano" type="number" min="1900" max="2100" value="${d.desdeAno ?? ''}" placeholder="2000"></label>
            <label data-campos="mensal">mês em que começou
              <select name="desde_mes"><option value="">—</option>${MESES_NOMES.map((m, i) =>
                `<option value="${i + 1}" ${i + 1 === d.desdeMes ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            <label class="largo">texto da contagem <small>(use {n} no lugar do número)</small>
              <input name="rotulo" value="${esc(d.rotulo)}" placeholder="faço {n} anos 😌"></label>
          </div>
        </details>

        <fieldset class="modo">
          <legend>sugestão de camadas</legend>
          ${CAMADAS_DATA.map(t => `
            <label class="check"><input type="checkbox" name="camada" value="${t.id}" ${sugeridas.includes(t.id) ? 'checked' : ''}> ${t.nome}</label>`).join('')}
        </fieldset>

        <p class="login-erro" id="erro-form" role="alert" hidden></p>
        <div class="admin-botoes"><button class="btn" type="submit">salvar</button></div>
      </form>
    </section>`;
  mostrarCamposData(document.getElementById('form-data'));
  window.scrollTo(0, 0);
}

async function salvarData(form) {
  const f = form.elements;
  const tipo = f.tipo.value || null;
  const inteiro = v => (v === '' ? null : parseInt(v, 10));
  const usa = campo => [...form.querySelectorAll(`[data-campos]`)]
    .some(el => !el.hidden && el.querySelector(`[name=${campo}]`));

  const registro = {
    lista_id: lista.id,
    nome: f.nome.value.trim(),
    nota: f.nota.value.trim() || null,
    tipo,
    dia: usa('dia') ? inteiro(f.dia.value) : null,
    mes: usa('mes') ? inteiro(f.mes.value) : null,
    desde_ano: usa('desde_ano') ? inteiro(f.desde_ano.value) : null,
    desde_mes: tipo === 'mensal' ? inteiro(f.desde_mes.value) : null,
    rotulo: usa('rotulo') ? (f.rotulo.value.trim() || null) : null,
    camada: [...form.querySelectorAll('[name=camada]:checked')].map(c => c.value).join(',') || null,
    periodos: null,
  };

  if (!tipo && !(registro.dia && registro.mes)) throw new Error('Data fixa precisa de dia e mês.');
  if (tipo === 'mensal' && !registro.dia) throw new Error('Informe o dia do mês.');
  if (registro.dia && (registro.dia < 1 || registro.dia > 31)) throw new Error('O dia precisa estar entre 1 e 31.');
  if (registro.rotulo && !registro.desde_ano) throw new Error('Pra usar a contagem, informe o ano em que começou.');
  if (tipo === 'mensal' && registro.desde_ano && !registro.desde_mes) throw new Error('Pra contar os meses, informe também o mês em que começou.');

  if (tipo === 'periodo') {
    registro.periodos = [...form.querySelectorAll('#linhas-periodos tr')]
      .map(tr => [tr.querySelector('[name=inicio]').value, tr.querySelector('[name=fim]').value])
      .filter(([i, f]) => i || f);
    if (registro.periodos.some(([i, f]) => !i || !f || f < i)) throw new Error('Cada período precisa de início e fim, com o fim depois do início.');
    registro.periodos.sort((a, b) => a[0].localeCompare(b[0]));
  }

  const id = form.dataset.id;
  const { error } = id
    ? await db.from('datas').update(registro).eq('id', id)
    : await db.from('datas').insert({ ...registro, ordem: Math.max(-1, ...datas.map(d => d.ordem)) + 1 });
  if (error) throw error;
}

async function apagarData(id) {
  const d = datas.find(x => String(x.id) === String(id));
  if (!d || !confirm(`Apagar "${d.nome}" do calendário?`)) return;
  const { error } = await db.from('datas').delete().eq('id', id);
  if (error) throw error;
  await recarregar();
}

/* ---------------- Eventos ---------------- */

async function tentar(acao, botao) {
  const erro = document.getElementById('erro-form');
  if (erro) erro.hidden = true;
  if (botao) { botao.disabled = true; botao.dataset.texto = botao.textContent; botao.textContent = 'salvando…'; }
  try {
    await acao();
  } catch (e) {
    console.error(e);
    const msg = e.message || 'Algo deu errado. Tenta de novo?';
    if (erro) { erro.textContent = msg; erro.hidden = false; } else alert(msg);
  } finally {
    if (botao && botao.isConnected) { botao.disabled = false; botao.textContent = botao.dataset.texto; }
  }
}

painel.addEventListener('click', e => {
  const alvo = e.target.closest('button');
  if (!alvo) return;
  if (alvo.id === 'novo') renderForm();
  else if (alvo.id === 'voltar') renderPainel();
  else if (alvo.id === 'add-loja') document.getElementById('linhas-lojas').insertAdjacentHTML('beforeend', linhaLoja());
  else if (alvo.hasAttribute('data-remover-loja')) alvo.closest('tr').remove();
  else if (alvo.dataset.editar) renderForm(itens.find(i => i.id === alvo.dataset.editar));
  else if (alvo.dataset.apagar) tentar(() => apagarItem(alvo.dataset.apagar));
  else if (alvo.id === 'nova-data') renderFormData();
  else if (alvo.id === 'add-periodo') document.getElementById('linhas-periodos').insertAdjacentHTML('beforeend', linhaPeriodo());
  else if (alvo.hasAttribute('data-remover-periodo')) alvo.closest('tr').remove();
  else if (alvo.dataset.editarData) renderFormData(datas.find(d => String(d.id) === alvo.dataset.editarData));
  else if (alvo.dataset.apagarData) tentar(() => apagarData(alvo.dataset.apagarData));
});

painel.addEventListener('change', e => {
  if (e.target.name === 'tipo' && e.target.form?.id === 'form-data') mostrarCamposData(e.target.form);
  if (e.target.name !== 'modo') return;
  document.getElementById('bloco-lojas').hidden = e.target.value !== 'lojas';
  document.getElementById('bloco-estimado').hidden = e.target.value !== 'estimado';
});

painel.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const botao = form.querySelector('button[type=submit]');
  if (form.id === 'form-item') tentar(async () => { await salvarItem(form); await recarregar(); }, botao);
  if (form.id === 'form-data') tentar(async () => { await salvarData(form); await recarregar(); }, botao);
  if (form.id === 'form-topo') tentar(() => salvarTopo(form), botao);
  if (form.id === 'form-lote') tentar(() => enviarLote(form), botao);
});

/* ---------------- Início ---------------- */

async function iniciarAdmin() {
  await exigirLogin();
  document.getElementById('sair').addEventListener('click', sair);
  const minhas = (await minhasListas()).filter(l => l.papel === 'dono');
  if (!minhas.length) {
    painel.innerHTML = '<p class="vazio">Só a dona da lista pode entrar aqui. <a href="index.html">Voltar pra lista</a></p>';
    return;
  }
  lista = minhas[0];
  document.getElementById('brand').textContent = `admin · desejos da ${lista.nome.toLowerCase()}`;
  await recarregar();
}

iniciarAdmin().catch(err => {
  if (err.message === 'sem sessão') return;
  console.error(err);
  painel.innerHTML = '<p class="vazio">Não consegui abrir o admin agora. Tenta recarregar a página?</p>';
});
