/* Rauchprobe: schneidet den Klassik-Block aus index.html aus und ruft
   kBrett / kAufloesung / roundOutcome mit einem nachgebauten Spieldokument
   auf. Prüft ausschließlich, dass keine Bezeichner fehlen. */
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
    dataset:{}, style:{},
    classList:{ add(){}, remove(){}, toggle(){}, contains(){return false} },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    querySelectorAll(){ return [] }, querySelector(){ return el() },
    focus(){}, click(){}, setAttribute(){}, getAttribute(){return null},
    closest(){ return null }, scrollIntoView(){}, animate(){ return {finished:Promise.resolve()} }
  };
  return e;
}
const nodes = new Map();
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
  requestAnimationFrame: f => setTimeout(f,0),
  fetch: () => Promise.resolve({ ok:true, json:()=>Promise.resolve({}) }),
  // Firebase-Ersatz
  initializeApp: stub, getAuth: stub, getFirestore: stub, getMessaging: stub,
  getToken: stub, isSupported: () => Promise.resolve(false),
  onAuthStateChanged(){}, signInAnonymously: stub, signOut: stub,
  GoogleAuthProvider: stub, signInWithPopup: stub, signInWithRedirect: stub,
  getRedirectResult: () => Promise.resolve(null), updateProfile: stub,
  doc: stub, getDoc: () => Promise.resolve({ exists:()=>false }),
  setDoc: stub, updateDoc: () => Promise.resolve(), deleteDoc: stub,
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

console.log('\nMatchball-Banner:', gemerkt.match || '(leer)');
console.log('Auflösungstitel :', gemerkt.titel);
console.log('Punkte          :', gemerkt.me, ':', gemerkt.opp);
console.log(fehler ? `\n${fehler} Fehler` : '\nkeine Fehler');
process.exit(fehler ? 1 : 0);
