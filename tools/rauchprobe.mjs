/* Rauchprobe: führt den Ablaufcode aus index.html in einem vm-Kontext mit
   nachgebautem Browser und nachgebauter Datenbank aus.

   Geprüft werden
     · Klassik  — kBrett, kAufloesung, kLadefehler, roundOutcome gegen ein
                  erfundenes Spieldokument (Matchball-Lage, Runde 3)
     · Freunde  — dass eine Freundschaftsanfrage erst nach dem Ja beide
                  Seiten einträgt und niemand ungefragt in einer fremden
                  Liste landet

   Es geht um fehlende Bezeichner und um die Schreibvorgänge, die dabei
   herauskommen — nicht um Darstellung. */
import fs from 'fs';
import vm from 'vm';

const h = fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
let src = h.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
// Zeile für Zeile: nur die Funktionen, die wir brauchen, plus Helfer.
// Einfacher: Importe und den Firebase-Start herausnehmen.
src = src.replace(/import\s*\{[\s\S]*?\}\s*from\s*"https:\/\/[^"]*";/g, '')
         .replace(/import\s*\{[^}]*\}\s*from\s*"https:\/\/[^"]*";/g, '');

const stub = new Proxy(function(){}, {
  get: (t,k) => k === Symbol.toPrimitive ? () => 'stub' : stub,
  apply: () => stub, construct: () => stub
});

function el(){
  const e = {
    textContent:'', innerHTML:'', value:'', disabled:false, hidden:false,
    dataset:{}, style:{}, children:[], isConnected:true,
    klassen:new Set(),
    classList:{
      add(...c){ c.forEach(x => e.klassen.add(x)) },
      remove(...c){ c.forEach(x => e.klassen.delete(x)) },
      toggle(c, an){ const soll = an === undefined ? !e.klassen.has(c) : !!an;
                     soll ? e.klassen.add(c) : e.klassen.delete(c) },
      contains(c){ return e.klassen.has(c) }
    },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    querySelectorAll(){ return [] }, querySelector(){ return el() },
    focus(){}, click(){}, setAttribute(){}, getAttribute(){return null},
    closest(){ return null }, scrollIntoView(){}, animate(){ return {finished:Promise.resolve()} }
  };
  return e;
}
const nodes = new Map();
const knoten = id => doc.getElementById(id);   // legt bei Bedarf an
const datenbank = new Map();   // pfad → daten
const schreib = [];            // [art, pfad, daten]
const doc = {
  getElementById: id => { if(!nodes.has(id)) nodes.set(id, el()); return nodes.get(id) },
  querySelector: () => el(), querySelectorAll: () => [],
  createElement: () => el(), addEventListener(){}, body: el(),
  documentElement: el(), visibilityState: 'visible', head: el()
};

