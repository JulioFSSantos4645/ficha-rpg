// Servidor local da mesa de Call of Cthulhu. Sem dependências.
//
//   node server.js           → só neste computador  (http://localhost:3000)
//   node server.js --lan     → também para outros aparelhos da mesma rede Wi-Fi
//   PORT=3001 node server.js → outra porta
//
// Dados: <jogador>/player.json e mestre/mestre.json (criados sozinhos).
// Estrutura (esta pasta é a "raiz"):
//   server.js, index.html
//   _modelo/<sistema>/ → ficha em branco (player.html, style.css, script.js), ex.: _modelo/call_of_cthulhu; é copiada ao criar um jogador
//   mestre/       → mestre.html
//   players/<jogador>/ → player.html, style.css, script.js; o player.json é criado sozinho
//
// Senhas: cada pasta pode ter um senha.json (criado pelo mestre; a senha fica criptografada).
// Esqueceu a senha? Apague o senha.json daquela pasta.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const LAN = process.argv.includes('--lan') || process.env.HOST === '0.0.0.0';
const ROOT = __dirname;
const MODEL = '_modelo';
const RESERVED = new Set(['senha', 'api', 'mestre', 'players']);
const SESSION_MS = 12 * 60 * 60 * 1000;
const SCOPE_TTL = 2 * 60 * 1000; // sem sinal de vida da página por 2 min → pede a senha de novo

const HTML = 'text/html; charset=utf-8';
const TYPES = {
  '.html': HTML, '.htm': HTML, '.index': HTML,
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
const JSON_TYPE = 'application/json; charset=utf-8';
const isHtml = n => /\.(html?|index)$/i.test(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
const sendJson = (res, code, obj) => send(res, code, typeof obj === 'string' ? obj : JSON.stringify(obj), JSON_TYPE);
const fail = (res, code, erro) => sendJson(res, code, { ok: false, erro });

// ---------------------------------------------------------------- pastas e fichas
// Jogadores ficam em players/<pasta>/ ; o mestre fica numa pasta da raiz com mestre.html (ex.: mestre/).
const PLAYERS = 'players';
const OFF = new Set([PLAYERS, 'node_modules']);
const okName = n => !!n && !/[\\/]/.test(n) && !n.startsWith('.') && !n.startsWith('_') && n !== 'node_modules';
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } };
function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && okName(e.name))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  } catch (_) { return []; }
}
function htmlIn(dir) {
  try { return fs.readdirSync(dir).filter(isHtml).sort(); } catch (_) { return []; }
}
function findMaster() {
  for (const n of subdirs(ROOT)) {
    if (OFF.has(n)) continue;
    const f = htmlIn(path.join(ROOT, n)).find(x => x.toLowerCase() === 'mestre.html');
    if (f) return { pasta: n, arquivo: f, dir: path.join(ROOT, n) };
  }
  return null;
}
// pasta → { dir, mestre } (jogador em players/, ou a pasta do mestre)
function dirOf(name) {
  if (!okName(name) || name === PLAYERS) return null;
  const pd = path.join(ROOT, PLAYERS, name);
  if (isDir(pd)) return { dir: pd, mestre: false };
  const m = findMaster();
  if (m && m.pasta === name) return { dir: m.dir, mestre: true };
  return null;
}
const folderPath = name => { const d = dirOf(name); return d ? d.dir : null; };
const urlOf = (pasta, arquivo, mestre) => '/' + (mestre ? '' : PLAYERS + '/') + encodeURIComponent(pasta) + '/' + encodeURIComponent(arquivo);

// arquivo de dados da pasta: player.json (jogador) ou mestre.json (mestre). Aceita o nome antigo <pasta>.json para ler.
function dataFile(pasta, forRead) {
  const d = dirOf(pasta);
  if (!d) return null;
  const novo = path.join(d.dir, d.mestre ? 'mestre.json' : 'player.json');
  if (forRead && !fs.existsSync(novo)) {
    const antigo = path.join(d.dir, pasta + '.json');
    if (fs.existsSync(antigo)) return antigo;
  }
  return novo;
}
function readSheet(pasta) {
  try { return JSON.parse(fs.readFileSync(dataFile(pasta, true), 'utf8')); } catch (_) { return null; }
}

