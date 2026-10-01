/* Sincronização do Painel acadêmico · Polo 1740
   ------------------------------------------------
   Usa o mesmo projeto Firebase do sistema de leads (leads-unifecaf), com login por e-mail e senha.
   - Os dados do painel ficam em academico/estado (um documento só, como antes).
   - Na primeira vez, se academico/estado estiver vazio, os dados são copiados do banco antigo
     (projeto polo-1740, configurado em sync-config.js como FIREBASE_CONFIG_ANTIGO).
   - Os alunos matriculados vêm da coleção leads do sistema de leads (somente leitura aqui).
   Quem acessa: a administradora (ADMIN_EMAILS) e as pessoas com função Permanência na aba Equipe
   do sistema de leads (regras do Firestore).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
  const ANTIGO = (typeof window !== 'undefined' && window.FIREBASE_CONFIG_ANTIGO) || null;
  const FIREBASE_VERSION = '10.14.1';
  let docRef = null, auth = null, db = null, carregando = null, unsubs = [];
  let alunosCb = null, alunos = null, usuario = null;

  function configured() { return !!CONFIG; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src; s.onload = function () { resolve(); }; s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function garantirFirebase() {
    if (carregando) return carregando;
    const base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';
    carregando = Promise.resolve()
      .then(function () { return (typeof firebase === 'undefined') ? loadScript(base + 'firebase-app-compat.js') : null; })
      .then(function () { return !firebase.auth ? loadScript(base + 'firebase-auth-compat.js') : null; })
      .then(function () { return !firebase.firestore ? loadScript(base + 'firebase-firestore-compat.js') : null; });
    return carregando;
  }

  /* ---------- Tela de login ---------- */
  function telaLogin() {
    let el = document.getElementById('login-painel');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'login-painel';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'login-titulo');
    el.innerHTML =
      '<style>#login-painel{position:fixed;inset:0;z-index:50;background:var(--rail,#0a4b3e);display:grid;place-items:center;padding:1rem;overflow:auto}' +
      '#login-painel form{background:var(--card,#fff);color:var(--ink,#13242b);border-radius:12px;padding:1.4rem;width:100%;max-width:380px;display:flex;flex-direction:column;gap:.8rem;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
      '#login-painel h1{font:800 1.4rem/1.1 var(--font-display,system-ui);margin:0}' +
      '#login-painel p{margin:0;font-size:.9rem;color:var(--ink-2,#4b5b61)}' +
      '#login-painel label{display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;font-weight:600}' +
      '#login-painel input{font:inherit;padding:.6rem .7rem;border:1px solid var(--line,#d5ddda);border-radius:8px}' +
      '#login-painel .lp-row{display:flex;flex-wrap:wrap;gap:.5rem}' +
      '#login-painel button{font:inherit;font-weight:600;padding:.55rem .9rem;border-radius:8px;border:1px solid var(--line,#d5ddda);background:var(--card,#fff);cursor:pointer;color:inherit}' +
      '#login-painel button.pri{background:var(--brand,#0b7a63);color:#fff;border-color:var(--brand,#0b7a63)}' +
      '#login-painel .lp-msg{min-height:1.2em;font-size:.85rem;color:var(--erro,#b42318)}</style>' +
      '<form id="lp-form" novalidate>' +
      '<h1 id="login-titulo">Painel acadêmico · Polo 1740</h1>' +
      '<p id="lp-sub">Entre com o mesmo e-mail e senha do sistema de leads.</p>' +
      '<label>E-mail<input type="email" id="lp-email" autocomplete="username" required></label>' +
      '<label>Senha<input type="password" id="lp-senha" autocomplete="current-password" required minlength="6"></label>' +
      '<label id="lp-conf-box" hidden>Repita a senha<input type="password" id="lp-conf" autocomplete="new-password" minlength="6"></label>' +
      '<div class="lp-row"><button type="submit" class="pri" id="lp-btn">Entrar</button><button type="button" id="lp-reset">Esqueci minha senha</button></div>' +
      '<div class="lp-msg" id="lp-msg" aria-live="polite"></div>' +
      '<p><button type="button" id="lp-toggle">Primeiro acesso: criar minha senha</button></p>' +
      '</form>';
    document.body.appendChild(el);
    let primeiro = false;
    const msg = function (t) { document.getElementById('lp-msg').textContent = t || ''; };
    const modo = function (pa) {
      primeiro = pa;
      document.getElementById('lp-conf-box').hidden = !pa;
      document.getElementById('lp-reset').hidden = pa;
      document.getElementById('lp-btn').textContent = pa ? 'Criar senha e entrar' : 'Entrar';
      document.getElementById('lp-toggle').textContent = pa ? 'Já tenho senha: voltar para Entrar' : 'Primeiro acesso: criar minha senha';
      document.getElementById('lp-sub').textContent = pa ? 'Use o e-mail que a Isabella cadastrou na Equipe e crie sua senha (mínimo 6 caracteres).' : 'Entre com o mesmo e-mail e senha do sistema de leads.';
      msg('');
    };
    document.getElementById('lp-toggle').addEventListener('click', function () { modo(!primeiro); });
    document.getElementById('lp-reset').addEventListener('click', function () {
      const em = document.getElementById('lp-email').value.trim();
      if (!em) { msg('Digite seu e-mail acima e clique de novo.'); return; }
      auth.sendPasswordResetEmail(em).then(function () { msg('Se esse e-mail estiver cadastrado, chega um link para criar nova senha.'); }, function () { msg('Não foi possível enviar. Confira o e-mail.'); });
    });
    document.getElementById('lp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const em = document.getElementById('lp-email').value.trim(), se = document.getElementById('lp-senha').value;
      if (primeiro) {
        if (se.length < 6) { msg('A senha precisa ter pelo menos 6 caracteres.'); return; }
        if (se !== document.getElementById('lp-conf').value) { msg('As duas senhas não estão iguais.'); return; }
        msg('Criando sua senha…');
        auth.createUserWithEmailAndPassword(em, se).then(function () { msg(''); }, function (err) {
          msg(err.code === 'auth/email-already-in-use' ? 'Esse e-mail já tem senha. Volte para Entrar ou use Esqueci minha senha.' : err.code === 'auth/invalid-email' ? 'E-mail inválido.' : 'Não foi possível criar a senha. Verifique a internet.');
        });
        return;
      }
      msg('Entrando…');
      auth.signInWithEmailAndPassword(em, se).then(function () { msg(''); }, function (err) {
        msg(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].indexOf(err.code) >= 0 ? 'E-mail ou senha incorretos.' : err.code === 'auth/too-many-requests' ? 'Muitas tentativas. Espere alguns minutos.' : 'Não foi possível entrar. Verifique a internet.');
      });
    });
    return el;
  }
  function semAcesso() {
    const el = telaLogin(); el.hidden = false;
    document.getElementById('lp-form').innerHTML = '<h1 id="login-titulo">Acesso não liberado</h1><p>O e-mail <b>' + (usuario && usuario.email || '') + '</b> ainda não tem acesso ao painel acadêmico. Peça para a Isabella incluir você na aba <b>Equipe</b> do sistema de leads com a função <b>Permanência</b>, depois recarregue esta página.</p><div class="lp-row"><button type="button" class="pri" id="lp-sair">Sair</button></div>';
    document.getElementById('lp-sair').addEventListener('click', function () { auth.signOut().then(function () { location.reload(); }); });
  }

  /* ---------- Cópia única do banco antigo ---------- */
  function copiarDoAntigo() {
    if (!ANTIGO) return Promise.resolve(null);
    let app;
    try { app = firebase.app('antigo'); } catch (e) { app = firebase.initializeApp(ANTIGO, 'antigo'); }
    return app.firestore().collection('polo1740').doc('estado').get().then(function (s) { return s.exists ? s.data() : null; }, function () { return null; });
  }

  /**
   * onRemoto(dados): chamado quando o documento compartilhado muda.
   * onStatus(status): 'sem-config' | 'login' | 'conectando' | 'sincronizado' | 'erro' | 'sem-acesso'.
   * estadoAtual(): estado local, usado para semear o banco se ele estiver vazio e não houver banco antigo.
   */
  function init(onRemoto, onStatus, estadoAtual) {
    if (!CONFIG) { onStatus && onStatus('sem-config'); return; }
    onStatus && onStatus('conectando');
    garantirFirebase().then(function () {
      if (!firebase.apps.some(function (a) { return a.name === '[DEFAULT]'; })) firebase.initializeApp(CONFIG);
      auth = firebase.auth(); db = firebase.firestore();
      auth.onAuthStateChanged(function (u) {
        unsubs.forEach(function (f) { f(); }); unsubs = []; usuario = u;
        if (!u) { docRef = null; telaLogin().hidden = false; onStatus && onStatus('login'); return; }
        const tl = document.getElementById('login-painel'); if (tl) tl.hidden = true;
        onStatus && onStatus('conectando');
        docRef = db.collection('academico').doc('estado');
        let primeira = true;
        unsubs.push(docRef.onSnapshot(function (snap) {
          onStatus && onStatus('sincronizado');
          if (snap.exists) onRemoto(snap.data() || {});
          else if (primeira) {
            copiarDoAntigo().then(function (antigo) {
              const base = antigo || (estadoAtual ? estadoAtual() : {});
              return docRef.set(Object.assign({}, base, { atualizadoEm: new Date().toISOString(), migradoDe: antigo ? 'polo-1740' : 'navegador' }));
            }).catch(function () { /* tenta de novo no próximo acesso */ });
          }
          primeira = false;
        }, function (err) {
          if (err && err.code === 'permission-denied') { onStatus && onStatus('sem-acesso'); semAcesso(); }
          else onStatus && onStatus('erro');
        }));
        unsubs.push(db.collection('leads').where('etapa', '==', 'matriculado').onSnapshot(function (s) {
          alunos = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
          alunosCb && alunosCb(alunos);
        }, function () { alunos = alunos || []; alunosCb && alunosCb(alunos); }));
      });
    }).catch(function () { onStatus && onStatus('erro'); });
  }

  function push(parcial) {
    if (!CONFIG || !docRef) return Promise.resolve(false);
    const corpo = Object.assign({}, parcial, { atualizadoEm: new Date().toISOString() });
    return docRef.set(corpo, { merge: true }).then(function () { return true; }, function () { return false; });
  }
  function onAlunos(cb) { alunosCb = cb; if (alunos) cb(alunos); }
  function email() { return usuario && usuario.email || ''; }
  function sair() { if (auth) auth.signOut().then(function () { location.reload(); }); }

  return { configured: configured, init: init, push: push, onAlunos: onAlunos, email: email, sair: sair };
});