const ctx = {
  console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  Promise, Math, JSON, Date, Object, Array, String, Number, Boolean, Map, Set,
  RegExp, Error, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  document: doc, navigator: { onLine:true, serviceWorker: stub },
  location: { href:'', hash:'', search:'' },
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  requestAnimationFrame: f => setTimeout(() => f(performance.now()), 0),
  performance,
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  fetch: () => Promise.resolve({ ok:true, json:()=>Promise.resolve({}) }),
  // Firebase-Ersatz
  initializeApp: stub, getAuth: stub, getFirestore: stub, getMessaging: stub,
  getToken: stub, isSupported: () => Promise.resolve(false),
  onAuthStateChanged(){}, signInAnonymously: stub, signOut: stub,
  GoogleAuthProvider: stub, signInWithPopup: stub, signInWithRedirect: stub,
  getRedirectResult: () => Promise.resolve(null), updateProfile: stub,
  /* Nachgebaute Datenbank: doc() merkt sich den Pfad, die Schreibvorgänge
     landen in db.schreib und lassen sich hinterher nachlesen. */
  doc: (_db, ...teile) => ({ pfad: teile.join("/") }),
  getDoc: ref => Promise.resolve({
    exists: () => datenbank.has(ref?.pfad),
    data:   () => datenbank.get(ref?.pfad)
  }),
  setDoc: (ref, d) => { schreib.push(["set", ref.pfad, d]); datenbank.set(ref.pfad, d); return Promise.resolve() },
  updateDoc: (ref, d) => { schreib.push(["update", ref.pfad, d]); return Promise.resolve() },
  deleteDoc: ref => { schreib.push(["delete", ref.pfad]); datenbank.delete(ref.pfad); return Promise.resolve() },
  collection: stub, query: stub, where: stub, orderBy: stub, limit: stub,
  getDocs: () => Promise.resolve({ docs:[], forEach(){} }),
  onSnapshot: () => (()=>{}), serverTimestamp: () => 0, increment: n => n,
  arrayUnion: stub, arrayRemove: stub, writeBatch: stub, runTransaction: stub,
  deleteField: stub, enableIndexedDbPersistence: stub, Timestamp: stub,
  addDoc: stub, startAfter: stub, documentId: stub
};
ctx.scrollTo = () => {};
ctx.scrollBy = () => {};
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
ctx.matchMedia = () => ({ matches:false, addEventListener(){}, addListener(){} });
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
const run = code => vm.runInContext(code, ctx);
try { run(src); } catch(e){ console.log('Auswertung:', e.constructor.name + ': ' + e.message); }

// Spieldokument nachbauen: Runde 3, beide haben geantwortet, Runden 1+2 gewonnen.
const top = ['A','B','C','D','E','F','G','H','I','J'];
const g = {
  round: 2, status: 'active', players: ['ich','du'],
  names: { ich:{username:'Ich'}, du:{username:'Du'} },
  config: { mode:'classic' },
  rounds: [
    { q:'Frage 1', unit:'', options: top.slice() },
    { q:'Frage 2', unit:'', options: top.slice() },
    { q:'Frage 3', unit:'Punkte', options: top.slice() }
  ],
  answers: {
    r0: { ich:['A','B','C','D','E'], du:['E','D','C','B','A'] },
    r1: { ich:['A','B','C','D','E'], du:['J','I','H','G','F'] },
    r2: { ich:['A','B','C','D','E'], du:['B','A','D','C','E'] }
  },
  scores: { r0:{ich:50,du:10}, r1:{ich:50,du:0} },
  ready: { r2:{} }
};
ctx.__g = g; ctx.__top = top;
run("me = { uid:'ich' }; currentGame = __g; currentGameId = 'spiel1';"
  + "solutionCache.set('spiel1:r0', { top: __top.slice(0,5), values:{} });"
  + "solutionCache.set('spiel1:r1', { top: __top.slice(0,5), values:{} });");

let fehler = 0;
ctx.__brett = null;
const run2 = brett => { ctx.__brett = brett; run("passeBrettEin(__brett)"); };
const run3 = (feld, ziel) => { ctx.__feld = feld; ctx.__ziel = ziel; run("zaehleHoch(__feld, __ziel)"); };
const probe = (name, fn) => {
  try { fn(); console.log('  ok   ', name); }
  catch(e){ fehler++; console.log('  FEHLER', name, '→', e.constructor.name + ': ' + e.message); }
};

console.log('\nKlassik, Runde 3 (Matchball-Pfad):');
probe('roundOutcome(0)', () => { const o = run("roundOutcome(0)"); if (o!=='me') throw new Error('erwartet "me", bekam '+o); });
probe('roundOutcome(1)', () => { const o = run("roundOutcome(1)"); if (o!=='me') throw new Error('erwartet "me", bekam '+o); });
probe('roundOutcome(2) unbewertbar', () => { const o = run("roundOutcome(2)"); if (o!==null) throw new Error('erwartet null, bekam '+o); });
probe('kBrett offen',    () => run("kBrett(2, false)"));
probe('kBrett gesperrt', () => run("kBrett(2, true, 'Beide fertig')"));
probe('kAufloesung',     () => run("kAufloesung(2, { top: __top.slice(0,5), values:{} }, __g.answers.r2.ich, __g.answers.r2.du, false)"));
const gemerkt = {
  match: nodes.get('revMatch')?.textContent,
  titel: nodes.get('revTitle')?.textContent,
  me:    nodes.get('revMe')?.textContent,
  opp:   nodes.get('revOpp')?.textContent
};
probe('kLadefehler',     () => run("kLadefehler(2)"));
probe('loadSolution vorhanden', () => { if (run("typeof loadSolution") !== 'function') throw new Error('fehlt'); });
probe('enterActive vorhanden',  () => { if (run("typeof enterActive")  !== 'function') throw new Error('fehlt'); });