// valor de um campo do investigador (ex.: "nome"), aceitando também formatos antigos
function fieldValue(j, id) {
  let v = null;
  if (j && Array.isArray(j.campos)) {
    const c = j.campos.find(x => x && x.id === id);
    if (c) v = c.valor;
  }
  if ((v == null || String(v).trim() === '') && j && j.info) v = j.info[id];
  if ((v == null || String(v).trim() === '') && j && (id === 'nome' || id === 'jogador')) v = j[id + '_inicial'];
  v = v == null ? '' : String(v).trim();
  return v || null;
}

function listSheets() {
  const out = { jogadores: [], mestre: null };
  const m = findMaster();
  if (m) out.mestre = { pasta: m.pasta, arquivo: m.arquivo, url: urlOf(m.pasta, m.arquivo, true), protegida: hasPassword(m.pasta) };
  for (const n of subdirs(path.join(ROOT, PLAYERS))) {
    const dir = path.join(ROOT, PLAYERS, n);
    for (const f of htmlIn(dir)) {
      if (f.toLowerCase() === 'mestre.html') continue;
      const j = readSheet(n) || {};
      out.jogadores.push({
        pasta: n, arquivo: f, url: urlOf(n, f, false), nome: fieldValue(j, 'nome'), jogador: fieldValue(j, 'jogador'),
        ocupacao: fieldValue(j, 'ocupacao'), protegida: hasPassword(n)
      });
    }
  }
  return out;
}

// só o que o mestre precisa ver (nome, ocupação e marcadores), não a ficha inteira
function trimmed(j) {
  if (!j) return null;
  return {
    campos: Array.isArray(j.campos) ? j.campos.filter(c => c && (c.id === 'nome' || c.id === 'jogador' || c.id === 'ocupacao')) : undefined,
    info: j.info ? { nome: j.info.nome, jogador: j.info.jogador, ocupacao: j.info.ocupacao } : undefined,
    nome_inicial: j.nome_inicial,
    jogador_inicial: j.jogador_inicial,
    marcadores: Array.isArray(j.marcadores)
      ? j.marcadores.map(m => ({ id: m.id, tipo: m.tipo, nome: m.nome, atual: m.atual, max_efetivo: m.max_efetivo }))
      : undefined,
    meta: j.meta
  };
}
function mesa() {
  const l = listSheets();
  l.jogadores = l.jogadores.map(p => ({ ...p, ficha: trimmed(readSheet(p.pasta)) }));
  return l;
}

