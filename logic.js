/* Painel Semipresencial · Polo 1740
   Lógica pura (sem DOM): leitura das planilhas, conferência, prazos, agenda .ics e mensagens.
   Funciona no navegador (window.Logic) e no Node (require) para testes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Constantes ---------- */
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DURACAO_PADRAO = 210; // 3h30 (FAQ do Semi)

  const LINKS = {
    portal: 'https://portalsaudesemipresencial.netlify.app/',
    ensalamento: 'https://analisedeensalamentossaude.netlify.app/',
    qrcode: 'https://semi-informacoes-portaria.netlify.app/',
    linktree: 'https://linktr.ee/SemipresencialUniFECAF',
    tutorialEnsalamento: 'https://drive.google.com/file/d/1pqALh1KtCagMBNaroJx2ZGC4eFJz1V-S/view?usp=drive_link',
    tutorialQr: 'https://drive.google.com/file/d/1KyjNynom62lwtYwNjw8uUVuhu9FSjYro/view?usp=drive_link',
    tutorialPortal: 'https://drive.google.com/file/d/1e8ZJsg0sANdgNxTH6LRJrYcXeeYq5lkW/view?usp=drive_link',
    formInfra: 'http://bit.ly/4lTvSDi',
    formIndicacao: 'https://docs.google.com/forms/d/e/1FAIpQLSf7lq9zLElgDAm89SjASwnaayX4R1aHh8hPbwQuvoSZ2OxxSw/viewform',
    formPrestador: 'http://bit.ly/46fXJJf',
    formMentor: 'https://docs.google.com/forms/d/e/1FAIpQLScqtYgGtyXOoeLE_AL5chSgu1Y7HcuCn3c2Euwa2_3g29221g/viewform',
    formEvidencias: 'http://bit.ly/4neHwdk'
  };

  // Salas físicas do polo disponíveis para as aulas presenciais da faculdade.
  const SALAS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Laboratório'];

  // Rótulo do semestre de ingresso da turma, a partir da fase. O calendário cobre ago–dez/2026:
  // fase 1 = planilha "1º Semestre" = turma que ingressou agora, em 2026.2 (está no seu 1º semestre do curso);
  // fase 2 = planilha "2º Semestre" = turma que ingressou em 2026.1 (já está no seu 2º semestre do curso).
  const COORTE = { 1: '2026.2', 2: '2026.1' };
  function coorte(fase) { return COORTE[fase] || ''; }

  // live: dia da semana das lives (JS getDay). Terça=2, Quinta=4 (Fluxo do Semipresencial).
  const CURSOS = {
    'biomedicina': { nome: 'Biomedicina', curto: 'Biomed', live: 2 },
    'farmacia': { nome: 'Farmácia', curto: 'Farmácia', live: 2 },
    'nutricao': { nome: 'Nutrição', curto: 'Nutrição', live: 2 },
    'fisioterapia': { nome: 'Fisioterapia', curto: 'Fisio', live: 2 },
    'terapia ocupacional': { nome: 'Terapia Ocupacional', curto: 'TO', live: 2 },
    'radiologia': { nome: 'Radiologia', curto: 'Radio', live: 2 },
    'estetica e cosmetica': { nome: 'Estética e Cosmética', curto: 'Estética', live: 2 },
    'estetica': { nome: 'Estética e Cosmética', curto: 'Estética', live: 2 },
    'educacao fisica licenciatura': { nome: 'Educação Física (Licenciatura)', curto: 'EF Lic.', live: 2 },
    'educacao fisica bacharelado': { nome: 'Educação Física (Bacharelado)', curto: 'EF Bach.', live: 2 },
    'educacao fisica': { nome: 'Educação Física', curto: 'EF', live: 2 },
    'pedagogia': { nome: 'Pedagogia', curto: 'Pedagogia', live: 4 },
    'psicopedagogia': { nome: 'Psicopedagogia', curto: 'Psicoped.', live: 4 },
    'servico social': { nome: 'Serviço Social', curto: 'Serv. Social', live: 4 }
  };

  const PROF_ALIAS = { marcelo: 'Marcelo', marcos: 'Marcos', michelle: 'Michele', michele: 'Michele', olavo: 'Olavo', rafael: 'Rafael', vitor: 'Vitor', victor: 'Vitor', fabricio: 'Fabrício' };

  /* ---------- Utilitários ---------- */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromIso(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((fromIso(b) - fromIso(a)) / 86400000); }
  function weekday(s) { return fromIso(s).getDay(); }
  function mondayOf(s) { const w = weekday(s); return addDays(s, w === 0 ? -6 : 1 - w); }
  function fmtCurta(s) { const p = s.split('-'); return p[2] + '/' + p[1]; }
  // Não se trabalha aos domingos: "a véspera útil" de uma data pula o domingo (ex.: aula de segunda → véspera é sábado, não domingo).
  function vesperaUtil(iso_) { const v = addDays(iso_, -1); return weekday(v) === 0 ? addDays(iso_, -2) : v; }

  /* ---------- Práticas EAD (encontros de prática dos alunos EAD no polo) ---------- */
  function lembretesPraticas(itens, hoje) {
    const out = [];
    (itens || []).forEach(function (p) {
      const dias = diffDays(hoje, p.data);
      if (dias >= 0 && dias <= 7) out.push({ tipo: 'materiais', p: p, dias: dias, texto: 'Conferir se os materiais da prática chegaram', quando: dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias > 1 ? 's' : '') });
      if (dias >= 0 && dias <= 2) out.push({ tipo: 'lembrar', p: p, dias: dias, texto: 'Avisar o professor da prática', quando: dias === 0 ? 'hoje' : (dias === 1 ? 'amanhã' : 'em 2 dias') });
      if (dias >= -3 && dias <= -1) out.push({ tipo: 'evidencias', p: p, dias: dias, texto: 'Cobrar evidências da prática', quando: dias === -1 ? 'ontem' : 'há ' + (-dias) + ' dias' });
    });
    return out.sort(function (a, b) { return Math.abs(a.dias) - Math.abs(b.dias); });
  }
  function mensagemPratica(p, opts) {
    opts = opts || {};
    const linhas = function (arr) { return (arr || []).map(function (x) { return '- ' + x; }).join('\n'); };
    const nome = opts.prof ? 'Olá, ' + opts.prof + '! Tudo bem?' : 'Olá! Tudo bem?';
    let t = nome + '\n\nPrática de EAD (' + (opts.curso || 'Biomedicina') + '): ' + p.tema + '\nData: ' + fmtLonga(p.data) + (p.hora ? ', ' + p.hora : '') + '\n\n';
    t += 'Antes da aula:\n1) Assista à capacitação: ' + p.video + '\n2) Leia o material da prática (PAP): ' + p.pap + '\n';
    if (p.polo && p.polo.length) t += '\nO polo providencia:\n' + linhas(p.polo) + '\n';
    if (p.sede && p.sede.length) t += '\nA UniFECAF envia (para cada 10 alunos):\n' + linhas(p.sede) + '\n';
    t += '\nOs alunos levam jaleco.\n\nDepois da aula, envie as evidências: 3 fotos dos alunos, vídeo de 1 a 3 minutos, lista de presença, número de alunos e a nota que você dá para a aula.';
    if (opts.assinatura) t += '\n\n' + opts.assinatura;
    return t;
  }

  function fmtLonga(s) { const d = fromIso(s); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function fmtBR(s) { const p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function ultimoDia(ano, mes) { return new Date(ano, mes, 0).getDate(); } // mes 1-12
  function hhmm(min) { if (min == null) return ''; const h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? pad(m) : ''); }
  function faixa(ini, fim) { return ini == null ? '' : hhmm(ini) + (fim != null ? '–' + hhmm(fim) : ''); }

  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, function (_, i) { return i; });
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /* ---------- Parsers ---------- */
  function parseDatas(str, ano) {
    const out = []; const re = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g; let m;
    while ((m = re.exec(String(str || '')))) {
      let y = m[3] ? Number(m[3]) : ano; if (y < 100) y += 2000;
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (d.getMonth() === Number(m[2]) - 1) out.push(iso(d));
    }
    return out;
  }
  function parseDia(str) {
    const n = norm(str).replace(/-?feira/g, '').trim(); if (!n) return null;
    const nomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']; // índice = getDay
    let best = null, bd = 9;
    nomes.forEach(function (nm, i) { const d = lev(n, nm); if (d < bd) { bd = d; best = i; } });
    return bd <= 2 ? best : null;
  }
  function parseHorario(str) {
    const t = []; const re = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?/gi; let m; const s = String(str || '');
    while ((m = re.exec(s))) t.push(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
    return t.length >= 2 ? { ini: t[0], fim: t[1] } : (t.length === 1 ? { ini: t[0], fim: null } : null);
  }
  function parseMes(str) { const n = norm(str); const i = MESES.findIndex(function (m) { return norm(m) === n; }); return i < 0 ? null : i + 1; }
  function titulo(s) { return String(s || '').trim().split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }
  function profCanon(name) {
    const n = norm(name); if (!n) return '';
    if (PROF_ALIAS[n]) return PROF_ALIAS[n];
    const first = n.split(' ')[0]; if (PROF_ALIAS[first]) return PROF_ALIAS[first];
    return titulo(name);
  }
  function cursoInfo(raw) {
    const k = norm(raw); if (CURSOS[k]) return CURSOS[k];
    const nome = titulo(String(raw || '').toLowerCase());
    return { nome: nome, curto: nome, live: 2 };
  }
  function faixaTurno(ini) { if (ini == null) return 'definir'; return ini < 12 * 60 ? 'manha' : (ini < 18 * 60 ? 'tarde' : 'noite'); }

  /* ---------- Linhas da planilha → aulas ---------- */
  const COLS = ['curso', 'semestre', 'mes', 'disciplina', 'dia', 'datas', 'horario', 'professor', 'sala'];
  function fromRows(rows, opts) {
    const ano = (opts && opts.ano) || 2026;
    return rows.map(function (r, idx) {
      const ci = cursoInfo(r.curso), ds = parseDatas(r.datas, ano), hr = parseHorario(r.horario);
      const fase = parseInt(String(r.semestre || '').replace(/\D/g, ''), 10) || 1;
      return {
        id: r.id || ('a' + (idx + 1)), row: r,
        curso: ci.nome, cursoCurto: ci.curto, live: ci.live, fase: fase, semestre: r.semestre || '', coorte: coorte(fase),
        mes: parseMes(r.mes), mesTxt: r.mes || '',
        disc: String(r.disciplina || '').trim(), diaTxt: r.dia || '', datasTxt: r.datas || '',
        datas: ds, ini: hr ? hr.ini : null, fim: hr ? hr.fim : null, horarioTxt: r.horario || '',
        prof: profCanon(r.professor), sala: String(r.sala || '').trim()
      };
    });
  }
  function toRows(aulas) { return aulas.map(function (a) { const o = {}; COLS.forEach(function (c) { o[c] = a.row[c] || ''; }); if (a.row.id) o.id = a.row.id; return o; }); }

  function eventos(aulas) {
    const ev = [];
    aulas.forEach(function (a) {
      a.datas.forEach(function (d, i) {
        ev.push({ aulaId: a.id, iso: d, n: i + 1, curso: a.curso, cursoCurto: a.cursoCurto, disc: a.disc, prof: a.prof, ini: a.ini, fim: a.fim, fase: a.fase, coorte: a.coorte, mes: a.mes, sala: a.sala });
      });
    });
    return ev.sort(function (x, y) { return x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : ((x.ini || 0) - (y.ini || 0)); });
  }
  // Aulas iguais (mesma data, horário, disciplina e professor) em cursos diferentes viram uma só.
  function agrupar(evs) {
    const map = new Map();
    evs.forEach(function (e) {
      const key = [e.iso, e.ini, e.fim, norm(e.disc), e.prof].join('|');
      if (!map.has(key)) map.set(key, { key: key, iso: e.iso, ini: e.ini, fim: e.fim, disc: e.disc, prof: e.prof, n: e.n, cursos: [], cursosCurto: [], aulaIds: [], fases: [], coortes: [], sala: e.sala || '' });
      const g = map.get(key);
      if (g.cursos.indexOf(e.curso) < 0) { g.cursos.push(e.curso); g.cursosCurto.push(e.cursoCurto); }
      g.aulaIds.push(e.aulaId); if (g.fases.indexOf(e.fase) < 0) g.fases.push(e.fase);
      if (e.coorte && g.coortes.indexOf(e.coorte) < 0) g.coortes.push(e.coorte);
      if (!g.sala && e.sala) g.sala = e.sala;
    });
    return Array.from(map.values()).sort(function (x, y) { return x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : ((x.ini || 0) - (y.ini || 0)); });
  }

  /* ---------- Conferência ---------- */
  // Chave da disciplina sem o nome do curso ("Biomedicina 360°" e "Farmácia 360°" são a mesma aula conjunta).
  function discChave(a) { return norm(a.disc).split(norm(a.curso)).join('').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function overlap(a, b) { return a.ini != null && b.ini != null && a.ini < (b.fim != null ? b.fim : b.ini + DURACAO_PADRAO) && b.ini < (a.fim != null ? a.fim : a.ini + DURACAO_PADRAO); }

  /* Dia e turno habituais de cada turma (regra informada pela coordenação). 0=dom … 6=sáb; 'manha' = 8h–11h30, 'noite' = 18h30–22h */
  const PADRAO = {
    1: { 'Biomedicina': [6, 'manha'], 'Farmácia': [6, 'manha'], 'Pedagogia': [2, 'noite'], 'Psicopedagogia': [2, 'noite'], 'Terapia Ocupacional': [3, 'noite'], 'Fisioterapia': [3, 'noite'], 'Nutrição': [6, 'manha'], 'Educação Física (Licenciatura)': [3, 'noite'], 'Educação Física (Bacharelado)': [3, 'noite'] },
    2: { 'Biomedicina': [1, 'noite'], 'Farmácia': [1, 'noite'], 'Pedagogia': [6, 'manha'], 'Psicopedagogia': [6, 'manha'], 'Terapia Ocupacional': [6, 'manha'], 'Fisioterapia': [6, 'manha'], 'Nutrição': [1, 'noite'], 'Educação Física (Licenciatura)': [3, 'noite'], 'Educação Física (Bacharelado)': [3, 'noite'] }
  };

  /* Feriados nacionais de 2026 (sem aula). Confira feriados estaduais/municipais do polo e acrescente aqui se precisar. */
  const FERIADOS = {
    '2026-01-01': 'Confraternização Universal', '2026-02-17': 'Carnaval (terça)', '2026-04-03': 'Sexta-feira Santa', '2026-04-21': 'Tiradentes',
    '2026-05-01': 'Dia do Trabalho', '2026-06-04': 'Corpus Christi', '2026-09-07': 'Independência', '2026-10-12': 'Nossa Senhora Aparecida',
    '2026-11-02': 'Finados', '2026-11-15': 'Proclamação da República', '2026-11-20': 'Consciência Negra', '2026-12-25': 'Natal'
  };

  function auditar(aulas) {
    const out = [];
    function add(a, tipo, sev, msg, dica, extra) {
      const ds = a.datas.slice().sort();
      out.push(Object.assign({ id: a.id + ':' + tipo + ':' + out.length, aulaId: a.id, aulaIds: [a.id], aulaTxt: a.disc + ' · ' + a.cursoCurto, tipo: tipo, sev: sev, msg: msg, dica: dica || '', iso: ds[0] || '9999-99-99', fim: ds[ds.length - 1] || '9999-99-99' }, extra || {}));
    }
    aulas.forEach(function (a) {
      const diaInf = a.diaTxt ? parseDia(a.diaTxt) : null;
      if (a.datas.length !== 2) add(a, 'datas', 'erro', a.datas.length + ' data(s) reconhecida(s) em "' + a.datasTxt + '"', 'São 2 encontros por mês, quinzenais.');
      a.datas.forEach(function (d) {
        if (a.mes && Number(d.slice(5, 7)) !== a.mes) add(a, 'mes', 'erro', fmtCurta(d) + ' está fora do mês de ' + a.mesTxt.toLowerCase(), 'Confira se a data foi copiada de outra linha.');
        if (diaInf != null && weekday(d) !== diaInf) add(a, 'dia', 'erro', fmtCurta(d) + ' cai em ' + DIAS[weekday(d)] + ', mas a planilha diz "' + a.diaTxt.trim() + '"', 'Corrija o dia da semana ou a data.');
        if (FERIADOS[d]) add(a, 'feriado', 'erro', fmtCurta(d) + ' é feriado (' + FERIADOS[d] + ')', 'Não pode haver aula em feriado.');
        if (weekday(d) === a.live) add(a, 'live', 'atencao', fmtCurta(d) + ' é dia de live do curso (' + DIAS[a.live] + ')', 'O presencial não pode coincidir com os dias das lives.');
      });
      if (a.datas.length === 2) {
        const gap = diffDays(a.datas[0], a.datas[1]);
        const dezembro = Number(a.datas[0].slice(5, 7)) === 12 && Number(a.datas[1].slice(5, 7)) === 12;
        if (gap <= 0) add(a, 'intervalo', 'erro', 'O 2º encontro (' + fmtCurta(a.datas[1]) + ') não vem depois do 1º (' + fmtCurta(a.datas[0]) + ')', 'Confira se uma das datas foi digitada errada.');
        else if (gap === 7 && dezembro) { /* dezembro: por causa das férias, alguns encontros ficam em semanas seguidas em vez de quinzenais */ }
        else if (gap !== 14) add(a, 'intervalo', 'atencao', gap + ' dias entre os dois encontros', 'Os encontros são quinzenais (14 dias).');
      }
      if (!a.diaTxt) add(a, 'sem-dia', 'atencao', 'Sem dia da semana informado');
      if (a.ini == null) add(a, 'sem-horario', 'atencao', 'Sem horário definido', 'Padrão: 18h30–22h (dia de semana) ou 8h–11h30 (sábado).');
      else {
        if (a.fim != null && a.fim - a.ini !== DURACAO_PADRAO) add(a, 'duracao', 'atencao', 'Duração de ' + hhmm(a.fim - a.ini) + ' (o padrão é 3h30)');
        const dias = a.datas.map(weekday);
        if (dias.length && dias.every(function (w) { return w >= 1 && w <= 5; }) && a.ini < 12 * 60) add(a, 'turno', 'atencao', 'Horário de manhã (' + faixa(a.ini, a.fim) + ') em dia de semana');
        if (dias.length && dias.every(function (w) { return w === 6; }) && a.ini >= 18 * 60) add(a, 'turno', 'atencao', 'Horário noturno no sábado (' + faixa(a.ini, a.fim) + ')');
        if (dias.length && dias.every(function (w) { return w === 6; }) && a.ini >= 11 * 60 && a.ini < 18 * 60) add(a, 'turno', 'atencao', 'Sábado a partir de ' + hhmm(a.ini) + ' (o padrão é 8h–11h30)');
      }
      a.datas.forEach(function (d) {
        if (d > '2026-12-21' && d <= '2026-12-31') add(a, 'limite', 'atencao', fmtCurta(d) + ' passa do limite de 21/12 para as aulas de dezembro', 'A coordenação definiu que as aulas de dezembro terminam até 21/12.');
      });
      const pad = PADRAO[a.fase] && PADRAO[a.fase][a.curso];
      if (pad && a.datas.length && a.ini != null) {
        const turno = a.ini < 12 * 60 ? 'manha' : (a.ini >= 18 * 60 ? 'noite' : 'outro');
        const fora = a.datas.some(function (d) { return weekday(d) !== pad[0]; }) || turno !== pad[1];
        if (fora) add(a, 'padrao', 'atencao', 'Fora do dia e horário habituais da turma (' + DIAS[pad[0]] + ', ' + (pad[1] === 'manha' ? '8h–11h30' : '18h30–22h') + ')', 'Só monte aula conjunta se os cursos já têm aula nesse mesmo dia e horário.');
      }
      if (!a.prof) add(a, 'sem-prof', 'atencao', 'Sem professor responsável', 'Indique um tutor e peça os formulários de cadastro.');
    });
    // Professor em duas aulas diferentes ao mesmo tempo (mesma disciplina em cursos diferentes = aula conjunta)
    const porProfData = {};
    aulas.forEach(function (a) { if (!a.prof) return; a.datas.forEach(function (d) { (porProfData[a.prof + '|' + d] = porProfData[a.prof + '|' + d] || []).push(a); }); });
    const conf = {};
    Object.keys(porProfData).forEach(function (k) {
      const lista = porProfData[k], d = k.split('|')[1];
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
        const x = lista[i], y = lista[j], kx = discChave(x), ky = discChave(y);
        if (kx === ky || !overlap(x, y)) continue;
        const key = k.split('|')[0] + '|' + d + '|' + [kx, ky].sort().join('~');
        const c = conf[key] = conf[key] || { prof: x.prof, d: d, lados: {}, ids: [] };
        [x, y].forEach(function (a) {
          const kk = discChave(a); const l = c.lados[kk] = c.lados[kk] || { disc: a.disc, cursos: [], aulaIds: [] };
          if (l.cursos.indexOf(a.curso) < 0) l.cursos.push(a.curso);
          if (l.aulaIds.indexOf(a.id) < 0) l.aulaIds.push(a.id);
          if (c.ids.indexOf(a.id) < 0) c.ids.push(a.id);
        });
      }
    });
    const porId = {}; aulas.forEach(function (a) { porId[a.id] = a; });
    Object.keys(conf).forEach(function (key) {
      const c = conf[key], lados = Object.keys(c.lados).map(function (k) { return c.lados[k]; });
      const txt = lados.map(function (l) { return '"' + l.disc + '" (' + l.cursos.join(', ') + ')'; }).join(' e ');
      add(porId[c.ids[0]], 'conflito-prof', 'erro', c.prof + ' está em duas aulas ao mesmo tempo em ' + fmtCurta(c.d) + ': ' + txt, 'Troque o professor ou o horário de uma delas.', { aulaIds: c.ids, lados: lados, aulaTxt: c.prof + ' em duas aulas ao mesmo tempo', iso: c.d, fim: c.d });
    });
    // Salas: o polo tem 3 salas para a faculdade (sala 4, sala 5, laboratório). Cada "aula física" (aula
    // conjunta de vários cursos conta como uma só) ocupa uma sala; duas aulas físicas diferentes não podem
    // ficar na mesma sala no mesmo horário, e não pode haver mais aulas simultâneas do que salas.
    const porDia = {};
    aulas.forEach(function (a) { a.datas.forEach(function (d) { (porDia[d] = porDia[d] || []).push(a); }); });
    Object.keys(porDia).forEach(function (d) {
      const fisicas = [];
      porDia[d].forEach(function (a) {
        const kk = discChave(a);
        let f = fisicas.filter(function (x) { return x.k === kk; }).find(function (x) { return overlap(x, a); });
        if (!f) { f = { k: kk, ini: a.ini, fim: a.fim, disc: a.disc, cursos: [], aulaIds: [], salas: [] }; fisicas.push(f); }
        if (f.cursos.indexOf(a.curso) < 0) f.cursos.push(a.curso);
        f.aulaIds.push(a.id);
        if (a.sala && f.salas.indexOf(a.sala) < 0) f.salas.push(a.sala);
      });
      for (let i = 0; i < fisicas.length; i++) for (let j = i + 1; j < fisicas.length; j++) {
        const x = fisicas[i], y = fisicas[j];
        if (x.k === y.k || !overlap(x, y)) continue;
        const comum = x.salas.filter(function (s) { return y.salas.indexOf(s) >= 0; });
        if (comum.length) {
          add(porId[x.aulaIds[0]], 'conflito-sala', 'erro', '"' + x.disc + '" e "' + y.disc + '" estão marcadas na mesma sala (' + comum.join(', ') + ') em ' + fmtCurta(d) + ', no mesmo horário', 'Troque a sala de uma das duas aulas.', { aulaIds: x.aulaIds.concat(y.aulaIds), iso: d, fim: d, aulaTxt: 'Duas aulas na mesma sala' });
        }
      }
      // Agrupa aulas físicas em janelas de horário que se sobrepõem, para checar se sobram salas.
      const clusters = [];
      fisicas.forEach(function (f) {
        let c = clusters.find(function (c) { return c.some(function (x) { return overlap(x, f); }); });
        if (!c) { c = []; clusters.push(c); }
        c.push(f);
      });
      clusters.forEach(function (c) {
        if (c.length > SALAS.length) {
          add(porId[c[0].aulaIds[0]], 'sala-capacidade', 'atencao',
            c.length + ' aulas ao mesmo tempo em ' + fmtCurta(d) + ' (' + c.map(function (f) { return '"' + f.disc + '"'; }).join(', ') + '), mas o polo só tem ' + SALAS.length + ' salas (' + SALAS.join(', ') + ')',
            'Remaneje uma das aulas para outro dia ou horário, ou confirme se alguma delas é remota.',
            { aulaIds: [].concat.apply([], c.map(function (f) { return f.aulaIds; })), iso: d, fim: d, aulaTxt: 'Mais aulas do que salas disponíveis' });
        }
      });
    });
    const peso = { erro: 0, atencao: 1 };
    return out.sort(function (a, b) { return peso[a.sev] - peso[b.sev] || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0); });
  }

  /* ---------- Prazos do ciclo mensal (FAQ, Manual e Fluxo do Semipresencial) ---------- */
  function prazosDoMes(ano, mes) {
    const ym = ano + '-' + pad(mes), ult = ultimoDia(ano, mes);
    const d = function (n) { return ym + '-' + pad(n); };
    return [
      { id: 'prova', ym: ym, iso: d(1), fim: d(15), titulo: 'Provas presenciais da disciplina do mês anterior',
        detalhe: 'O polo define dias e horários, agenda no UniFECAF Polos e avisa os alunos. A prova só é liberada no AVA quando o aluno chega ao polo. Até 3h, sem consulta.', fonte: 'FAQ 14–16 · Manual' },
      { id: 'nota-sub', ym: ym, iso: d(10), titulo: 'Nota da prova substitutiva do mês anterior',
        detalhe: 'A sede divulga a nota até o dia 10. Confira se saiu.', fonte: 'FAQ 22' },
      { id: 'sub', ym: ym, iso: d(16), fim: d(25), titulo: 'Provas substitutivas (R$ 80,00)',
        detalhe: 'O aluno pede pelo Mentor (protocolo 388) e faz a prova no polo entre os dias 16 e 25.', fonte: 'FAQ 21 · Manual' },
      { id: 'corte-matricula', ym: ym, iso: d(20), titulo: 'Corte de matrículas para abrir turma',
        detalhe: '15 matrículas confirmadas até o dia 20 abrem turma no mês seguinte; depois disso, a abertura vai para o mês subsequente. Após a confirmação, o tutor é capacitado em até 10 dias corridos.', fonte: 'Fluxo do Semi' },
      { id: 'corte-semi', ym: ym, iso: d(26), titulo: 'Corte do time do Semi: definição das turmas',
        detalhe: 'Polo sem turma: avisar os alunos da migração automática de eixo. Polo com turma: informar dia, hora e tutor da disciplina presencial.', fonte: 'FAQ 2' },
      { id: 'gabarito', ym: ym, iso: d(ult), titulo: 'Gabaritos e notas das provas no AVA',
        detalhe: 'A sede divulga até o último dia do mês da aplicação. Se não saiu, acione o Relacionamento com Polos.', fonte: 'FAQ 20 · Manual' }
    ].sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
  }

  // Lembretes por aula: materiais 7 dias antes (a sede envia insumos com até 7 dias de antecedência), professor 1 dia antes, evidências depois.
  function lembretes(grupos, hoje) {
    const out = [];
    grupos.forEach(function (g) {
      const dias = diffDays(hoje, g.iso);
      const diaPreparo = diffDays(hoje, vesperaUtil(g.iso));
      if (dias >= 0 && dias <= 7) out.push({ tipo: 'materiais', grupo: g, dias: dias, texto: 'Conferir materiais e insumos', quando: dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias > 1 ? 's' : '') });
      if (dias >= 0 && dias <= 2) out.push({ tipo: 'lembrar', grupo: g, dias: dias, texto: 'Lembrar o professor', quando: dias === 0 ? 'hoje' : (dias === 1 ? 'amanhã' : 'em 2 dias') });
      if (diaPreparo === 0) out.push({ tipo: 'preparo', grupo: g, dias: 0, texto: 'Perguntar se precisa imprimir/separar algo', quando: 'hoje (véspera)' });
      if (dias >= -3 && dias <= -1) out.push({ tipo: 'evidencias', grupo: g, dias: dias, texto: 'Cobrar evidências e presença', quando: dias === -1 ? 'ontem' : 'há ' + (-dias) + ' dias' });
      if (dias >= -3 && dias <= 0) out.push({ tipo: 'checklist', grupo: g, dias: dias, texto: 'Conferir checklist da aula (chamada, fotos, vídeo)', quando: dias === 0 ? 'hoje' : dias === -1 ? 'ontem' : 'há ' + (-dias) + ' dias' });
    });
    return out.sort(function (a, b) { return Math.abs(a.dias) - Math.abs(b.dias); });
  }

  /* ---------- Contatos e mensagens ---------- */
  function parseContatos(texto) {
    const out = {};
    String(texto || '').split(/\n|\/|;/).forEach(function (linha) {
      const dig = linha.replace(/\D/g, ''); if (dig.length < 10) return;
      const nome = linha.replace(/[\d()+\-\s:;|]+$/, '').replace(/^[\s\-•*]+/, '').trim(); if (!nome) return;
      out[profCanon(nome)] = fmtTel(dig);
    });
    return out;
  }
  function fmtTel(dig) {
    let d = String(dig).replace(/\D/g, ''); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return dig;
  }
  function waUrl(tel, texto) {
    let d = String(tel || '').replace(/\D/g, ''); if (!d) return '';
    if (!d.startsWith('55')) d = '55' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto || '');
  }
  function primeiroNome(n) { return String(n || '').split(' ')[0]; }

  function mensagens(g, cfg) {
    const ass = (cfg && cfg.assinatura) || 'Coordenação Acadêmica — Polo 1740';
    const nome = primeiroNome(g.prof) || 'professor(a)';
    const cursos = g.cursos.join(', ');
    const quando = fmtLonga(g.iso) + ' (' + fmtCurta(g.iso) + ')';
    const hora = faixa(g.ini, g.fim) || 'horário a confirmar';
    return [
      { id: 'lembrete', label: 'Lembrar da aula', texto:
        'Olá, ' + nome + '! Tudo bem?\n\nPassando para lembrar da aula presencial:\n\n' +
        'Disciplina: ' + g.disc + '\nCurso(s): ' + cursos + '\nData: ' + quando + '\nHorário: ' + hora + '\n\n' +
        'O material instrutivo e a lista de materiais por disciplina estão no portal: ' + LINKS.portal + '\n' +
        'Você confirma presença?\n\n' + ass },
      { id: 'materiais', label: 'Conferir materiais', texto:
        'Olá, ' + nome + '! A aula de "' + g.disc + '" (' + cursos + ') está marcada para ' + quando + '.\n\n' +
        'Você já conferiu a lista de materiais e o material instrutivo dessa disciplina? ' + LINKS.portal + '\n' +
        'Se faltar algum item ou houver dúvida sobre as oficinas, me avise com antecedência para eu resolver.\n\n' + ass },
      { id: 'preparo', label: 'Perguntar se precisa de algo', texto:
        'Olá, ' + nome + '! A aula de "' + g.disc + '" (' + cursos + ') está chegando: ' + quando + ', ' + hora + '.\n\n' +
        'Precisa que eu imprima ou separe alguma coisa para a aula (material, formulário, equipamento)? Me avise para eu providenciar a tempo.\n\n' + ass },
      { id: 'evidencias', label: 'Cobrar evidências e presença', texto:
        'Olá, ' + nome + '! Agradeço pela aula de "' + g.disc + '" em ' + fmtCurta(g.iso) + '.\n\n' +
        'Dois lembretes:\n1) Registrar a presença dos alunos no Mentor.\n2) Enviar as evidências da atividade pelo formulário: ' + LINKS.formEvidencias + ' — é a comprovação oficial para o pagamento.\n\n' + ass },
      { id: 'remarcar', label: 'Propor remarcação', texto:
        'Olá, ' + nome + '! Preciso ajustar o calendário da disciplina "' + g.disc + '" (' + cursos + '), hoje marcada para ' + quando + ', ' + hora + '.\n\n' +
        'Você consegue em [NOVA DATA] no mesmo horário? Lembrando que o presencial não pode coincidir com o dia das lives do curso.\n\n' + ass }
    ];
  }
  function msgCadastro(prof, status, cfg) {
    const ass = (cfg && cfg.assinatura) || 'Coordenação Acadêmica — Polo 1740';
    const s = status || {}; const falta = [];
    if (!s.indicacao) falta.push('Indicação de tutor: ' + LINKS.formIndicacao);
    if (!s.prestador) falta.push('Cadastro de prestador de serviços (DP): ' + LINKS.formPrestador);
    if (!s.mentor) falta.push('Cadastro no Mentor (onde você faz a chamada): ' + LINKS.formMentor);
    if (!falta.length && s.capacitado) return 'Olá, ' + primeiroNome(prof) + '! Seu cadastro e sua capacitação estão em dia. Obrigada pelo trabalho!\n\n' + ass;
    let t = 'Olá, ' + primeiroNome(prof) + '! Para você seguir como tutor do Semipresencial, preciso destes itens:\n\n';
    if (falta.length) t += falta.map(function (x, i) { return (i + 1) + ') ' + x; }).join('\n') + '\n\n';
    if (!s.capacitado) t += (falta.length ? falta.length + 1 : 1) + ') Capacitação do tutor (ementa, competências e atividades presenciais): me diga dois horários em que você consegue.\n\n';
    return t + ass;
  }

  /* ---------- Agenda .ics ---------- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    const out = []; let s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s); return out.join('\r\n');
  }
  function ics(grupos, nomeCal) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Painel Semipresencial 1740//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(nomeCal || 'Aulas presenciais · Polo 1740'), 'X-WR-TIMEZONE:America/Sao_Paulo'];
    const stamp = iso(new Date()).replace(/-/g, '') + 'T000000Z';
    grupos.forEach(function (g) {
      const ymd = g.iso.replace(/-/g, '');
      const t = function (min) { return pad(Math.floor(min / 60)) + pad(min % 60) + '00'; };
      const ini = g.ini != null ? g.ini : 18 * 60 + 30, fim = g.fim != null ? g.fim : ini + DURACAO_PADRAO;
      L.push('BEGIN:VEVENT', 'UID:' + ymd + '-' + ini + '-' + norm(g.disc).replace(/[^a-z0-9]/g, '').slice(0, 24) + '-' + norm(g.prof).replace(/[^a-z0-9]/g, '') + '@painel-semi-1740',
        'DTSTAMP:' + stamp, 'DTSTART:' + ymd + 'T' + t(ini), 'DTEND:' + ymd + 'T' + t(fim),
        icsFold('SUMMARY:' + icsEsc(g.disc + ' · ' + g.cursosCurto.join(', '))),
        icsFold('DESCRIPTION:' + icsEsc('Professor: ' + (g.prof || 'a definir') + '\nCursos: ' + g.cursos.join(', ') + '\nEncontro ' + g.n + ' do mês' + (g.ini == null ? '\nHorário a confirmar' : ''))),
        'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }

  /* ---------- Planilha ↔ linhas ---------- */
  const CABECALHO = ['Curso', 'Semestre', 'Mês', 'Disciplina', 'Dia da Semana', 'Data das aulas', 'Horário', 'Professor Responsável', 'Telefone', 'Email', 'Preencheu formulário', 'Capacitado?', 'Sala'];
  function lerLinhasPlanilha(matriz) {
    // matriz: array de arrays (primeira linha = cabeçalho). Reconhece colunas pelo nome.
    if (!matriz.length) return [];
    const head = matriz[0].map(norm);
    const col = function (nomes) { for (let i = 0; i < head.length; i++) if (nomes.some(function (n) { return head[i].indexOf(n) === 0; })) return i; return -1; };
    const idx = { curso: 0, semestre: col(['semestre']), mes: col(['mes']), disciplina: col(['disciplina']), dia: col(['dia da semana', 'dia']), datas: col(['data']), horario: col(['horario']), professor: col(['professor']), sala: col(['sala']) };
    if (idx.mes < 0 || idx.disciplina < 0 || idx.datas < 0) throw new Error('Não encontrei as colunas Mês, Disciplina e Data das aulas. Use o mesmo modelo das planilhas do polo.');
    const get = function (r, i) { return i < 0 || r[i] == null ? '' : String(r[i]).replace(/\s+/g, ' ').trim(); };
    return matriz.slice(1).filter(function (r) { return r && get(r, idx.mes) && get(r, idx.disciplina); }).map(function (r) {
      const o = {}; Object.keys(idx).forEach(function (k) { o[k] = get(r, idx[k]); }); return o;
    });
  }

  /* ---------- Matrículas (lista de alunos da sede: RA, Nome, Curso, Entrada/eixo, Turma) ----------
     "Entrada" é o código de eixo (ex.: S.2026.2C = entrou em setembro/2026). Quando uma turma não fecha
     as 15 matrículas até o corte, a sede realoca automaticamente o aluno para o eixo seguinte — por isso
     o mesmo aluno pode aparecer com dois códigos de Entrada/Turma diferentes na mesma exportação; o mais
     recente é o vínculo atual. Linhas totalmente repetidas (mesmo RA, Entrada e Turma) são só duplicidade
     da exportação, não realocação. */
  const MES_LETRA = 'ABCDEF';
  function parseEixo(codigo) {
    const m = String(codigo || '').trim().match(/^[A-Z]\.(\d{4})\.([12])([A-F])$/i);
    if (!m) return null;
    const ano = parseInt(m[1], 10), sem = parseInt(m[2], 10), letra = m[3].toUpperCase(), idx = MES_LETRA.indexOf(letra);
    return { codigo: codigo, ano: ano, sem: sem, letra: letra, mes: sem === 1 ? idx + 1 : idx + 7, ord: ano * 100 + sem * 10 + idx };
  }
  function lerMatriculas(matriz) {
    if (!matriz.length) return [];
    const head = matriz[0].map(norm);
    const col = function (nomes) { for (let i = 0; i < head.length; i++) if (nomes.some(function (n) { return head[i].indexOf(n) === 0; })) return i; return -1; };
    const idx = { ra: col(['ra']), nome: col(['nome']), curso: col(['curso']), entrada: col(['entrada']), turma: col(['turma']) };
    const get = function (r, i) { return i < 0 || r[i] == null ? '' : String(r[i]).replace(/\s+/g, ' ').trim(); };
    return matriz.slice(1).filter(function (r) { return r && get(r, idx.nome); }).map(function (r) {
      return { ra: get(r, idx.ra), nome: get(r, idx.nome), curso: get(r, idx.curso), entrada: get(r, idx.entrada), turma: get(r, idx.turma) };
    });
  }
  // Pares de curso que contam juntos para o corte mínimo de matrículas (regra da coordenação).
  // Cursos fora dessa lista contam sozinhos.
  const PARES_MATRICULA = {
    'Biomedicina': 'Biomedicina + Farmácia', 'Farmácia': 'Biomedicina + Farmácia',
    'Terapia Ocupacional': 'Terapia Ocupacional + Fisioterapia', 'Fisioterapia': 'Terapia Ocupacional + Fisioterapia',
    'Pedagogia': 'Pedagogia + Psicopedagogia', 'Psicopedagogia': 'Pedagogia + Psicopedagogia',
    'Educação Física Licenciatura': 'Educação Física (Lic. + Bach.)', 'Educação Física Bacharelado': 'Educação Física (Lic. + Bach.)'
  };
  function grupoMatricula(curso) { return PARES_MATRICULA[curso] || curso; }
  // Consolida a lista bruta (que pode ter linhas repetidas e realocações) em um aluno por matrícula,
  // mantendo o eixo mais recente, e agrupa por par de curso + semestre de ingresso (2026.1/2026.2) —
  // é nesse nível que a sede aplica o corte mínimo de matrículas para abrir turma (normalmente 15,
  // às vezes 10, conforme a coordenação define no momento).
  function resumoMatriculas(alunos) {
    const porAluno = new Map();
    (alunos || []).forEach(function (a) {
      const chave = a.ra || (norm(a.nome) + '|' + norm(a.curso));
      const eixo = parseEixo(a.entrada);
      const atual = porAluno.get(chave);
      if (!atual) { porAluno.set(chave, Object.assign({}, a, { eixo: eixo, realocado: false })); return; }
      if (atual.entrada === a.entrada && atual.turma === a.turma) return; // duplicata idêntica
      if (eixo && (!atual.eixo || eixo.ord > atual.eixo.ord)) porAluno.set(chave, Object.assign({}, a, { eixo: eixo, realocado: true }));
      else atual.realocado = true;
    });
    const porGrupo = new Map();
    Array.from(porAluno.values()).forEach(function (a) {
      if (!a.eixo) return; // "Entrada" fora do formato esperado (ex.: código antigo) — não dá para saber o semestre
      const grupo = grupoMatricula(a.curso), chave = grupo + '|' + a.eixo.ano + '.' + a.eixo.sem;
      if (!porGrupo.has(chave)) porGrupo.set(chave, { grupo: grupo, sem: a.eixo.sem, coorte: a.eixo.ano + '.' + a.eixo.sem, cursos: [], alunos: [] });
      const g = porGrupo.get(chave);
      if (g.cursos.indexOf(a.curso) < 0) g.cursos.push(a.curso);
      g.alunos.push(a);
    });
    const grupos = Array.from(porGrupo.values()).map(function (g) {
      return Object.assign(g, { total: g.alunos.length, realocados: g.alunos.filter(function (a) { return a.realocado; }).length });
    }).sort(function (a, b) { return a.total - b.total; });
    const semEixo = Array.from(porAluno.values()).filter(function (a) { return !a.eixo; }).length;
    return { totalAlunos: porAluno.size, grupos: grupos, semEixo: semEixo };
  }

  function dataJs(rows, atualizado, extras) {
    return '// Gerado pelo painel em ' + atualizado + '. Substitua este arquivo no repositório para publicar as alterações.\nwindow.CALENDARIO_DATA = ' +
      JSON.stringify(Object.assign({ polo: '1740', atualizado: atualizado }, extras || {}, { rows: rows }), null, 1) + ';\n';
  }

  return {
    PADRAO: PADRAO, FERIADOS: FERIADOS, SALAS: SALAS, coorte: coorte, lembretesPraticas: lembretesPraticas, mensagemPratica: mensagemPratica,
    DIAS: DIAS, DIAS_CURTO: DIAS_CURTO, MESES: MESES, LINKS: LINKS, CURSOS: CURSOS, CABECALHO: CABECALHO, DURACAO_PADRAO: DURACAO_PADRAO,
    norm: norm, esc: esc, pad: pad, iso: iso, fromIso: fromIso, addDays: addDays, diffDays: diffDays, weekday: weekday, mondayOf: mondayOf,
    fmtCurta: fmtCurta, fmtLonga: fmtLonga, fmtBR: fmtBR, ultimoDia: ultimoDia, hhmm: hhmm, faixa: faixa, faixaTurno: faixaTurno,
    parseDatas: parseDatas, parseDia: parseDia, parseHorario: parseHorario, parseMes: parseMes, profCanon: profCanon, cursoInfo: cursoInfo,
    fromRows: fromRows, toRows: toRows, eventos: eventos, agrupar: agrupar, auditar: auditar, prazosDoMes: prazosDoMes, lembretes: lembretes,
    parseContatos: parseContatos, fmtTel: fmtTel, waUrl: waUrl, mensagens: mensagens, msgCadastro: msgCadastro,
    ics: ics, lerLinhasPlanilha: lerLinhasPlanilha, dataJs: dataJs,
    parseEixo: parseEixo, lerMatriculas: lerMatriculas, resumoMatriculas: resumoMatriculas, grupoMatricula: grupoMatricula, vesperaUtil: vesperaUtil
  };
});