console.log('\nZählwerk und Knopfzustand:');
probe('Zähler steht sofort auf dem Endwert', () => {
  const f = el();
  run3(f, 35);
  if (f.textContent !== 35 && f.textContent !== 0)
    throw new Error('unerwarteter Startwert: ' + f.textContent);
});
probe('Zähler bei null bleibt null', () => {
  const f = el();
  run3(f, 0);
  if (f.textContent !== 0) throw new Error('war ' + f.textContent);
});
probe('Knopf bekommt bereit nur bei voller Liste', () => {
  run("kEntwurf = ['a','b','c','d','e']; kEntwurfRunde = 2");
  run("kBrett(2, false)");
  if (!knoten('btnSubmitList').classList.contains('bereit')) throw new Error('fehlt bei voller Liste');
  run("kEntwurf = ['a',null,null,null,null]; kEntwurfRunde = 2");
  run("kBrett(2, false)");
  if (knoten('btnSubmitList').classList.contains('bereit')) throw new Error('gesetzt bei halber Liste');
  run("kEntwurf = ['a','b','c','d','e']; kEntwurfRunde = 2");
  run("kBrett(2, true, 'Beide fertig')");
  if (knoten('btnSubmitList').classList.contains('bereit')) throw new Error('gesetzt trotz Sperre');
});

console.log('\nEinpassen statt scrollen:');
// Die Attrappe misst nicht wirklich; geprüft wird die Logik der Stufen.
function machBrett(zuEng){
  let ueberlauf = zuEng;
  const kind = () => ({
    get scrollHeight(){ return ueberlauf ? 200 : 100 },
    get clientHeight(){ return 100 }
  });
  const pool = kind(), rows = kind();
  const brett = el();
  brett.querySelector = sel => sel === '.pool' ? pool : sel === '.board-rows' ? rows : null;
  brett.passtAb = n => { brett.stufeGrenze = n; };
  return { brett, engerMachen: () => { ueberlauf = false } };
}
probe('passt sofort: keine Stufe', () => {
  const { brett } = machBrett(false);
  run2(brett);
  if ([...brett.klassen].length) throw new Error('Stufe gesetzt: ' + [...brett.klassen]);
});
probe('passt nie: letzte Stufe', () => {
  const { brett } = machBrett(true);
  run2(brett);
  if (!brett.classList.contains('eng4')) throw new Error('Stufen: ' + [...brett.klassen]);
  if ([...brett.klassen].length !== 1) throw new Error('mehrere Stufen zugleich: ' + [...brett.klassen]);
});
probe('zweiter Aufruf beginnt wieder bei null', () => {
  const { brett, engerMachen } = machBrett(true);
  run2(brett);
  engerMachen();
  run2(brett);
  if ([...brett.klassen].length) throw new Error('Stufe blieb stehen: ' + [...brett.klassen]);
});