// modelos de ficha: _modelo/<sistema>/player.html (+ style.css, script.js). Ex.: _modelo/call_of_cthulhu
function listModels() {
  try {
    return fs.readdirSync(path.join(ROOT, MODEL), { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(ROOT, MODEL, e.name, 'player.html')))
      .map(e => ({ id: e.name, nome: e.name.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } catch (_) { return []; }
}

// ficha inicial: a importada (se houver) com o nome do personagem e do jogador preenchidos
function startSheet(ficha, nome, jogador) {
  const j = ficha ? JSON.parse(JSON.stringify(ficha)) : {};
  const vals = { nome, jogador };
  for (const [id, v] of Object.entries(vals)) {
    if (!v) continue;
    let done = false;
    if (Array.isArray(j.campos)) {
      const c = j.campos.find(x => x && x.id === id);
      if (c) c.valor = v; else j.campos.push({ id, nome: id === 'nome' ? 'Nome' : 'Jogador', valor: v });
      done = true;
    }
    if (j.info && typeof j.info === 'object') { j.info[id] = v; done = true; }
    if (!done || !ficha) j[id + '_inicial'] = v;
  }
  return j;
}

// ---------------------------------------------------------------- senhas
const pwFile = pasta => path.join(folderPath(pasta) || path.join(ROOT, '_'), 'senha.json');
const hasPassword = pasta => fs.existsSync(pwFile(pasta));
const hashPw = (senha, salt) => crypto.scryptSync(String(senha), salt, 32).toString('hex');

function setPassword(pasta, senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(pwFile(pasta), JSON.stringify({
    alg: 'scrypt', salt, hash: hashPw(senha, salt), criada_em: new Date().toISOString()
  }, null, 2), 'utf8');
}
function checkPassword(pasta, senha) {
  try {
    const j = JSON.parse(fs.readFileSync(pwFile(pasta), 'utf8'));
    const a = Buffer.from(hashPw(senha, j.salt), 'hex');
    const b = Buffer.from(String(j.hash), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; } // arquivo corrompido: ninguém entra; apague o senha.json
}

// sessões em memória (reiniciar o servidor desconecta todo mundo)
const sessions = new Map(); // token → { token, scopes:Scopes, exp }
// pasta → último sinal de vida; expira rápido para a senha ser pedida a cada nova visita
class Scopes {
  constructor() { this.m = new Map(); }
  add(p) { this.m.set(p, Date.now()); }
  delete(p) { this.m.delete(p); }
  has(p) { const t = this.m.get(p); if (t === undefined) return false; if (Date.now() - t > SCOPE_TTL) { this.m.delete(p); return false; } return true; }
  touch(p) { if (this.has(p)) this.m.set(p, Date.now()); }
}
function getSession(req) {
  const m = /(?:^|;\s*)coc_sess=([a-f0-9]{48})/.exec(req.headers.cookie || '');
  const s = m && sessions.get(m[1]);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(s.token); return null; }
  return s;
}
function ensureSession(req, res) {
  let s = getSession(req);
  if (!s) {
    const token = crypto.randomBytes(24).toString('hex');
    s = { token, scopes: new Scopes(), exp: 0 };
    sessions.set(token, s);
    const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `coc_sess=${token}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  }
  s.exp = Date.now() + SESSION_MS;
  return s;
}

// quem pode abrir a pasta? sem senha: todos. Com senha: quem entrou nela, ou o mestre (se o mestre tiver senha e tiver entrado)
function canAccess(req, pasta) {
  if (!hasPassword(pasta)) return true;
  const s = getSession(req);
  if (!s) return false;
  if (s.scopes.has(pasta)) { s.scopes.touch(pasta); return true; }
  const m = findMaster();
  if (m && m.pasta !== pasta && s.scopes.has(m.pasta)) { s.scopes.touch(m.pasta); return true; }
  return false;
}
function masterOk(req) {
  const m = findMaster();
  return !m || canAccess(req, m.pasta);
}

// limite de tentativas de senha (por endereço)
const fails = new Map();
const LIMIT = 8, WINDOW = 10 * 60 * 1000;
const clientKey = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function waitSeconds(key) {
  const f = fails.get(key);
  if (!f) return 0;
  if (Date.now() > f.reset) { fails.delete(key); return 0; }
  return f.n >= LIMIT ? Math.ceil((f.reset - Date.now()) / 1000) : 0;
}
function addFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() > f.reset) fails.set(key, { n: 1, reset: Date.now() + WINDOW });
  else f.n++;
}

function loginPage(pasta) {
  const m = findMaster();
  const titulo = m && m.pasta === pasta ? 'Área do Mestre' : (fieldValue(readSheet(pasta) || {}, 'nome') || pasta);
  const p = JSON.stringify(pasta).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Senha – Call of Cthulhu</title>
<style>
  *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;color:#e8dfd0;font-family:Georgia,serif;
  background:#14110f radial-gradient(circle at top,#1f2a26 0%,#14110f 55%) fixed}
  .box{width:min(380px,100%);background:#211c17;border:1px solid #4a3f33;border-radius:12px;padding:22px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
  h1{margin:0 0 4px;font-size:1.15rem;color:#c9a24b;letter-spacing:.06em} p{margin:0 0 14px;color:#9a8f7d;font-size:.9rem}
  input{width:100%;font:inherit;font-size:16px;color:#e8dfd0;background:#17130f;border:1px solid #4a3f33;border-radius:6px;padding:10px}
  input:focus{outline:2px solid #6fa38a;border-color:transparent}
  button{width:100%;margin-top:10px;font:inherit;padding:10px;cursor:pointer;color:#c9a24b;background:rgba(201,162,75,.14);border:1px solid #c9a24b;border-radius:6px}
  #e{min-height:1.2em;margin:10px 0 0;color:#ffb3a8;font-size:.88rem} a{color:#9a8f7d;font-size:.85rem}
</style></head><body><form class="box" id="f">
<h1>🔒 ${esc(titulo)}</h1><p>Esta ficha tem senha. Digite para continuar.</p>
<input id="s" type="password" placeholder="Senha" autocomplete="current-password" autofocus>
<button type="submit">Entrar</button><p id="e" role="alert"></p><a href="/">← Início</a></form>
<script>
const PASTA=${p};
document.getElementById('f').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const e=document.getElementById('e'); e.textContent='';
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pasta:PASTA,senha:document.getElementById('s').value})});
    if(r.ok) location.reload();
    else if(r.status===429){const j=await r.json().catch(()=>({}));e.textContent='Muitas tentativas. Tente de novo em '+Math.ceil((j.espera||600)/60)+' min.';}
    else e.textContent='Senha incorreta.';
  }catch(_){e.textContent='Servidor fora do ar.';}
});
</script></body></html>`;
}

// ---------------------------------------------------------------- utilidades de requisição
function originOk(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const fwd = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  try {
    const oh = new URL(origin).host;
    return oh === req.headers.host || (fwd !== '' && oh === fwd);
  } catch (_) { return false; }
}
function readBody(req, limit = 5e6) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > limit) { reject(new Error('grande')); req.destroy(); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
async function parseBody(req, res) {
  let raw;
  try { raw = await readBody(req); } catch (_) { fail(res, 413, 'Conteúdo grande demais.'); return null; }
  try {
    const v = raw.trim() ? JSON.parse(raw) : {};
    if (v === null || typeof v !== 'object') throw new Error('x');
    return v;
  } catch (_) { fail(res, 400, 'JSON inválido.'); return null; }
}
const decode = s => { try { return decodeURIComponent(s); } catch (_) { return null; } };
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// ---------------------------------------------------------------- arquivos estáticos
function serveStatic(req, res, urlPath) {
  const rel0 = decode(urlPath);
  if (rel0 === null || rel0.includes('\0')) return send(res, 400, 'Requisição inválida');
  const rel = rel0.endsWith('/') ? rel0 + 'index.html' : rel0;
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT + path.sep)) return send(res, 403, 'Acesso negado');
  const parts = path.relative(ROOT, full).split(path.sep);
  const scope = parts[0] === PLAYERS ? parts[1] : parts[0]; // pasta que a senha protege
  const nested = parts.length > (parts[0] === PLAYERS ? 2 : 1);
  if (parts.some(p => p.startsWith('.') || p.startsWith('_')) || parts[0] === 'node_modules' || full === path.join(ROOT, 'server.js')) {
    return send(res, 404, 'Não encontrado');
  }
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type) return send(res, 404, 'Não encontrado'); // .json só pela API; senha.json nunca é servido
  if (nested && !canAccess(req, scope)) {
    return type === HTML ? send(res, 401, loginPage(scope), HTML) : send(res, 401, 'Senha necessária');
  }
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Não encontrado');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

// ---------------------------------------------------------------- rotas
async function route(req, res) {
  const url = (req.url || '/').split('?')[0];
  const method = req.method;
  let m;

  if (url.startsWith('/api/')) {
    if (method === 'POST' && !originOk(req)) return fail(res, 403, 'Origem não permitida.');

    // modelos disponíveis para criar fichas (só o mestre)
    if (url === '/api/modelos' && method === 'GET') {
      if (!masterOk(req)) return fail(res, 401, 'senha');
      return sendJson(res, 200, { modelos: listModels() });
    }

    // lista pública (página inicial)
    if (url === '/api/fichas' && method === 'GET') return sendJson(res, 200, listSheets());

    // visão do mestre: lista + marcadores de cada jogador
    if (url === '/api/mesa' && method === 'GET') {
      if (!masterOk(req)) return fail(res, 401, 'senha');
      return sendJson(res, 200, mesa());
    }

    if (url === '/api/login' && method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const pasta = String(body.pasta || '');
      if (!folderPath(pasta)) return fail(res, 404, 'Pasta não encontrada.');
      const key = clientKey(req);
      const espera = waitSeconds(key);
      if (espera) return sendJson(res, 429, { ok: false, erro: 'Muitas tentativas.', espera });
      if (hasPassword(pasta) && !checkPassword(pasta, String(body.senha || ''))) {
        addFail(key);
        return fail(res, 401, 'Senha incorreta.');
      }
      fails.delete(key);
      ensureSession(req, res).scopes.add(pasta);
      return sendJson(res, 200, { ok: true });
    }

    // sinal de vida da página (mantém o acesso) e saída explícita ao fechar a página
    if ((m = /^\/api\/(ping|sair)\/([^/]+)$/.exec(url)) && method === 'POST') {
      const name = decode(m[2]);
      const s = getSession(req);
      if (s && name) {
        if (m[1] === 'sair') s.scopes.delete(name);
        else if (s.scopes.has(name)) s.scopes.touch(name);
        else { const mm = findMaster(); if (mm && s.scopes.has(mm.pasta)) s.scopes.touch(mm.pasta); }
      }
      return sendJson(res, 200, { ok: true });
    }

    if (url === '/api/logout' && method === 'POST') {
      const s = getSession(req);
      if (s) sessions.delete(s.token);
      res.setHeader('Set-Cookie', 'coc_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      return sendJson(res, 200, { ok: true });
    }

    // ficha de uma pasta: <pasta>/<pasta>.json
    if ((m = /^\/api\/ficha\/([^/]+)$/.exec(url))) {
      const name = decode(m[1]);
      if (name === null || name === 'senha' || !folderPath(name)) return sendJson(res, 404, '{}');
      if (!canAccess(req, name)) return fail(res, 401, 'senha');
      const file = dataFile(name, method === 'GET');
      if (method === 'GET') {
        fs.readFile(file, 'utf8', (err, data) => (err ? sendJson(res, 404, '{}') : sendJson(res, 200, data)));
        return;
      }
      if (method === 'POST') {
        const obj = await parseBody(req, res); if (!obj) return;
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
        fs.renameSync(tmp, file);
        return sendJson(res, 200, { ok: true });
      }
      return fail(res, 405, 'Método não permitido.');
    }

    // definir ou remover a senha de uma pasta (só o mestre)
    if ((m = /^\/api\/senha\/([^/]+)$/.exec(url)) && method === 'POST') {
      if (!masterOk(req)) return fail(res, 401, 'senha');
      const name = decode(m[1]);
      if (name === null || !folderPath(name)) return fail(res, 404, 'Pasta não encontrada.');
      const body = await parseBody(req, res); if (!body) return;
      const senha = String(body.senha == null ? '' : body.senha);
      if (senha !== '' && (senha.length < 3 || senha.length > 200)) return fail(res, 400, 'A senha precisa ter de 3 a 200 caracteres.');
      const s = ensureSession(req, res);
      if (senha === '') { try { fs.unlinkSync(pwFile(name)); } catch (_) { /* já não existia */ } }
      else { setPassword(name, senha); s.scopes.add(name); } // quem definiu continua com acesso
      for (const o of sessions.values()) if (o !== s) o.scopes.delete(name);
      return sendJson(res, 200, { ok: true, protegida: senha !== '' });
    }

    // criar jogador a partir da pasta _modelo (só o mestre)
    if (url === '/api/jogadores' && method === 'POST') {
      if (!masterOk(req)) return fail(res, 401, 'senha');
      const body = await parseBody(req, res); if (!body) return;
      const nome = String(body.nome || '').trim().slice(0, 60);
      const jogador = String(body.jogador || '').trim().slice(0, 60);
      if (!nome && !jogador) return fail(res, 400, 'Informe o nome do personagem (ou do jogador).');
      let ficha = null;
      if (body.ficha !== undefined && body.ficha !== null) {
        if (typeof body.ficha !== 'object' || Array.isArray(body.ficha)) return fail(res, 400, 'O JSON importado não é uma ficha válida.');
        ficha = body.ficha;
      }
      const senha = String(body.senha || '');
      if (senha !== '' && (senha.length < 3 || senha.length > 200)) return fail(res, 400, 'A senha precisa ter de 3 a 200 caracteres.');
      const modelos = listModels();
      if (!modelos.length) {
        return fail(res, 500, `Nenhum modelo encontrado: crie a pasta "${MODEL}/<sistema>" com player.html, style.css e script.js.`);
      }
      const modelo = String(body.modelo || '') || (modelos.length === 1 ? modelos[0].id : '');
      const escolhido = modelos.find(m => m.id === modelo);
      if (!escolhido) return fail(res, 400, 'Escolha o modelo de ficha.');
      const tpl = path.join(ROOT, MODEL, escolhido.id);
      let base = slug(nome || jogador) || 'jogador';
      if (RESERVED.has(base)) base += '-1';
      let pasta = base;
      const mst0 = findMaster();
      for (let n = 2; fs.existsSync(path.join(ROOT, PLAYERS, pasta)) || fs.existsSync(path.join(ROOT, pasta)) || (mst0 && mst0.pasta === pasta); n++) pasta = `${base}-${n}`;
      const dir = path.join(ROOT, PLAYERS, pasta);
      try {
        fs.mkdirSync(dir, { recursive: true });
        for (const f of fs.readdirSync(tpl, { withFileTypes: true })) {
          if (!f.isFile() || f.name.startsWith('.') || /\.json$/i.test(f.name)) continue;
          fs.copyFileSync(path.join(tpl, f.name), path.join(dir, f.name));
        }
        fs.writeFileSync(path.join(dir, 'player.json'), JSON.stringify(startSheet(ficha, nome, jogador), null, 2), 'utf8');
        if (senha !== '') setPassword(pasta, senha);
      } catch (e) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignora */ }
        return fail(res, 500, 'Não foi possível criar a pasta do jogador.');
      }
      return sendJson(res, 200, { ok: true, pasta, arquivo: 'player.html', url: urlOf(pasta, 'player.html', false) });
    }

    // deletar jogador: apaga a pasta inteira (só o mestre, com confirmação)
    if ((m = /^\/api\/jogadores\/([^/]+)\/deletar$/.exec(url)) && method === 'POST') {
      if (!masterOk(req)) return fail(res, 401, 'senha');
      const name = decode(m[1]);
      const info = name === null ? null : dirOf(name);
      if (!info || info.mestre) return fail(res, 404, 'Pasta não encontrada.');
      const dir = info.dir;
      const body = await parseBody(req, res); if (!body) return;
      if (body.confirmar !== 'DELETAR') return fail(res, 400, 'Digite DELETAR para confirmar.');
      const mst = findMaster();
      if (mst && mst.pasta === name) return fail(res, 400, 'Esta é a pasta do mestre; ela não pode ser deletada por aqui.');
      if (!htmlIn(dir).length) return fail(res, 400, 'Esta pasta não parece ser de um jogador.');
      fs.rmSync(dir, { recursive: true, force: true });
      for (const o of sessions.values()) o.scopes.delete(name);
      return sendJson(res, 200, { ok: true });
    }

    return fail(res, 404, 'Não encontrado.');
  }

  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, 'Método não permitido');
  serveStatic(req, res, url);
}

