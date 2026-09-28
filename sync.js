/* Sincronização opcional entre navegadores (Polo 1740)
   -----------------------------------------------------
   Sem configuração (padrão), o painel funciona exatamente como antes: cada navegador guarda seu
   próprio rascunho em localStorage, e "publicar" é baixar o data.js e trocar o arquivo no GitHub.

   Com um projeto Firebase gratuito configurado em sync-config.js, este arquivo passa a manter os
   dados (calendário, telefones, pendências, práticas, status de professores, rotina) num banco
   compartilhado: a alteração que uma coordenadora faz aparece para as outras em poucos segundos,
   em qualquer navegador, sem precisar baixar/subir arquivo nenhum. Veja o passo a passo no README
   ("Sincronizar entre navegadores").
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
  const FIREBASE_VERSION = '10.14.1';
  let docRef = null;
  let carregando = null;

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
    carregando = Promise.resolve()
      .then(function () { return (typeof firebase === 'undefined') ? loadScript('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-app-compat.js') : null; })
      .then(function () { return (typeof firebase === 'undefined' || !firebase.firestore) ? loadScript('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-firestore-compat.js') : null; });
    return carregando;
  }

  /**
   * Liga a sincronização. `onRemoto(dados)` é chamado sempre que outro navegador salvar uma
   * mudança (dados = objeto com as mesmas chaves usadas em `push`). `onStatus(status)` é chamado
   * com 'sem-config' | 'conectando' | 'sincronizado' | 'erro'. `estadoAtual()` deve devolver o
   * estado local (usado só uma vez, para semear o banco se ele ainda estiver vazio).
   */
  function init(onRemoto, onStatus, estadoAtual) {
    if (!CONFIG) { onStatus && onStatus('sem-config'); return; }
    onStatus && onStatus('conectando');
    garantirFirebase().then(function () {
      if (!firebase.apps.length) firebase.initializeApp(CONFIG);
      const db = firebase.firestore();
      docRef = db.collection('polo1740').doc('estado');
      let primeira = true;
      docRef.onSnapshot(function (snap) {
        onStatus && onStatus('sincronizado');
        if (snap.exists) {
          onRemoto(snap.data() || {});
        } else if (primeira && estadoAtual) {
          // Banco novo/vazio: semeia com o que já existe neste navegador.
          docRef.set(Object.assign({}, estadoAtual(), { atualizadoEm: new Date().toISOString() })).catch(function () { /* tenta de novo na próxima alteração */ });
        }
        primeira = false;
      }, function () {
        onStatus && onStatus('erro');
      });
    }).catch(function () {
      onStatus && onStatus('erro');
    });
  }

  /** Envia só os campos alterados (mesclados no documento compartilhado). */
  function push(parcial) {
    if (!CONFIG || !docRef) return Promise.resolve(false);
    const corpo = Object.assign({}, parcial, { atualizadoEm: new Date().toISOString() });
    return docRef.set(corpo, { merge: true }).then(function () { return true; }, function () { return false; });
  }

  return { configured: configured, init: init, push: push };
});