console.log('\nRundenbalken und Matchball:');
probe('Balken färbt jede Runde nach Ausgang', () => {
  run("barHTML(2, 'rndBar', 'rndNum')");
  const html = knoten('rndBar').innerHTML;
  const treffer = [...html.matchAll(/class="rnd ([a-z]*)"/g)].map(m => m[1]);
  // Runden 1 und 2 gewonnen, Runde 3 läuft, 4 und 5 offen
  const soll = ['won','won','now','',''];
  if (JSON.stringify(treffer) !== JSON.stringify(soll))
    throw new Error('erwartet ' + JSON.stringify(soll) + ', war ' + JSON.stringify(treffer));
});
probe('Balken zeigt auch verlorene Runden', () => {
  const alt = g.scores;
  g.scores = { r0:{ich:50,du:10}, r1:{ich:0,du:50} };   // Runde 2 verloren
  run("solutionCache.clear()");
  run("barHTML(2, 'rndBar', 'rndNum')");
  const treffer = [...knoten('rndBar').innerHTML.matchAll(/class="rnd ([a-z]*)"/g)].map(m => m[1]);
  g.scores = alt;
  if (treffer[1] !== 'lost') throw new Error('Runde 2 war ' + JSON.stringify(treffer));
});
probe('Matchball erst bei zwei Siegen', () => {
  run("solutionCache.set('spiel1:r0', { top: __top.slice(0,5), values:{} })");
  run("solutionCache.set('spiel1:r1', { top: __top.slice(0,5), values:{} })");
  if (run("matchballWer(1)") !== null) throw new Error('nach einer Runde schon Matchball');
  if (run("matchballWer(2)") !== 'me') throw new Error('nach zwei Siegen kein eigener Matchball');
});
probe('Matchball nicht in Runde 1 und nicht nach dem Spiel', () => {
  if (run("matchballWer(0)") !== null) throw new Error('vor der ersten Runde');
  if (run("matchballWer(5)") !== null) throw new Error('nach der letzten Runde');
});
probe('Einblendung blockiert nichts', () => {
  run("zeigeMatchball(2)");
  const f = knoten('mbFlash');
  if (!f.classList.contains('an')) throw new Error('nicht eingeblendet');
  if (knoten('mbWer').textContent !== 'Dein Matchball')
    throw new Error('Text: ' + knoten('mbWer').textContent);
  // Das Brett muss danach unverändert bedienbar sein
  run("kBrett(2, false)");
  if (knoten('btnSubmitList').disabled !== false && knoten('btnSubmitList').disabled !== true)
    throw new Error('Knopf in unklarem Zustand');
});
probe('Einblendung springt nicht erneut an', () => {
  run("versteckeMatchball()");
  run("zeigeMatchball(2)");
  if (knoten('mbFlash').classList.contains('an'))
    throw new Error('zweite Einblendung derselben Runde');
});
probe('versteckeMatchball räumt auf', () => {
  run("$('mbFlash').classList.add('an')");
  run("versteckeMatchball()");
  if (knoten('mbFlash').classList.contains('an')) throw new Error('blieb stehen');
});

console.log('\nFreundschaftsanfragen:');
run("profile = { username:'ich', usernameLower:'ich', friends:[] };");
schreib.length = 0;
datenbank.clear();

// Anfrage stellen: darf ausschließlich das Anfragedokument schreiben.
knoten('addUsername').value = 'snaefell';
datenbank.set('usernames/snaefell', { uid:'du' });
await run("$('btnAddFriend').onclick()");
await new Promise(r => setTimeout(r, 0));

probe('Anfrage legt genau ein Dokument an', () => {
  if (schreib.length !== 1) throw new Error('erwartet 1 Schreibvorgang, waren ' + JSON.stringify(schreib));
});
probe('Anfrage landet beim Empfänger', () => {
  const [art, pfad] = schreib[0];
  if (art !== 'set' || pfad !== 'users/du/listfriendreqs/ich')
    throw new Error('unerwartet: ' + art + ' ' + pfad);
});
probe('niemand wird ungefragt eingetragen', () => {
  const eintrag = schreib.find(w => JSON.stringify(w[2] || '').includes('friends'));
  if (eintrag) throw new Error('Freundesliste wurde ohne Ja verändert: ' + JSON.stringify(eintrag));
});

