/* Simulação de uso do Katsuyou Lab com relógio virtual e sementes fixas.
   Uso: node scripts/simular-semanas.mjs <raiz-do-projeto> > resultado.json
   Para comparar versões, rode contra duas cópias (ex.: git worktree do commit anterior). */
const root = process.argv[2];
const mem = new Map();
globalThis.localStorage = { getItem:k=>mem.has(k)?mem.get(k):null, setItem:(k,v)=>mem.set(k,String(v)), removeItem:k=>mem.delete(k), clear:()=>mem.clear() };
globalThis.window = globalThis;
let NOW = Date.UTC(2026,0,5,20,0,0);
const realNow = Date.now; Date.now = () => NOW;
const store = await import(root + '/src/progress/store.js');
const { Session } = await import(root + '/src/practice/engine.js');
const { VERBS } = await import(root + '/src/data/verbs.js');
const { FORMS } = await import(root + '/src/conjugation/rules.js');

function seeded(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

function run({ seed, sessions, gapDays, length=20, base, formSkill={}, hardVerbs=[], repeat=true }) {
  mem.clear(); store.resetAll();
  if (!repeat) store.updateSettings({ repeatErrors:false });
  NOW = Date.UTC(2026,0,5,20,0,0);
  const rng = seeded(seed); Math.random = rng;
  const seenPairs = new Set(), forms = new Set(), verbs = new Set();
  const pairCount = {};
  const perSession = [];
  let immediate=0, requeueGaps=[], corrective=0;
  for (let k=0;k<sessions;k++){
    const s = new Session({ mode:'mixed', limitKind:'count', length });
    let newIn=0, idx=0; const pos={};
    while (s.current) {
      const cur=s.current, key=cur.verbId+'|'+cur.form;
      if (cur.requeued){ corrective++; if(pos[key]!=null){ requeueGaps.push(idx-pos[key]); if(idx-pos[key]===1) immediate++; } }
      else { pos[key]=idx; if(!seenPairs.has(key)) newIn++; }
      seenPairs.add(key); forms.add(cur.form); verbs.add(cur.verbId);
      pairCount[key]=(pairCount[key]||0)+1;
      const p = store.getPair(cur.verbId, cur.form);
      let prob = (formSkill[cur.form] ?? base) + Math.min(p.right||0,4)*0.05;
      if (hardVerbs.includes(cur.verbId)) prob -= 0.35;
      const ok = rng() < Math.min(0.97,prob);
      s.submit(ok ? cur.verb[cur.form] : 'まちがい');
      NOW += 40_000; idx++;
      s.next();
    }
    s.finishAndRecord();
    const c = store.overallCounts();
    let learning=0, due=0;
    for (const [key,p] of Object.entries(store.getState().pairs)) {
      if (!p.seen) continue;
      if (p.mastery==='learning') learning++;
      if (p.mastery==='almost'||p.mastery==='mastered'){
        const iv = p.mastery==='almost'?2:7; if ((NOW-(p.lastSeenAt||0))>=iv*86400000) due++; }
    }
    perSession.push({ s:k+1, new:newIn, practiced:c.practiced, mastered:c.mastered, learning });
    NOW += gapDays*86400000;
  }
  const counts=Object.values(pairCount).sort((a,b)=>b-a);
  const c=store.overallCounts();
  return { practiced:c.practiced, mastered:c.mastered, trainable:c.trainable, distinctForms:forms.size, distinctVerbs:verbs.size,
    pendentes: perSession.at(-1).learning, maxRepeatPair:counts[0], pairsSeen3plus:counts.filter(x=>x>=3).length,
    newPerSession: perSession.map(x=>x.new).join(','), masteredBySession: perSession.map(x=>x.mastered).join(','),
    learningBySession: perSession.map(x=>x.learning).join(','),
    corrective, immediateRepeats: immediate, requeueGapMin: requeueGaps.length?Math.min(...requeueGaps):null, requeueGapMax: requeueGaps.length?Math.max(...requeueGaps):null,
    requeueGapsDistinct: [...new Set(requeueGaps)].sort((a,b)=>a-b).join(',') };
}
const out = {
  semanal_acertaMuito: run({ seed:1, sessions:12, gapDays:7, base:0.88 }),
  semanal_medio:       run({ seed:2, sessions:12, gapDays:7, base:0.72 }),
  semanal_formasDificeis: run({ seed:3, sessions:12, gapDays:7, base:0.85, formSkill:{ nai:0.45, nakatta:0.4 } }),
  semanal_30q:         run({ seed:4, sessions:10, gapDays:7, length:30, base:0.8 }),
  diario_medio:        run({ seed:5, sessions:28, gapDays:1, base:0.72 }),
  semanal_semRepeticao: run({ seed:6, sessions:8, gapDays:7, base:0.72, repeat:false }),
};
console.log(JSON.stringify(out, null, 1));