const handler = (req, res) => {
  route(req, res).catch(e => {
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Erro interno.');
  });
};

// ---------------------------------------------------------------- iniciar
let announced = false;
function announce() {
  if (announced) return;
  announced = true;
  console.log('Mesa de Call of Cthulhu rodando.');
  console.log(`  Neste computador:  http://localhost:${PORT}`);
  if (LAN) {
    Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal)
      .forEach(i => console.log(`  Na rede (celulares): http://${i.address}:${PORT}`));
  } else {
    console.log('  (para abrir em outros aparelhos da rede, rode: node server.js --lan)');
  }
  console.log(`  Pasta raiz: ${ROOT}`);
  if (!listModels().length) {
    console.log(`  Aviso: falta um modelo em "${MODEL}/<sistema>" (ex.: ${MODEL}/call_of_cthulhu com player.html, style.css e script.js).`);
  }
}

// escuta em IPv4 e IPv6: o "localhost" de um túnel pode virar ::1
function listen(host, optional) {
  const s = http.createServer(handler);
  s.on('error', e => {
    if (optional) return; // ex.: este computador não tem IPv6
    if (host === '::' && (e.code === 'EAFNOSUPPORT' || e.code === 'EADDRNOTAVAIL')) return listen('0.0.0.0', false);
    if (e.code === 'EADDRINUSE') console.error(`A porta ${PORT} já está em uso. Feche o outro servidor ou use: PORT=3001 node server.js`);
    else console.error(e.message);
    process.exit(1);
  });
  s.listen({ port: PORT, host, ipv6Only: false }, () => { if (!optional) announce(); });
}

if (LAN) listen('::', false);
else { listen('127.0.0.1', false); listen('::1', true); }