// Karte zeigt offene Anfragen und verschwindet wieder.
probe('Karte bleibt ohne Anfragen versteckt', () => {
  run("renderFriendReqs([])");
  if (!knoten('freqCard').classList.contains('hidden')) throw new Error('Karte sichtbar');
});
probe('Karte zeigt zwei Anfragen', () => {
  ctx.__reqs = [{ id:'du', fromName:'Snaefell' }, { id:'wer', fromName:'Jemand' }];
  run("renderFriendReqs(__reqs)");
  const k = knoten('freqCard');
  if (k.classList.contains('hidden')) throw new Error('Karte versteckt');
  const t = knoten('freqLabel').textContent;
  if (!/2 Freundschaftsanfragen/.test(t)) throw new Error('Beschriftung: ' + t);
  if (!knoten('freqList').innerHTML.includes('Snaefell')) throw new Error('Absender fehlt');
});

// Ja: trägt beide Seiten ein und räumt die Anfrage weg.
schreib.length = 0;
await run("acceptFriendReq('du')");
await new Promise(r => setTimeout(r, 0));
probe('Ja trägt beide Seiten ein', () => {
  const ziele = schreib.filter(w => w[0] === 'update').map(w => w[1]);
  if (!ziele.includes('users/ich') || !ziele.includes('users/du'))
    throw new Error('nur ' + JSON.stringify(ziele));
});
probe('Ja löscht die Anfrage danach', () => {
  const del = schreib.filter(w => w[0] === 'delete').map(w => w[1]);
  if (!del.includes('users/ich/listfriendreqs/du')) throw new Error('nicht gelöscht: ' + JSON.stringify(del));
  if (schreib.findIndex(w => w[0] === 'delete') < schreib.findIndex(w => w[0] === 'update'))
    throw new Error('zuerst gelöscht, dann eingetragen — falsche Reihenfolge');
});

// Zweite Anfrage an dieselbe Person: nichts wird geschrieben.
run("profile = { username:'ich', usernameLower:'ich', friends:[] };");
datenbank.set('users/du/listfriendreqs/ich', { from:'ich' });
schreib.length = 0;
knoten('addUsername').value = 'snaefell';
await run("$('btnAddFriend').onclick()");
await new Promise(r => setTimeout(r, 0));
probe('zweite Anfrage schreibt nichts', () => {
  if (schreib.length) throw new Error('geschrieben: ' + JSON.stringify(schreib));
});

// Gegenanfrage liegt schon vor: das Hinzufügen ist dann das Ja.
datenbank.clear();
datenbank.set('usernames/snaefell', { uid:'du' });
datenbank.set('users/ich/listfriendreqs/du', { from:'du' });
schreib.length = 0;
knoten('addUsername').value = 'snaefell';
await run("$('btnAddFriend').onclick()");
await new Promise(r => setTimeout(r, 40));
probe('Gegenanfrage wird sofort angenommen', () => {
  const ziele = schreib.filter(w => w[0] === 'update').map(w => w[1]);
  if (!ziele.includes('users/ich') || !ziele.includes('users/du'))
    throw new Error('nicht eingetragen: ' + JSON.stringify(schreib));
  if (schreib.some(w => w[0] === 'set'))
    throw new Error('zusätzliche Anfrage angelegt: ' + JSON.stringify(schreib));
});

// Nein: löscht nur, trägt nichts ein.
schreib.length = 0;
await run("declineFriendReq('wer')");
await new Promise(r => setTimeout(r, 0));
probe('Nein löscht nur', () => {
  if (schreib.length !== 1 || schreib[0][0] !== 'delete')
    throw new Error('unerwartet: ' + JSON.stringify(schreib));
});

console.log('\nMatchball-Banner:', gemerkt.match || '(leer)');
console.log('Auflösungstitel :', gemerkt.titel);
console.log('Punkte          :', gemerkt.me, ':', gemerkt.opp);
console.log(fehler ? `\n${fehler} Fehler` : '\nkeine Fehler');
process.exit(fehler ? 1 : 0);
