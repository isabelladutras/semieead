/* Painel Semipresencial · Polo 1740 — interface */
(function () {
  'use strict';
  const L = window.Logic, esc = L.esc;
  const DATA = window.CALENDARIO_DATA || { rows: [], atualizado: '' };
  const $ = function (s, el) { return (el || document).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- Armazenamento local (por navegador) + sincronização opcional entre navegadores ---------- */
  const Sync = window.Sync || { configured: function () { return false; }, init: function () {}, push: function () { return Promise.resolve(false); } };
  const CHAVES_SYNC = ['rows', 'contatos', 'pend', 'prat', 'status', 'tarefas', 'cfg', 'aulaChk', 'matriculas', 'turmaCfg', 'log', 'pratItens', 'ignorados', 'ocorrencias', 'estoque', 'afazeres'];
  const LS = {
    get: function (k, def) { try { const v = localStorage.getItem('sp1740.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) {
      try { localStorage.setItem('sp1740.' + k, JSON.stringify(v)); } catch (e) { /* ignora */ }
      if (CHAVES_SYNC.indexOf(k) >= 0 && Sync.configured()) { const p = {}; p[k] = v; Sync.push(p); }
      return true;
    },
    setLocal: function (k, v) { try { localStorage.setItem('sp1740.' + k, JSON.stringify(v)); } catch (e) { /* ignora */ } },
    del: function (k) { try { localStorage.removeItem('sp1740.' + k); } catch (e) { /* ignora */ } }
  };
  const params = new URLSearchParams(location.search);
  const HOJE = /^\d{4}-\d{2}-\d{2}$/.test(params.get('hoje') || '') ? params.get('hoje') : L.iso(new Date());
  const YM_HOJE = HOJE.slice(0, 7);

  const baseRows = function () { return DATA.rows.map(function (r, i) { return Object.assign({ id: 'a' + (i + 1) }, r); }); };
  const basePratItens = function () { return ((DATA.praticas && DATA.praticas.itens) || []).map(function (p) { return Object.assign({}, p); }); };
  const PUBLICO = !!DATA.publico;
  const S = {
    rows: LS.get('rows', null) || baseRows(),
    contatos: LS.get('contatos', null) || Object.assign({}, DATA.contatos || {}),
    pend: LS.get('pend', null) || (DATA.pendencias || []).map(function (p) { return Object.assign({ feito: false }, p); }),
    prat: LS.get('prat', {}),
    status: LS.get('status', {}),
    tarefas: LS.get('tarefas', {}),
    cfg: Object.assign({ assinatura: 'Coordenação Acadêmica — Polo 1740' }, LS.get('cfg', {})),
    aulaChk: LS.get('aulaChk', {}),
    matriculas: LS.get('matriculas', null),
    turmaCfg: LS.get('turmaCfg', {}),
    log: LS.get('log', []),
    pratItens: LS.get('pratItens', null) || basePratItens(),
    ignorados: LS.get('ignorados', {}),
    ocorrencias: LS.get('ocorrencias', null) || (DATA.ocorrencias || []).map(function (o) { return Object.assign({}, o); }),
    estoque: LS.get('estoque', null) || (DATA.estoque || []).map(function (e) { return Object.assign({}, e); }),
    afazeres: LS.get('afazeres', null) || (DATA.afazeres || []).map(function (t) { return Object.assign({}, t); })
  };
  const V = { view: 'semana', semana: L.mondayOf(HOJE), mes: YM_HOJE, mesRot: YM_HOJE, fCurso: '', fProf: '', passado: false, pratPassado: false, verIgnorados: false, ocorResolvidas: false, afazerFeitas: false, msgs: [], msgTel: '', syncStatus: 'sem-config' };
  const D = {};

  const PROF_CORES = { Marcelo: '#2454c5', Marcos: '#c2410c', Michele: '#b0245a', Olavo: '#6b3fc4', Rafael: '#0e7490', Vitor: '#4d7c0f', 'Fabrício': '#7a6f5b' };
  const corProf = function (p) { return p ? (PROF_CORES[p] || '#5b6b73') : '#9aa5ab'; };
  const plural = function (n, s, p) { return n + ' ' + (n === 1 ? s : p); };
  const cap = function (t) { return String(t).charAt(0).toUpperCase() + String(t).slice(1); };

  /* ---------- Dados derivados ---------- */
  function recalc() {
    D.aulas = L.fromRows(S.rows);
    D.porId = {}; D.aulas.forEach(function (a) { D.porId[a.id] = a; });
    D.eventos = L.eventos(D.aulas);
    D.grupos = L.agrupar(D.eventos);
    D.grupoPorKey = {}; D.grupos.forEach(function (g) { D.grupoPorKey[g.key] = g; });
    D.issues = L.auditar(D.aulas);
    D.sevAula = {};
    D.issues.forEach(function (i) { i.aulaIds.forEach(function (id) { D.sevAula[id] = (D.sevAula[id] === 'erro' || i.sev === 'erro') ? 'erro' : 'atencao'; }); });
    const nomes = {}; D.aulas.forEach(function (a) { if (a.prof) nomes[a.prof] = 1; });
    Object.keys(S.contatos).forEach(function (n) { if (PROF_CORES[n]) nomes[n] = 1; });
    D.profs = Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    D.cursos = Array.from(new Set(D.aulas.map(function (a) { return a.curso; }))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }
  const sevGrupo = function (g) { let s = ''; g.aulaIds.forEach(function (id) { if (D.sevAula[id] === 'erro') s = 'erro'; else if (D.sevAula[id] && !s) s = 'atencao'; }); return s; };
  const issuesFuturas = function (sev) { return D.issues.filter(function (i) { return i.fim >= HOJE && (!sev || i.sev === sev) && !S.ignorados[sigIssue(i)]; }); };
  function persistir() { LS.set('rows', S.rows); LS.set('rowsBase', DATA.atualizado || ''); recalc(); }

  /* ---------- Registro de quem mudou o quê ---------- */
  function autorAtual() {
    if (!S.cfg.autor) {
      const n = (typeof prompt === 'function') ? prompt('Como você se chama? (aparece no registro de alterações do painel)') : '';
      if (n && n.trim()) { S.cfg.autor = n.trim(); LS.set('cfg', S.cfg); }
    }
    return S.cfg.autor || 'Alguém';
  }
  function registrar(acao, detalhe) {
    S.log = S.log || [];
    S.log.unshift({ ts: new Date().toISOString(), autor: autorAtual(), acao: acao, detalhe: detalhe || '' });
    if (S.log.length > 200) S.log.length = 200;
    LS.set('log', S.log);
  }
  function relTempo(iso) {
    const d = new Date(iso), min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'há ' + h + 'h';
    const dias = Math.round(h / 24);
    if (dias === 1) return 'ontem';
    if (dias < 7) return 'há ' + dias + ' dias';
    return L.fmtCurta(L.iso(d));
  }

  /* ---------- Utilidades de interface ---------- */
  const ICON = {
    semana: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    calendario: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2"/>',
    professores: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.3 2.3 3.5 5.2"/>',
    conferencia: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    rotina: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 15 2 2 4-4"/>',
    praticas: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/>',
    guia: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5"/>',
    dados: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    permanencia: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    linksUteis: '<path d="M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0L5.7 12.6a4 4 0 0 0 5.7 5.7l1-1"/>',
    ocorrencias: '<path d="M12 9v4M12 16.5v.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    estoque: '<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    afazeres: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m8 15 2.5 2.5L16 12"/>'
  };
  const VIEWS = [
    { id: 'semana', nome: 'Semana' }, { id: 'calendario', nome: 'Calendário' }, { id: 'professores', nome: 'Professores' },
    { id: 'conferencia', nome: 'Conferência' }, { id: 'rotina', nome: 'Rotina do mês' }, { id: 'praticas', nome: 'Práticas EAD' },
    { id: 'ocorrencias', nome: 'Ocorrências' }, { id: 'estoque', nome: 'Estoque' }, { id: 'afazeres', nome: 'Tarefas' },
    { id: 'buscar', nome: 'Buscar' }, { id: 'guia', nome: 'Guia rápido' }, { id: 'dados', nome: 'Dados' }
  ];
  // Links externos fixos do dia a dia da coordenação (abrem em outra aba; não fazem parte da navegação por hash).
  const EXT_LINKS = [
    { id: 'permanencia', nome: 'Permanência', url: L.LINKS.permanencia },
    { id: 'linksUteis', nome: 'Links úteis', url: L.LINKS.linksUteis }
  ];
  function svg(id) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[id] + '</svg>'; }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function baixar(nome, conteudo, mime) {
    const direto = function () {
      const blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' }); const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then(function (dl) {
        if (!dl) { direto(); return; }
        return dl.save({ filename: nome, data: conteudo }).then(function () { toast('Arquivo salvo'); }, function (e) {
          if (e && e.code === 'declined') return;
          if (e && e.code === 'rejected_extension') { toast('Este tipo de arquivo só baixa na versão publicada no GitHub.'); return; }
          toast('Não consegui baixar o arquivo.');
        });
      }, direto);
      return;
    }
    direto();
  }
  function copiar(texto) {
    const fallback = function () { const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (e) { toast('Não consegui copiar. Selecione e copie manualmente.'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(function () { toast('Copiado'); }, fallback); else fallback();
  }
  function abrirDlg(html) { const d = $('#dlg'); d.innerHTML = html; if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } }
  function fecharDlg() { const d = $('#dlg'); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }
  const nomeMes = function (ym) { const p = ym.split('-'); return L.MESES[Number(p[1]) - 1] + ' de ' + p[0]; };
  const somaMes = function (ym, n) { const p = ym.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + L.pad(d.getMonth() + 1); };
  const tel = function (nome) { return S.contatos[nome] || ''; };

  function imprimirListaProf(prof, ym) {
    const evs = D.eventos.filter(function (e) {
      return e.iso.slice(0, 7) === ym && (prof === '__sem' ? !e.prof : e.prof === prof);
    }).slice().sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : ((a.ini || 0) - (b.ini || 0)); });
    const titulo = 'Calendário de ' + nomeMes(ym) + (prof && prof !== '__sem' ? ' — ' + prof : ' — sem professor');
    const linhas = evs.map(function (e) {
      return '<tr><td>' + esc(L.DIAS_CURTO[L.weekday(e.iso)]) + ' ' + esc(L.fmtCurta(e.iso)) + '</td>' +
        '<td>' + esc(L.faixa(e.ini, e.fim)) + '</td>' +
        '<td>' + esc(e.disc) + '</td>' +
        '<td>' + esc(e.cursoCurto || e.curso || '') + '</td>' +
        '<td>' + esc(e.sala || '') + '</td></tr>';
    }).join('');
    const corpo = evs.length
      ? '<table class="lista-impressao"><thead><tr><th>Data</th><th>Horário</th><th>Disciplina</th><th>Curso</th><th>Sala</th></tr></thead><tbody>' + linhas + '</tbody></table>'
      : '<p>Nenhuma aula neste mês.</p>';
    let cont = document.getElementById('impressao-prof');
    if (!cont) { cont = document.createElement('div'); cont.id = 'impressao-prof'; document.body.appendChild(cont); }
    cont.innerHTML = '<h1>' + esc(titulo) + '</h1>' + corpo;
    const nomeArq = 'Calendario ' + nomeMes(ym) + (prof && prof !== '__sem' ? ' - ' + prof : ' - sem professor');
    const antigo = document.title; document.title = nomeArq;
    document.body.classList.add('imprimindo-lista');
    toast('Escolha "Salvar como PDF" na janela de impressão');
    setTimeout(function () {
      window.print();
      document.title = antigo;
      document.body.classList.remove('imprimindo-lista');
    }, 150);
  }

  function cardGrupo(g) {
    const sev = sevGrupo(g), cor = corProf(g.prof);
    return '<button type="button" class="gcard' + (g.prof ? '' : ' sem-prof') + '" style="--c:' + cor + '" data-act="grupo" data-key="' + esc(g.key) + '">' +
      '<span class="h">' + (g.ini != null ? esc(L.faixa(g.ini, g.fim)) : 'Sem horário') + (sev ? '<span class="badge ' + sev + ' flag">' + (sev === 'erro' ? 'Conferir' : 'Atenção') + '</span>' : '') + '</span>' +
      '<span class="d">' + esc(g.disc) + '</span>' +
      '<span class="cs">' + g.cursosCurto.map(function (c) { return '<span class="chip curso">' + esc(c) + '</span>'; }).join('') +
      g.coortes.map(function (c) { return '<span class="chip coorte">' + esc(c) + '</span>'; }).join('') +
      (g.sala ? '<span class="chip sala">' + esc(g.sala) + '</span>' : '') + '</span>' +
      '<span class="p"><i class="dot" style="--c:' + cor + '"></i>' + esc(g.prof || 'Sem professor') + '</span></button>';
  }

  /* ---------- Semana ---------- */
  function rotuloSemana(ini) {
    const fim = L.addDays(ini, 5), a = ini.split('-'), b = fim.split('-');
    return a[1] === b[1] ? Number(a[2]) + ' a ' + Number(b[2]) + ' de ' + L.MESES[Number(a[1]) - 1] : L.fmtCurta(ini) + ' a ' + L.fmtCurta(fim);
  }
  function prazosProximos(n) {
    const p = L.prazosDoMes(Number(YM_HOJE.slice(0, 4)), Number(YM_HOJE.slice(5))).concat((function () { const y = somaMes(YM_HOJE, 1); return L.prazosDoMes(Number(y.slice(0, 4)), Number(y.slice(5))); })());
    return p.filter(function (x) { return (x.fim || x.iso) >= HOJE; }).sort(function (a, b) { return a.iso < b.iso ? -1 : 1; }).slice(0, n);
  }
  function quandoTxt(iso) { const d = L.diffDays(HOJE, iso); return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d > 1 ? 'em ' + d + ' dias' : 'há ' + (-d) + ' dias'; }

  function viewSemana() {
    const ini = V.semana, fimSem = L.addDays(ini, 6);
    const gs = D.grupos.filter(function (g) { return g.iso >= ini && g.iso <= fimSem; });
    const temDom = gs.some(function (g) { return L.weekday(g.iso) === 0; });
    const dias = Array.from({ length: temDom ? 7 : 6 }, function (_, i) { return L.addDays(ini, i); });
    const naSemana = dias.indexOf(HOJE) >= 0;
    const hojeG = D.grupos.filter(function (g) { return g.iso === HOJE; });
    const profs = new Set(gs.map(function (g) { return g.prof; }).filter(Boolean)).size;
    let resumo = gs.length ? plural(gs.length, 'aula presencial', 'aulas presenciais') + ' com ' + plural(profs, 'professor', 'professores') + ' nesta semana.' : 'Nenhuma aula presencial nesta semana.';
    if (naSemana) resumo = (hojeG.length ? 'Hoje: ' + plural(hojeG.length, 'aula', 'aulas') + '. ' : 'Hoje não há aula presencial. ') + resumo;

    let quadro;
    if (!gs.length) {
      const prox = D.grupos.find(function (g) { return g.iso > fimSem; });
      quadro = '<div class="vazio">Sem aulas nesta semana.' + (prox ? ' A próxima é em ' + L.fmtLonga(prox.iso) + '. <button type="button" class="linkbtn" data-act="sem-ir" data-iso="' + prox.iso + '">Ir para essa semana</button>' : '') + '</div>';
    } else if (window.matchMedia('(max-width: 820px)').matches) {
      quadro = dias.filter(function (d) { return gs.some(function (g) { return g.iso === d; }); }).map(function (d) {
        return '<section class="dia-lista' + (d === HOJE ? ' hoje' : '') + '"><h3>' + esc(cap(L.fmtLonga(d))) + (d === HOJE ? ' (hoje)' : '') + '</h3>' + gs.filter(function (g) { return g.iso === d; }).map(cardGrupo).join('') + '</section>';
      }).join('');
    } else {
      const bandas = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['definir', 'Sem horário']].filter(function (b) { return gs.some(function (g) { return L.faixaTurno(g.ini) === b[0]; }); });
      quadro = '<div class="board" style="--cols:' + dias.length + '"><div class="corner"></div>' +
        dias.map(function (d) { return '<div class="dh' + (d === HOJE ? ' hoje' : '') + '"><span>' + L.DIAS_CURTO[L.weekday(d)] + '</span><b>' + Number(d.slice(8)) + '</b></div>'; }).join('') +
        bandas.map(function (b) {
          return '<div class="bl">' + b[1] + '</div>' + dias.map(function (d) {
            return '<div class="cell' + (d === HOJE ? ' hoje' : '') + '">' + gs.filter(function (g) { return g.iso === d && L.faixaTurno(g.ini) === b[0]; }).map(cardGrupo).join('') + '</div>';
          }).join('');
        }).join('') + '</div>';
    }

    const vistos = {}, erros = [];
    issuesFuturas('erro').forEach(function (i) { const k = i.aulaTxt + '|' + i.iso; if (vistos[k]) { vistos[k].mais++; return; } vistos[k] = { i: i, mais: 0 }; erros.push(vistos[k]); });
    erros.splice(4);
    const prazos = prazosProximos(4);
    const lem = L.lembretes(D.grupos, HOJE).filter(function (l) { return (l.tipo !== 'lembrar' || l.dias <= 1) && (l.tipo !== 'checklist' || !chkAulaCompleto(l.grupo.key)); }).slice(0, 6);
    const lateral = '<div class="tres">' +
      '<section class="bloco"><h2>Para resolver</h2>' + pendResumo() + (erros.length ? '<ul class="itens">' + erros.map(function (x) {
        const i = x.i; return '<li><span class="quando">' + esc(L.fmtCurta(i.iso)) + '</span><span class="t"><b>' + esc(i.aulaTxt) + '</b><small>' + esc(i.msg) + (x.mais ? ' (+' + x.mais + ' na mesma aula)' : '') + '</small></span></li>';
      }).join('') + '</ul><p style="margin-top:.7rem"><a href="#conferencia">Ver todas as pendências</a></p>' : '<p class="muted">Nenhum erro nas próximas datas.</p>' + (issuesFuturas().length ? '<p><a href="#conferencia">' + plural(issuesFuturas().length, 'ponto de atenção', 'pontos de atenção') + '</a></p>' : '')) + '</section>' +
      '<section class="bloco"><h2>Próximos prazos</h2><ul class="itens">' + prazos.map(function (p) {
        return '<li><span class="quando">' + (p.fim ? Number(p.iso.slice(8)) + '–' + Number(p.fim.slice(8)) : Number(p.iso.slice(8))) + '/' + p.iso.slice(5, 7) + '</span><span class="t">' + esc(p.titulo) + '<small>' + esc(quandoTxt(p.iso <= HOJE ? HOJE : p.iso)) + '</small></span></li>';
      }).join('') + '</ul><p style="margin-top:.7rem"><a href="#rotina">Rotina do mês</a></p></section>' +
      '<section class="bloco"><h2>Lembretes</h2>' + lembretesPratHtml() + (lem.length ? '<ul class="itens">' + lem.map(function (l) {
        return '<li><span class="quando">' + esc(l.quando) + '</span><span class="t"><button type="button" class="linkbtn" data-act="grupo" data-key="' + esc(l.grupo.key) + '">' + esc(l.texto) + '</button><small>' + esc(l.grupo.disc) + ' · ' + esc(L.juntarNatural(l.grupo.cursosCurto)) + '</small></span></li>';
      }).join('') + '</ul>' : (lembretesPratHtml() ? '' : '<p class="muted">Nada para lembrar nos próximos dias.</p>')) + '</section></div>';

    return '<div class="topo"><div><h1>Semana de ' + rotuloSemana(ini) + '</h1><p>' + esc(resumo) + '</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn" data-act="sem-prev" aria-label="Semana anterior">‹</button><button type="button" class="btn" data-act="sem-hoje">Hoje</button><button type="button" class="btn" data-act="sem-next" aria-label="Próxima semana">›</button></div></div>' +
      quadro + lateral;
  }

  /* ---------- Calendário ---------- */
  function gruposFiltrados() {
    return D.grupos.filter(function (g) {
      return (!V.fCurso || g.cursos.indexOf(V.fCurso) >= 0) && (!V.fProf || (V.fProf === '__sem' ? !g.prof : g.prof === V.fProf));
    });
  }
  function filtrosHtml() {
    return '<div class="filtros"><div><label for="f-curso">Curso</label><select id="f-curso" data-chg="fCurso"><option value="">Todos os cursos</option>' +
      D.cursos.map(function (c) { return '<option' + (V.fCurso === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="f-prof">Professor</label><select id="f-prof" data-chg="fProf"><option value="">Todos</option>' +
      D.profs.map(function (p) { return '<option value="' + esc(p) + '"' + (V.fProf === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') +
      '<option value="__sem"' + (V.fProf === '__sem' ? ' selected' : '') + '>Sem professor</option></select></div></div>';
  }
  function viewCalendario() {
    const p = V.mes.split('-').map(Number), primeiro = V.mes + '-01', inicio = L.mondayOf(primeiro);
    const total = Math.ceil(((L.weekday(primeiro) + 6) % 7 + L.ultimoDia(p[0], p[1])) / 7) * 7;
    const gs = gruposFiltrados(), porDia = {}; gs.forEach(function (g) { (porDia[g.iso] = porDia[g.iso] || []).push(g); });
    const errosPorDia = {}; D.issues.forEach(function (i) { if (i.sev === 'erro') errosPorDia[i.iso] = 1; });
    let cel = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function (d) { return '<div class="cab">' + d + '</div>'; }).join('');
    for (let i = 0; i < total; i++) {
      const d = L.addDays(inicio, i), lista = porDia[d] || [], dentro = d.slice(0, 7) === V.mes;
      cel += '<button type="button" class="dia' + (dentro ? '' : ' fora') + (d === HOJE ? ' hoje' : '') + (errosPorDia[d] ? ' issue' : '') + '" data-act="dia" data-iso="' + d + '" aria-label="' + esc(L.fmtLonga(d)) + ', ' + plural(lista.length, 'aula', 'aulas') + '">' +
        '<span class="num">' + Number(d.slice(8)) + '</span>' +
        lista.slice(0, 3).map(function (g) { return '<span class="ch" style="--c:' + corProf(g.prof) + '" title="' + esc(g.disc + ' · ' + g.coortes.join(', ') + (g.sala ? ' · ' + g.sala : '')) + '">' + esc(L.hhmm(g.ini) + ' ' + L.juntarNatural(g.cursosCurto)) + ' <b class="mini-coorte">' + esc(g.coortes.join('/')) + '</b></span>'; }).join('') +
        (lista.length > 3 ? '<span class="mais">+' + (lista.length - 3) + '</span>' : '') +
        '<span class="pontos">' + lista.map(function (g) { return '<i style="--c:' + corProf(g.prof) + '"></i>'; }).join('') + '</span></button>';
    }
    const usados = Array.from(new Set(gs.map(function (g) { return g.prof; })));
    const filtroTxt = (V.fCurso ? V.fCurso : '') + (V.fCurso && (V.fProf || V.fProf === '__sem') ? ' · ' : '') + (V.fProf === '__sem' ? 'Sem professor' : V.fProf || '');
    return '<div class="topo mes-fixo"><div><h1>' + esc(nomeMes(V.mes)).replace(/^./, function (c) { return c.toUpperCase(); }) + (filtroTxt ? ' <small class="subt-filtro">— ' + esc(filtroTxt) + '</small>' : '') + '</h1><p>Cada cor é um professor. Toque em um dia para ver as aulas, avisar o professor ou ajustar.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn" data-act="mes-prev" aria-label="Mês anterior">‹</button><button type="button" class="btn" data-act="mes-hoje">Hoje</button><button type="button" class="btn" data-act="mes-next" aria-label="Próximo mês">›</button>' +
      '<button type="button" class="btn primario" data-act="nova">Nova aula</button></div></div>' +
      filtrosHtml() +
      '<div class="legenda">' + usados.map(function (n) { return '<span><i class="dot" style="--c:' + corProf(n) + '"></i>' + esc(n || 'Sem professor') + '</span>'; }).join('') +
      '<span><b style="color:var(--erro)">●</b> erro naquela data (veja Conferência)</span><span style="margin-left:auto" class="acoes"><button type="button" class="linkbtn" data-act="ics">Baixar agenda (.ics) do filtro atual</button><button type="button" class="linkbtn" data-act="pdf-mes">Baixar este mês em PDF' + (filtroTxt ? ' (filtro atual)' : '') + '</button></span></div>' +
      '<div class="mes">' + cel + '</div>';
  }

  /* ---------- Professores ---------- */
  const CHECKS = [['indicacao', 'Indicação de tutor enviada'], ['prestador', 'Cadastro de prestador (DP)'], ['mentor', 'Cadastro no Mentor'], ['capacitado', 'Capacitado']];
  function linksEvidenciasProf(p, gsMes) {
    const mapa = DATA.evidenciasDrive || {}, ano = Number(YM_HOJE.slice(0, 4)), mesNum = Number(YM_HOJE.slice(5));
    const vistos = {};
    return gsMes.map(function (g) {
      const aulasDoGrupo = g.aulaIds.map(function (id) { return D.porId[id]; });
      return aulasDoGrupo.map(function (a) {
        if (vistos[a.curso]) return ''; vistos[a.curso] = 1;
        const url = L.urlEvidencias(mapa, a.curso, p, mesNum, ano, a.fase) || L.DRIVE_RAIZ;
        return '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener" title="Pasta de evidências de ' + esc(a.cursoCurto) + ' em ' + esc(nomeMes(YM_HOJE)) + '">Evidências ' + esc(a.cursoCurto) + '</a>';
      }).join('');
    }).join('');
  }
  function viewProfessores() {
    const cards = D.profs.map(function (p) {
      const gs = D.grupos.filter(function (g) { return g.prof === p; }), fut = gs.filter(function (g) { return g.iso >= HOJE; }), prox = fut[0];
      const cursos = Array.from(new Set([].concat.apply([], gs.map(function (g) { return g.cursosCurto; }))));
      const gsMes = gs.filter(function (g) { return g.iso.slice(0, 7) === YM_HOJE; });
      const evid = linksEvidenciasProf(p, gsMes);
      const mesesProf = Array.from(new Set(gs.map(function (g) { return g.iso.slice(0, 7); }))).sort();
      const mesPadraoPdf = mesesProf.indexOf(YM_HOJE) >= 0 ? YM_HOJE : (mesesProf.filter(function (m) { return m >= YM_HOJE; })[0] || mesesProf[mesesProf.length - 1] || YM_HOJE);
      const selMesPdf = mesesProf.length > 1
        ? '<select class="sel-mes-pdf" aria-label="Mês do calendário em PDF" data-prof="' + esc(p) + '">' + mesesProf.map(function (m) {
          return '<option value="' + m + '"' + (m === mesPadraoPdf ? ' selected' : '') + '>' + esc(nomeMes(m)).replace(/^./, function (c) { return c.toUpperCase(); }) + '</option>';
        }).join('') + '</select>'
        : '';
      const st = S.status[p] || {}, t = tel(p), completos = CHECKS.filter(function (c) { return st[c[0]]; }).length;
      const msg = L.msgCadastro(p, st, S.cfg);
      return '<article class="pcard" style="--c:' + corProf(p) + '"><header><div><h3>' + esc(p) + '</h3><div class="fone">' + (t ? esc(t) : 'Sem telefone cadastrado') + '</div></div>' +
        '<span class="badge ' + (completos === 4 ? 'ok' : 'atencao') + '">' + completos + '/4 em dia</span></header>' +
        '<div class="cs">' + (cursos.length ? cursos.map(function (c) { return '<span class="chip curso">' + esc(c) + '</span>'; }).join('') : '<span class="muted small">Sem aulas no calendário</span>') + '</div>' +
        '<div class="prox">' + (prox ? '<b>Próxima:</b> ' + esc(L.fmtLonga(prox.iso)) + ', ' + esc(L.faixa(prox.ini, prox.fim)) + '<br><span class="muted">' + esc(prox.disc) + '</span>' : '<span class="muted">Nenhuma aula futura.</span>') + '<div class="muted small" style="margin-top:.2rem">' + plural(fut.length, 'aula futura', 'aulas futuras') + ' de ' + gs.length + ' no calendário</div></div>' +
        '<fieldset><legend>Pendências de cadastro</legend>' + CHECKS.map(function (c) {
          return '<label class="check"><input type="checkbox" data-chg="status" data-prof="' + esc(p) + '" data-k="' + c[0] + '"' + (st[c[0]] ? ' checked' : '') + '>' + c[1] + '</label>';
        }).join('') + '</fieldset>' +
        '<div class="rod"><a class="btn sm primario' + (t ? '' : '" aria-disabled="true') + '" ' + (t ? 'href="' + esc(L.waUrl(t, msg)) + '" target="_blank" rel="noopener"' : '') + '>Cobrar cadastro no WhatsApp</a>' +
        '<button type="button" class="btn sm" data-act="copiar-cad" data-prof="' + esc(p) + '">Copiar mensagem</button>' +
        '<button type="button" class="btn sm" data-act="agenda-prof" data-prof="' + esc(p) + '">Ver agenda</button>' +
        selMesPdf + '<button type="button" class="btn sm" data-act="pdf-prof" data-prof="' + esc(p) + '" data-ym-padrao="' + esc(mesPadraoPdf) + '">Calendário do mês em PDF</button>' + evid + '</div></article>';
    }).join('');
    const meses = Array.from(new Set(D.grupos.map(function (g) { return g.iso.slice(0, 7); }))).sort();
    const linhas = D.profs.concat(['']).map(function (p) {
      const n = meses.map(function (m) { return D.grupos.filter(function (g) { return (g.prof || '') === p && g.iso.slice(0, 7) === m; }).length; });
      if (!p && !n.some(Boolean)) return '';
      return '<tr><td>' + (p ? '<i class="dot" style="--c:' + corProf(p) + '"></i> ' + esc(p) : '<i>Sem professor</i>') + '</td>' + n.map(function (c) { return '<td class="num' + (c ? ' h' + Math.min(3, Math.ceil(c / 4)) : '') + '">' + (c || '') + '</td>'; }).join('') + '<td class="num"><b>' + n.reduce(function (a, b) { return a + b; }, 0) + '</b></td></tr>';
    }).join('');
    const semTel = !D.profs.some(function (p) { return tel(p); });
    const convite = semTel ? '<section class="bloco" style="margin-bottom:1rem"><h2>Cadastre os telefones para usar o WhatsApp</h2><p class="muted small">Um por linha ou separados por “/”, como “Marcelo 21 99999-9999”. ' + (PUBLICO ? 'Os números ficam só neste navegador; não vão para o site.' : 'Os números vão junto no site; quem tem o link consegue vê-los.') + '</p><label class="sr" for="tels">Telefones</label><textarea id="tels" style="min-height:5.5rem"></textarea><div class="acoes" style="margin-top:.6rem"><button type="button" class="btn primario" data-act="salvar-tels">Salvar telefones</button></div></section>' : '';
    return '<div class="topo"><div><h1>Professores</h1><p>Cadastro, contato e carga de cada tutor. As caixas de pendência alimentam as colunas “Preencheu formulário” e “Capacitado?” da planilha exportada.</p></div></div>' +
      convite + '<div class="profs">' + cards + '</div>' +
      '<section class="bloco" style="margin-top:1.2rem"><h2>Encontros por mês</h2><p class="muted small">Aulas conjuntas de vários cursos contam uma vez. Cada aula tem 2 encontros por mês.</p><div class="rolagem"><table class="tabela"><thead><tr><th>Professor</th>' + meses.map(function (m) { return '<th class="num">' + esc(L.MESES[Number(m.slice(5)) - 1].slice(0, 3)) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' + linhas + '</tbody></table></div></section>';
  }

  /* ---------- Decisões pendentes (responsável: quem monta o cronograma) ---------- */
  const RESP = DATA.responsavelCronograma || 'Carla';
  const pendAbertas = function () { return S.pend.filter(function (p) { return !p.feito; }); };
  function pendResumo() {
    const n = pendAbertas().length;
    return n ? '<p style="margin:0 0 .8rem"><a href="#conferencia"><b>' + plural(n, 'decisão pendente', 'decisões pendentes') + '</b></a> com a ' + esc(RESP) + '.</p>' : '';
  }
  function blocoPendencias() {
    const ab = pendAbertas().length;
    const lista = S.pend.map(function (p) {
      return '<li class="dec-item' + (p.feito ? ' feito' : '') + '"><label class="check"><input type="checkbox" data-chg="pend-feito" data-id="' + esc(p.id) + '"' + (p.feito ? ' checked' : '') + '><span><b>' + esc(p.titulo) + '</b>' + (p.detalhe ? '<small>' + esc(p.detalhe) + '</small>' : '') + '</span></label>' +
        '<span class="chip curso">' + esc(p.resp || RESP) + '</span>' + (String(p.id).charAt(0) === 'u' ? '<button type="button" class="btn sm" data-act="pend-del" data-id="' + esc(p.id) + '">Excluir</button>' : '') + '</li>';
    }).join('');
    return '<section class="bloco dec" style="margin-bottom:1.2rem"><h2>Decisões pendentes' + (ab ? ' <span class="badge atencao">' + ab + ' em aberto</span>' : '') + '</h2>' +
      '<p class="muted small">Quem monta o cronograma é a ' + esc(RESP) + ' (coordenação acadêmica). São decisões dela; marque quando resolver.</p>' +
      (lista ? '<ul class="decs">' + lista + '</ul>' : '<p class="muted">Nenhuma decisão pendente.</p>') +
      '<div class="add-dec"><label for="pend-t">Nova pendência</label><input type="text" id="pend-t" placeholder="O que precisa ser decidido?"><input type="text" id="pend-d" placeholder="Detalhes (opcional)"><input type="text" id="pend-r" value="' + esc(RESP) + '" aria-label="Responsável"><button type="button" class="btn primario" data-act="pend-add">Adicionar</button></div></section>';
  }

  /* ---------- Práticas EAD ---------- */
  const PRAT_CHK = [['mat', 'Materiais da UniFECAF recebidos e conferidos'], ['polo', 'Materiais do polo providenciados'], ['cap', 'Professor assistiu à capacitação e leu o PAP'], ['evid', 'Evidências enviadas']];
  function quandoRel(iso) { const d = L.diffDays(HOJE, iso); return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d > 1 ? 'em ' + d + ' dias' : d === -1 ? 'ontem' : 'há ' + (-d) + ' dias'; }
  function lembretesPratHtml() {
    const P = DATA.praticas; if (!P) return '';
    const l = L.lembretesPraticas(P.itens, HOJE); if (!l.length) return '';
    return '<ul class="itens">' + l.map(function (x) {
      return '<li><span class="quando">' + esc(x.quando) + '</span><span class="t"><a href="#praticas">' + esc(x.texto) + '</a><small>Prática EAD · ' + esc(x.p.tema) + '</small></span></li>';
    }).join('') + '</ul>';
  }
  function viewPraticas() {
    const P = DATA.praticas;
    if (!P) return '<div class="topo"><div><h1>Práticas EAD</h1><p>Nenhuma prática cadastrada.</p></div></div>';
    const todas = S.pratItens || [];
    const passadas = todas.filter(function (p) { return L.diffDays(HOJE, p.data) < 0; }).length;
    const itensVisiveis = todas.filter(function (p) { return V.pratPassado || L.diffDays(HOJE, p.data) >= 0; });
    const lis = function (arr) { return arr && arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted small">Nada além dos materiais enviados pela UniFECAF.</p>'; };
    const cards = itensVisiveis.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).map(function (p) {
      const st = S.prat[p.id] || { chk: {}, prof: '' }, chk = st.chk || {};
      const profSel = st.prof || p.prof || '', t = profSel ? tel(profSel) : '';
      const msg = L.mensagemPratica(p, { prof: profSel, assinatura: S.cfg.assinatura, curso: P.curso });
      const avisos = [];
      if (L.weekday(p.data) !== 6) avisos.push('Esta data cai numa ' + L.DIAS[L.weekday(p.data)] + '. As práticas são aos sábados.');
      if (profSel) {
        const ph = p.hora ? L.parseHorario(p.hora) : null, vistos = {};
        D.eventos.filter(function (e) { return e.iso === p.data && L.profCanon(e.prof || '') === profSel; }).forEach(function (e) {
          if (vistos[e.disc]) return; vistos[e.disc] = 1;
          const choca = ph && ph.ini != null && e.ini != null ? (ph.ini < e.fim && e.ini < ph.fim) : null;
          if (choca === false) return;
          avisos.push(profSel + ' também dá ' + e.disc + ' (' + e.cursoCurto + ', ' + L.faixa(e.ini, e.fim) + ') nesse dia' + (choca === true ? ': choca com o horário da prática.' : '. Defina um horário da prática sem choque.'));
        });
      }
      const dias = L.diffDays(HOJE, p.data);
      const ref = p.sedeRef ? (p.sedeRef.data === p.data ? 'Igual ao cronograma da sede (' + esc(p.sedeRef.hora) + ').' : 'No cronograma da sede: ' + esc(L.fmtCurta(p.sedeRef.data)) + ' (' + L.DIAS_CURTO[L.weekday(p.sedeRef.data)].toLowerCase() + '), ' + esc(p.sedeRef.hora) + '.') : '';
      const opcoes = '<option value="">Escolher professor</option>' + D.profs.map(function (n) { return '<option' + (profSel === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
      const wa = t ? '<a class="btn sm primario" href="' + esc(L.waUrl(t, msg)) + '" target="_blank" rel="noopener">Avisar professor no WhatsApp</a>' : '<span class="btn sm" aria-disabled="true">' + (profSel ? 'Sem telefone cadastrado' : 'Escolha o professor para avisar') + '</span>';
      return '<article class="prat" id="' + esc(p.id) + '"><header><div class="pdata"><b>' + Number(p.data.slice(8)) + '/' + p.data.slice(5, 7) + '</b><span>' + L.DIAS_CURTO[L.weekday(p.data)] + '</span></div>' +
        '<div class="ptema"><h3>' + esc(p.tema) + '</h3><div class="meta">' + esc(P.curso) + ' · ' + esc(p.semestre) + ' · 3 horas · ' + (p.hora ? esc(p.hora) : 'horário a confirmar') + '</div><div class="meta">' + ref + '</div></div>' +
        '<span class="badge ' + (dias < 0 ? 'ok' : (dias <= 7 ? 'atencao' : '')) + '">' + (dias < 0 ? 'Já passou' : quandoRel(p.data)) + '</span></header>' + (avisos.length ? '<div class="alertas">' + avisos.map(function (a) { return '<div>' + esc(a) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="mats"><div><h4>A UniFECAF envia <small>(referência: para cada 10 alunos)</small></h4>' + lis(p.sede) + '</div><div><h4>O polo providencia</h4>' + lis(p.polo) + '<p class="muted small">Alunos: ' + esc(P.alunos) + '.</p></div></div>' +
        '<div class="capac"><b>Para o professor se preparar:</b> <a href="' + esc(p.video) + '" target="_blank" rel="noopener">vídeo da capacitação</a> · <a href="' + esc(p.pap) + '" target="_blank" rel="noopener">PAP (material da prática)</a></div>' +
        '<fieldset><legend>Andamento</legend>' + PRAT_CHK.map(function (c) {
          const rot = c[0] === 'mat' ? c[1] + ' (chegam até ' + esc(L.fmtCurta(L.addDays(p.data, -7))) + ')' : c[1];
          return '<label class="check"><input type="checkbox" data-chg="prat-chk" data-id="' + esc(p.id) + '" data-k="' + c[0] + '"' + (chk[c[0]] ? ' checked' : '') + '>' + rot + '</label>';
        }).join('') + '</fieldset>' +
        '<div class="rod"><select data-chg="prat-prof" data-id="' + esc(p.id) + '" aria-label="Professor da prática">' + opcoes + '</select>' + wa +
        '<button type="button" class="btn sm" data-act="prat-copiar" data-id="' + esc(p.id) + '">Copiar mensagem</button>' +
        '<button type="button" class="btn sm" data-act="editar-pratica" data-id="' + esc(p.id) + '">Editar</button></div></article>';
    }).join('');
    return '<div class="topo"><div><h1>Práticas EAD · ' + esc(P.curso) + '</h1><p>Encontros de prática dos alunos EAD no polo: datas, materiais, preparação do professor e evidências. Profissional apto para a aula: ' + esc(P.apto) + '.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn primario" data-act="nova-pratica">Nova prática</button></div></div>' +
      '<div class="acoes"><label class="check"><input type="checkbox" data-chg="pratPassado"' + (V.pratPassado ? ' checked' : '') + '> Incluir práticas já realizadas' + (passadas ? ' (' + passadas + ')' : '') + '</label></div>' +
      '<div class="prats">' + (cards || '<p class="muted small">Nenhuma prática futura cadastrada.</p>') + '</div>' +
      '<section class="bloco" style="margin-top:1.2rem"><h2>Depois de cada aula</h2><p class="muted small">O professor envia as evidências pelo formulário da UniFECAF:</p><ul>' + P.evidencias.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' +
      '<p class="muted small" style="margin-top:.6rem">Formulário de experiência do aluno (o mesmo para todas as práticas): <a href="' + esc(P.formExperiencia) + '" target="_blank" rel="noopener">abrir</a> · Grupo de tutores no WhatsApp: <a href="' + esc(P.whatsappTutores) + '" target="_blank" rel="noopener">entrar</a></p></section>';
  }

  /* ---------- Ocorrências de alunos ---------- */
  const OCOR_CATEGORIAS = ['Alterações Cadastrais', 'Alterações Financeiras', 'Análise Curricular', 'Análise Documental', 'Cobrança', 'Cancelamento', 'Lançamento de notas', 'Transferência de Polo', 'Mudança de Eixo', 'Outros Acadêmico'];
  const OCOR_RESPONSAVEIS = ['Resolvido', 'P. Aluno', 'P. Aline', 'P. Naiane', 'P. Suporte Acadêmico', 'P. Suporte Financeiro', 'P. Gerência FECAF', 'P. Gerência F5'];
  function viewOcorrencias() {
    const todas = S.ocorrencias || [];
    const abertas = todas.filter(function (o) { return o.responsavel !== 'Resolvido'; });
    const visiveis = (V.ocorResolvidas ? todas : abertas).slice().sort(function (a, b) {
      const pa = a.prazo || '9999-99-99', pb = b.prazo || '9999-99-99';
      return (a.responsavel === 'Resolvido' ? 1 : 0) - (b.responsavel === 'Resolvido' ? 1 : 0) || (pa < pb ? -1 : pa > pb ? 1 : 0);
    });
    const resp = '<option value="">Escolher</option>' + OCOR_RESPONSAVEIS.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');
    const cards = visiveis.map(function (o) {
      const atrasada = o.responsavel !== 'Resolvido' && o.prazo && o.prazo < HOJE;
      const sev = o.responsavel === 'Resolvido' ? 'ok' : (atrasada ? 'erro' : 'atencao');
      return '<article class="pitem ' + sev + '"><div><h3>' + esc(o.aluno || 'Sem nome') + (o.ra ? ' <small class="muted">RA ' + esc(o.ra) + '</small>' : '') + '</h3>' +
        '<div class="meta">' + esc(o.categoria || 'Sem categoria') + (o.dataOcorrencia ? ' · aberta em ' + esc(L.fmtCurta(o.dataOcorrencia)) : '') + (o.prazo ? ' · prazo ' + esc(L.fmtCurta(o.prazo)) + (atrasada ? ' (atrasado)' : '') : '') + (o.solucaoEm ? ' · resolvida em ' + esc(L.fmtCurta(o.solucaoEm)) : '') + '</div>' +
        (o.evento ? '<p class="small" style="margin:.4rem 0 0">' + esc(o.evento) + '</p>' : '') + '</div>' +
        '<div class="acoes"><select data-chg="ocor-resp" data-id="' + esc(o.id) + '" aria-label="Responsável">' + resp.replace('value="' + esc(o.responsavel || '') + '"', 'value="' + esc(o.responsavel || '') + '" selected') + '</select>' +
        '<button type="button" class="btn sm" data-act="editar-ocorrencia" data-id="' + esc(o.id) + '">Editar</button></div></article>';
    }).join('');
    return '<div class="topo"><div><h1>Ocorrências de alunos</h1><p>Registro de solicitações e problemas de alunos em andamento: quem está tratando, prazo e o que já foi feito.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn primario" data-act="nova-ocorrencia">Nova ocorrência</button></div></div>' +
      '<div class="acoes"><label class="check"><input type="checkbox" data-chg="ocorResolvidas"' + (V.ocorResolvidas ? ' checked' : '') + '> Mostrar resolvidas' + (todas.length - abertas.length ? ' (' + (todas.length - abertas.length) + ')' : '') + '</label></div>' +
      '<div class="pend">' + (cards || '<div class="vazio">Nenhuma ocorrência em aberto.</div>') + '</div>';
  }
  function abrirEditarOcorrencia(id) {
    const novo = !id, o = novo ? null : S.ocorrencias.find(function (x) { return x.id === id; });
    if (!novo && !o) return;
    abrirDlg(cabDlg(novo ? 'Nova ocorrência' : 'Editar ocorrência', '') +
      '<div class="corpo" data-id="' + esc(id || '') + '" id="form-ocor"><div class="campos">' +
      '<div class="largo"><label for="o-aluno">Aluno</label><input type="text" id="o-aluno" value="' + esc(o ? o.aluno : '') + '"></div>' +
      '<div><label for="o-ra">RA</label><input type="text" id="o-ra" value="' + esc(o ? o.ra : '') + '"></div>' +
      '<div><label for="o-cat">Categoria</label><select id="o-cat"><option value="">Escolher</option>' + OCOR_CATEGORIAS.map(function (c) { return '<option' + (o && o.categoria === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="o-resp">Responsável</label><select id="o-resp"><option value="">Escolher</option>' + OCOR_RESPONSAVEIS.map(function (r) { return '<option' + (o && o.responsavel === r ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="o-data">Data da ocorrência</label><input type="date" id="o-data" value="' + esc(o ? o.dataOcorrencia : '') + '"></div>' +
      '<div><label for="o-prazo">Prazo</label><input type="date" id="o-prazo" value="' + esc(o ? o.prazo : '') + '"></div>' +
      '<div><label for="o-sol">Solução em</label><input type="date" id="o-sol" value="' + esc(o ? o.solucaoEm : '') + '"></div>' +
      '<div class="largo"><label for="o-evento">O que aconteceu / andamento</label><textarea id="o-evento" style="min-height:5rem">' + esc(o ? o.evento : '') + '</textarea></div>' +
      '</div></div>' +
      '<footer><button type="button" class="btn primario" data-act="salvar-ocorrencia">Salvar</button>' + (novo ? '' : '<button type="button" class="btn perigo" data-act="excluir-ocorrencia">Excluir</button>') + '<button type="button" class="btn fim" data-act="fechar">Cancelar</button></footer>');
  }
  function salvarOcorrencia() {
    const f = $('#form-ocor'); if (!f) return;
    const id = f.dataset.id, novo = !id;
    const aluno = $('#o-aluno').value.trim(); if (!aluno) { toast('Informe o nome do aluno'); return; }
    const campos = {
      aluno: aluno, ra: $('#o-ra').value.trim(), categoria: $('#o-cat').value, responsavel: $('#o-resp').value,
      dataOcorrencia: $('#o-data').value, prazo: $('#o-prazo').value, solucaoEm: $('#o-sol').value, evento: $('#o-evento').value.trim()
    };
    if (novo) { S.ocorrencias.push(Object.assign({ id: 'o' + Date.now().toString(36) }, campos)); }
    else { const o = S.ocorrencias.find(function (x) { return x.id === id; }); if (o) Object.assign(o, campos); }
    LS.set('ocorrencias', S.ocorrencias);
    registrar(novo ? 'Criou ocorrência' : 'Editou ocorrência', aluno);
    fecharDlg(); render(); toast('Ocorrência salva' + (Sync.configured() ? '' : ' neste navegador'));
  }

  /* ---------- Estoque ---------- */
  const ESTOQUE_CATEGORIAS = ['Escritório', 'Cozinha', 'Limpeza', 'Manutenção', 'Papelaria', 'Outro'];
  function viewEstoque() {
    const todos = S.estoque || [];
    const comprar = todos.filter(function (i) { return i.comprar; }).length;
    const grupos = ESTOQUE_CATEGORIAS.map(function (cat) {
      const itens = todos.filter(function (i) { return (i.categoria || 'Outro') === cat; });
      if (!itens.length) return '';
      const linhas = itens.map(function (i) {
        return '<tr' + (i.comprar ? ' class="risco"' : '') + '><td><label class="check"><input type="checkbox" data-chg="estoque-comprar" data-id="' + esc(i.id) + '"' + (i.comprar ? ' checked' : '') + '>' + esc(i.item) + '</label></td>' +
          '<td class="num">' + (i.qtd != null && i.qtd !== '' ? esc(String(i.qtd)) : '—') + '</td>' +
          '<td>' + esc(i.fornecedor || '') + '</td><td>' + (i.preco != null && i.preco !== '' ? 'R$ ' + esc(String(i.preco)) : '') + '</td>' +
          '<td>' + esc(i.obs || '') + '</td>' +
          '<td><button type="button" class="btn sm" data-act="editar-estoque" data-id="' + esc(i.id) + '">Editar</button></td></tr>';
      }).join('');
      return '<section class="bloco" style="margin-bottom:1rem"><h2>' + esc(cat) + '</h2><div class="rolagem"><table class="tabela"><thead><tr><th>Item</th><th class="num">Qtd.</th><th>Fornecedor</th><th>Preço</th><th>Observação</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div></section>';
    }).join('');
    return '<div class="topo"><div><h1>Estoque e compras</h1><p>Itens de escritório, cozinha, limpeza, papelaria e manutenção do polo. Marque "Precisa comprar" para não esquecer.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn primario" data-act="novo-estoque">Novo item</button></div></div>' +
      (comprar ? '<p class="aviso"><b>' + plural(comprar, 'item', 'itens') + '</b> marcado' + (comprar === 1 ? '' : 's') + ' para comprar.</p>' : '') +
      (grupos || '<div class="vazio">Nenhum item cadastrado ainda.</div>');
  }
  function abrirEditarEstoque(id) {
    const novo = !id, i = novo ? null : S.estoque.find(function (x) { return x.id === id; });
    if (!novo && !i) return;
    abrirDlg(cabDlg(novo ? 'Novo item de estoque' : 'Editar item', '') +
      '<div class="corpo" data-id="' + esc(id || '') + '" id="form-estoque"><div class="campos">' +
      '<div class="largo"><label for="es-item">Item</label><input type="text" id="es-item" value="' + esc(i ? i.item : '') + '"></div>' +
      '<div><label for="es-cat">Categoria</label><select id="es-cat">' + ESTOQUE_CATEGORIAS.map(function (c) { return '<option' + (i && i.categoria === c || (!i && c === 'Outro') ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="es-qtd">Quantidade atual</label><input type="number" id="es-qtd" min="0" step="1" value="' + esc(i && i.qtd != null ? i.qtd : '') + '"></div>' +
      '<div><label for="es-fornecedor">Fornecedor</label><input type="text" id="es-fornecedor" value="' + esc(i ? i.fornecedor : '') + '"></div>' +
      '<div><label for="es-preco">Preço (R$)</label><input type="number" id="es-preco" min="0" step="0.01" value="' + esc(i && i.preco != null ? i.preco : '') + '"></div>' +
      '<div class="largo"><label for="es-obs">Observação</label><input type="text" id="es-obs" value="' + esc(i ? i.obs : '') + '"></div>' +
      '<label class="check"><input type="checkbox" id="es-comprar"' + (i && i.comprar ? ' checked' : '') + '> Precisa comprar</label>' +
      '</div></div>' +
      '<footer><button type="button" class="btn primario" data-act="salvar-estoque">Salvar</button>' + (novo ? '' : '<button type="button" class="btn perigo" data-act="excluir-estoque">Excluir</button>') + '<button type="button" class="btn fim" data-act="fechar">Cancelar</button></footer>');
  }
  function salvarEstoque() {
    const f = $('#form-estoque'); if (!f) return;
    const id = f.dataset.id, novo = !id;
    const item = $('#es-item').value.trim(); if (!item) { toast('Informe o item'); return; }
    const campos = {
      item: item, categoria: $('#es-cat').value, qtd: $('#es-qtd').value === '' ? null : Number($('#es-qtd').value),
      fornecedor: $('#es-fornecedor').value.trim(), preco: $('#es-preco').value === '' ? null : Number($('#es-preco').value),
      obs: $('#es-obs').value.trim(), comprar: $('#es-comprar').checked
    };
    if (novo) { S.estoque.push(Object.assign({ id: 'e' + Date.now().toString(36) }, campos)); }
    else { const i = S.estoque.find(function (x) { return x.id === id; }); if (i) Object.assign(i, campos); }
    LS.set('estoque', S.estoque);
    registrar(novo ? 'Criou item de estoque' : 'Editou item de estoque', item);
    fecharDlg(); render(); toast('Item salvo' + (Sync.configured() ? '' : ' neste navegador'));
  }

  /* ---------- Tarefas administrativas (afazeres) ---------- */
  function viewAfazeres() {
    const todas = S.afazeres || [];
    const abertas = todas.filter(function (t) { return !t.feito; });
    const visiveis = (V.afazerFeitas ? todas : abertas).slice().sort(function (a, b) {
      const pa = a.prazo || a.data || '9999-99-99', pb = b.prazo || b.data || '9999-99-99';
      return (a.feito ? 1 : 0) - (b.feito ? 1 : 0) || (pa < pb ? -1 : pa > pb ? 1 : 0);
    });
    const linhas = visiveis.map(function (t) {
      const atrasada = !t.feito && t.prazo && t.prazo < HOJE;
      return '<li class="dec-item' + (t.feito ? ' feito' : '') + '"><label class="check"><input type="checkbox" data-chg="afazer-feito" data-id="' + esc(t.id) + '"' + (t.feito ? ' checked' : '') + '><span><b>' + esc(t.demanda) + '</b><small>' + (t.responsavel ? esc(t.responsavel) + ' · ' : '') + (t.data ? 'a partir de ' + esc(L.fmtCurta(t.data)) + ' · ' : '') + (t.prazo ? 'prazo ' + esc(L.fmtCurta(t.prazo)) + (atrasada ? ' (atrasado)' : '') : 'sem prazo') + '</small></span></label>' +
        '<button type="button" class="btn sm" data-act="editar-afazer" data-id="' + esc(t.id) + '">Editar</button></li>';
    }).join('');
    return '<div class="topo"><div><h1>Tarefas administrativas</h1><p>Lista contínua de demandas da unidade (eventos, matrículas, organização) — sem precisar recriar a lista todo mês.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn primario" data-act="novo-afazer">Nova tarefa</button></div></div>' +
      '<div class="acoes"><label class="check"><input type="checkbox" data-chg="afazerFeitas"' + (V.afazerFeitas ? ' checked' : '') + '> Mostrar concluídas' + (todas.length - abertas.length ? ' (' + (todas.length - abertas.length) + ')' : '') + '</label></div>' +
      (linhas ? '<ul class="decs">' + linhas + '</ul>' : '<div class="vazio">Nenhuma tarefa em aberto.</div>');
  }
  function abrirEditarAfazer(id) {
    const novo = !id, t = novo ? null : S.afazeres.find(function (x) { return x.id === id; });
    if (!novo && !t) return;
    abrirDlg(cabDlg(novo ? 'Nova tarefa' : 'Editar tarefa', '') +
      '<div class="corpo" data-id="' + esc(id || '') + '" id="form-afazer"><div class="campos">' +
      '<div class="largo"><label for="t-demanda">Demanda</label><input type="text" id="t-demanda" value="' + esc(t ? t.demanda : '') + '"></div>' +
      '<div><label for="t-resp">Responsável</label><input type="text" id="t-resp" value="' + esc(t ? t.responsavel : '') + '"></div>' +
      '<div><label for="t-data">Data</label><input type="date" id="t-data" value="' + esc(t ? t.data : '') + '"></div>' +
      '<div><label for="t-prazo">Prazo</label><input type="date" id="t-prazo" value="' + esc(t ? t.prazo : '') + '"></div>' +
      (novo ? '' : '<label class="check"><input type="checkbox" id="t-feito"' + (t && t.feito ? ' checked' : '') + '> Concluída</label>') +
      '</div></div>' +
      '<footer><button type="button" class="btn primario" data-act="salvar-afazer">Salvar</button>' + (novo ? '' : '<button type="button" class="btn perigo" data-act="excluir-afazer">Excluir</button>') + '<button type="button" class="btn fim" data-act="fechar">Cancelar</button></footer>');
  }
  function salvarAfazer() {
    const f = $('#form-afazer'); if (!f) return;
    const id = f.dataset.id, novo = !id;
    const demanda = $('#t-demanda').value.trim(); if (!demanda) { toast('Informe a demanda'); return; }
    const campos = { demanda: demanda, responsavel: $('#t-resp').value.trim(), data: $('#t-data').value, prazo: $('#t-prazo').value };
    if (novo) { S.afazeres.push(Object.assign({ id: 't' + Date.now().toString(36), feito: false }, campos)); }
    else { const t = S.afazeres.find(function (x) { return x.id === id; }); if (t) { Object.assign(t, campos); const chk = $('#t-feito'); if (chk) t.feito = chk.checked; } }
    LS.set('afazeres', S.afazeres);
    registrar(novo ? 'Criou tarefa' : 'Editou tarefa', demanda);
    fecharDlg(); render(); toast('Tarefa salva' + (Sync.configured() ? '' : ' neste navegador'));
  }

  /* ---------- Conferência ---------- */
  function sigIssue(i) { return (i.aulaId || i.aulaIds.join(',')) + '|' + i.tipo + '|' + i.msg; }
  function viewConferencia() {
    const porData = D.issues.filter(function (i) { return V.passado || i.fim >= HOJE; });
    const passadas = D.issues.length - D.issues.filter(function (i) { return i.fim >= HOJE; }).length;
    const ignoradas = porData.filter(function (i) { return S.ignorados[sigIssue(i)]; }).length;
    const todos = porData.filter(function (i) { return V.verIgnorados || !S.ignorados[sigIssue(i)]; });
    const itens = []; const porAula = {};
    todos.forEach(function (i) {
      if (i.tipo === 'conflito-prof') { itens.push({ iso: i.iso, sev: i.sev, ids: i.aulaIds, titulo: 'Professor em duas aulas ao mesmo tempo', aulas: i.aulaIds.map(function (id) { return D.porId[id]; }), issues: [i], conflito: true }); return; }
      if (i.tipo === 'conflito-sala' || i.tipo === 'sala-capacidade') { itens.push({ iso: i.iso, sev: i.sev, ids: i.aulaIds, titulo: i.tipo === 'conflito-sala' ? 'Duas aulas na mesma sala' : 'Mais aulas do que salas', aulas: i.aulaIds.map(function (id) { return D.porId[id]; }), issues: [i], conflitoSala: true }); return; }
      if (!porAula[i.aulaId]) { const a = D.porId[i.aulaId]; porAula[i.aulaId] = { iso: i.iso, sev: 'atencao', ids: [a.id], titulo: a.disc, aulas: [a], issues: [] }; itens.push(porAula[i.aulaId]); }
      const it = porAula[i.aulaId]; it.issues.push(i); if (i.sev === 'erro') it.sev = 'erro'; if (i.iso < it.iso) it.iso = i.iso;
    });
    // Aulas de cursos diferentes com o mesmo problema viram um só cartão
    const unidos = []; const porSig = {};
    itens.forEach(function (it) {
      if (it.conflito || it.conflitoSala) { unidos.push(it); return; }
      const a = it.aulas[0], sig = [L.norm(a.disc), a.datasTxt, a.horarioTxt, a.prof, a.diaTxt, it.issues.map(function (i) { return i.msg; }).join(';')].join('|');
      if (porSig[sig]) { porSig[sig].ids = porSig[sig].ids.concat(it.ids); porSig[sig].aulas = porSig[sig].aulas.concat(it.aulas); } else { porSig[sig] = it; unidos.push(it); }
    });
    itens.length = 0; unidos.forEach(function (u) { itens.push(u); });
    itens.sort(function (a, b) { return (a.sev === 'erro' ? 0 : 1) - (b.sev === 'erro' ? 0 : 1) || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0); });
    const nErro = itens.filter(function (i) { return i.sev === 'erro'; }).length;
    const lista = itens.map(function (it) {
      const a0 = it.aulas[0];
      const cursos = Array.from(new Set(it.aulas.map(function (a) { return a.cursoCurto; })));
      return '<article class="pitem ' + it.sev + '"><div><h3>' + esc(it.titulo) + '</h3><div class="meta">' + esc(cursos.join(', ')) + (a0 && !it.conflito && !it.conflitoSala ? ' · ' + esc(a0.mesTxt.toLowerCase()) + ' · planilha: “' + esc(a0.datasTxt) + '”, ' + esc(a0.diaTxt || 'sem dia') + ', ' + esc(a0.horarioTxt || 'sem horário') + ', ' + esc(a0.prof || 'sem professor') : '') + '</div></div>' +
        '<div class="acoes">' + (it.conflito ? it.issues[0].lados.map(function (l) { return '<button type="button" class="btn sm" data-act="editar" data-ids="' + esc(l.aulaIds.join(',')) + '" data-primary="' + esc(l.aulaIds[0]) + '" title="Editar ' + esc(l.disc) + '">Ajustar “' + esc(l.disc.length > 22 ? l.disc.slice(0, 21) + '…' : l.disc) + '”</button>'; }).join('') : it.conflitoSala ? Array.from(new Map(it.aulas.map(function (a) { return [a.disc + '|' + a.curso, a]; })).values()).map(function (a) { return '<button type="button" class="btn sm" data-act="editar" data-ids="' + esc(a.id) + '" data-primary="' + esc(a.id) + '" title="Editar ' + esc(a.disc) + '">Ajustar “' + esc(a.disc.length > 22 ? a.disc.slice(0, 21) + '…' : a.disc) + '”</button>'; }).join('') : '<button type="button" class="btn sm" data-act="editar" data-ids="' + esc(it.ids.join(',')) + '" data-primary="' + esc(it.ids[0]) + '">Corrigir</button>') + '</div>' +
        '<ul>' + it.issues.map(function (i) {
          const ignorado = !!S.ignorados[sigIssue(i)];
          return '<li' + (ignorado ? ' class="ignorado"' : '') + '><span class="badge ' + i.sev + '">' + (i.sev === 'erro' ? 'Erro' : 'Atenção') + '</span><span>' + esc(i.msg) + (i.dica ? '<small>' + esc(i.dica) + '</small>' : '') +
            (ignorado ? '<button type="button" class="linkbtn" data-act="reativar-aviso" data-sig="' + esc(sigIssue(i)) + '">Voltar a avisar</button>' : '<button type="button" class="linkbtn" data-act="ignorar-aviso" data-sig="' + esc(sigIssue(i)) + '" title="Use quando já revisou e decidiu manter assim de propósito">Já revisei, não é erro</button>') +
            '</span></li>';
        }).join('') + '</ul></article>';
    }).join('');
    return '<div class="topo"><div><h1>Conferência do calendário</h1><p>' + (itens.length ? plural(itens.length, 'aula precisa', 'aulas precisam') + ' de revisão' + (nErro ? ', ' + plural(nErro, 'com erro que muda a data ou o professor', 'com erros que mudam data ou professor') : '') + '.' : 'Nenhuma pendência' + (V.passado ? '' : ' nas datas de hoje em diante') + '.') + ' A conferência cruza dias da semana, meses, intervalo quinzenal, dias de live, horários e disponibilidade dos professores.</p></div>' +
      '<div class="acoes"><label class="check"><input type="checkbox" data-chg="passado"' + (V.passado ? ' checked' : '') + '> Incluir datas que já passaram' + (passadas ? ' (' + passadas + ')' : '') + '</label>' +
      '<label class="check"><input type="checkbox" data-chg="verIgnorados"' + (V.verIgnorados ? ' checked' : '') + '> Mostrar avisos já revisados' + (ignoradas ? ' (' + ignoradas + ')' : '') + '</label></div></div>' +
      blocoPendencias() + '<div class="pend">' + (lista || '<div class="vazio">Tudo certo por aqui.</div>') + '</div>';
  }

  /* ---------- Rotina do mês ---------- */
  const PASSOS_CURSO = [
    ['Formulário de Infraestrutura Mínima', 'O polo preenche um formulário por curso: <a href="' + L.LINKS.formInfra + '" target="_blank" rel="noopener">' + L.LINKS.formInfra + '</a>. Sem esse envio a solicitação não abre.'],
    ['Análise do Núcleo da Saúde', 'Até 7 dias úteis para avaliar estrutura física, tecnologia, acessibilidade e alinhamento com o MEC. O parecer (deferido ou indeferido) chega por e-mail, com cópia para o Relacionamento com Polos. Se indeferir, ajuste o que foi pedido e reenvie o formulário.'],
    ['Resposta ao deferimento', 'Informe: dia da semana e horário dos presenciais (quinzenais, 3h30, sem coincidir com o dia das lives); endereço completo e sala; e dois tutores, um de formação ampla (disciplinas institucionais) e um técnico do curso.'],
    ['Formulários do tutor', 'Indicação de tutor, cadastro de prestador de serviços (DP) e cadastro no Mentor, onde o tutor faz a chamada. Os três são indispensáveis.'],
    ['Liberação no sistema', 'O Núcleo pede a liberação da oferta ao Relacionamento com Polos, que vincula o curso no UniFECAF Polos e avisa o polo. Só então a captação começa.'],
    ['Captação e abertura da turma', 'São necessárias 15 matrículas confirmadas. Se chegarem até o dia 20, a turma inicia no mês seguinte; depois do dia 20, o início adia mais um mês.'],
    ['Capacitação do tutor', 'Em até 10 dias corridos após a confirmação da turma, com o tutor e o responsável pelo polo presentes. Saúde: Núcleo da Saúde. Arquitetura, Engenharias e Pedagogia: coordenador do curso.'],
    ['Aulas e pagamento', 'As oficinas seguem o material instrutivo validado. Depois de cada aula, o tutor envia as evidências pelo formulário (<a href="' + L.LINKS.formEvidencias + '" target="_blank" rel="noopener">' + L.LINKS.formEvidencias + '</a>); é a base do pagamento.']
  ];
  function viewRotina() {
    const p = V.mesRot.split('-').map(Number), prazos = L.prazosDoMes(p[0], p[1]);
    const passou = V.mesRot < YM_HOJE;
    const lista = prazos.map(function (x) {
      const key = V.mesRot + ':' + x.id, feito = !!S.tarefas[key], fim = x.fim || x.iso;
      const est = feito ? 'feito' : passou ? 'passou' : fim < HOJE ? 'atrasado' : (x.iso <= HOJE && HOJE <= fim) ? 'hoje' : 'futuro';
      const rot = x.fim ? 'Dia ' + Number(x.iso.slice(8)) + ' a ' + Number(x.fim.slice(8)) : 'Dia ' + Number(x.iso.slice(8));
      const badge = est === 'atrasado' ? '<span class="badge erro">Passou do prazo</span>' : est === 'hoje' ? '<span class="badge ok">Em andamento</span>' : est === 'feito' ? '<span class="badge ok">Feito</span>' : '';
      return '<li class="prazo ' + est + '"><div class="dt">' + rot.replace('Dia ', '') + '<small>' + esc(L.MESES[p[1] - 1].slice(0, 3)) + '</small></div><div><label class="check"><input type="checkbox" data-chg="tarefa" data-id="' + esc(key) + '"' + (feito ? ' checked' : '') + '><b>' + esc(x.titulo) + '</b> ' + badge + '</label><div class="muted">' + esc(x.detalhe) + '</div><div class="fonte">Fonte: ' + esc(x.fonte) + '</div></div></li>';
    }).join('');
    const gs = D.grupos.filter(function (g) { return g.iso.slice(0, 7) === V.mesRot; });
    const linhasAulas = gs.map(function (g) {
      return '<tr><td>' + esc(L.fmtCurta(g.iso)) + '<br><span class="muted small">' + L.DIAS_CURTO[L.weekday(g.iso)] + ', ' + esc(L.faixa(g.ini, g.fim)) + '</span></td><td><button type="button" class="linkbtn" data-act="grupo" data-key="' + esc(g.key) + '">' + esc(g.disc) + '</button><br>' + g.cursosCurto.map(function (c) { return '<span class="chip curso">' + esc(c) + '</span> '; }).join('') + '</td><td>' + (g.prof ? '<i class="dot" style="--c:' + corProf(g.prof) + '"></i> ' + esc(g.prof) : '<i>—</i>') + '</td><td>' + esc(L.fmtCurta(L.addDays(g.iso, -7))) + '</td></tr>';
    }).join('');
    return '<div class="topo"><div><h1>Rotina de ' + esc(L.MESES[p[1] - 1]) + '</h1><p>Prazos que se repetem todo mês no Semipresencial e o que fazer antes de cada aula. Marque o que já foi feito; a marcação fica neste navegador.</p></div>' +
      '<div class="acoes nav-sem"><button type="button" class="btn" data-act="rot-prev" aria-label="Mês anterior">‹</button><button type="button" class="btn" data-act="rot-hoje">Hoje</button><button type="button" class="btn" data-act="rot-next" aria-label="Próximo mês">›</button></div></div>' +
      '<div class="dois"><div><ul class="linha-tempo">' + lista + '</ul></div><div class="lateral"><section class="bloco"><h2>Aulas do mês</h2>' + (gs.length ? '<div class="rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Aula</th><th>Professor</th><th>Materiais até</th></tr></thead><tbody>' + linhasAulas + '</tbody></table></div><p class="muted small" style="margin-top:.6rem">A sede envia os insumos com até 7 dias de antecedência. O que o polo precisa providenciar está no <a href="' + L.LINKS.portal + '" target="_blank" rel="noopener">portal de materiais</a>.</p>' : '<p class="muted">Sem aulas neste mês.</p>') + '</section></div></div>' +
      '<section class="bloco" style="margin-top:1.4rem"><h2>Abrir um curso novo no polo</h2><p class="muted">Fluxo oficial do Semipresencial, na ordem em que acontece.</p><ol class="passos">' + PASSOS_CURSO.map(function (s) { return '<li><b>' + s[0] + '</b><div class="muted">' + s[1] + '</div></li>'; }).join('') + '</ol></section>';
  }

  /* ---------- Buscar ---------- */
  function buscarTudo(q0) {
    const q = L.norm((q0 || '').trim());
    if (!q) return [];
    const out = [];
    const vistosGrupo = {};
    D.grupos.forEach(function (g) {
      if (vistosGrupo[g.key]) return;
      const texto = L.norm([g.disc, g.cursos.join(' '), g.prof || '', g.sala || '', g.coortes.join(' ')].join(' '));
      if (texto.indexOf(q) < 0) return;
      vistosGrupo[g.key] = 1;
      out.push({ tipo: 'Aula', titulo: g.disc, sub: L.juntarNatural(g.cursos) + ' · ' + L.fmtCurta(g.iso) + (g.prof ? ' · ' + g.prof : '') + (g.sala ? ' · ' + g.sala : ''), act: 'grupo', key: g.key });
    });
    S.pend.forEach(function (p) {
      const texto = L.norm([p.titulo, p.detalhe || ''].join(' '));
      if (texto.indexOf(q) < 0) return;
      out.push({ tipo: 'Decisão pendente', titulo: p.titulo, sub: p.detalhe || '', act: 'ir-view', view: 'conferencia' });
    });
    (S.pratItens || []).forEach(function (p) {
      const texto = L.norm([p.tema, p.semestre || '', p.prof || ''].join(' '));
      if (texto.indexOf(q) < 0) return;
      out.push({ tipo: 'Prática EAD', titulo: p.tema, sub: L.fmtCurta(p.data) + (p.prof ? ' · ' + p.prof : ''), act: 'ir-view', view: 'praticas' });
    });
    D.profs.forEach(function (n) {
      if (L.norm(n).indexOf(q) < 0) return;
      out.push({ tipo: 'Professor', titulo: n, sub: tel(n) || 'Sem telefone cadastrado', act: 'ir-view', view: 'professores' });
    });
    (S.ocorrencias || []).forEach(function (o) {
      const texto = L.norm([o.aluno, o.ra || '', o.categoria || '', o.responsavel || '', o.evento || ''].join(' '));
      if (texto.indexOf(q) < 0) return;
      out.push({ tipo: 'Ocorrência', titulo: o.aluno, sub: (o.categoria || 'Sem categoria') + ' · ' + (o.responsavel || 'sem responsável'), act: 'ir-view', view: 'ocorrencias' });
    });
    (S.estoque || []).forEach(function (i) {
      const texto = L.norm([i.item, i.categoria || '', i.fornecedor || '', i.obs || ''].join(' '));
      if (texto.indexOf(q) < 0) return;
      out.push({ tipo: 'Estoque', titulo: i.item, sub: (i.categoria || 'Outro') + (i.comprar ? ' · precisa comprar' : ''), act: 'ir-view', view: 'estoque' });
    });
    (S.afazeres || []).forEach(function (t) {
      const texto = L.norm([t.demanda, t.responsavel || ''].join(' '));
      if (texto.indexOf(q) < 0) return;
      out.push({ tipo: 'Tarefa', titulo: t.demanda, sub: (t.responsavel ? t.responsavel + ' · ' : '') + (t.feito ? 'concluída' : (t.prazo ? 'prazo ' + L.fmtCurta(t.prazo) : 'sem prazo')), act: 'ir-view', view: 'afazeres' });
    });
    return out;
  }
  function renderResultadosBusca(q) {
    if (!q.trim()) return '<p class="muted small">Comece a digitar para ver resultados.</p>';
    const res = buscarTudo(q);
    const lista = res.map(function (r) {
      return '<article class="pitem"><div><h3>' + esc(r.titulo) + '</h3><div class="meta">' + esc(r.tipo) + (r.sub ? ' · ' + esc(r.sub) : '') + '</div></div>' +
        '<div class="acoes">' + (r.act === 'grupo' ? '<button type="button" class="btn sm" data-act="grupo" data-key="' + esc(r.key) + '">Abrir</button>' : '<button type="button" class="btn sm" data-act="ir-view" data-view="' + esc(r.view) + '">Abrir</button>') + '</div></article>';
    }).join('');
    return lista || '<div class="vazio">Nada encontrado para “' + esc(q) + '”.</div>';
  }
  function viewBusca() {
    const q = V.busca || '';
    return '<div class="topo"><div><h1>Buscar</h1><p>Procure por disciplina, curso, professor, sala, decisão pendente ou prática EAD.</p></div></div>' +
      '<label class="sr" for="busca-q">Buscar</label><input type="text" id="busca-q" placeholder="Ex.: Bases Morfofuncionais, Marcelo, Sala 4…" value="' + esc(q) + '" style="font-size:1rem;padding:.7rem .9rem;margin-bottom:1rem" autofocus>' +
      '<div id="busca-resultados" class="pend">' + renderResultadosBusca(q) + '</div>';
  }

  /* ---------- Guia rápido ---------- */
  const CONTATOS_SEDE = [
    ['Núcleo da Saúde', [['Juliana Pachioni', 'Diretora'], ['Rafaela Mendonça', 'Gerente'], ['Juliana Sanchez', 'Especialista em operações acadêmicas (analisa a estrutura do polo)']]],
    ['Coordenadores de curso', [['Marcela Granda', 'Arquitetura'], ['Sebastião Garcia', 'Engenharias'], ['Ataíde Junior', 'Pedagogia']]],
    ['Relacionamento com Polos', [['Joel Domingues', 'Head de Relacionamento (vincula cursos no UniFECAF Polos)']]]
  ];
  function viewGuia() {
    const l = L.LINKS;
    const lk = function (href, t, d) { return '<a href="' + href + '" target="_blank" rel="noopener"><b>' + t + '</b><span>' + d + '</span></a>'; };
    return '<div class="topo"><div><h1>Guia rápido</h1><p>As regras do Semipresencial reunidas para responder professor e aluno sem procurar em cinco documentos. Baseado no Guia dos cursos, no FAQ e no Fluxo do Semipresencial.</p></div></div>' +
      '<div class="aviso"><b>Antes de repassar valores e prazos:</b> os documentos têm divergências entre si. Veja “Pontos para confirmar com a sede”, no fim desta página.</div>' +
      '<details class="guia" open><summary>Como funciona uma disciplina</summary><ul>' +
      '<li>Cada disciplina dura um mês: <b>4 lives semanais</b> (3h, obrigatórias, 19h às 22h, terça ou quinta conforme o curso) e <b>2 encontros presenciais quinzenais</b> de 3h30 no polo, em oficinas com metodologias ativas.</li>' +
      '<li>O presencial não pode cair no dia da live do curso. Terça: cursos da saúde, exatas, gestão e tecnologia. Quinta: Pedagogia, Psicopedagogia e Serviço Social.</li>' +
      '<li>Reprova quem não atinge <b>75% de presença</b>, somando lives e presenciais. São 6 encontros, cada um pesa cerca de 16,67%. Na conta, 4 de 6 dá 66,7%, então na prática o aluno precisa de 5 presenças. O aluno não vê a própria frequência na plataforma.</li>' +
      '<li>Live: o aluno entra pelo AVA (UniFECAF One › Meus cursos › Acessar AVA › disciplina do mês › Aulas ao vivo › Aulas Meet) com CPF e data de nascimento; a presença é registrada pelo CPF.</li>' +
      '<li>Presencial: a presença é lançada pelo tutor no Mentor. O presencial não é gravado nem tem conteúdo expositivo para repassar a quem faltou.</li></ul></details>' +
      '<details class="guia"><summary>Faltas e justificativas</summary><ul>' +
      '<li>Atestado: o aluno envia em Portal do aluno › Agiliza › Outros requerimentos › Abono de faltas com Atestado. Com o atestado aceito, ele apenas não fica com falta.</li>' +
      '<li>Força maior (chuva, por exemplo): vale foto da estrada ou qualquer documento que justifique.</li>' +
      '<li>Não há limite de justificativas por aula ao vivo ou presencial.</li>' +
      '<li>Se ninguém aparece ou o aluno não comprova, o tutor ainda é remunerado. Repor a aula é permitido, mas o dia extra do tutor é custo do polo; avise os alunos e a sede pela planilha de planejamento.</li></ul></details>' +
      '<details class="guia"><summary>Provas e notas</summary><ul>' +
      '<li>A composição da nota está no plano avaliativo de cada disciplina (questionários, prova online, prova presencial, trabalho). Oriente sempre o aluno a consultá-lo.</li>' +
      '<li><b>Prova presencial:</b> de 1 a 15 do mês seguinte à disciplina (disciplina de fevereiro, prova de 1 a 15 de março). 10 questões objetivas de 0,3 e 1 discursiva de 2,0, somando 5,0. Sem consulta, até 3h (média de 2h).</li>' +
      '<li>O polo define dias e horários, avisa os alunos e agenda no UniFECAF Polos. A prova só é liberada no AVA quando o aluno chega ao polo. Os tutores corrigem a discursiva. Gabaritos e notas saem até o último dia do mês da aplicação.</li>' +
      '<li><b>Substitutiva:</b> pedida pelo Mentor (protocolo “Prova substitutiva – Avaliação final (388)”), feita no polo de 16 a 25, custa R$ 80,00, com primeiro vencimento 5 dias após o deferimento. A nota sai até o dia 10 do mês seguinte.</li>' +
      '<li>Quem não fez a prova online pode fazer a presencial, mas precisa praticamente gabaritá-la para passar.</li>' +
      '<li>Atividades online perdidas: requerimento no Portal do Aluno (Mentor) entre os dias 15 e 25 do mês seguinte à oferta.</li></ul></details>' +
      '<details class="guia"><summary>Tutores, materiais e capacitação</summary><ul>' +
      '<li>Indique dois perfis: um tutor de formação ampla, para disciplinas institucionais e comuns, e um técnico do curso. Os tutores podem mudar de uma disciplina para outra.</li>' +
      '<li>Pagamento pela sede via nota fiscal ou RPS, com base nas evidências enviadas pelo formulário. Valor de referência no Guia: R$ 70,00 por hora-aula.</li>' +
      '<li>A sede compra e envia os insumos das aulas práticas, que chegam ao polo até 7 dias antes. Várias disciplinas não recebem nada da sede; a lista do que o polo providencia está no portal de materiais.</li>' +
      '<li>Capacitação em até 10 dias corridos após a confirmação da turma. As oficinas seguem o material instrutivo validado pelo Núcleo da Saúde (ou pelo coordenador do curso, em Arquitetura, Engenharias e Pedagogia).</li></ul></details>' +
      '<details class="guia"><summary>Pontos para confirmar com a sede</summary><ul>' +
      '<li><b>Dia 20 ou dia 26?</b> O Fluxo usa dia 20 como corte de matrículas; o FAQ diz que o time do Semi fecha as turmas no dia 26. Provavelmente são etapas diferentes, mas vale confirmar o que cada data trava.</li>' +
      '<li><b>Mínimo de alunos.</b> O Fluxo exige 15 matrículas para abrir turma. O Guia dos cursos fala em 15 apenas na primeira abertura, depois 5 em janeiro e julho e 1 nos demais meses, com 10 alunos ativos por ano de curso para manter a turma.</li>' +
      '<li><b>Carga do presencial.</b> O Guia paga 8h por mês (2 encontros de 4h, R$ 560,00), mas o FAQ, o Fluxo e os calendários do polo usam 2 encontros de 3h30 (7h).</li>' +
      '<li><b>Valor das lives.</b> O Guia lista R$ 50,00 “por live de 3 horas” e R$ 600,00 por 12h no mês. Como 4 lives de R$ 50,00 dão R$ 200,00, o R$ 50,00 parece ser por hora.</li>' +
      '<li><b>Requerimento de atividades online.</b> O FAQ dizia que ainda não estava disponível para o Semi e que seria habilitado em abril. Confirme se já está ativo.</li></ul></details>' +
      '<section class="bloco" style="margin-top:1rem"><h2>Ferramentas e formulários</h2><div class="links">' +
      lk(l.portal, 'Portal de materiais e oficinas', 'Lista de materiais por disciplina, oficinas e mês de referência') +
      lk(l.ensalamento, 'Análise de ensalamento', 'Cronograma de disciplinas por mês e curso') +
      lk(l.qrcode, 'QR Code de presença dos alunos', 'Portaria e presença nos encontros') +
      lk(l.linktree, 'Linktree do Semipresencial', 'Sugestões de compra e habilitação dos polos') +
      lk(l.tutorialEnsalamento, 'Tutorial · ensalamento', 'Vídeo no Drive') + lk(l.tutorialQr, 'Tutorial · QR Code de presença', 'Vídeo no Drive') + lk(l.tutorialPortal, 'Tutorial · portal da universidade corporativa', 'Vídeo no Drive') +
      lk(l.formInfra, 'Formulário de infraestrutura mínima', 'Um por curso a abrir') + lk(l.formIndicacao, 'Indicação de tutor', 'Formulário do tutor 1 de 3') + lk(l.formPrestador, 'Cadastro de prestador (DP)', 'Formulário do tutor 2 de 3') + lk(l.formMentor, 'Cadastro no Mentor', 'Formulário do tutor 3 de 3, onde o tutor faz a chamada') + lk(l.formEvidencias, 'Evidências das aulas presenciais', 'Enviado pelo tutor depois de cada aula; base do pagamento') +
      '</div></section>' +
      '<section class="bloco"><h2>Contatos na sede</h2><p class="muted small">Os telefones aparecem aqui se você os cadastrar em Dados › Telefones. Eles ficam só neste navegador.</p>' +
      CONTATOS_SEDE.map(function (g) {
        return '<h3 style="margin:.8rem 0 .3rem">' + g[0] + '</h3><ul class="itens">' + g[1].map(function (c) {
          const t = tel(L.profCanon(c[0])); return '<li><span class="t"><b>' + esc(c[0]) + '</b><small>' + esc(c[1]) + (t ? ' · ' + esc(t) : '') + '</small></span>' + (t ? '<a class="btn sm" style="margin-left:auto" href="' + esc(L.waUrl(t, 'Olá, ' + c[0].split(' ')[0] + '! Sou da coordenação acadêmica do Polo 1740.')) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</li>';
        }).join('') + '</ul>';
      }).join('') + '</section>';
  }

  /* ---------- Dados ---------- */
  function contatosTexto() { return Object.keys(S.contatos).map(function (n) { return n + ' ' + S.contatos[n]; }).join('\n'); }
  function blocoMatriculas() {
    const resumo = S.matriculas ? L.resumoMatriculas(S.matriculas) : null;
    const atuais = resumo ? resumo.grupos.filter(function (g) { return g.coorte === '2026.1' || g.coorte === '2026.2'; }) : [];
    const linhas = atuais.map(function (g) {
      const chave = g.grupo + '|' + g.coorte, cfg = S.turmaCfg[chave] || {};
      const corte = cfg.corte != null ? cfg.corte : 15, formada = !!cfg.formada, risco = !formada && g.total < corte;
      return '<tr' + (risco ? ' class="risco"' : '') + '><td>' + esc(g.grupo) + '<br><span class="muted small">' + esc(g.coorte) + '</span></td>' +
        '<td>' + g.total + (g.realocados ? ' <span class="muted small">(' + g.realocados + ' realocado' + (g.realocados > 1 ? 's' : '') + ')</span>' : '') + '</td>' +
        '<td><input type="number" min="1" max="99" data-chg="matr-corte" data-key="' + esc(chave) + '" value="' + corte + '" style="width:4.5rem"></td>' +
        '<td><label class="check"><input type="checkbox" data-chg="matr-formada" data-key="' + esc(chave) + '"' + (formada ? ' checked' : '') + '>Já formada</label></td>' +
        '<td>' + (risco ? '<span class="badge atencao">Abaixo do corte</span>' : formada ? '<span class="badge ok">Formada</span>' : '<span class="badge ok">Dentro do corte</span>') + '</td></tr>';
    }).join('');
    return '<section class="bloco"><h2>Matrículas por turma</h2>' +
      '<p class="muted small">Importe a exportação de matrículas da sede (colunas RA, Nome, Curso, Entrada, Turma). O total é contado agrupado como a sede fecha o corte: Biomedicina+Farmácia, Terapia Ocupacional+Fisioterapia, Pedagogia+Psicopedagogia e Educação Física (Lic.+Bach.) juntos; os demais cursos contam sozinhos — sempre por semestre de ingresso (2026.1/2026.2). "Realocado" é aluno cuja turma original não fechou e foi remanejado pela sede para o eixo seguinte. Marque "Já formada" nas turmas que a sede já abriu, mesmo que o total mostrado esteja abaixo do corte hoje (alunos saem depois de a turma abrir); ajuste o corte para 10 quando for o caso.</p>' +
      '<div class="acoes"><button type="button" class="btn primario" data-act="importar-matriculas">Importar lista de matrículas (.xlsx)</button>' +
      (S.matriculas ? '<span class="muted small" style="align-self:center">' + plural(resumo.totalAlunos, 'aluno', 'alunos') + ' na última importação</span>' : '') + '</div>' +
      '<input type="file" id="arquivo-matriculas" accept=".xlsx,.xls" hidden>' +
      (linhas ? '<div class="rolagem" style="margin-top:.8rem"><table class="tabela"><thead><tr><th>Turma (grupo)</th><th>Matriculados</th><th>Corte mínimo</th><th></th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' :
        '<p class="muted small" style="margin-top:.6rem">' + (S.matriculas ? 'Nenhum grupo de 2026.1/2026.2 encontrado nessa lista.' : 'Nenhuma lista importada ainda.') + '</p>') + '</section>';
  }
  function viewDados() {
    const rascunho = !!LS.get('rows', null), sinc = Sync.configured();
    const fases = Array.from(new Set(D.aulas.map(function (a) { return a.fase; }))).sort();
    const statusTxt = sinc
      ? (V.syncStatus === 'sincronizado' ? 'Este painel está <b>sincronizado com a equipe</b>: o que você mudar aqui aparece para as outras coordenadoras em poucos segundos, em qualquer navegador.' : V.syncStatus === 'erro' ? 'Não consegui conectar à sincronização agora — as mudanças ficam salvas neste navegador e sobem assim que a conexão voltar.' : 'Conectando à sincronização entre navegadores…')
      : (rascunho ? 'Você está vendo um <b>rascunho local</b>: as alterações feitas aqui ainda não foram publicadas para os outros computadores.' : 'Você está vendo o calendário publicado no site (' + esc(DATA.atualizado || 's/d') + ').');
    return '<div class="topo"><div><h1>Dados</h1><p>' + statusTxt + ' Hoje são ' + plural(D.aulas.length, 'linha', 'linhas') + ' em ' + plural(fases.length, 'fase', 'fases') + '.</p></div></div>' +
      '<section class="bloco"><h2>Calendário das aulas</h2><div class="acoes">' +
      '<button type="button" class="btn primario" data-act="importar">Importar planilha (.xlsx)</button>' +
      '<button type="button" class="btn" data-act="exportar-xlsx">Baixar Excel</button>' +
      '<button type="button" class="btn" data-act="datajs">Baixar data.js' + (sinc ? ' (backup)' : ' para publicar') + '</button>' +
      '<button type="button" class="btn" data-act="ics-tudo">Baixar agenda completa (.ics)</button>' +
      (sinc ? '' : '<button type="button" class="btn perigo" data-act="restaurar"' + (rascunho ? '' : ' disabled') + '>Descartar rascunho</button>') + '</div>' +
      '<input type="file" id="arquivo" accept=".xlsx,.xls" multiple hidden>' +
      '<p class="muted small" style="margin-top:.7rem">Importar: escolha uma ou as duas planilhas (Fase 1 e Fase 2) no mesmo modelo de sempre — colunas Curso, Semestre, Mês, Disciplina, Dia da Semana, Data das aulas, Horário, Professor e Sala. Elas substituem o calendário atual depois que você confirmar.<br>' + (sinc ? 'Como a sincronização está ativa, isso já vale para todo mundo assim que você confirmar — o data.js aqui é só um backup para guardar no computador.' : 'Publicar: baixe o data.js e troque o arquivo no repositório do GitHub; todos passam a ver a nova versão.') + '</p></section>' +
      blocoMatriculas() +
      '<section class="bloco"><h2>Telefones</h2><p class="muted small">Um por linha, no formato “Nome (21) 99999-9999”. ' + (PUBLICO ? 'Ficam apenas neste navegador; não vão para o site nem para o data.js. Cada computador precisa cadastrar uma vez.' : 'Os telefones dos professores já vêm cadastrados no site. Quem tem o link consegue vê-los.') + '</p>' +
      '<label class="sr" for="tels">Telefones</label><textarea id="tels" placeholder="Marcelo (21) 99999-9999">' + esc(contatosTexto()) + '</textarea><div class="acoes" style="margin-top:.6rem"><button type="button" class="btn primario" data-act="salvar-tels">Salvar telefones</button></div></section>' +
      '<section class="bloco"><h2>Assinatura das mensagens</h2><label for="ass">Texto que fecha cada mensagem de WhatsApp</label><input type="text" id="ass" value="' + esc(S.cfg.assinatura) + '"><div class="acoes" style="margin-top:.6rem"><button type="button" class="btn" data-act="salvar-ass">Salvar assinatura</button></div>' +
      '<label for="autor" style="margin-top:.8rem;display:block">Seu nome (aparece no registro de alterações)</label><input type="text" id="autor" value="' + esc(S.cfg.autor || '') + '"><div class="acoes" style="margin-top:.6rem"><button type="button" class="btn" data-act="salvar-autor">Salvar nome</button></div></section>' +
      blocoAtividade() +
      '<section class="bloco"><h2>Levar para outro computador</h2><p class="muted small">Gera um arquivo com rascunho, telefones, pendências de cadastro e marcações da rotina, para a coordenadora abrir em outro navegador.</p><div class="acoes"><button type="button" class="btn" data-act="backup">Baixar backup</button><button type="button" class="btn" data-act="restaurar-backup">Carregar backup</button></div><input type="file" id="arquivo-backup" accept=".json" hidden></section>';
  }

  function blocoAtividade() {
    const itens = (S.log || []).slice(0, 20);
    const linhas = itens.map(function (l) {
      return '<li><span class="muted small">' + esc(relTempo(l.ts)) + '</span> · <b>' + esc(l.autor) + '</b> · ' + esc(l.acao) + (l.detalhe ? ': ' + esc(l.detalhe) : '') + '</li>';
    }).join('');
    return '<section class="bloco"><h2>Atividade recente</h2>' +
      (linhas ? '<ul class="lista-atividade">' + linhas + '</ul>' : '<p class="muted small">Nenhuma alteração registrada ainda.</p>') + '</section>';
  }

  /* ---------- Modais ---------- */
  function cabDlg(titulo, sub) { return '<div class="dlg"><header><div><h2 id="dlg-titulo">' + titulo + '</h2>' + (sub ? '<div class="muted small" style="margin-top:.3rem">' + sub + '</div>' : '') + '</div><button type="button" class="fechar" data-act="fechar" aria-label="Fechar">×</button></header>'; }

  const AULA_CHK = [['chamada', 'Chamada registrada no Mentor'], ['fotos', 'Fotos da aula'], ['video', 'Vídeo da aula']];
  const chkAula = function (key) { return S.aulaChk[key] || {}; };
  const chkAulaCompleto = function (key) { const c = chkAula(key); return AULA_CHK.every(function (x) { return c[x[0]]; }); };
  function linksEvidenciasGrupo(g, aulas) {
    if (!g.prof) return '';
    const mapa = DATA.evidenciasDrive || {};
    const mesNum = Number(g.iso.slice(5, 7)), ano = Number(g.iso.slice(0, 4));
    const vistos = {};
    const btns = aulas.map(function (a) {
      if (vistos[a.curso]) return ''; vistos[a.curso] = 1;
      const url = L.urlEvidencias(mapa, a.curso, g.prof, mesNum, ano, a.fase) || L.DRIVE_RAIZ;
      return '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener" title="Fotos e vídeos desta aula no Drive">Pasta de evidências' + (aulas.length > 1 ? ' (' + esc(a.cursoCurto) + ')' : '') + '</a>';
    }).join('');
    return btns;
  }
  function abrirGrupo(key) {
    const g = D.grupoPorKey[key]; if (!g) return;
    const aulas = g.aulaIds.map(function (id) { return D.porId[id]; }), a0 = aulas[0], t = tel(g.prof);
    const iss = D.issues.filter(function (i) { return i.aulaIds.some(function (id) { return g.aulaIds.indexOf(id) >= 0; }); });
    V.msgs = L.mensagens(g, S.cfg); V.msgTel = t;
    const dist = L.diffDays(HOJE, g.iso), vespera = L.diffDays(HOJE, L.vesperaUtil(g.iso)) === 0;
    const padrao = dist < 0 ? 'evidencias' : vespera ? 'preparo' : dist <= 2 ? 'lembrete' : 'materiais';
    const atual = V.msgs.find(function (m) { return m.id === padrao; });
    const chk = chkAula(key);
    abrirDlg(cabDlg(esc(g.disc), g.cursos.map(function (c) { return '<span class="chip curso">' + esc(c) + '</span>'; }).join(' ')) +
      '<div class="corpo"><dl class="info"><dt>Encontros</dt><dd class="enc">' + a0.datas.map(function (d) { return '<span class="chip' + (d === g.iso ? ' atual' : '') + '">' + esc(L.DIAS_CURTO[L.weekday(d)] + ' ' + L.fmtCurta(d)) + '</span>'; }).join('') + '</dd>' +
      '<dt>Horário</dt><dd>' + (g.ini != null ? esc(L.faixa(g.ini, g.fim)) : 'A definir') + '</dd>' +
      '<dt>Professor</dt><dd>' + (g.prof ? '<i class="dot" style="--c:' + corProf(g.prof) + '"></i> ' + esc(g.prof) + (t ? ' · ' + esc(t) : ' · <span class="muted">sem telefone cadastrado</span>') : 'Sem professor definido') + '</dd>' +
      '<dt>Semestre</dt><dd>' + esc(a0.semestre) + ' · ' + esc(a0.mesTxt.toLowerCase()) + '</dd>' +
      '<dt>Turma (ingresso)</dt><dd>' + g.coortes.map(function (c) { return '<span class="chip coorte">' + esc(c) + '</span>'; }).join(' ') + '</dd>' +
      '<dt>Sala</dt><dd>' + (g.sala ? esc(g.sala) : '<span class="muted">Sem sala definida</span>') + '</dd>' +
      '<dt>Materiais</dt><dd><a href="' + L.LINKS.portal + '" target="_blank" rel="noopener">Abrir portal de materiais</a> e procurar a disciplina</dd></dl>' +
      (iss.length ? '<div class="alertas">' + iss.map(function (i) { return '<div class="' + i.sev + '"><b>' + (i.sev === 'erro' ? 'Erro: ' : 'Atenção: ') + '</b>' + esc(i.msg) + '</div>'; }).join('') + '</div>' : '') +
      '<fieldset><legend>Checklist da aula</legend>' + AULA_CHK.map(function (c) {
        return '<label class="check"><input type="checkbox" data-chg="aula-chk" data-key="' + esc(key) + '" data-k="' + c[0] + '"' + (chk[c[0]] ? ' checked' : '') + '>' + c[1] + '</label>';
      }).join('') + '</fieldset>' +
      '<div><label for="msgSel">Mensagem para o professor</label><select id="msgSel" data-chg="msgSel">' + V.msgs.map(function (m) { return '<option value="' + m.id + '"' + (m.id === padrao ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('') + '</select>' +
      '<label class="sr" for="msgTxt">Texto</label><textarea id="msgTxt" style="margin-top:.5rem;min-height:11rem">' + esc(atual.texto) + '</textarea>' +
      '<div class="msg-linha"><a class="btn primario' + (t ? '' : '" aria-disabled="true') + '" id="waBtn" ' + (t ? 'href="' + esc(L.waUrl(t, atual.texto)) + '" target="_blank" rel="noopener"' : '') + '>Abrir no WhatsApp</a><button type="button" class="btn" data-act="copiar-msg">Copiar texto</button></div>' +
      (t ? '' : '<p class="muted small" style="margin-top:.4rem">Cadastre o telefone em Dados › Telefones para abrir direto no WhatsApp.</p>') + '</div></div>' +
      '<footer><button type="button" class="btn" data-act="editar" data-ids="' + esc(g.aulaIds.join(',')) + '" data-primary="' + esc(g.aulaIds[0]) + '">Editar aula</button>' + linksEvidenciasGrupo(g, aulas) + '<button type="button" class="btn" data-act="ics-grupo" data-key="' + esc(g.key) + '">Baixar .ics</button><button type="button" class="btn fim" data-act="fechar">Fechar</button></footer></div>');
  }
  function abrirDia(iso) {
    const gs = gruposFiltrados().filter(function (g) { return g.iso === iso; });
    abrirDlg(cabDlg(esc(L.fmtLonga(iso).replace(/^./, function (c) { return c.toUpperCase(); })), plural(gs.length, 'aula', 'aulas')) +
      '<div class="corpo">' + (gs.length ? gs.map(cardGrupo).join('') : '<div class="vazio">Sem aulas neste dia.</div>') + '</div><footer><button type="button" class="btn" data-act="nova" data-iso="' + iso + '">Nova aula neste dia</button><button type="button" class="btn fim" data-act="fechar">Fechar</button></footer></div>');
  }

  const SEMESTRES = ['1º Semestre', '2º Semestre'];
  function nomesCursos() { const s = new Set(D.cursos); Object.keys(L.CURSOS).forEach(function (k) { const n = L.CURSOS[k].nome; if (k !== 'estetica' && k !== 'educacao fisica') s.add(n); }); return Array.from(s).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }); }
  const horaVal = function (m) { return m == null ? '' : L.pad(Math.floor(m / 60)) + ':' + L.pad(m % 60); };

  function abrirEditar(ids, primary, isoInicial) {
    const novo = !ids.length, a = novo ? null : D.porId[primary];
    if (!novo && !a) return;
    const d = a ? a.datas : [];
    const mesSel = a && a.mes ? a.mes : (isoInicial ? Number(isoInicial.slice(5, 7)) : Number(HOJE.slice(5, 7)));
    abrirDlg(cabDlg(novo ? 'Nova aula' : 'Editar aula', novo ? '' : esc(a.curso) + ' · ' + esc(a.mesTxt.toLowerCase())) +
      '<div class="corpo" data-ids="' + esc(ids.join(',')) + '" data-primary="' + esc(primary || '') + '" id="form-edit"><div class="campos">' +
      (novo ? '<div class="largo"><label for="e-curso">Curso</label><select id="e-curso">' + nomesCursos().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="largo"><label for="e-disc">Disciplina</label><input type="text" id="e-disc" value="' + esc(a ? a.disc : '') + '"></div>' +
      '<div><label for="e-d1">1º encontro</label><input type="date" id="e-d1" value="' + esc(d[0] || isoInicial || '') + '"></div>' +
      '<div><label for="e-d2">2º encontro</label><input type="date" id="e-d2" value="' + esc(d[1] || (isoInicial ? L.addDays(isoInicial, 14) : '')) + '"></div>' +
      '<div><label for="e-ini">Início</label><input type="time" id="e-ini" value="' + esc(horaVal(a ? a.ini : null)) + '"></div>' +
      '<div><label for="e-fim">Fim</label><input type="time" id="e-fim" value="' + esc(horaVal(a ? a.fim : null)) + '"></div>' +
      '<div><label for="e-prof">Professor</label><input type="text" id="e-prof" list="lista-profs" placeholder="Digite o nome (novo ou já cadastrado)" value="' + esc(a ? a.prof : '') + '"><datalist id="lista-profs">' + D.profs.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist><small class="muted">Pode digitar um nome que ainda não está na lista — ele é cadastrado sozinho ao salvar.</small></div>' +
      '<div><label for="e-mes">Mês de referência</label><select id="e-mes">' + L.MESES.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === mesSel ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
      (novo ? '<div><label for="e-sem">Semestre</label><select id="e-sem">' + SEMESTRES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' : '') +
      '<div><label for="e-sala">Sala</label><select id="e-sala"><option value="">A definir</option>' + L.SALAS.map(function (s) { return '<option' + (a && a.sala === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      (ids.length > 1 ? '<label class="check"><input type="checkbox" id="e-todos" checked>Aplicar a todos os cursos desta aula (' + ids.length + ': ' + esc(ids.map(function (id) { return D.porId[id].cursoCurto; }).join(', ')) + ')</label>' : '') +
      '<p class="muted small">O dia da semana é preenchido sozinho a partir da data do 1º encontro. Depois de salvar, confira a aba Conferência.</p></div>' +
      '<footer><button type="button" class="btn primario" data-act="salvar-edicao">Salvar</button>' + (novo ? '' : '<button type="button" class="btn perigo" data-act="excluir-aula">Excluir</button>') + '<button type="button" class="btn fim" data-act="fechar">Cancelar</button></footer></div>');
  }
  function salvarEdicao() {
    const f = $('#form-edit'); if (!f) return;
    const ids = f.dataset.ids ? f.dataset.ids.split(',') : [], novo = !ids.length, primary = f.dataset.primary;
    const disc = $('#e-disc').value.trim(); if (!disc) { toast('Informe a disciplina'); return; }
    const d1 = $('#e-d1').value, d2 = $('#e-d2').value; if (!d1) { toast('Informe a data do 1º encontro'); return; }
    const ini = $('#e-ini').value, fim = $('#e-fim').value;
    const min = function (v) { const p = v.split(':').map(Number); return p[0] * 60 + p[1]; };
    if (ini && fim && min(fim) <= min(ini)) { toast('O horário final precisa ser depois do inicial'); return; }
    const datas = [d1, d2].filter(Boolean).map(L.fmtBR).join(' e ');
    const horario = ini ? L.hhmm(min(ini)) + (fim ? ' às ' + L.hhmm(min(fim)) : '') : '';
    const mes = L.MESES[Number($('#e-mes').value) - 1].toUpperCase();
    const prof = $('#e-prof').value.trim();
    const sala = $('#e-sala') ? $('#e-sala').value : '';
    const dia = L.DIAS[L.weekday(d1)];
    if (novo) {
      S.rows.push({ id: 'n' + Date.now().toString(36), curso: $('#e-curso').value, semestre: $('#e-sem').value, mes: mes, disciplina: disc, dia: dia, datas: datas, horario: horario, professor: prof, sala: sala });
    } else {
      const todos = $('#e-todos'), alvo = (todos && !todos.checked) ? [primary] : ids;
      alvo.forEach(function (id) {
        const r = S.rows.find(function (x) { return x.id === id; }); if (!r) return;
        const mudouDatas = r.datas.replace(/\s+/g, ' ').trim() !== datas;
        r.disciplina = disc; r.datas = datas; r.horario = horario; r.mes = mes; r.professor = prof; r.sala = sala;
        if (mudouDatas || !r.dia) r.dia = dia;
      });
    }
    persistir();
    registrar(novo ? 'Criou aula' : 'Editou aula', disc + (sala ? ' · ' + sala : ''));
    fecharDlg(); render(); toast('Alteração salva' + (Sync.configured() ? '' : ' neste navegador'));
  }

  function abrirEditarPratica(id) {
    const novo = !id, p = novo ? null : S.pratItens.find(function (x) { return x.id === id; });
    if (!novo && !p) return;
    abrirDlg(cabDlg(novo ? 'Nova prática EAD' : 'Editar prática EAD', novo ? '' : esc(DATA.praticas.curso)) +
      '<div class="corpo" data-id="' + esc(id || '') + '" id="form-pratica"><div class="campos">' +
      '<div class="largo"><label for="p-tema">Tema da prática</label><input type="text" id="p-tema" value="' + esc(p ? p.tema : '') + '"></div>' +
      '<div><label for="p-data">Data do encontro</label><input type="date" id="p-data" value="' + esc(p ? p.data : '') + '"></div>' +
      '<div><label for="p-hora">Horário</label><input type="text" id="p-hora" placeholder="9h às 12h" value="' + esc(p ? p.hora || '' : '') + '"></div>' +
      '<div><label for="p-semestre">Semestre do curso</label><input type="text" id="p-semestre" placeholder="3º semestre" value="' + esc(p ? p.semestre || '' : '') + '"></div>' +
      '<div><label for="p-prof">Professor padrão</label><input type="text" id="p-prof" list="lista-profs" value="' + esc(p ? p.prof || '' : '') + '"><datalist id="lista-profs">' + D.profs.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>' +
      '<div class="largo"><label for="p-video">Link do vídeo de capacitação</label><input type="text" id="p-video" value="' + esc(p ? p.video || '' : '') + '"></div>' +
      '<div class="largo"><label for="p-pap">Link do PAP (material da prática)</label><input type="text" id="p-pap" value="' + esc(p ? p.pap || '' : '') + '"></div>' +
      '<div class="largo"><label for="p-sede">A UniFECAF envia (um item por linha)</label><textarea id="p-sede" style="min-height:5rem">' + esc((p && p.sede || []).join('\n')) + '</textarea></div>' +
      '<div class="largo"><label for="p-polo">O polo providencia (um item por linha)</label><textarea id="p-polo" style="min-height:4rem">' + esc((p && p.polo || []).join('\n')) + '</textarea></div>' +
      '</div>' +
      '<p class="muted small">Depois que a data passar, a prática some da lista sozinha — dá pra ver de novo marcando "Incluir práticas já realizadas".</p></div>' +
      '<footer><button type="button" class="btn primario" data-act="salvar-pratica">Salvar</button>' + (novo ? '' : '<button type="button" class="btn perigo" data-act="excluir-pratica">Excluir</button>') + '<button type="button" class="btn fim" data-act="fechar">Cancelar</button></footer></div>');
  }
  function salvarPratica() {
    const f = $('#form-pratica'); if (!f) return;
    const id = f.dataset.id, novo = !id;
    const tema = $('#p-tema').value.trim(); if (!tema) { toast('Informe o tema da prática'); return; }
    const data = $('#p-data').value; if (!data) { toast('Informe a data do encontro'); return; }
    const campos = {
      tema: tema, data: data, hora: $('#p-hora').value.trim(), semestre: $('#p-semestre').value.trim(), prof: $('#p-prof').value.trim(),
      video: $('#p-video').value.trim(), pap: $('#p-pap').value.trim(),
      sede: $('#p-sede').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      polo: $('#p-polo').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
    };
    if (novo) {
      S.pratItens.push(Object.assign({ id: 'pr' + Date.now().toString(36) }, campos));
    } else {
      const p = S.pratItens.find(function (x) { return x.id === id; }); if (!p) return;
      Object.assign(p, campos);
    }
    LS.set('pratItens', S.pratItens);
    registrar(novo ? 'Criou prática EAD' : 'Editou prática EAD', tema + ' · ' + L.fmtCurta(data));
    fecharDlg(); render(); toast('Prática salva' + (Sync.configured() ? '' : ' neste navegador'));
  }

  /* ---------- Importar / exportar ---------- */
  function lerArquivos(files) {
    const lidos = Array.from(files).map(function (f) {
      return f.arrayBuffer().then(function (buf) {
        const wb = XLSX.read(buf, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
        return L.lerLinhasPlanilha(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })).map(function (r) { return Object.assign({}, r); });
      });
    });
    Promise.all(lidos).then(function (listas) {
      const rows = [].concat.apply([], listas).map(function (r, i) { return Object.assign({ id: 'a' + (i + 1) }, r); });
      if (!rows.length) { toast('Não encontrei linhas de aulas nesse arquivo'); return; }
      if (!confirm('Substituir as ' + S.rows.length + ' linhas atuais por ' + rows.length + ' linhas importadas?')) return;
      S.rows = rows; persistir(); registrar('Importou planilha do calendário', rows.length + ' linhas'); render(); toast(rows.length + ' linhas importadas. Confira a aba Conferência.');
    }).catch(function (e) { toast(e && e.message ? e.message : 'Não consegui ler o arquivo'); });
  }
  function lerMatriculas(file) {
    file.arrayBuffer().then(function (buf) {
      const wb = XLSX.read(buf, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
      const alunos = L.lerMatriculas(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }));
      if (!alunos.length) { toast('Não encontrei linhas de alunos nesse arquivo'); return; }
      S.matriculas = alunos; LS.set('matriculas', S.matriculas); registrar('Importou lista de matrículas', plural(alunos.length, 'linha', 'linhas')); render(); toast(plural(alunos.length, 'linha importada', 'linhas importadas'));
    }).catch(function (e) { toast(e && e.message ? e.message : 'Não consegui ler o arquivo'); });
  }
  function exportarXlsx() {
    const wb = XLSX.utils.book_new(); const fases = Array.from(new Set(D.aulas.map(function (a) { return a.fase; }))).sort();
    fases.forEach(function (f) {
      const aoa = [L.CABECALHO].concat(D.aulas.filter(function (a) { return a.fase === f; }).map(function (a) {
        const st = S.status[a.prof];
        return [a.row.curso, a.row.semestre, a.row.mes, a.row.disciplina, a.row.dia, a.row.datas, a.row.horario, a.row.professor, tel(a.prof), '',
          st ? ((st.indicacao && st.prestador && st.mentor) ? 'Sim' : 'Não') : '', st ? (st.capacitado ? 'Sim' : 'Não') : '', a.sala || ''];
      }));
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [28, 12, 12, 46, 16, 26, 16, 22, 18, 22, 20, 13, 14].map(function (w) { return { wch: w }; });
      XLSX.utils.book_append_sheet(wb, ws, 'Fase ' + f);
    });
    baixar('calendario-polo-1740.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function backup() {
    baixar('backup-painel-1740.json', JSON.stringify({ versao: 1, rows: S.rows, contatos: S.contatos, status: S.status, tarefas: S.tarefas, cfg: S.cfg, pend: S.pend, prat: S.prat, pratItens: S.pratItens, ocorrencias: S.ocorrencias, estoque: S.estoque, afazeres: S.afazeres }, null, 1), 'application/json');
  }

  /* ---------- Ações ---------- */
  const ACTS = {
    fechar: function () { fecharDlg(); },
    grupo: function (el) { abrirGrupo(el.dataset.key); },
    dia: function (el) { abrirDia(el.dataset.iso); },
    'sem-prev': function () { V.semana = L.addDays(V.semana, -7); render(); },
    'sem-next': function () { V.semana = L.addDays(V.semana, 7); render(); },
    'sem-hoje': function () { V.semana = L.mondayOf(HOJE); render(); },
    'sem-ir': function (el) { V.semana = L.mondayOf(el.dataset.iso); render(); },
    'mes-prev': function () { V.mes = somaMes(V.mes, -1); render(); },
    'mes-next': function () { V.mes = somaMes(V.mes, 1); render(); },
    'mes-hoje': function () { V.mes = YM_HOJE; render(); },
    'rot-prev': function () { V.mesRot = somaMes(V.mesRot, -1); render(); },
    'rot-next': function () { V.mesRot = somaMes(V.mesRot, 1); render(); },
    'rot-hoje': function () { V.mesRot = YM_HOJE; render(); },
    nova: function (el) { fecharDlg(); abrirEditar([], '', el.dataset.iso || ''); },
    editar: function (el) { abrirEditar(el.dataset.ids.split(','), el.dataset.primary); },
    'salvar-edicao': salvarEdicao,
    'excluir-aula': function () {
      const f = $('#form-edit'), ids = f.dataset.ids.split(','), todos = $('#e-todos'), alvo = (todos && !todos.checked) ? [f.dataset.primary] : ids;
      if (!confirm('Excluir ' + plural(alvo.length, 'linha', 'linhas') + ' do calendário?')) return;
      const disc = alvo.map(function (id) { const r = S.rows.find(function (x) { return x.id === id; }); return r ? r.disciplina : ''; }).filter(Boolean)[0] || '';
      S.rows = S.rows.filter(function (r) { return alvo.indexOf(r.id) < 0; }); persistir();
      registrar('Excluiu aula', disc);
      fecharDlg(); render(); toast('Aula excluída' + (Sync.configured() ? '' : ' neste navegador'));
    },
    'copiar-msg': function () { copiar($('#msgTxt').value); },
    'copiar-cad': function (el) { copiar(L.msgCadastro(el.dataset.prof, S.status[el.dataset.prof], S.cfg)); },
    'agenda-prof': function (el) { V.fProf = el.dataset.prof; V.fCurso = ''; location.hash = '#calendario'; },
    'pdf-prof': function (el) {
      const sel = el.parentElement && el.parentElement.querySelector('.sel-mes-pdf[data-prof="' + el.dataset.prof.replace(/"/g, '\\"') + '"]');
      imprimirListaProf(el.dataset.prof, (sel && sel.value) || el.dataset.ymPadrao || YM_HOJE);
    },
    ics: function () { const gs = gruposFiltrados(); if (!gs.length) { toast('Nenhuma aula no filtro atual'); return; } baixar('agenda-polo-1740.ics', L.ics(gs), 'text/calendar;charset=utf-8'); },
    'pdf-mes': function () {
      const nomeArq = 'Calendario ' + nomeMes(V.mes) + (V.fProf && V.fProf !== '__sem' ? ' - ' + V.fProf : V.fCurso ? ' - ' + V.fCurso : '');
      const antigo = document.title; document.title = nomeArq;
      toast('Escolha "Salvar como PDF" na janela de impressão');
      setTimeout(function () { window.print(); document.title = antigo; }, 150);
    },
    'ics-tudo': function () { baixar('agenda-polo-1740.ics', L.ics(D.grupos), 'text/calendar;charset=utf-8'); },
    'ics-grupo': function (el) { const g = D.grupoPorKey[el.dataset.key]; baixar('aula-' + g.iso + '.ics', L.ics([g], g.disc), 'text/calendar;charset=utf-8'); },
    importar: function () { $('#arquivo').click(); },
    'importar-matriculas': function () { $('#arquivo-matriculas').click(); },
    'exportar-xlsx': exportarXlsx,
    datajs: function () { const rows = S.rows.map(function (r) { const o = Object.assign({}, r); delete o.id; return o; }); baixar('data.js', L.dataJs(rows, L.iso(new Date()), { responsavelCronograma: RESP, contatos: PUBLICO ? {} : S.contatos, pendencias: S.pend, praticas: Object.assign({}, DATA.praticas, { itens: S.pratItens }) }), 'text/javascript;charset=utf-8'); toast('Troque o data.js do repositório por este arquivo'); },
    restaurar: function () { if (!confirm('Descartar o rascunho local e voltar ao calendário publicado?')) return; LS.del('rows'); LS.del('rowsBase'); S.rows = baseRows(); recalc(); render(); toast('Rascunho descartado'); },
    'salvar-tels': function () { S.contatos = L.parseContatos($('#tels').value); LS.set('contatos', S.contatos); recalc(); registrar('Atualizou telefones', plural(Object.keys(S.contatos).length, 'contato', 'contatos')); render(); toast(plural(Object.keys(S.contatos).length, 'telefone salvo', 'telefones salvos')); },
    'salvar-ass': function () { S.cfg.assinatura = $('#ass').value.trim() || 'Coordenação Acadêmica — Polo 1740'; LS.set('cfg', S.cfg); toast('Assinatura salva'); },
    'salvar-autor': function () { const v = $('#autor').value.trim(); if (!v) { toast('Digite seu nome'); return; } S.cfg.autor = v; LS.set('cfg', S.cfg); toast('Nome salvo'); render(); },
    backup: backup,
    'restaurar-backup': function () { $('#arquivo-backup').click(); },
    'pend-add': function () {
      const t = $('#pend-t').value.trim(); if (!t) { toast('Escreva o que precisa ser decidido'); return; }
      S.pend.push({ id: 'u' + Date.now(), titulo: t, detalhe: $('#pend-d').value.trim(), resp: $('#pend-r').value.trim() || RESP, feito: false }); LS.set('pend', S.pend); registrar('Criou pendência', t); render(); toast('Pendência adicionada');
    },
    'pend-del': function (el) {
      if (!confirm('Excluir esta pendência?')) return;
      const p = S.pend.find(function (x) { return x.id === el.dataset.id; });
      S.pend = S.pend.filter(function (x) { return x.id !== el.dataset.id; }); LS.set('pend', S.pend);
      if (p) registrar('Excluiu pendência', p.titulo);
      render();
    },
    'prat-copiar': function (el) {
      const P = DATA.praticas, p = S.pratItens.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
      const st = S.prat[p.id] || {};
      copiar(L.mensagemPratica(p, { prof: st.prof || p.prof, assinatura: S.cfg.assinatura, curso: P.curso }));
    },
    'nova-pratica': function () { abrirEditarPratica(null); },
    'editar-pratica': function (el) { abrirEditarPratica(el.dataset.id); },
    'salvar-pratica': salvarPratica,
    'excluir-pratica': function () {
      const f = $('#form-pratica'); if (!f) return;
      const id = f.dataset.id; if (!confirm('Excluir esta prática?')) return;
      const p = S.pratItens.find(function (x) { return x.id === id; });
      S.pratItens = S.pratItens.filter(function (x) { return x.id !== id; }); LS.set('pratItens', S.pratItens);
      if (p) registrar('Excluiu prática EAD', p.tema);
      fecharDlg(); render(); toast('Prática excluída');
    },
    'usar-publicado': function () { LS.del('rows'); LS.set('rowsBase', DATA.atualizado || ''); S.rows = baseRows(); recalc(); render(); toast('Mostrando o calendário publicado'); },
    'ir-view': function (el) { location.hash = '#' + el.dataset.view; },
    'ignorar-aviso': function (el) {
      const sig = el.dataset.sig; S.ignorados[sig] = true; LS.set('ignorados', S.ignorados);
      registrar('Marcou aviso como revisado', sig.split('|').slice(1).join(' · '));
      render(); toast('Não vamos mais avisar sobre isso, a não ser que os dados mudem');
    },
    'reativar-aviso': function (el) {
      const sig = el.dataset.sig; delete S.ignorados[sig]; LS.set('ignorados', S.ignorados);
      registrar('Voltou a avisar sobre um item', sig.split('|').slice(1).join(' · '));
      render(); toast('Aviso reativado');
    },
    'manter-rascunho': function () { LS.set('rowsBase', DATA.atualizado || ''); render(); },
    'nova-ocorrencia': function () { abrirEditarOcorrencia(null); },
    'editar-ocorrencia': function (el) { abrirEditarOcorrencia(el.dataset.id); },
    'salvar-ocorrencia': salvarOcorrencia,
    'excluir-ocorrencia': function () {
      const f = $('#form-ocor'); if (!f) return;
      const id = f.dataset.id; if (!confirm('Excluir esta ocorrência?')) return;
      const o = S.ocorrencias.find(function (x) { return x.id === id; });
      S.ocorrencias = S.ocorrencias.filter(function (x) { return x.id !== id; }); LS.set('ocorrencias', S.ocorrencias);
      if (o) registrar('Excluiu ocorrência', o.aluno);
      fecharDlg(); render(); toast('Ocorrência excluída');
    },
    'novo-estoque': function () { abrirEditarEstoque(null); },
    'editar-estoque': function (el) { abrirEditarEstoque(el.dataset.id); },
    'salvar-estoque': salvarEstoque,
    'excluir-estoque': function () {
      const f = $('#form-estoque'); if (!f) return;
      const id = f.dataset.id; if (!confirm('Excluir este item?')) return;
      const i = S.estoque.find(function (x) { return x.id === id; });
      S.estoque = S.estoque.filter(function (x) { return x.id !== id; }); LS.set('estoque', S.estoque);
      if (i) registrar('Excluiu item de estoque', i.item);
      fecharDlg(); render(); toast('Item excluído');
    },
    'novo-afazer': function () { abrirEditarAfazer(null); },
    'editar-afazer': function (el) { abrirEditarAfazer(el.dataset.id); },
    'salvar-afazer': salvarAfazer,
    'excluir-afazer': function () {
      const f = $('#form-afazer'); if (!f) return;
      const id = f.dataset.id; if (!confirm('Excluir esta tarefa?')) return;
      const t = S.afazeres.find(function (x) { return x.id === id; });
      S.afazeres = S.afazeres.filter(function (x) { return x.id !== id; }); LS.set('afazeres', S.afazeres);
      if (t) registrar('Excluiu tarefa', t.demanda);
      fecharDlg(); render(); toast('Tarefa excluída');
    }
  };
  const CHG = {
    fCurso: function (el) { V.fCurso = el.value; render(); },
    fProf: function (el) { V.fProf = el.value; render(); },
    passado: function (el) { V.passado = el.checked; render(); },
    pratPassado: function (el) { V.pratPassado = el.checked; render(); },
    verIgnorados: function (el) { V.verIgnorados = el.checked; render(); },
    ocorResolvidas: function (el) { V.ocorResolvidas = el.checked; render(); },
    afazerFeitas: function (el) { V.afazerFeitas = el.checked; render(); },
    'ocor-resp': function (el) { const o = S.ocorrencias.find(function (x) { return x.id === el.dataset.id; }); if (!o) return; o.responsavel = el.value; LS.set('ocorrencias', S.ocorrencias); if (el.value === 'Resolvido' && !o.solucaoEm) o.solucaoEm = HOJE; registrar('Atualizou responsável da ocorrência', o.aluno + ' · ' + (el.value || 'sem responsável')); render(); },
    'estoque-comprar': function (el) { const i = S.estoque.find(function (x) { return x.id === el.dataset.id; }); if (!i) return; i.comprar = el.checked; LS.set('estoque', S.estoque); render(); const n = $('input[data-chg="estoque-comprar"][data-id="' + CSS.escape(i.id) + '"]'); if (n) n.focus(); },
    'afazer-feito': function (el) { const t = S.afazeres.find(function (x) { return x.id === el.dataset.id; }); if (!t) return; t.feito = el.checked; LS.set('afazeres', S.afazeres); if (el.checked) registrar('Concluiu tarefa', t.demanda); render(); const n = $('input[data-chg="afazer-feito"][data-id="' + CSS.escape(t.id) + '"]'); if (n) n.focus(); },
    status: function (el) { const p = el.dataset.prof, k = el.dataset.k; S.status[p] = S.status[p] || {}; S.status[p][k] = el.checked; LS.set('status', S.status); render(); const n = $('input[data-chg="status"][data-prof="' + CSS.escape(p) + '"][data-k="' + k + '"]'); if (n) n.focus(); },
    tarefa: function (el) { const id = el.dataset.id; S.tarefas[id] = el.checked; LS.set('tarefas', S.tarefas); render(); const n = $('input[data-chg="tarefa"][data-id="' + CSS.escape(id) + '"]'); if (n) n.focus(); },
    'pend-feito': function (el) { const p = S.pend.find(function (x) { return x.id === el.dataset.id; }); if (!p) return; p.feito = el.checked; LS.set('pend', S.pend); if (el.checked) registrar('Resolveu pendência', p.titulo); render(); const n = $('input[data-chg="pend-feito"][data-id="' + CSS.escape(p.id) + '"]'); if (n) n.focus(); },
    'prat-chk': function (el) { const id = el.dataset.id; S.prat[id] = S.prat[id] || { chk: {}, prof: '' }; S.prat[id].chk = S.prat[id].chk || {}; S.prat[id].chk[el.dataset.k] = el.checked; LS.set('prat', S.prat); render(); const n = $('input[data-chg="prat-chk"][data-id="' + CSS.escape(id) + '"][data-k="' + el.dataset.k + '"]'); if (n) n.focus(); },
    'prat-prof': function (el) { const id = el.dataset.id; S.prat[id] = S.prat[id] || { chk: {}, prof: '' }; S.prat[id].prof = el.value; LS.set('prat', S.prat); render(); },
    'aula-chk': function (el) { const key = el.dataset.key; S.aulaChk[key] = S.aulaChk[key] || {}; S.aulaChk[key][el.dataset.k] = el.checked; LS.set('aulaChk', S.aulaChk); render(); const n = $('input[data-chg="aula-chk"][data-key="' + CSS.escape(key) + '"][data-k="' + el.dataset.k + '"]'); if (n) n.focus(); },
    'matr-corte': function (el) { const key = el.dataset.key; S.turmaCfg[key] = S.turmaCfg[key] || {}; S.turmaCfg[key].corte = Math.max(1, parseInt(el.value, 10) || 15); LS.set('turmaCfg', S.turmaCfg); registrar('Ajustou corte mínimo', key.replace('|', ' · ') + ' → ' + S.turmaCfg[key].corte); render(); },
    'matr-formada': function (el) { const key = el.dataset.key; S.turmaCfg[key] = S.turmaCfg[key] || {}; S.turmaCfg[key].formada = el.checked; LS.set('turmaCfg', S.turmaCfg); registrar(el.checked ? 'Marcou turma como formada' : 'Desmarcou turma como formada', key.replace('|', ' · ')); render(); },
    msgSel: function (el) {
      const m = V.msgs.find(function (x) { return x.id === el.value; }); if (!m) return; $('#msgTxt').value = m.texto; atualizarWa();
    }
  };
  function atualizarWa() { const b = $('#waBtn'); if (b && V.msgTel) b.href = L.waUrl(V.msgTel, $('#msgTxt').value); }

  document.addEventListener('click', function (e) {
    if (e.target === $('#dlg')) { fecharDlg(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACTS[el.dataset.act]; if (fn) fn(el, e);
  });
  document.addEventListener('change', function (e) {
    const el = e.target;
    if (el.id === 'arquivo' && el.files.length) { lerArquivos(el.files); el.value = ''; return; }
    if (el.id === 'arquivo-matriculas' && el.files.length) { lerMatriculas(el.files[0]); el.value = ''; return; }
    if (el.id === 'arquivo-backup' && el.files.length) {
      el.files[0].text().then(function (t) {
        const b = JSON.parse(t); if (!b || !Array.isArray(b.rows)) throw new Error('Arquivo de backup inválido');
        if (!confirm('Substituir os dados deste navegador pelo backup?')) return;
        S.rows = b.rows; S.contatos = b.contatos || {}; S.status = b.status || {}; S.tarefas = b.tarefas || {}; S.cfg = Object.assign(S.cfg, b.cfg || {}); if (b.pend) { S.pend = b.pend; LS.set('pend', S.pend); } if (b.prat) { S.prat = b.prat; LS.set('prat', S.prat); } if (b.pratItens) { S.pratItens = b.pratItens; LS.set('pratItens', S.pratItens); }
        if (b.ocorrencias) { S.ocorrencias = b.ocorrencias; LS.set('ocorrencias', S.ocorrencias); } if (b.estoque) { S.estoque = b.estoque; LS.set('estoque', S.estoque); } if (b.afazeres) { S.afazeres = b.afazeres; LS.set('afazeres', S.afazeres); }
        LS.set('contatos', S.contatos); LS.set('status', S.status); LS.set('tarefas', S.tarefas); LS.set('cfg', S.cfg); persistir(); render(); toast('Backup carregado');
      }).catch(function (err) { toast(err.message || 'Não consegui ler o backup'); }); el.value = ''; return;
    }
    if (el.dataset && el.dataset.chg && CHG[el.dataset.chg]) CHG[el.dataset.chg](el);
    if (el.id === 'e-d1' && el.value) { $('#e-mes').value = String(Number(el.value.slice(5, 7))); const d2 = $('#e-d2'); if (!d2.value) d2.value = L.addDays(el.value, 14); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'msgTxt') atualizarWa();
    if (e.target.id === 'busca-q') {
      V.busca = e.target.value;
      const alvo = $('#busca-resultados');
      if (alvo) alvo.innerHTML = renderResultadosBusca(V.busca);
    }
  });

  /* ---------- Render e rotas ---------- */
  const RENDER = { semana: viewSemana, calendario: viewCalendario, professores: viewProfessores, conferencia: viewConferencia, rotina: viewRotina, praticas: viewPraticas, ocorrencias: viewOcorrencias, estoque: viewEstoque, afazeres: viewAfazeres, buscar: viewBusca, guia: viewGuia, dados: viewDados };
  function banner() {
    if (Sync.configured()) return '';
    const rascunho = LS.get('rows', null), base = LS.get('rowsBase', '');
    if (rascunho && DATA.atualizado && base !== DATA.atualizado) {
      return '<div class="aviso"><b>O calendário publicado foi atualizado (' + esc(DATA.atualizado) + ').</b> Este navegador tem um rascunho de uma versão anterior. <button type="button" class="linkbtn" data-act="usar-publicado">Usar o publicado</button> ou <button type="button" class="linkbtn" data-act="manter-rascunho">manter meu rascunho</button>.</div>';
    }
    return '';
  }
  function render() {
    const id = RENDER[V.view] ? V.view : 'semana';
    const nErr = issuesFuturas('erro').length + pendAbertas().length, rasc = !!LS.get('rows', null);
    $('#nav').innerHTML = VIEWS.map(function (v) {
      return '<a href="#' + v.id + '"' + (v.id === id ? ' aria-current="page"' : '') + '>' + svg(v.id) + v.nome + (v.id === 'conferencia' && nErr ? '<span class="n" title="Erros de hoje em diante e decisões pendentes">' + nErr + '</span>' : '') + '</a>';
    }).join('') + '<hr class="sep-nav">' + EXT_LINKS.map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" class="nav-ext">' + svg(l.id) + l.nome + '</a>';
    }).join('');
    const foot = $('.rodape');
    if (foot) {
      const rotFoot = { 'sem-config': 'Os dados ficam neste navegador. Para publicar mudanças, use Dados › Baixar data.js.', conectando: 'Conectando à sincronização entre navegadores…', sincronizado: 'Sincronizado: as alterações aparecem para toda a equipe.', erro: 'Não consegui sincronizar agora. Os dados continuam salvos neste navegador.' };
      foot.textContent = Sync.configured() ? rotFoot[V.syncStatus] : (rasc ? 'Rascunho local: as mudanças ainda não foram publicadas. Dados › Baixar data.js.' : rotFoot['sem-config']);
    }
    const app = $('#app'); app.innerHTML = banner() + RENDER[id]();
  }
  function rota() {
    const h = (location.hash || '#semana').slice(1); V.view = RENDER[h] ? h : 'semana'; render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rota);
  try { window.matchMedia('(max-width: 820px)').addEventListener('change', function () { if (V.view === 'semana') render(); }); } catch (e) { /* navegadores antigos */ }

  /* ---------- Sincronização entre navegadores (se configurada em sync-config.js) ---------- */
  function aplicarRemoto(dados) {
    let mudou = false;
    CHAVES_SYNC.forEach(function (k) {
      if (dados[k] === undefined) return;
      S[k] = k === 'cfg' ? Object.assign({ assinatura: 'Coordenação Acadêmica — Polo 1740' }, dados[k]) : dados[k];
      LS.setLocal(k, S[k]); mudou = true;
    });
    /* Migração única: as abas Ocorrências/Estoque/Tarefas foram sincronizadas vazias antes de
       existirem os itens das planilhas. Na primeira vez que qualquer navegador abrir o painel
       depois desta atualização, se estiverem vazias no banco compartilhado, preenche com os
       itens que já vieram no data.js e marca a migração como feita (pra nunca repetir, mesmo
       se depois alguém apagar tudo de propósito). */
    if (!S.cfg.seedNovasAbasV1) {
      const semear = { ocorrencias: DATA.ocorrencias || [], estoque: DATA.estoque || [], afazeres: DATA.afazeres || [] };
      let algumaSemeada = false;
      ['ocorrencias', 'estoque', 'afazeres'].forEach(function (k) {
        if ((!S[k] || !S[k].length) && semear[k].length) {
          S[k] = semear[k].map(function (x) { return Object.assign({}, x); });
          LS.setLocal(k, S[k]);
          algumaSemeada = true;
        }
      });
      S.cfg = Object.assign({}, S.cfg, { seedNovasAbasV1: true });
      LS.set('cfg', S.cfg);
      if (algumaSemeada) { LS.set('ocorrencias', S.ocorrencias); LS.set('estoque', S.estoque); LS.set('afazeres', S.afazeres); }
      mudou = true;
    }
    if (mudou) { recalc(); render(); }
  }
  function estadoAtual() {
    const o = {}; CHAVES_SYNC.forEach(function (k) { o[k] = S[k]; }); return o;
  }

  recalc();
  Sync.init(aplicarRemoto, function (status) { V.syncStatus = status; render(); }, estadoAtual);
  rota();
  window.__painel = { S: S, D: D, V: V, render: render, recalc: recalc, abrirGrupo: abrirGrupo, abrirEditar: abrirEditar };
})();
