(() => {
  'use strict';

  // pasta onde esta ficha mora (ex.: /player1/player1.html → "player1"); cada jogador tem a sua pasta e o seu <pasta>.json
  const DIR = (() => {
    const seg = location.pathname.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (_) { return s; } });
    const last = seg[seg.length - 1] || '';
    return (/\.[a-z0-9]+$/i.test(last) ? seg[seg.length - 2] : last) || 'player1';
  })();
  const API = '/api/ficha/' + encodeURIComponent(DIR);

  // mantém o acesso enquanto a página está aberta; ao fechar, a senha volta a ser pedida
  setInterval(() => { fetch('/api/ping/' + encodeURIComponent(DIR), { method: 'POST' }).catch(() => {}); }, 30000);
  addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/sair/' + encodeURIComponent(DIR)); } catch (_) { /* ignora */ } });
  const LS_KEY = 'coc-' + DIR;
  const UI_KEY = 'coc-ui-' + DIR;

  const CHARS = [
    ['str', 'Força'], ['con', 'Constituição'], ['siz', 'Tamanho'], ['dex', 'Destreza'],
    ['app', 'Aparência'], ['int', 'Inteligência'], ['pow', 'Poder'], ['edu', 'Educação']
  ];

  const DEFAULT_FIELDS = [
    ['nome', 'Nome'], ['jogador', 'Jogador'], ['ocupacao', 'Ocupação'], ['idade', 'Idade'],
    ['sexo', 'Sexo'], ['residencia', 'Residência'], ['local_nascimento', 'Local de nascimento']
  ];

  const MARKER_TYPES = {
    pv: 'Pontos de Vida', san: 'Sanidade', pm: 'Pontos de Magia', sorte: 'Sorte', custom: 'Novo marcador', livre: 'Novo marcador único'
  };
  const MARKER_MENU = [
    ['pv', 'Pontos de Vida'], ['san', 'Sanidade'], ['pm', 'Pontos de Magia'], ['sorte', 'Sorte'],
    ['custom', '+ Marcador personalizado'], ['livre', '+ Marcador personalizado único']
  ];
  const DEFAULT_MARKERS = ['pv', 'san', 'pm', 'sorte'].map(t => ({ tipo: t, nome: MARKER_TYPES[t] }));

  const CONDITION_PRESETS = [
    'Ferimento grave', 'Inconsciente', 'Morrendo', 'Sangrando', 'Insanidade temporária',
    'Insanidade indefinida', 'Fobia', 'Mania', 'Amedrontado', 'Atordoado', 'Exausto',
    'Envenenado', 'Paralisado', 'Cego', 'Surdo', 'Em chamas'
  ];

  // containers de texto padrão (os 10 primeiros vinham do formato antigo "hist")
  const OLD_HIST_KEYS = ['descricao', 'ideologia', 'pessoas', 'locais', 'pertences', 'tracos', 'ferimentos', 'fobias', 'tomos', 'encontros'];
  const DEFAULT_HIST = [
    'Descrição pessoal', 'Ideologia / Crenças', 'Pessoas significativas', 'Locais significativos',
    'Pertences queridos', 'Características', 'Ferimentos e cicatrizes', 'Fobias e manias',
    'Tomos arcanos, feitiços e artefatos', 'Encontros com entidades estranhas',
    'Companheiros de investigação', 'Anotações'
  ];
  const OLD_POSSES_KEYS = ['gastos', 'dinheiro', 'bens'];
  const DEFAULT_POSSES = ['Nível de gastos', 'Dinheiro', 'Bens'];

  // compatibilidade com o formato antigo do player1.json
  const OLD_STATES = {
    ferimento_grave: 'Ferimento grave', inconsciente: 'Inconsciente', morrendo: 'Morrendo',
    insanidade_temporaria: 'Insanidade temporária', insanidade_indefinida: 'Insanidade indefinida'
  };

  // [nome, base] — base pode ser número ou fórmula ('dex/2', 'edu')
  const DEFAULT_SKILLS = [
    ['Antropologia', 1], ['Arqueologia', 1], ['Armas de Fogo (Pistola)', 20],
    ['Armas de Fogo (Rifle/Espingarda)', 25], ['Armas de Fogo (Submetralhadora)', 15],
    ['Arte/Ofício (   )', 5], ['Arremessar', 20], ['Avaliação', 5], ['Charme', 15],
    ['Ciência (   )', 1], ['Cavalgar', 5], ['Contabilidade', 5], ['Consertos Elétricos', 10],
    ['Consertos Mecânicos', 10], ['Crédito', 0], ['Dirigir Automóvel', 20], ['Direito', 5],
    ['Disfarces', 5], ['Escalar', 20], ['Escutar', 20], ['Esquivar', 'dex/2'],
    ['Furtividade', 20], ['História', 5], ['Intimidação', 15], ['Lábia', 5],
    ['Língua Nativa (   )', 'edu'], ['Outra Língua (   )', 1], ['Lutar (Briga)', 25],
    ['Medicina', 1], ['Mitos de Cthulhu', 0], ['Mundo Natural', 10], ['Natação', 20],
    ['Navegação', 10], ['Encontrar', 25], ['Ocultismo', 5], ['Operar Maq. Pesada', 1],
    ['Persuasão', 10], ['Pilotar (   )', 1], ['Prestidigitação', 10], ['Primeiros Socorros', 30],
    ['Psicanálise', 1], ['Psicologia', 10], ['Rastrear', 10], ['Saltar', 20],
    ['Sobrevivência (   )', 10], ['Usar Bibliotecas', 20]
  ];

  const DEFAULT_WEAPONS = [
    { name: 'Desarmado', skill: 'Lutar (Briga)', damage: '1d3 + BD', range: 'Toque', attacks: '1', ammo: '—', malfunction: '—', desc: '' }
  ];

  const TABS = ['personagem', 'pericias', 'combate', 'historico'];

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = v => Number(v) || 0;
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => {
    const ks = p.split('.');
    let c = o;
    ks.slice(0, -1).forEach(k => { c = c[k] ??= {}; });
    c[ks[ks.length - 1]] = v;
  };
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  };
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  let derived = {};
  let editing = false;

  // preferências de interface (só neste navegador)
  let ui = {};
  try { ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (_) { ui = {}; }
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) { /* ignora */ } };

  // ---------- abas ----------
  function setTab(name, scroll) {
    if (!TABS.includes(name)) name = 'personagem';
    ui.tab = name;
    saveUi();
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('[data-tabbtn]').forEach(b => {
      const on = b.dataset.tabbtn === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (scroll) window.scrollTo({ top: 0 });
  }

  // ---------- campos do investigador ----------
  function addField(f) {
    const d = el('div', 'field', `
      <input class="f-label" type="text" placeholder="Nome do campo">
      <input class="f-value" type="text">
      <button type="button" class="del edit-only" title="Remover campo">✕</button>`);
    d.dataset.id = f.id || '';
    $('.f-label', d).value = f.nome ?? '';
    $('.f-value', d).value = f.valor ?? '';
    if (f.id === 'idade') $('.f-value', d).inputMode = 'numeric';
    $('#fields').appendChild(d);
    return d;
  }

  function getAge() {
    const row = $('#fields .field[data-id="idade"] .f-value');
    return row ? parseInt(row.value, 10) || 0 : 0;
  }

  // ---------- características ----------
  function addChar(c) {
    const d = el('div', 'char', `
      <div class="m-top">
        <input class="ch-name" type="text" placeholder="Nome">
        <span class="ch-btns">
          <button type="button" class="del edit-only" title="Remover característica">✕</button>
        </span>
      </div>
      <div class="m-body"><input class="ch-val" type="number" inputmode="numeric" min="0" max="999" aria-label="Valor"></div>
      <div class="sub"><span class="half ch-half">0</span><span class="fifth ch-fifth">0</span></div>
      <label class="ch-sig edit-only" title="Nome usado nas fórmulas (ex.: FOR). Se ficar vazio, vale o nome ou as 3 primeiras letras.">ID<input class="ch-sigla" type="text" maxlength="12" autocomplete="off" spellcheck="false"></label>`);
    d.dataset.id = c.id || '';
    $('.ch-sigla', d).value = c.sigla ?? '';
    $('.ch-name', d).value = c.nome ?? '';
    $('.ch-val', d).value = c.valor ?? '';
    $('#chars').appendChild(d);
    return d;
  }

  function buildCharMenu() {
    const have = new Set($$('#chars .char').map(d => d.dataset.id));
    const items = CHARS.filter(([k]) => !have.has(k))
      .map(([k, n]) => `<button type="button" data-add-char="${k}">${n}</button>`);
    items.push('<button type="button" data-add-char="custom">+ Característica personalizada</button>');
    $('#menu-char .items').innerHTML = items.join('');
  }

  // ---------- modo edição ----------
  function refreshEdit() {
    $$('.f-label, .m-name, .ch-name, .b-title, .s-name, .ch-val, .m-max, .s-base, .s-occ, .s-pers, .s-imp').forEach(i => { i.readOnly = !editing; });
  }
  function setEdit(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    $('#edit-banner').hidden = !on;
    const btn = $('#edit-toggle');
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '✔ Concluir edição' : '✏️ Editar';
    if (!on) closeMenus();
    refreshEdit();
  }

  // ---------- marcadores ----------
  function addMarker(m) {
    const tipo = m.tipo || 'custom';
    if (tipo === 'livre') return addFreeMarker(m);
    const rollBtn = '<button type="button" class="roll" title="Testar">🎲</button>';
    const d = el('div', 'marker', `
      <div class="m-top">
        <input class="m-name" type="text" placeholder="Nome do marcador">
        ${rollBtn}
        <button type="button" class="del edit-only" title="Remover marcador">✕</button>
      </div>
      <div class="m-body">
        <button type="button" class="step" data-d="-1" aria-label="Diminuir">−</button>
        <input class="m-cur" type="number" inputmode="numeric" aria-label="Valor atual">
        <button type="button" class="step" data-d="1" aria-label="Aumentar">+</button>
        <span class="m-slash">/</span>
        <input class="m-max fx" type="text" autocomplete="off" spellcheck="false" aria-label="Máximo (número ou =fórmula)">
      </div>
      <div class="bar"><i></i></div>
      <p class="m-hint"></p>
      <label class="m-opt edit-only"><input type="checkbox" class="m-rollon"> Habilitar rolagem</label>`);
    d.dataset.tipo = tipo;
    $('.m-rollon', d).checked = m.rolagem ?? ['san', 'sorte', 'custom'].includes(tipo);
    d.classList.toggle('roll-on', $('.m-rollon', d).checked);
    d.dataset.id = m.id || ((tipo !== 'custom' && !$(`#markers .marker[data-id="${tipo}"]`)) ? tipo : newId());
    $('.m-name', d).value = m.nome ?? MARKER_TYPES[tipo];
    $('.m-cur', d).value = m.atual ?? '';
    setFv($('.m-max', d), m.max);
    $('#markers').appendChild(d);
    return d;
  }

  // espaço único: um campo de preenchimento sem mínimo nem máximo (número, texto ou =fórmula)
  function addFreeMarker(m) {
    const d = el('div', 'marker livre', `
      <div class="m-top">
        <input class="m-name" type="text" placeholder="Nome">
        <button type="button" class="roll" title="Testar">🎲</button>
        <button type="button" class="del edit-only" title="Remover">✕</button>
      </div>
      <div class="m-body">
        <input class="m-cur fx" type="text" autocomplete="off" spellcheck="false" aria-label="Valor (número, texto ou =fórmula)">
      </div>
      <p class="m-hint"></p>
      <label class="m-opt edit-only"><input type="checkbox" class="m-rollon"> Habilitar rolagem</label>`);
    d.dataset.tipo = 'livre';
    $('.m-rollon', d).checked = !!m.rolagem;
    d.classList.toggle('roll-on', $('.m-rollon', d).checked);
    d.dataset.id = m.id || newId();
    $('.m-name', d).value = m.nome ?? MARKER_TYPES.livre;
    setFv($('.m-cur', d), m.formula ?? m.atual);
    $('#markers').appendChild(d);
    return d;
  }

  // ---------- condições ----------
  function addCondition(c) {
    const d = el('div', 'chip', `
      <b class="c-name"></b>
      <input class="c-note" type="text" placeholder="nota">
      <button type="button" class="del" title="Remover condição">✕</button>`);
    $('.c-name', d).textContent = c.nome;
    $('.c-note', d).value = c.nota ?? '';
    if (/morrendo|ferimento|inconsciente|sangrando|chamas/i.test(c.nome)) d.classList.add('danger');
    else if (/insanidade|fobia|mania|amedront/i.test(c.nome)) d.classList.add('mind');
    $('#cond-list').appendChild(d);
    updateCondEmpty();
    return d;
  }
  const updateCondEmpty = () => { $('#cond-empty').hidden = $$('#cond-list .chip').length > 0; };

  // ---------- menus ----------
  function buildMenus() {
    $('#menu-cond .items').innerHTML = CONDITION_PRESETS
      .map(n => `<button type="button" data-add-cond="${n}">${n}</button>`).join('');
    $('#menu-marker .items').innerHTML = MARKER_MENU
      .map(([k, v]) => `<button type="button" data-add-marker="${k}">${v}</button>`).join('');
  }
  const closeMenus = () => $$('.menu').forEach(m => { m.hidden = true; });

  // ---------- perícias ----------
  const updatePinnedWrap = () => {
    $('#skills-pinned-wrap').hidden = $('#skills-pinned').children.length === 0;
  };

  // coloca a perícia na lista certa (fixadas ou não), em ordem alfabética
  function placeSkill(row) {
    const box = row.classList.contains('pinned') ? $('#skills-pinned') : $('#skills-list');
    const name = $('.s-name', row).value.trim();
    const next = [...box.children].find(r => r !== row && collator.compare($('.s-name', r).value.trim(), name) > 0);
    box.insertBefore(row, next || null);
    updatePinnedWrap();
  }

  function addSkillRow(s, open) {
    const tr = el('div', 'skill' + (open ? ' open' : '') + (s.pinned ? ' pinned' : ''), `
      <div class="s-head">
        <label class="s-tickwrap" title="Marcar para evolução"><input class="s-tick" type="checkbox"></label>
        <input class="s-name" type="text" placeholder="Nome da perícia">
        <button type="button" class="pin" title="Fixar no topo">📌</button>
        <span class="s-btns">
          <button type="button" class="del edit-only" title="Remover">✕</button>
        </span>
      </div>
      <div class="s-vals">
        <div class="v total"><b class="s-total">0</b><span>Total</span></div>
        <div class="v half"><b class="s-half">0</b><span>½ Difícil</span></div>
        <div class="v fifth"><b class="s-fifth">0</b><span>⅕ Extremo</span></div>
      </div>
      <div class="s-edit edit-only">
        <label class="s-evowrap"><input class="s-evo" type="checkbox"> Pode evoluir</label>
        <label class="s-sig" title="Nome usado nas fórmulas. Se ficar vazio vale P. + 3 primeiras letras do nome (ou P. + nome completo).">ID<input class="s-sigla" type="text" maxlength="24" autocomplete="off" spellcheck="false"></label>
      </div>
      <div class="s-det">
        <label>Base<input class="s-base fx" type="text" autocomplete="off" spellcheck="false"></label>
        <label>Ocup.<input class="s-occ fx" type="text" autocomplete="off" spellcheck="false"></label>
        <label>Pess.<input class="s-pers fx" type="text" autocomplete="off" spellcheck="false"></label>
        <label>Melh.<input class="s-imp fx" type="text" autocomplete="off" spellcheck="false"></label>
      </div>`);
    tr.dataset.formula = s.formula || '';
    $('.s-name', tr).value = s.name ?? '';
    setFv($('.s-base', tr), s.base ?? 0);
    setFv($('.s-occ', tr), s.occ || '');
    setFv($('.s-pers', tr), s.pers || '');
    setFv($('.s-imp', tr), s.imp || '');
    const noEvoDefault = /^(mitos de cthulhu|credito|crédito)/i.test(String(s.name || '').trim());
    $('.s-evo', tr).checked = s.evolui === undefined || s.evolui === null ? !noEvoDefault : !!s.evolui;
    $('.s-sigla', tr).value = s.sigla ?? '';
    $('.s-tick', tr).checked = !!s.tick && $('.s-evo', tr).checked;
    (tr.classList.contains('pinned') ? $('#skills-pinned') : $('#skills-list')).appendChild(tr);
    placeSkill(tr);
    return tr;
  }

  function defaultSkillObjects() {
    return DEFAULT_SKILLS.map(([name, base]) =>
      typeof base === 'string'
        ? { name, base: 0, formula: base }
        : { name, base, formula: null });
  }

  function addNewSkill(nome) {
    $('#skill-search').value = '';
    applySearch();
    const row = addSkillRow({ name: nome, base: 0 }, true);
    changed();
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1900);
    $('.s-base', row).focus({ preventScroll: true });
  }

  function applySearch() {
    const q = $('#skill-search').value.trim().toLowerCase();
    $$('#skills-wrap .skill').forEach(r => {
      r.hidden = !!q && !$('.s-name', r).value.toLowerCase().includes(q);
    });
  }

  // ---------- armas ----------
  function addWeaponRow(w) {
    const tr = el('div', 'weapon', `
      <div class="w-top">
        <input type="text" data-w="name" placeholder="Arma">
        <button type="button" class="w-stats" title="Mostrar/ocultar perícia, dano, alcance…" aria-expanded="true">▾</button>
        <button type="button" class="w-toggle" title="Mostrar/ocultar descrição">Descrição ▾</button>
        <button type="button" class="del" title="Remover arma">✕</button>
      </div>
      <div class="w-actions">
        <button type="button" class="w-go" title="Rola o ataque (d100 contra a perícia) e o dano de uma vez">⚔ Atacar</button>
      </div>
      <div class="w-grid">
        <label>Perícia<input type="text" data-w="skill"></label>
        <label>Dano<input type="text" data-w="damage"></label>
        <label>Alcance<input type="text" data-w="range"></label>
        <label>Ataques<input type="text" data-w="attacks"></label>
        <label>Munição<input type="text" data-w="ammo"></label>
        <label>Defeito<input type="text" data-w="malfunction"></label>
      </div>
      <textarea class="w-desc" data-w="desc" placeholder="Descrição da arma (efeitos, notas, munição especial…)" hidden></textarea>`);
    ['name', 'skill', 'damage', 'range', 'attacks', 'ammo', 'malfunction', 'desc']
      .forEach(k => { $(`[data-w="${k}"]`, tr).value = w[k] ?? ''; });
    if (w.hide) { tr.classList.add('compact'); $('.w-stats', tr).textContent = '▸'; $('.w-stats', tr).setAttribute('aria-expanded', 'false'); }
    $('#weapons-list').appendChild(tr);
    return tr;
  }

  // ---------- inventário ----------
  function addItem(it) {
    const d = el('div', 'item', `
      <div class="i-top">
        <input class="i-name" type="text" placeholder="Nome do item">
        <input class="i-qty" type="number" inputmode="numeric" min="0" placeholder="Qtd" aria-label="Quantidade">
        <button type="button" class="del" title="Remover item">✕</button>
      </div>
      <textarea class="i-desc" placeholder="Descrição do item"></textarea>`);
    $('.i-name', d).value = it.nome ?? '';
    $('.i-qty', d).value = it.quantidade ?? 1;
    $('.i-desc', d).value = it.descricao ?? '';
    $('#items-list').appendChild(d);
    updateItemsEmpty();
    return d;
  }
  const updateItemsEmpty = () => { $('#items-empty').hidden = $$('#items-list .item').length > 0; };

  // ---------- containers de texto (história / posses) ----------
  function addBox(listSel, b) {
    const d = el('div', 'box', `
      <div class="b-top">
        <input class="b-title" type="text" placeholder="Título do container">
        <button type="button" class="del edit-only" title="Remover container">✕</button>
      </div>
      <textarea class="b-text"></textarea>`);
    $('.b-title', d).value = b.titulo ?? '';
    $('.b-text', d).value = b.texto ?? '';
    $(listSel).appendChild(d);
    return d;
  }

  // <formula-engine>
  // ---------- fórmulas: =1/5CON*2 · =1/2EDU+1/2TAM · =DES+3 ----------
  // Aceita números, + - * /, parênteses, multiplicação implícita (5CON, 1/2EDU), características pela sigla
  // (FOR CON TAM DES APA INT POD EDU) ou pelo nome, e as funções min, max, piso, teto, arred.
  // O resultado é arredondado para baixo no fim.
  const normId = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9_.]/g, '');
  const normKey = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9_]/g, '');

  function evalFormula(text, vars) {
    const src = String(text).replace(/^\s*=/, '').replace(/×/g, '*').replace(/÷/g, '/');
    const toks = [];
    const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*(?:\.[A-Za-zÀ-ÖØ-öø-ÿ_0-9]+)?)|([-+*/(),;]))/y;
    let pos = 0;
    while (pos < src.length) {
      if (/^\s*$/.test(src.slice(pos))) break;
      re.lastIndex = pos;
      const m = re.exec(src);
      if (!m) throw new Error(`caractere inesperado "${src.slice(pos).trim()[0]}"`);
      pos = re.lastIndex;
      if (m[1] !== undefined) toks.push({ t: 'n', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) toks.push({ t: 'id', v: m[2] });
      else toks.push({ t: 'op', v: m[3] === ';' ? ',' : m[3] });
    }
    if (!toks.length) throw new Error('fórmula vazia');

    const FN = { min: Math.min, max: Math.max, floor: Math.floor, piso: Math.floor, ceil: Math.ceil, teto: Math.ceil, round: Math.round, arred: Math.round };
    let i = 0;
    const isOp = v => i < toks.length && toks[i].t === 'op' && toks[i].v === v;

    function primary() {
      const t = toks[i++];
      if (!t) throw new Error('fórmula incompleta');
      if (t.t === 'n') return t.v;
      if (t.t === 'id') {
        const fname = t.v.toLowerCase();
        if (FN[fname] && isOp('(')) {
          i++;
          const args = [];
          if (!isOp(')')) {
            args.push(expr());
            while (isOp(',')) { i++; args.push(expr()); }
          }
          if (!isOp(')')) throw new Error('faltou fechar o parêntese');
          i++;
          if (!args.length) throw new Error(`${t.v}() sem argumentos`);
          return FN[fname](...args);
        }
        const key = normId(t.v);
        if (!Object.prototype.hasOwnProperty.call(vars, key)) throw new Error(`"${t.v}" não é uma característica conhecida`);
        return vars[key];
      }
      if (t.v === '(') {
        const v = expr();
        if (!isOp(')')) throw new Error('faltou fechar o parêntese');
        i++;
        return v;
      }
      throw new Error(`"${t.v}" fora de lugar`);
    }
    function unary() {
      if (isOp('-')) { i++; return -unary(); }
      if (isOp('+')) { i++; return unary(); }
      return primary();
    }
    function term() {
      let v = unary();
      for (;;) {
        if (isOp('*')) { i++; v *= unary(); }
        else if (isOp('/')) { i++; v /= unary(); }
        else if (i < toks.length && (toks[i].t === 'n' || toks[i].t === 'id' || isOp('('))) v *= unary(); // 5CON, 1/2EDU
        else break;
      }
      return v;
    }
    function expr() {
      let v = term();
      while (isOp('+') || isOp('-')) {
        const op = toks[i++].v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }

    const out = expr();
    if (i < toks.length) throw new Error(`"${toks[i].v}" fora de lugar`);
    if (!Number.isFinite(out)) throw new Error('resultado inválido (divisão por zero?)');
    return Math.floor(out + 1e-9);
  }
  // </formula-engine>

  // siglas das características padrão (as personalizadas valem pelo próprio nome)
  const CHAR_ALIASES = {
    str: ['FOR', 'STR'], con: ['CON'], siz: ['TAM', 'SIZ'], dex: ['DES', 'DEX'],
    app: ['APA', 'APP'], int: ['INT'], pow: ['POD', 'POW'], edu: ['EDU']
  };
  // nomes que valem em fórmulas, por característica: 1) siglas (padrão FOR/CON… e o campo "ID" da edição),
  // 2) nome completo e 3) as 3 primeiras letras do nome. Em caso de repetição vale a primeira; use o campo "ID" para desempatar.
  function charKeys(d) {
    const keys = [];
    const sig = normKey($('.ch-sigla', d).value);
    if (sig) keys.push(sig);
    (CHAR_ALIASES[d.dataset.id] || []).forEach(a => keys.push(a));
    const nm = normKey($('.ch-name', d).value);
    if (nm) { keys.push(nm); if (nm.length > 3) keys.push(nm.slice(0, 3)); }
    return keys;
  }
  function formulaVars() {
    const vars = {};
    const rows = $$('#chars .char');
    const put = (k, v) => { if (k && !(k in vars)) { vars[k] = v; return true; } return false; };
    const explicit = d => { const k = [normKey($('.ch-sigla', d).value), ...(CHAR_ALIASES[d.dataset.id] || [])]; return k.filter(Boolean); };
    rows.forEach(d => { const v = num($('.ch-val', d).value); explicit(d).forEach(k => put(k, v)); });
    rows.forEach(d => { const v = num($('.ch-val', d).value); charKeys(d).forEach(k => put(k, v)); });
    // aviso de siglas repetidas / dica do que cada característica responde
    const owner = {};
    rows.forEach(d => {
      const mine = charKeys(d);
      const first = mine.find(k => owner[k] === undefined || owner[k] === d);
      mine.forEach(k => { if (owner[k] === undefined) owner[k] = d; });
      const dup = explicit(d).some(k => owner[k] !== d);
      const sg = $('.ch-sigla', d);
      sg.placeholder = (CHAR_ALIASES[d.dataset.id] || [])[0] || normKey($('.ch-name', d).value).slice(0, 3) || 'ID';
      sg.classList.toggle('bad', dup);
      sg.title = dup ? 'Esta sigla já é de outra característica' : '';
      d.title = mine.length ? 'Nas fórmulas: ' + mine.filter(k => owner[k] === d).join(', ') : '';
    });
    return vars;
  }

  // ---------- campos com fórmula, como no Excel: o campo mostra o resultado; ao clicar, aparece a fórmula ----------
  const fv = el => (document.activeElement === el ? el.value : (el.dataset.f || el.value));
  const numFx = el => { const p = parseValue(fv(el), formulaVars()); return p.value == null ? 0 : p.value; };
  const fxRaw = el => { const s = String(fv(el)).trim(); return s.startsWith('=') ? s : num(s); };
  function setFv(el, raw) {
    const s = raw == null ? '' : String(raw);
    if (s.trim().startsWith('=')) { el.dataset.f = s.trim(); el.value = s.trim(); } // o recalc troca pelo resultado
    else { delete el.dataset.f; el.value = s; }
  }
  function showFx(el, parsed) {
    if (el.dataset.f && document.activeElement !== el) el.value = parsed.error ? '#ERRO' : String(parsed.value);
    el.title = el.dataset.f ? el.dataset.f + (parsed.error ? '  →  ' + parsed.error : '') : '';
    el.classList.toggle('formula', !!el.dataset.f);
  }
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el.classList && el.classList.contains('fx') && el.dataset.f) { el.value = el.dataset.f; el.select(); }
  });
  document.addEventListener('focusout', e => {
    const el = e.target;
    if (!(el.classList && el.classList.contains('fx'))) return;
    const v = el.value.trim();
    if (v.startsWith('=')) el.dataset.f = v; else delete el.dataset.f;
    el.dispatchEvent(new Event('input', { bubbles: true })); // recalcula e mostra o resultado no próprio campo
  });

  // número ("12"), vazio (→ automático) ou fórmula ("=1/5CON*2")
  function parseValue(raw, vars) {
    const s = String(raw == null ? '' : raw).trim();
    if (s === '') return { value: null };
    if (s.startsWith('=')) {
      try { return { value: evalFormula(s, vars), formula: true }; }
      catch (e) { return { value: null, formula: true, error: e.message }; }
    }
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? { value: n } : { value: null, error: 'valor inválido' };
  }
  const rawOrNumber = v => {
    const s = String(v == null ? '' : v).trim();
    if (s === '') return null;
    if (s.startsWith('=')) return s;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // características escolhidas para os pontos de ocupação (cada uma vale ×2; EDU + EDU = EDU×4)
  let occPref = { a: 'edu', b: 'edu' };
  let selSig = '';
  function syncCharSelects(force) {
    const opts = $$('#chars .char').map(d => [d.dataset.id, $('.ch-name', d).value || d.dataset.id]);
    const sig = JSON.stringify(opts);
    if (sig === selSig && !force) return;
    selSig = sig;
    ['a', 'b'].forEach(k => {
      const sel = $('#occ-' + k);
      const want = sel.value || occPref[k];
      sel.innerHTML = '';
      opts.forEach(([id, nome]) => {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = nome;
        sel.appendChild(o);
      });
      sel.value = opts.some(o => o[0] === want) ? want : (opts[0] ? opts[0][0] : '');
    });
  }

  // ---------- regras de Call of Cthulhu 7e ----------
  function buildAndDamage(total) {
    if (total <= 0) return { db: '0', build: 0 };
    if (total <= 64) return { db: '-2', build: -2 };
    if (total <= 84) return { db: '-1', build: -1 };
    if (total <= 124) return { db: '0', build: 0 };
    if (total <= 164) return { db: '+1d4', build: 1 };
    if (total <= 204) return { db: '+1d6', build: 2 };
    const extra = Math.ceil((total - 204) / 80);
    return { db: `+${1 + extra}d6`, build: 2 + extra };
  }

  function calcMove(str, dex, siz, age) {
    let mov = (str < siz && dex < siz) ? 7 : (str > siz && dex > siz) ? 9 : 8;
    if (age >= 40) mov -= Math.floor(age / 10) - 3;
    return Math.max(0, mov);
  }

  // ---------- recálculo ----------
  function recalc() {
    refreshEdit();
    const c = {};
    $$('#chars .char').forEach(d => {
      const v = num($('.ch-val', d).value);
      $('.ch-half', d).textContent = Math.floor(v / 2);
      $('.ch-fifth', d).textContent = Math.floor(v / 5);
      c[d.dataset.id] = v;
    });
    CHARS.forEach(([k]) => { c[k] = c[k] || 0; });

    const vars = formulaVars();
    const sv = el => { const p = parseValue(fv(el), vars); showFx(el, p); el.classList.toggle('bad', !!p.error); return p.value == null ? 0 : p.value; };
    // ---- perícias (valores podem usar fórmulas com atributos e com outras perícias: P.ESQ, P.PSI…) ----
    const skillRows = $$('#skills-wrap .skill');
    const skillKeys = tr => {
      const keys = [];
      const sg = normId($('.s-sigla', tr).value);
      if (sg) keys.push(sg);
      const nm = normKey($('.s-name', tr).value);
      if (nm) { keys.push('P.' + nm); if (nm.length > 3) keys.push('P.' + nm.slice(0, 3)); }
      return keys;
    };
    const owner = new Map(); // chave → perícia dona (a primeira vence; atributos têm prioridade)
    skillRows.forEach(tr => skillKeys(tr).forEach(k => { if (!(k in vars) && !owner.has(k)) owner.set(k, tr); }));
    const totals = new Map();
    const localVars = tr => {
      const lv = Object.assign({}, vars);
      owner.forEach((t, k) => { if (t !== tr) lv[k] = totals.get(t) || 0; });
      return lv;
    };
    const skillParts = (tr, show) => {
      const lv = localVars(tr);
      const f = tr.dataset.formula;
      const baseEl = $('.s-base', tr);
      if (f) {
        baseEl.value = f === 'dex/2' ? Math.floor(c.dex / 2) : c.edu;
        baseEl.readOnly = true;
      }
      const get = el => {
        const p = parseValue(fv(el), lv);
        if (show) { showFx(el, p); el.classList.toggle('bad', !!p.error); }
        return p.value == null ? 0 : p.value;
      };
      const occ = get($('.s-occ', tr)), pers = get($('.s-pers', tr));
      const total = (f ? num(baseEl.value) : get(baseEl)) + occ + pers + get($('.s-imp', tr));
      return { occ, pers, total };
    };
    for (let pass = 0; pass < 6; pass++) { // dependências entre perícias: repete até estabilizar
      let moved = false;
      skillRows.forEach(tr => { const t = skillParts(tr, false).total; if (totals.get(tr) !== t) { totals.set(tr, t); moved = true; } });
      if (!moved) break;
    }
    let occSpent = 0, persSpent = 0, mitos = 0;
    skillRows.forEach(tr => {
      const { occ, pers, total } = skillParts(tr, true);
      totals.set(tr, total);
      // pode evoluir? sem a opção, a perícia fica sem o marcador
      const evo = $('.s-evo', tr).checked;
      tr.classList.toggle('noevo', !evo);
      if (!evo) $('.s-tick', tr).checked = false;
      // ID da perícia: dica e aviso de repetição
      const sg = $('.s-sigla', tr);
      const mine = skillKeys(tr);
      sg.placeholder = 'P.' + (normKey($('.s-name', tr).value).slice(0, 3) || 'ID');
      const explicit = normId(sg.value);
      sg.classList.toggle('bad', !!explicit && (explicit in vars || owner.get(explicit) !== tr));
      tr.querySelector('.s-name').title = mine.length ? 'Nas fórmulas: ' + mine.filter(k => owner.get(k) === tr).join(', ') : '';
      occSpent += occ; persSpent += pers;
      $('.s-total', tr).textContent = total;
      $('.s-half', tr).textContent = Math.floor(total / 2);
      $('.s-fifth', tr).textContent = Math.floor(total / 5);
      if ($('.s-name', tr).value.trim().toLowerCase().startsWith('mitos de cthulhu')) mitos = total;
    });
    owner.forEach((t, k) => { vars[k] = totals.get(t) || 0; }); // PV, pontos etc. também enxergam as perícias

    syncCharSelects();
    const charVal = id => { const row = $(`#chars .char[data-id="${id}"] .ch-val`); return row ? num(row.value) : 0; };
    const occAuto = 2 * charVal($('#occ-a').value) + 2 * charVal($('#occ-b').value);
    $('#occ-auto').textContent = occAuto;
    const ovO = parseValue(fv($('#orc-ocup')), vars);
    const ovP = parseValue(fv($('#orc-pess')), vars);
    const budOcc = ovO.value != null ? ovO.value : occAuto;
    const budPers = ovP.value != null ? ovP.value : c.int * 2;
    $('#orc-ocup').placeholder = 'automático = ' + occAuto;
    $('#orc-pess').placeholder = 'INT×2 = ' + c.int * 2;
    [['#orc-ocup', ovO], ['#orc-pess', ovP]].forEach(([sel, ov]) => {
      showFx($(sel), ov);
      $(sel).classList.toggle('bad', !!ov.error);
    });
    $('#gasto-ocup').textContent = occSpent; $('#tot-ocup').textContent = budOcc;
    $('#gasto-pess').textContent = persSpent; $('#tot-pess').textContent = budPers;
    $('#gasto-ocup').classList.toggle('over', occSpent > budOcc);
    $('#gasto-pess').classList.toggle('over', persSpent > budPers);

    const pvMax = Math.floor((c.con + c.siz) / 10);
    const pmMax = Math.floor(c.pow / 5);
    const sanMax = 99 - mitos;
    const bd = buildAndDamage(c.str + c.siz);
    const move = calcMove(c.str, c.dex, c.siz, getAge());
    const dodge = Math.floor(c.dex / 2);

    // marcadores
    const maxAuto = { pv: pvMax, pm: pmMax, san: sanMax, sorte: 99 };
    $$('#markers .marker').forEach(d => {
      const tipo = d.dataset.tipo;
      d.classList.toggle('roll-on', $('.m-rollon', d).checked);
      if (tipo === 'livre') {
        const inp = $('.m-cur', d);
        const raw = String(fv(inp)).trim();
        let val = raw, err = '';
        if (raw.startsWith('=')) {
          const p = parseValue(raw, vars);
          showFx(inp, p);
          val = p.error ? null : p.value;
          err = p.error || '';
        } else {
          showFx(inp, { value: null });
          const n = Number(raw.replace(',', '.'));
          if (raw !== '' && Number.isFinite(n)) val = n;
          if (raw === '') val = null;
        }
        inp.classList.toggle('bad', !!err);
        d.dataset.val = JSON.stringify(val);
        $('.m-hint', d).textContent = err ? `Fórmula inválida: ${err}` : '';
        $('.m-hint', d).classList.toggle('err', !!err);
        return;
      }
      const auto = maxAuto[tipo];
      const maxEl = $('.m-max', d);
      maxEl.placeholder = auto !== undefined ? String(auto) : 'máx.';
      const pv = parseValue(fv(maxEl), vars);
      showFx(maxEl, pv);
      const eff = pv.value != null ? pv.value : (auto ?? null);
      maxEl.classList.toggle('formula', !!pv.formula);
      const cur = num($('.m-cur', d).value);
      d.dataset.eff = eff ?? '';
      const pct = eff > 0 ? Math.max(0, Math.min(100, cur / eff * 100)) : 0;
      $('.bar i', d).style.width = pct + '%';
      d.classList.toggle('low', eff > 0 && cur / eff <= 0.25);
      const hint = [];
      if (tipo === 'san') hint.push(`Inicial ${c.pow} · Insanidade indefinida ao perder ${Math.floor(cur / 5)}+ em 1 hora`);
      if (pv.error) hint.push(`Fórmula inválida: ${pv.error}`);
      $('.m-hint', d).textContent = hint.join(' · ');
      $('.m-hint', d).classList.toggle('err', !!pv.error);
    });

    // indicador de descrição preenchida e valor da perícia nas armas
    $$('#weapons-list .weapon').forEach(w => {
      $('.w-toggle', w).classList.toggle('has', !!$('[data-w="desc"]', w).value.trim());
      const sk = skillForWeapon(w);
      $('.w-go', w).textContent = sk ? `⚔ Atacar (${sk.value}%)` : '⚔ Atacar';
    });

    // botão de melhoria automática
    const marked = $$('#skills-wrap .s-tick').filter(c => c.checked).length;
    $('#improve-skills').disabled = marked === 0;
    $('#improve-count').textContent = marked ? `(${marked} marcada${marked > 1 ? 's' : ''})` : '(nenhuma marcada)';

    $('#db').textContent = bd.db;
    $('#bd-now').textContent = bd.db;
    const nm = $('#fields .field[data-id="nome"] .f-value');
    document.title = (nm && nm.value.trim() ? nm.value.trim() + ' – ' : '') + 'Ficha de Investigador';
    $('#build').textContent = bd.build;
    $('#move').textContent = move;
    $('#dodge').textContent = dodge;

    derived = {
      pv_max: pvMax, pm_max: pmMax, san_inicial: c.pow, san_max: sanMax,
      bonus_dano: bd.db, corpo: bd.build, movimento: move, esquiva: dodge,
      pontos_ocupacao_gastos: occSpent, pontos_pessoais_gastos: persSpent,
      pontos_ocupacao_total: budOcc, pontos_pessoais_total: budPers
    };
  }

  // ---------- coleta / preenchimento ----------
  function collect() {
    const data = {};
    $$('[data-key]').forEach(e => {
      let v;
      if (e.type === 'checkbox') v = e.checked;
      else if (e.type === 'number') v = e.value === '' ? null : Number(e.value);
      else v = e.value;
      setPath(data, e.dataset.key, v);
    });

    data.caracteristicas = $$('#chars .char').map(d => {
      const raw = $('.ch-val', d).value;
      const v = num(raw);
      return {
        id: d.dataset.id,
        nome: $('.ch-name', d).value,
        sigla: $('.ch-sigla', d).value.trim() || undefined,
        valor: raw === '' ? null : v,
        metade: Math.floor(v / 2),
        quinto: Math.floor(v / 5)
      };
    });

    data.campos = $$('#fields .field').map(d => ({
      id: d.dataset.id || null,
      nome: $('.f-label', d).value,
      valor: $('.f-value', d).value
    }));

    data.marcadores = $$('#markers .marker').map(d => d.dataset.tipo === 'livre' ? ({
      id: d.dataset.id,
      tipo: 'livre',
      rolagem: $('.m-rollon', d).checked,
      nome: $('.m-name', d).value,
      atual: d.dataset.val ? JSON.parse(d.dataset.val) : null,
      formula: String(fv($('.m-cur', d))).trim().startsWith('=') ? String(fv($('.m-cur', d))).trim() : undefined
    }) : ({
      id: d.dataset.id,
      tipo: d.dataset.tipo,
      rolagem: $('.m-rollon', d).checked,
      nome: $('.m-name', d).value,
      atual: $('.m-cur', d).value === '' ? null : num($('.m-cur', d).value),
      max: rawOrNumber(fv($('.m-max', d))),
      max_efetivo: d.dataset.eff === '' ? null : num(d.dataset.eff)
    }));

    data.condicoes = $$('#cond-list .chip').map(d => ({
      nome: $('.c-name', d).textContent,
      nota: $('.c-note', d).value
    }));

    data.pontos = {
      orcamento_ocupacao: rawOrNumber(fv($('#orc-ocup'))),
      orcamento_pessoal: rawOrNumber(fv($('#orc-pess'))),
      ocupacao_a: $('#occ-a').value,
      ocupacao_b: $('#occ-b').value
    };

    data.derivados = derived;

    data.pericias = $$('#skills-wrap .skill').map(tr => ({
      nome: $('.s-name', tr).value,
      base: fxRaw($('.s-base', tr)),
      formula: tr.dataset.formula || null,
      ocupacao: fxRaw($('.s-occ', tr)),
      pessoal: fxRaw($('.s-pers', tr)),
      melhoria: fxRaw($('.s-imp', tr)),
      total: num($('.s-total', tr).textContent),
      metade: num($('.s-half', tr).textContent),
      quinto: num($('.s-fifth', tr).textContent),
      marcada: $('.s-tick', tr).checked,
      evolui: $('.s-evo', tr).checked,
      sigla: $('.s-sigla', tr).value.trim() || undefined,
      fixada: tr.classList.contains('pinned')
    }));

    data.armas = $$('#weapons-list .weapon').map(tr => ({
      nome: $('[data-w="name"]', tr).value,
      pericia: $('[data-w="skill"]', tr).value,
      dano: $('[data-w="damage"]', tr).value,
      alcance: $('[data-w="range"]', tr).value,
      ataques: $('[data-w="attacks"]', tr).value,
      municao: $('[data-w="ammo"]', tr).value,
      defeito: $('[data-w="malfunction"]', tr).value,
      descricao: $('[data-w="desc"]', tr).value,
      ocultar_status: tr.classList.contains('compact')
    }));

    data.inventario = $$('#items-list .item').map(d => ({
      nome: $('.i-name', d).value,
      quantidade: $('.i-qty', d).value === '' ? null : num($('.i-qty', d).value),
      descricao: $('.i-desc', d).value
    }));

    const boxes = sel => $$(sel + ' .box').map(d => ({ titulo: $('.b-title', d).value, texto: $('.b-text', d).value }));
    data.historia = boxes('#hist-list');
    data.posses_financas = boxes('#posses-list');

    data.meta = { sistema: 'Call of Cthulhu 7e', atualizado_em: new Date().toISOString() };
    return data;
  }

  // converte formatos antigos do player1.json para o atual (e cria os padrões)
  function migrate(d) {
    d = d && typeof d === 'object' ? d : {};

    if (!Array.isArray(d.caracteristicas)) {
      const car = d.car || {};
      d.caracteristicas = CHARS.map(([id, nome]) => ({ id, nome, valor: car[id] ?? null }));
    }

    const info = d.info || {};
    if (!Array.isArray(d.campos)) {
      d.campos = DEFAULT_FIELDS.map(([id, nome]) => ({ id, nome, valor: info[id] ?? ((id === 'nome' || id === 'jogador') ? (d[id + '_inicial'] ?? '') : '') }));
    }
    if (!Array.isArray(d.marcadores)) {
      const v = d.vitais || {};
      d.marcadores = DEFAULT_MARKERS.map(m => ({ ...m, atual: v[m.tipo] ?? null, max: null }));
    }
    if (!Array.isArray(d.condicoes)) {
      const e = d.estado || {};
      d.condicoes = Object.entries(OLD_STATES).filter(([k]) => e[k]).map(([, n]) => ({ nome: n, nota: '' }));
    }

    const oldPosses = (d.posses && !Array.isArray(d.posses) && typeof d.posses === 'object') ? d.posses : {};
    if (!Array.isArray(d.historia)) {
      const h = d.hist || {};
      d.historia = DEFAULT_HIST.map((titulo, i) => ({
        titulo,
        texto: i < 10 ? (h[OLD_HIST_KEYS[i]] ?? '') : i === 10 ? (d.companheiros ?? '') : (d.notas ?? '')
      }));
    }
    if (!Array.isArray(d.posses_financas)) {
      d.posses_financas = DEFAULT_POSSES.map((titulo, i) => ({ titulo, texto: oldPosses[OLD_POSSES_KEYS[i]] ?? '' }));
    }
    if (!Array.isArray(d.inventario)) {
      d.inventario = oldPosses.equipamento
        ? [{ nome: 'Equipamento e posses', quantidade: 1, descricao: oldPosses.equipamento }]
        : [];
    }
    return d;
  }

  function populate(data) {
    data = migrate(data);

    $$('[data-key]').forEach(e => {
      const v = getPath(data, e.dataset.key);
      if (e.type === 'checkbox') e.checked = !!v;
      else e.value = v ?? '';
    });

    $('#chars').innerHTML = '';
    data.caracteristicas.forEach(addChar);

    const pt = data.pontos || {};
    setFv($('#orc-ocup'), pt.orcamento_ocupacao);
    setFv($('#orc-pess'), pt.orcamento_pessoal);
    occPref = { a: pt.ocupacao_a || 'edu', b: pt.ocupacao_b || 'edu' };
    $('#occ-a').innerHTML = '';
    $('#occ-b').innerHTML = '';
    syncCharSelects(true);

    $('#fields').innerHTML = '';
    data.campos.forEach(addField);

    const usedIds = new Set();
    data.marcadores.forEach(m => {
      if (!m.id || usedIds.has(m.id)) m.id = (m.tipo && m.tipo !== 'custom' && m.tipo !== 'livre' && !usedIds.has(m.tipo)) ? m.tipo : newId();
      usedIds.add(m.id);
    });
    $('#markers').innerHTML = '';
    data.marcadores.forEach(addMarker);

    $('#cond-list').innerHTML = '';
    data.condicoes.forEach(addCondition);
    updateCondEmpty();

    $('#skills-pinned').innerHTML = '';
    $('#skills-list').innerHTML = '';
    if (Array.isArray(data.pericias) && data.pericias.length) {
      data.pericias.forEach(p => addSkillRow({
        name: /^observa[cç][aã]o$/i.test(String(p.nome).trim()) ? 'Encontrar' : p.nome, base: p.base, formula: p.formula,
        occ: p.ocupacao, pers: p.pessoal, imp: p.melhoria, tick: p.marcada, pinned: p.fixada, evolui: p.evolui, sigla: p.sigla
      }));
    } else {
      defaultSkillObjects().forEach(s => addSkillRow(s));
    }
    updatePinnedWrap();
    applySearch();

    $('#weapons-list').innerHTML = '';
    if (Array.isArray(data.armas) && data.armas.length) {
      data.armas.forEach(w => addWeaponRow({
        name: w.nome, skill: w.pericia, damage: w.dano, range: w.alcance,
        attacks: w.ataques, ammo: w.municao, malfunction: w.defeito, desc: w.descricao, hide: !!w.ocultar_status
      }));
    } else {
      DEFAULT_WEAPONS.forEach(addWeaponRow);
    }

    $('#items-list').innerHTML = '';
    data.inventario.forEach(addItem);
    updateItemsEmpty();

    $('#hist-list').innerHTML = '';
    data.historia.forEach(b => addBox('#hist-list', b));
    $('#posses-list').innerHTML = '';
    data.posses_financas.forEach(b => addBox('#posses-list', b));

    recalc();
  }

  // ---------- salvar ----------
  const statusEl = $('#status');
  const setStatus = (text, cls, tip) => {
    statusEl.className = 'status ' + (cls || '');
    $('.txt', statusEl).textContent = text;
    statusEl.title = tip || text;
  };
  let timer;

  function schedule() {
    setStatus('Salvando…', 'dirty');
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  }
  function changed() { recalc(); schedule(); }

  async function save() {
    const data = collect();
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) { /* ignora */ }
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) { const er = new Error('HTTP ' + r.status); er.status = r.status; throw er; }
      setStatus('Salvo', 'ok', 'Salvo em player1.json às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (er) {
      if (er && er.status === 401) setStatus('Sessão expirada. Recarregue a página e entre de novo.', 'warn');
      else setStatus('Offline — salvo só no navegador. Use "Exportar JSON".', 'warn');
    }
  }

  async function load() {
    let data = null;
    try {
      const r = await fetch(API, { cache: 'no-store' });
      if (r.ok) data = await r.json();
    } catch (_) { /* sem servidor */ }
    if (!data || !Object.keys(data).length) {
      try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (_) { data = null; }
    }
    populate(data);
    save(); // normaliza o arquivo na primeira abertura
  }

  // ---------- resetar ficha ----------
  async function resetSheet() {
    clearTimeout(timer);
    try { localStorage.removeItem(LS_KEY); } catch (_) { /* ignora */ }
    $('#skill-search').value = '';
    populate(null);
    setEdit(false);
    setTab('personagem', true);
    await save();
  }

  function openReset() {
    const dlg = $('#reset-dialog');
    $('#reset-input').value = '';
    $('#reset-confirm').disabled = true;
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
      $('#reset-input').focus();
    } else if (window.prompt('Digite DELETAR para apagar toda a ficha:') === 'DELETAR') {
      resetSheet();
    }
  }

  // ---------- rolagem ----------
  let toastTimer;

  function showToast({ l = '', n = '', r = '', x = '', cls = 'good' }) {
    const t = $('#toast');
    t.className = 'toast ' + cls;
    t.innerHTML = '<div class="l"></div><div class="n"></div><div class="r"></div><div class="x"></div>';
    $('.l', t).textContent = l;
    $('.n', t).textContent = n;
    $('.r', t).textContent = r;
    $('.x', t).textContent = x;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  const notify = msg => showToast({ l: msg, cls: 'fail' });

  function testRoll(v, opts = {}) {
    const r = rand(100);
    let res, cls;
    if (r === 1) { res = 'Sucesso Crítico'; cls = 'crit'; }
    else if (r === 100 || (v < 50 && r >= 96)) { res = 'Fracasso Crítico'; cls = 'fail'; }
    else if (r <= Math.floor(v / 5)) { res = 'Sucesso Extremo'; cls = 'crit'; }
    else if (r <= Math.floor(v / 2)) { res = 'Sucesso Difícil'; cls = 'good'; }
    else if (r <= v) { res = 'Sucesso Regular'; cls = 'good'; }
    else { res = 'Fracasso'; cls = 'fail'; }
    return { roll: r, result: res, cls, extra: opts.mal && r >= opts.mal ? 'Defeito da arma!' : '' };
  }

  function roll(label, value, opts = {}) {
    const v = num(value);
    const t = testRoll(v, opts);
    addRoll({ kind: 'test', label, target: v, roll: t.roll, result: t.result, cls: t.cls, extra: t.extra });
    if (!isPanelOpen()) showToast({ l: `${label} (${v})`, n: t.roll, r: t.result, x: t.extra, cls: t.cls });
  }

  // ataque (d100 contra a perícia da arma) + dano, num clique só
  function attack(w) {
    const nome = $('[data-w="name"]', w).value.trim() || 'Arma';
    const sk = skillForWeapon(w);
    if (!sk) { notify('Preencha o campo "Perícia" da arma com uma perícia da ficha (ou um número).'); return; }
    const db = $('#db').textContent;
    const dano = $('[data-w="damage"]', w).value.trim();
    let dmg = null;
    if (dano) {
      try { dmg = rollDice(dano, { bd: db }); } catch (ex) { notify('Dano da arma: ' + ex.message); return; }
      if (/bd/i.test(dano)) dmg.bdNote = 'BD = ' + db;
    }
    const mal = parseInt($('[data-w="malfunction"]', w).value, 10);
    const t = testRoll(sk.value, { mal: mal > 0 ? mal : 0 });
    const hit = t.cls !== 'fail';
    addRoll({ kind: 'attack', label: `Ataque: ${nome} · ${sk.name}`, target: sk.value, ...t, hit, damage: dmg });
    if (!isPanelOpen()) {
      const x = [dmg ? `Dano: ${dmg.total}` + (hit ? '' : ' (ataque falhou)') : '', t.extra].filter(Boolean).join(' · ');
      showToast({ l: `${nome} · ${sk.name} (${sk.value})`, n: t.roll, r: t.result, x, cls: t.cls });
    }
  }

  // perícia usada por uma arma: nome (exato ou parcial) ou um número fixo
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function skillForWeapon(w) {
    const txt = $('[data-w="skill"]', w).value.trim();
    if (/^\d+%?$/.test(txt)) return { name: txt.replace('%', '') + '%', value: parseInt(txt, 10) };
    const q = norm(txt);
    if (!q) return null;
    const rows = $$('#skills-wrap .skill').map(r => ({ r, n: norm($('.s-name', r).value) })).filter(i => i.n);
    const hit = rows.find(i => i.n === q) || rows.find(i => i.n.includes(q));
    return hit ? { name: $('.s-name', hit.r).value.trim(), value: num($('.s-total', hit.r).textContent) } : null;
  }

  // <dice-engine>
  // ---------- rolagem de dados (1d20+3, 4d6kh3, (1d8+2d6)kh1, 1d3+BD…) ----------
  const rand = n => Math.floor(Math.random() * n) + 1;
  const BAD_EXPR = 'Expressão inválida. Exemplos: 1d20+3 · 4d6kh3 · (1d8+2d6)kh1 · 1d3+BD';

  // devolve, para cada valor, se ele é mantido (true) ou descartado (false)
  function pickKeep(values, mod, n) {
    const count = values.length;
    const keepHighest = mod === 'k' || mod === 'kh' || mod === 'dl';
    const nKeep = Math.max(0, Math.min(count, (mod === 'dh' || mod === 'dl') ? count - n : n));
    const order = values.map((_, i) => i).sort(keepHighest
      ? (a, b) => values[b] - values[a] || a - b
      : (a, b) => values[a] - values[b] || a - b);
    const kept = new Set(order.slice(0, nKeep));
    return values.map((_, i) => kept.has(i));
  }

  function rollDice(raw, ctx = {}) {
    let src = String(raw).toLowerCase().replace(/\s+/g, '');
    if (!src) throw new Error('Digite uma expressão, ex.: 1d20+3');

    // BD (bônus de dano) vira a expressão do bônus, combinando o sinal de antes dele
    const bd = String(ctx.bd ?? '0').toLowerCase().replace(/\s+/g, '') || '0';
    const bdNeg = bd.startsWith('-');
    const bdBody = bd.replace(/^[+-]/, '') || '0';
    src = src.replace(/([+-]?)bd/g, (_, s) => ((s === '-') !== bdNeg ? '-' : '+') + bdBody);

    let pos = 0;
    let diceCount = 0;
    const bad = () => new Error(BAD_EXPR);
    const digits = () => {
      const s = pos;
      while (pos < src.length && src[pos] >= '0' && src[pos] <= '9') pos++;
      return src.slice(s, pos);
    };
    const readMod = () => {
      const m = /^(kh|kl|dh|dl|k)(\d*)/.exec(src.slice(pos));
      if (!m) return null;
      pos += m[0].length;
      return { mod: m[1], n: m[2] === '' ? 1 : parseInt(m[2], 10) };
    };

    // lê e já rola um termo: "NdX[kh|kl|dh|dl N]" ou número fixo
    function parseTerm() {
      const start = pos;
      const d = digits();
      if (src[pos] === 'd') {
        pos++;
        let sides;
        if (src[pos] === '%') { sides = 100; pos++; }
        else { const s = digits(); if (!s) throw bad(); sides = parseInt(s, 10); }
        const count = d === '' ? 1 : parseInt(d, 10);
        if (count < 1 || count > 100) throw new Error('Use de 1 a 100 dados por termo.');
        if (sides < 1 || sides > 1000) throw new Error('Os dados devem ter de 1 a 1000 lados.');
        diceCount += count;
        if (diceCount > 300) throw new Error('Dados demais na expressão (máximo 300).');
        const md = readMod();
        const values = Array.from({ length: count }, () => rand(sides));
        const keep = md ? pickKeep(values, md.mod, md.n) : values.map(() => true);
        return {
          text: src.slice(start, pos), sides,
          dice: values.map((v, i) => ({ v, keep: keep[i] })),
          value: values.reduce((s, v, i) => s + (keep[i] ? v : 0), 0)
        };
      }
      if (d === '') throw bad();
      return { text: d, dice: null, value: parseInt(d, 10) };
    }

    const terms = [];
    let total = 0;
    while (pos < src.length) {
      let sign = '+';
      if (src[pos] === '+' || src[pos] === '-') { sign = src[pos]; pos++; }
      else if (terms.length > 0) throw bad();
      const mult = sign === '-' ? -1 : 1;
      if (terms.length >= 20) throw new Error('Termos demais (máximo 20).');

      if (src[pos] === '(') {
        const gStart = pos;
        pos++;
        const parts = [];
        for (;;) {
          let ps = '+';
          if (src[pos] === '+' || src[pos] === '-') { ps = src[pos]; pos++; }
          else if (parts.length > 0) throw bad();
          if (src[pos] === '(') throw new Error('Parênteses dentro de parênteses não são suportados.');
          const t = parseTerm();
          if (ps === '-' && t.dice) throw new Error('Dentro de ( ) só dá para subtrair números fixos.');
          parts.push({ sign: ps, ...t });
          if (src[pos] === ')') { pos++; break; }
          if (pos >= src.length) throw new Error('Faltou fechar o parêntese.');
        }
        const gm = readMod();

        // todos os dados de dentro formam um conjunto só; o filtro vale para o conjunto
        const pool = [];
        parts.forEach(p => { if (p.dice) p.dice.forEach(x => { if (x.keep) pool.push(x); }); });
        if (gm) {
          const keep = pickKeep(pool.map(x => x.v), gm.mod, gm.n);
          pool.forEach((x, i) => { x.keep = keep[i]; });
        }
        let value = 0;
        parts.forEach(p => {
          if (p.dice) value += p.dice.reduce((s, x) => s + (x.keep ? x.v : 0), 0);
          else value += (p.sign === '-' ? -1 : 1) * p.value;
        });
        total += mult * value;
        terms.push({ sign, text: src.slice(gStart, pos), group: true, parts, value });
      } else {
        const t = parseTerm();
        total += mult * t.value;
        terms.push({ sign, ...t });
      }
    }

    return { kind: 'dice', expr: String(raw).trim(), total, terms };
  }
  // </dice-engine>

  // ---------- histórico de rolagens ----------
  const RL_KEY = 'coc-rolls-' + DIR;
  let rolls = [];
  try { rolls = JSON.parse(localStorage.getItem(RL_KEY) || '[]'); if (!Array.isArray(rolls)) rolls = []; } catch (_) { rolls = []; }

  const fmtTime = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // desenha o detalhe de uma rolagem de dados (termos, dados mantidos/descartados e total) dentro de `box`
  function appendDice(box, r) {
    const det = el('div', 're-detail');
    if (r.label) {
      const ex = el('span', 're-expr');
      ex.textContent = r.expr;
      det.appendChild(ex);
    }
    const sg = (g, s) => {
      const e = el('span', 'sg');
      e.textContent = s === '-' ? '−' : '+';
      g.appendChild(e);
    };
    const konst = (g, v) => {
      const e = el('span', 'k');
      e.textContent = v;
      g.appendChild(e);
    };
    const dieSpans = (g, sides, dice) => dice.forEach(d => {
      let cls = 'die';
      if (!d.keep) cls += ' drop';
      else if (sides > 1 && d.v === sides) cls += ' max';
      else if (sides > 1 && d.v === 1) cls += ' min';
      const s = el('span', cls);
      s.textContent = d.v;
      g.appendChild(s);
    });
    r.terms.forEach((tm, i) => {
      const g = el('span', 'term');
      if (i > 0 || tm.sign === '-') sg(g, tm.sign);
      if (tm.group || tm.dice) {
        const lab = el('span', 'tx');
        lab.textContent = tm.text + ':';
        g.appendChild(lab);
      }
      if (tm.group) {
        tm.parts.forEach((p, k) => {
          if (k > 0 || p.sign === '-') sg(g, p.sign);
          if (p.dice) dieSpans(g, p.sides, p.dice); else konst(g, p.value);
        });
      } else if (tm.dice) {
        dieSpans(g, tm.sides, tm.dice);
      } else {
        konst(g, tm.value);
      }
      det.appendChild(g);
    });
    if (r.bdNote) {
      const n = el('span', 're-bd');
      n.textContent = r.bdNote;
      det.appendChild(n);
    }
    box.appendChild(det);
    const tot = el('div', 're-total');
    tot.textContent = r.total;
    box.appendChild(tot);
  }

  function renderRoll(r) {
    const li = el('li', 'roll-entry ' + r.kind);
    const head = el('div', 're-head');
    const title = el('span', 're-title');
    const time = el('time');
    time.textContent = fmtTime(r.t);
    head.append(title, time);
    li.appendChild(head);

    if (r.kind === 'dice') {
      title.textContent = r.label || r.expr;
      appendDice(li, r);
    } else if (r.kind === 'test') {
      title.textContent = `${r.label} (${r.target})`;
      const body = el('div', 're-test ' + r.cls);
      const n = el('b', 'n'); n.textContent = r.roll;
      const res = el('span', 'r'); res.textContent = r.result;
      body.append(n, res);
      li.appendChild(body);
      if (r.extra) {
        const x = el('div', 're-extra');
        x.textContent = r.extra;
        li.appendChild(x);
      }
    } else if (r.kind === 'attack') {
      title.textContent = `${r.label} (${r.target})`;
      const body = el('div', 're-test ' + r.cls);
      const n = el('b', 'n'); n.textContent = r.roll;
      const res = el('span', 'r'); res.textContent = r.result;
      body.append(n, res);
      li.appendChild(body);
      if (r.extra) {
        const x = el('div', 're-extra');
        x.textContent = r.extra;
        li.appendChild(x);
      }
      if (r.damage) {
        const box = el('div', 're-dmg' + (r.hit ? '' : ' miss'));
        const lab = el('div', 're-dmg-lab');
        lab.textContent = r.hit ? 'Dano' : 'Dano (o ataque falhou, não se aplica)';
        box.appendChild(lab);
        appendDice(box, r.damage);
        li.appendChild(box);
      }
    } else if (r.kind === 'improve') {
      title.textContent = 'Melhoria automática de perícias';
      const ul = el('ul', 're-list');
      let ok = 0;
      r.items.forEach(it => {
        const row = el('li', it.skip ? 'skip' : it.ok ? 'ok' : 'fail');
        if (it.skip) {
          row.textContent = `${it.name}: ${it.skip}`;
        } else if (it.ok) {
          ok++;
          const why = it.roll > it.before ? `${it.roll} > ${it.before}` : `${it.roll} > 95`;
          row.textContent = `${it.name}: d100 = ${why} → +${it.gain} (1d10 = ${it.gainRaw}${it.capped ? ', limite 99' : ''}) · ${it.before} → ${it.after}`;
        } else {
          row.textContent = `${it.name}: d100 = ${it.roll} ≤ ${it.before} → sem melhoria`;
        }
        ul.appendChild(row);
        if (it.sanity) {
          const n = el('li', 'note');
          n.textContent = `${it.name} chegou a 90% ou mais: o investigador ganha 2d6 de Sanidade (aplique no marcador).`;
          ul.appendChild(n);
        }
      });
      const sum = el('li', 'note');
      sum.textContent = `${ok} de ${r.items.length} melhoraram. Marcas removidas.`;
      ul.appendChild(sum);
      li.appendChild(ul);
    }
    return li;
  }

  function renderRolls() {
    const ul = $('#roll-list');
    ul.innerHTML = '';
    rolls.forEach(r => ul.appendChild(renderRoll(r)));
    $('#roll-empty').hidden = rolls.length > 0;
  }

  function addRoll(entry) {
    entry.t = Date.now();
    rolls.unshift(entry);
    if (rolls.length > 100) rolls.length = 100;
    try { localStorage.setItem(RL_KEY, JSON.stringify(rolls)); } catch (_) { /* ignora */ }
    renderRolls();
    $('#roll-list').scrollTop = 0;
  }

  function clearRolls() {
    rolls = [];
    try { localStorage.removeItem(RL_KEY); } catch (_) { /* ignora */ }
    renderRolls();
  }

  const isPanelOpen = () => $('#roll-panel').classList.contains('open');
  function setPanel(open) {
    const p = $('#roll-panel');
    p.classList.toggle('open', open);
    p.setAttribute('aria-hidden', String(!open));
    $('#roll-toggle').setAttribute('aria-expanded', String(open));
    $('#roll-toggle').classList.toggle('active', open);
    document.body.classList.toggle('panel-open', open);
    // no celular não foca o campo (evita abrir o teclado sem querer)
    if (open && window.matchMedia('(min-width: 701px)').matches) $('#dice-input').focus({ preventScroll: true });
  }

  function doDiceRoll(str, label) {
    const err = $('#dice-error');
    try {
      const db = $('#db').textContent;
      const entry = rollDice(str, { bd: db });
      if (label) entry.label = label;
      if (/bd/i.test(str)) entry.bdNote = 'BD = ' + db;
      err.textContent = '';
      addRoll(entry);
      if (!isPanelOpen()) showToast({ l: label || entry.expr, n: entry.total, r: label ? entry.expr : '', cls: 'good' });
    } catch (ex) {
      if (isPanelOpen()) err.textContent = ex.message; else notify(ex.message);
    }
  }

  // ---------- melhoria automática de perícias ----------
  function improveSkills() {
    const rows = $$('#skills-wrap .skill').filter(r => $('.s-tick', r).checked);
    if (!rows.length) return;

    const items = rows.map(row => {
      const name = $('.s-name', row).value.trim() || 'Perícia sem nome';
      const before = num($('.s-total', row).textContent);
      const it = { name, before };

      if (/^(mitos de cthulhu|cr[eé]dito)/i.test(name)) {
        it.skip = 'não evolui por experiência';
      } else {
        it.roll = rand(100);
        it.ok = it.roll > before || it.roll > 95;
        if (it.ok) {
          it.gainRaw = rand(10);
          it.gain = Math.max(0, Math.min(it.gainRaw, 99 - before)); // perícia não passa de 99
          it.capped = it.gain < it.gainRaw;
          if (it.gain) setFv($('.s-imp', row), numFx($('.s-imp', row)) + it.gain);
        }
      }
      $('.s-tick', row).checked = false;
      it.after = before + (it.gain || 0);
      it.sanity = !!it.gain && before < 90 && it.after >= 90;
      return it;
    });

    changed();
    addRoll({ kind: 'improve', items });
    setPanel(true);
  }

  // ---------- eventos ----------
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.nosave !== undefined) {
      if (t.id === 'skill-search') applySearch();
      return;
    }
    if (!t.closest('main')) return;
    changed();
  });

  // ao terminar de editar o nome de uma perícia, reposiciona em ordem alfabética
  document.addEventListener('change', e => {
    if (e.target.classList.contains('s-name')) {
      placeSkill(e.target.closest('.skill'));
      schedule();
    }
  });

  $('#reset-input').addEventListener('input', e => {
    $('#reset-confirm').disabled = e.target.value !== 'DELETAR';
  });

  $('#dice-form').addEventListener('submit', e => {
    e.preventDefault();
    doDiceRoll($('#dice-input').value);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isPanelOpen() && !$('#reset-dialog').open) { setPanel(false); return; }
    if (e.key !== 'Enter') return;
    if (e.target.id === 'cond-custom') { e.preventDefault(); $('#add-cond-custom').click(); }
    else if (e.target.id === 'new-skill-name') { e.preventDefault(); $('#add-skill').click(); }
    else if (e.target.id === 'reset-input' && !$('#reset-confirm').disabled) { e.preventDefault(); $('#reset-confirm').click(); }
  });

  // fora da edição, nomes não recebem foco nem cursor (só servem para rolar o teste)
  document.addEventListener('mousedown', e => {
    if (!editing && e.target.closest && e.target.closest('.s-name, .ch-name, .m-name, .f-label, .b-title')) e.preventDefault();
  });

  // ---------- celular: menus flutuantes e linhas compactas ----------
  const isMobile = () => matchMedia('(max-width: 700px)').matches;
  function closePops() {
    document.body.classList.remove('pop-top', 'pop-nav');
    $('#top-menu').setAttribute('aria-expanded', 'false');
    $('#nav-fab').setAttribute('aria-expanded', 'false');
  }
  function togglePop(which) {
    const cls = which === 'top' ? 'pop-top' : 'pop-nav';
    const open = !document.body.classList.contains(cls);
    closePops();
    if (open) {
      setPanel(false);
      document.body.classList.add(cls);
      $(which === 'top' ? '#top-menu' : '#nav-fab').setAttribute('aria-expanded', 'true');
    }
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (!t.closest('.menu-wrap')) closeMenus();
    if (t.closest('#top-menu')) { togglePop('top'); return; }
    if (t.closest('#nav-fab')) { togglePop('nav'); return; }
    if (!t.closest('label.btn')) closePops(); // o seletor de arquivo do "Importar" precisa do rótulo vivo
    // fora do modo edição, tocar no nome de uma perícia/característica faz o teste
    const nm = t.closest('.s-name, .ch-name');
    if (nm && !editing) {
      nm.blur();
      const sk = nm.closest('.skill');
      const ch = nm.closest('.char');
      if (sk) roll(nm.value || 'Perícia', $('.s-total', sk).textContent);
      else if (ch) roll(nm.value || 'Característica', $('.ch-val', ch).value);
      return;
    }
    const b = t.closest('button');
    if (!b) return;

    // abas
    if (b.dataset.tabbtn) { setTab(b.dataset.tabbtn, true); return; }

    // histórico de rolagens
    if (b.id === 'edit-toggle') { setEdit(!editing); return; }
    if (b.id === 'roll-toggle') { closePops(); setPanel(!isPanelOpen()); return; }
    if (b.id === 'roll-close') { setPanel(false); return; }
    if (b.id === 'roll-clear') { clearRolls(); return; }
    if (b.dataset.quick) { doDiceRoll(b.dataset.quick); return; }
    if (b.id === 'improve-skills') { improveSkills(); return; }

    // reset
    if (b.id === 'reset-open') { openReset(); return; }
    if (b.id === 'reset-cancel') { $('#reset-dialog').close(); return; }
    if (b.id === 'reset-confirm') {
      if ($('#reset-input').value === 'DELETAR') {
        $('#reset-dialog').close();
        resetSheet();
      }
      return;
    }

    // menus
    if (b.dataset.menu) {
      if (b.dataset.menu === 'menu-char') buildCharMenu();
      const m = $('#' + b.dataset.menu);
      const willOpen = m.hidden;
      closeMenus();
      m.hidden = !willOpen;
      if (willOpen) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (b.dataset.addCond) {
      addCondition({ nome: b.dataset.addCond });
      closeMenus(); changed();
      return;
    }
    if (b.id === 'add-cond-custom') {
      const inp = $('#cond-custom');
      const nome = inp.value.trim();
      if (!nome) { inp.focus(); return; }
      addCondition({ nome });
      inp.value = '';
      closeMenus(); changed();
      return;
    }
    if (b.dataset.addChar) {
      const k = b.dataset.addChar;
      const base = CHARS.find(x => x[0] === k);
      const d = addChar(base
        ? { id: k, nome: base[1], valor: null }
        : { id: 'c' + Date.now().toString(36), nome: '', valor: null });
      closeMenus(); changed();
      if (!base) $('.ch-name', d).focus();
      return;
    }
    if (b.dataset.addMarker) {
      const tipo = b.dataset.addMarker;
      const d = addMarker({ tipo, nome: MARKER_TYPES[tipo] });
      closeMenus(); changed();
      if (tipo === 'custom' || tipo === 'livre') { const n = $('.m-name', d); n.focus(); n.select(); }
      return;
    }

    // rolagens
    if (b.classList.contains('w-go')) { attack(b.closest('.weapon')); return; }
    if (b.classList.contains('roll')) {
      const mk = b.closest('.marker');
      const sk = b.closest('.skill');
      const ch = b.closest('.char');
      if (mk) roll($('.m-name', mk).value || 'Marcador', $('.m-cur', mk).value);
      else if (sk) roll($('.s-name', sk).value || 'Perícia', $('.s-total', sk).textContent);
      else if (ch) roll($('.ch-name', ch).value || 'Característica', $('.ch-val', ch).value);
      return;
    }

    // marcadores: + / −
    if (b.classList.contains('step')) {
      const mk = b.closest('.marker');
      const cur = $('.m-cur', mk);
      let v = num(cur.value) + Number(b.dataset.d);
      const eff = mk.dataset.eff === '' ? 0 : num(mk.dataset.eff);
      v = Math.max(0, eff > 0 ? Math.min(eff, v) : v);
      cur.value = v;
      changed();
      return;
    }

    // perícias
    if (b.classList.contains('pin')) {
      const row = b.closest('.skill');
      row.classList.toggle('pinned');
      placeSkill(row);
      changed();
      return;
    }
    if (b.classList.contains('exp')) {
      b.closest('.skill').classList.toggle('open');
      return;
    }
    if (b.id === 'add-skill') {
      const inp = $('#new-skill-name');
      const nome = inp.value.trim();
      if (!nome) { inp.focus(); return; }
      addNewSkill(nome);
      inp.value = '';
      return;
    }

    // armas, itens, campos, containers
    if (b.classList.contains('w-stats')) {
      const w = b.closest('.weapon');
      const hide = !w.classList.contains('compact');
      w.classList.toggle('compact', hide);
      b.textContent = hide ? '▸' : '▾';
      b.setAttribute('aria-expanded', String(!hide));
      changed();
      return;
    }
    if (b.classList.contains('w-toggle')) {
      const w = b.closest('.weapon');
      const ta = $('[data-w="desc"]', w);
      ta.hidden = !ta.hidden;
      b.textContent = ta.hidden ? 'Descrição ▾' : 'Descrição ▴';
      if (!ta.hidden) ta.focus();
      return;
    }
    if (b.id === 'add-weapon') { const w = addWeaponRow({}); $('[data-w="name"]', w).focus(); changed(); return; }
    if (b.id === 'add-item') { const d = addItem({ quantidade: 1 }); $('.i-name', d).focus(); changed(); return; }
    if (b.id === 'add-field') {
      const f = addField({ nome: '', valor: '' });
      $('.f-label', f).focus();
      changed();
      return;
    }
    if (b.dataset.addBox) {
      const d = addBox(b.dataset.addBox, { titulo: '', texto: '' });
      $('.b-title', d).focus();
      changed();
      return;
    }

    // remover (campo, marcador, condição, perícia, arma, item, container)
    if (b.classList.contains('del')) {
      const item = b.closest('.field, .char, .marker, .chip, .skill, .weapon, .item, .box');
      if (item) {
        item.remove();
        updateCondEmpty(); updateItemsEmpty(); updatePinnedWrap();
        changed();
      }
      return;
    }

    if (b.id === 'btn-export') {
      const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = DIR + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });

  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      populate(JSON.parse(await file.text()));
      await save();
    } catch (_) {
      setStatus('Arquivo JSON inválido.', 'warn');
    }
    e.target.value = '';
  });

  // ---------- início ----------
  buildMenus();
  setTab(ui.tab, false);
  renderRolls();
  load();
})();
