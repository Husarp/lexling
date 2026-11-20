// Fair, live achievement progress; no browser required.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log('✗', name, '\n got ', got, '\n want', want); }
};
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)),
} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en' } });
const realNow = Date.now, now = 1800000000000;
Date.now = () => now;
const { stats, newGame, markPractice, counts, setupPractice, putSave } = await import('../app/js/store.js');
const { TIERS, TIERED, CHALLENGES, playChallenges, gameChallenges, bump, grant, progress, gotAt,
  recordAchievementEnd, recordConnectBonus, migrateAchievements, earlierAchievements } = await import('../app/js/achievements.js');
const def = id => TIERED.find(d => d.id === id);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const clean = { mode: 'guess', guesses: [] };
check('seven ladders', TIERED.length, 7);
check('twelve challenges', CHALLENGES.length, 12);
check('renamed and replacement ladders', TIERED.map(d => d.id), ['guess.finished','letters.finished','connect.words','tiles.words','tiles.letters','connect.boards','connect.bonus']);
check('new tile thresholds', def('tiles.letters').th, [100,500,2000,10000,30000]);
check('cumulative bonus thresholds', def('connect.bonus').th, [10,50,150,500,1500]);
for (const d of TIERED) {
  d.th.forEach((th, i) => {
    stats.ach.n[d.id] = th - 1;
    check(`${d.id} below tier ${i}`, gotAt(`${d.id}#${i}`), null);
    check(`${d.id} crosses tier ${i}`, bump(d.id, 1, clean).includes(`${d.id}#${i}`), true);
    check(`${d.id} date ${i}`, gotAt(`${d.id}#${i}`), now);
    check(`${d.id} tier ${i}`, progress(d).tiers, i + 1);
    check(`${d.id} no duplicate ${i}`, bump(d.id, 1, clean), []);
  });
  check(`${d.id} complete`, progress(d).next, null);
}
for (const by of [NaN, Infinity, -1, 0]) check('invalid increment ' + by, bump('guess.finished', by, clean), []);
check('missing game cannot write progress', bump('guess.finished'), []);
check('missing game cannot grant awards', grant('tiles.len8'), []);
check('retired challenge never granted', grant('tiles.move100', clean), []);
for (const id of ['guess.sharpshooter','letters.lucky','connect.unaided','tiles.move100','tiles.points'])
  check('retired definition ' + id, [...TIERED, ...CHALLENGES].some(d => d.id === id), false);
const fixture = { cn: { bonus: 7 }, rec: { a: { m: 'connect', b: 8 } }, ach: { since: 123, n: {
  'guess.won': 51, 'letters.won': 25, 'tiles.points': 9999, 'connect.words': 260, 'connect.bonusHunter': 30,
}, got: { 'guess.won#0': 11, 'guess.won#2': 12, 'letters.won#1': 13, 'tiles.points#1': 14,
 'guess.streak#0': 15, 'letters.lucky': 16, 'connect.bonusHunter': 17, unknown: 18 }, lengths: [3,8], streak: { guess: 8 } } };
const original = structuredClone(fixture);
migrateAchievements(fixture);
check('renamed counts carried', [fixture.ach.n['guess.finished'],fixture.ach.n['letters.finished']], [51,25]);
check('renamed earned dates carried', [fixture.ach.got['guess.finished#2'],fixture.ach.got['letters.finished#1']], [12,13]);
check('bonus seeded from saved totals', fixture.ach.n['connect.bonus'], 15);
check('tiles start at zero', fixture.ach.n['tiles.letters'], 0);
for (const [key, value] of Object.entries(original.ach.got)) check('kept award ' + key, fixture.ach.got[key], value);
for (const [key, value] of Object.entries(original.ach.n)) check('kept counter ' + key, fixture.ach.n[key], value);
check('kept lengths and old fields', [fixture.ach.lengths,fixture.ach.streak,fixture.ach.since], [[3,8],{guess:8},123]);
const once = structuredClone(fixture);
migrateAchievements(fixture);
check('migration is idempotent', fixture, once);
const empty = {};
migrateAchievements(empty);
check('no old bonus total starts at zero', empty.ach.n['connect.bonus'], 0);
// Reload the real modules twice, including unknown and retired keys.
const reload = saved => spawnSync(process.execPath, ['--input-type=module','-e', `
  const saved = JSON.parse(process.argv[1]);
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>k==='wg.stats'?JSON.stringify(saved):null,setItem(){}}});
  Object.defineProperty(globalThis,'navigator',{value:{language:'en'}});
  const {stats}=await import(${JSON.stringify(new URL('../app/js/store.js',import.meta.url).href)});
  const {earlierAchievements}=await import(${JSON.stringify(new URL('../app/js/achievements.js',import.meta.url).href)});
  console.log(JSON.stringify({ach:stats.ach,earlier:earlierAchievements()}));
`, JSON.stringify(saved)], {encoding:'utf8'});
const first = reload(original);
check('fresh migration succeeds', first.status, 0);
const restored = JSON.parse(first.stdout);
const second = reload({ach:restored.ach});
check('second reload succeeds', second.status, 0);
check('reload migration remains idempotent', JSON.parse(second.stdout).ach, restored.ach);
check('retired earned awards listed', restored.earlier.some(([key,at])=>key==='tiles.points#1' && at===14), true);
check('unknown award survives reload', restored.ach.got.unknown, 18);

const practice = newGame({friend:true, lang:'en'}), before = structuredClone(stats.ach);
for (const d of TIERED) bump(d.id, 10000, practice);
for (const d of CHALLENGES) grant(d.id, practice);
check('setup practice writes no achievements', stats.ach, before);
const live = newGame({lang:'en'});
stats.ach.n['guess.finished'] = 4;
delete stats.ach.got['guess.finished#0'];
bump('guess.finished', 1, live);
const earned = gotAt('guess.finished#0');
markPractice(live);
bump('guess.finished', 100, live);
check('hint keeps prior progress and earned award', [stats.ach.n['guess.finished'],gotAt('guess.finished#0')], [5,earned]);
check('hint stops later challenge', grant('tiles.len10', live), []);
const end = (mode, fields={}) => recordAchievementEnd({mode, status:'won', secret:'cat', guesses:[], diff:'normal', ...fields},mode);
end('letters',{secret:'abcdefgh',tries:0});
check('unlimited tries cannot earn long haul',gotAt('letters.longHaul'),null);
end('letters',{secret:'abcdefgh',tries:6});
check('finite tries earn long haul',gotAt('letters.longHaul'),now);
for(let n=3;n<=12;n++) end('letters',{secret:'a'.repeat(n),tries:6});
end('letters',{secret:'a'.repeat(13),tries:6,status:'lost'});
check('lost final length does not qualify',gotAt('letters.everyLength'),null);
end('letters',{secret:'a'.repeat(13),tries:6});
check('every length challenge',gotAt('letters.everyLength'),now);
const priorBoards=stats.ach.n['connect.boards'];
end('connect',{hints:1,shown:['1-1'],diff:'hard'});
check('hinted completion adds nothing',[stats.ach.n['connect.boards'],gotAt('connect.hardBoard')],[priorBoards,null]);
end('connect',{hints:0,shown:[],diff:'hard'});
check('hard board qualifies',gotAt('connect.hardBoard'),now);
stats.ach.n['connect.bonus']=0;
for(let n=0;n<12;n++) recordConnectBonus({mode:'connect',bonus:[n],hints:0,shown:[]});
check('bonus accumulates across boards',stats.ach.n['connect.bonus'],12);
recordConnectBonus({mode:'connect',hints:1,shown:[],bonus:['helped']});
check('practice bonus excluded',stats.ach.n['connect.bonus'],12);

const move=(words=['cat'],fields={})=>({kind:'play',words:words.map(w=>({w})),score:20,placed:Array(3).fill({ch:'a'}),...fields});
for(const [words,keys] of [[['cat'],[]],[['cat','dog'],[]],[['cat','dog','hen'],['tiles.multi3']],
 [['abcdefgh'],['tiles.len8']],[['abcdefghij'],['tiles.len8','tiles.len10']],[['ananas'],['tiles.triple']]])
 check('move '+words,playChallenges(move(words)),keys);
check('all seven with no bingo bonus',playChallenges(move(['cat'],{placed:Array(7).fill({})})),['tiles.bingo']);
for(const pct of [null,undefined,Infinity,NaN,-1,1.001,50]) check('rarity excluded '+pct,playChallenges(move(),{rarePct:pct}),[]);
for(const pct of [0,.5,1]) check('rarity included '+pct,playChallenges(move(),{rarePct:pct}),['tiles.rare1']);
for(const hinted of [true,'small','big','master']) check('hinted move '+hinted,playChallenges(move(['abcdefghij'],{hinted})),[]);
check('approved move excluded',playChallenges(move(['abcdefghij'],{approved:['abcdefghij']})),[]);
check('no retired point challenge',playChallenges(move(['cat'],{score:1000})),[]);
const duel=(cpu='expert',reason='out')=>({players:[{}, {cpu}],rules:{rating:'score'},log:[],over:{winner:0,reason}});
check('expert duel',gameChallenges(duel(),[0]),['tiles.beatHard','tiles.beatExpert']);
check('hard duel',gameChallenges(duel('hard','passes'),[0]),['tiles.beatHard']);
check('any eligible rules',gameChallenges({...duel(),board:'bonus',rules:{rating:false,bingo:100,time:{seconds:5}}},[0]),['tiles.beatHard','tiles.beatExpert']);
for(const reason of ['resign','ended',undefined]) check('non-natural ending '+reason,gameChallenges(duel('expert',reason),[0]),reason===undefined?['tiles.beatHard','tiles.beatExpert']:[]);
check('remote winner excluded',gameChallenges(duel(),[1]),[]);
check('CPU seat excluded',gameChallenges({...duel(),over:{winner:1,reason:'out'}},[1]),[]);
check('three seats excluded',gameChallenges({...duel(),players:[{}, {cpu:'expert'},{}]},[0,2]),[]);
check('two CPUs excluded',gameChallenges({...duel(),players:[{cpu:'hard'},{cpu:'expert'}]},[0]),[]);
check('practice duel excluded',gameChallenges({...duel(),rules:{rating:true}},[0]),[]);
check('resigned match excluded',gameChallenges({...duel(),log:[{type:'resign',p:1}]},[0]),[]);
check('draw excluded',gameChallenges({...duel(),over:{winner:-1,reason:'out'}},[0]),[]);
// Final-turn scores come from settled plays, not the rack/time-adjusted final totals.
const comeback = {
 players: [{}, {cpu: 'easy'}], rules: {}, log: [], out: [false, false],
 moves: [{p:0,kind:'play',score:10},{p:1,kind:'play',score:20},{p:0,kind:'play',score:15}],
 scores: [30,15], over: {winner:0,reason:'out',adjust:[5,-5]},
};
const photo = (s=comeback, mine=[0]) => gameChallenges(s,mine).includes('tiles.photoFinish');
check('last-turn comeback qualifies',photo(),true);
check('already leading before final turn excluded',photo({...comeback,moves:[{p:0,kind:'play',score:25},{p:1,kind:'play',score:20},{p:0,kind:'play',score:5}]}),false);
check('tied before final turn qualifies',photo({...comeback,moves:[{p:0,kind:'play',score:20},{p:1,kind:'play',score:20},{p:0,kind:'play',score:5}]}),true);
check('practice comeback excluded',photo({...comeback,rules:{undo:true}}),false);
check('remote comeback excluded',photo(comeback,[1]),false);
check('computer comeback excluded',photo({...comeback,players:[{cpu:'easy'},{}]}),false);
check('draw comeback excluded',photo({...comeback,over:{winner:-1,reason:'out'}}),false);
check('resignation comeback excluded',photo({...comeback,over:{winner:0,reason:'resign'}}),false);
check('missing history cannot earn comeback',photo({...comeback,moves:[]}),false);
check('multiplayer human comeback qualifies',photo({...comeback,players:[{},{},{}],scores:[30,15,12],out:[false,false,false]}),true);
check('final pass compares before that pass',photo({...comeback,moves:[...comeback.moves,{p:1,kind:'pass'},{p:0,kind:'pass'}],over:{winner:0,reason:'passes'}}),false);
check('settlement can break tie on final pass',photo({...comeback,moves:[{p:0,kind:'play',score:20},{p:1,kind:'play',score:20},{p:0,kind:'pass'}],over:{winner:0,reason:'passes'}}),true);
check('withdrawn plays do not inflate prior score',photo({...comeback,moves:[{p:0,kind:'withdrawn',score:100},...comeback.moves]}),true);
check('grant comeback records earned date',grant('tiles.photoFinish',{mode:'tiles',state:comeback}),['tiles.photoFinish']);
check('comeback earned date',gotAt('tiles.photoFinish'),now);
// Exercise the production settled-move cursor, including remote/CPU/replayed/pending actions.
const source=read('app/js/tiles-game.js');
const hook=source.slice(source.indexOf('  function countAchievements('),source.indexOf('  function pickLetter('));
function counter({linked=false,seat=0,practice=false}={}) {
 const calls=[], game={mode:'tiles',practice,achDone:0};
 const ctx={game,linked,linkMe:seat,lex:{count:100},people:[0,2],counts,cpu:p=>p===1,
 S:{players:[{},{cpu:'expert'},{}],rules:{rating:'score'},moves:[],pending:null},rankOf:()=>99,
 listedPct:()=>.5,playChallenges,gameChallenges,bump:(id,n,g)=>{if(counts(g))calls.push([id,n]);},grant:id=>calls.push([id]),putSave(){}};
 return {ctx,calls,count:runInNewContext('('+hook+')',ctx)};
}
for(const options of [{},{linked:true},{linked:true,seat:2},{practice:true}]) {
 const c=counter(options); c.ctx.S.moves=[{...move(),p:0},{...move(),p:1},{...move(),p:2}];
 c.count();const n=options.practice?0:options.linked?1:2;
 check('only owned seats '+JSON.stringify(options),c.calls.filter(x=>x[0]==='tiles.words').length,n);
 check('new tiles counted '+JSON.stringify(options),c.calls.filter(x=>x[0]==='tiles.letters').map(x=>x[1]),Array(n).fill(3));
 const before=structuredClone(c.calls);c.count();check('replay does not duplicate '+JSON.stringify(options),c.calls,before);
}
const pending=counter();pending.ctx.S.moves=[{...move(),p:0}];pending.ctx.S.pending={before:{moves:[]}};
pending.count();check('unsettled move waits',pending.calls,[]);
pending.ctx.S.pending=null;pending.count();check('settled move counts once',pending.calls.filter(x=>x[0]==='tiles.words').length,1);
const finalCounter=counter();
finalCounter.ctx.S={...comeback,players:comeback.players,moves:comeback.moves.map(m=>({...move(),...m}))};
finalCounter.count(true);
check('production end hook grants comeback',finalCounter.calls.some(c=>c[0]==='tiles.photoFinish'),true);
const practiceFinal=counter({practice:true});practiceFinal.ctx.S=finalCounter.ctx.S;practiceFinal.count(true);
check('production practice end excludes comeback',practiceFinal.calls,[]);
check('production end hook includes Letters losses',read('app/js/letters-game.js').includes("status === 'won' || status === 'lost'"),true);
for(const [file,mode] of [['game.js','guess'],['letters-game.js','letters'],['connect-game.js','connect']])
 check('production end hook '+mode,read('app/js/'+file).includes(`recordAchievementEnd(game, '${mode}'`),true);
// Set a useful mixed ledger for the existing screen/detail/notice checks.
for(const d of TIERED) stats.ach.n[d.id]=0;
for(const key of Object.keys(stats.ach.got)) delete stats.ach.got[key];
stats.ach.n['letters.finished']=5;stats.ach.got['letters.finished#0']=now;
stats.ach.got['tiles.bingo']=now;stats.ach.got['tiles.points#0']=now-1;
// Render the actual screen and run the global notice listener against a tiny DOM stand-in.
const listeners = new Map(), notices = [], timers = [];
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: {
  documentElement: {},
  addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
  createRange() { return {}; },
  createElement() { return { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { notices.splice(notices.indexOf(this), 1); } }; },
  body: { append(node) { notices.push(node); } },
} });
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); };
const { achievementsScreen, statsScreen } = await import('../app/js/screens.js');
const { t, setLang, num, dateTime } = await import('../app/js/i18n.js');
const root = { innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; } };
for (const lang of ['en', 'pl']) {
  setLang(lang);
  for (const d of [...TIERED, ...CHALLENGES]) {
    check(`${lang}: achievement name ${d.id}`, t('ach.' + d.id) !== 'ach.' + d.id, true);
    check(`${lang}: achievement description ${d.id}`, t(`ach.${d.id}.d`) !== `ach.${d.id}.d`, true);
  }
  check(`${lang}: final tier names`, TIERS.map(k => t('tier.' + k)), lang === 'en' ? ['Common','Rare','Epic','Legendary','Mythical'] : ['Zwykły','Rzadki','Epicki','Legendarny','Mityczny']);
  check(`${lang}: action language`, t('ach.see'), lang === 'en' ? 'See it' : 'Zobacz');
  achievementsScreen(root);
  const html = root.innerHTML;
  check(`${lang}: five game tabs`, (html.match(/role="tab"/g) ?? []).length, 5);
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]);
  check(`${lang}: icon-only tabs retain translated names and tooltips`, tabs.every(tab => /aria-label="[^"]+" title="[^"]+"/.test(tab) && /<\/svg><\/span><\/button>$/.test(tab)), true);
  check(`${lang}: selected section has a visible name`, html.includes(`<h2 class="ach-section-title">${t('col.all')}</h2>`), true);
  check(`${lang}: nineteen achievement squares`, (html.match(/data-ach="/g) ?? []).length, 19);
  check(`${lang}: earlier awards are collapsed`, html.includes('<details class="earlier-ach"><summary>' + t('ach.earlier')), true);
  check(`${lang}: earlier award keeps its date`, html.includes(t('ach.got', { d: dateTime(now - 1) })), true);
  check(`${lang}: retired award has no active tile`, html.includes('data-ach="tiles.points"'), false);
  check(`${lang}: obsolete fairness paragraph removed`, html.includes(t('ach.fair')), false);
  check(`${lang}: seven progress bars`, (html.match(/role="progressbar"/g) ?? []).length, 7);
  check(`${lang}: thirty-five tier pips plus summary`, (html.match(/class="ach-shape"/g) ?? []).length, 40);
  check(`${lang}: no challenge frames`, (html.match(/class="ach-frame"/g) ?? []).length, 0);
  check(`${lang}: locked and earned tiles`, html.includes('ach-tile locked') && html.includes('ach-tile earned'), true);
  check(`${lang}: no counted-since timestamp`, html.includes(t('ach.since', { d: dateTime(stats.ach.since) })), false);
  check(`${lang}: summary counts only milestone tiers`, html.includes(t('ach.tiers', { a: num(TIERED.reduce((n, d) => n + TIERS.filter((_, i) => gotAt(`${d.id}#${i}`) !== null).length, 0)), b: num(35) })), true);
  for (const key of ['tiers', 'milestones', 'challenges', 'see', 'nice', 'earned', 'detail']) check(`${lang}: translated ${key}`, t('ach.' + key) !== 'ach.' + key, true);
  statsScreen(root, null, () => {});
  check(`${lang}: Statistics has no achievements button`, root.innerHTML.includes('href="#/achievements"'), false);
}
setLang('pl');
check('Polish Guess achievement uses the game name', t('ach.guess.finished.d').includes(t('mode.guess')), true);
const { achievementIcon, tierShape } = await import('../app/js/achievement-icons.js');
for (const d of [...TIERED, ...CHALLENGES]) check('drawing: ' + d.id, achievementIcon(d.id).includes('undefined'), false);
const mythicalPath = tierShape(4).match(/d="([^"]+)"/)[1];
const points = [...mythicalPath.matchAll(/[ML]([^ ]+) ([^LZ ]+)/g)].map(m => [+m[1], +m[2]]);
check('AnkiGo Mythical has sixteen vertices', points.length, 16);
check('AnkiGo Mythical alternating radii', points.every(([x, y], i) => Math.abs(Math.hypot(x - 8, y - 8) - (i % 2 ? 2.9 : i % 4 ? 5.9 : 7.4)) < 1e-9), true);
check('AnkiGo Legendary keeps its four curved points', (tierShape(3).match(/C/g) ?? []).length, 1);
check('builder keeps approved rotation', achievementIcon('tiles.words').includes('rotate(-90 12 12)'), true);
const { achievementMedal } = await import('../app/js/ui.js');
check('locked medals use an outline; earned medals have a filled face', [achievementMedal(false).includes('fill="currentColor"'), achievementMedal(true).includes('fill="currentColor"')], [false, true]);
setLang('en');
check('one global achievement listener', listeners.get('lexling:achievement').length, 1);
const announce = keys => listeners.get('lexling:achievement')[0]({ detail: { keys } });
announce(['tiles.bingo', 'guess.finished#0']);
check('only one notice visible at once', notices.length, 1);
check('notice has challenge name and accessible status', [notices[0].innerHTML.includes(t('ach.tiles.bingo')), notices[0].attrs.role], [true, 'status']);
check('notice uses the same SVG medal as the screen', notices[0].innerHTML.includes(achievementIcon('tiles.bingo')), true);
check('notice lasts three seconds', timers[0].ms, 3000);
announce(['tiles.len10']);
check('later unlock joins the queue', notices.length, 1);
root.innerHTML = '<div>another screen</div>';
timers.shift().fn();
check('tier notice follows across screen changes', notices[0].innerHTML.includes(t('ach.guess.finished') + ' · ' + t('tier.common')), true);
timers.shift().fn();
check('later notice preserves queue order', notices[0].innerHTML.includes(t('ach.tiles.len10')), true);
timers.shift().fn();
check('notice queue clears completely', [notices.length, timers.length], [0, 0]);
check('notice has detail and dismiss actions', notices.length === 0 && read('app/js/ui.js').includes('data-see') && read('app/js/ui.js').includes('data-close'), true);
check('menu link follows Statistics', /href="#\/stats"[^\n]+\n\s+<a href="#\/achievements"/.test(read('app/js/screens.js')), true);
const mainSource = read('app/js/main.js');
check('route opens achievement screen', mainSource.includes('achievements: achievementsScreen'), true);
check('Escape goes up from achievements', mainSource.includes("achievements: () => '#/'"), true);
// Detail renders the same live ledger, including reached dates and the next goal.
const noticeDocument = globalThis.document, dialogs = [];
globalThis.document = {
  querySelectorAll: () => [...dialogs],
  createElement: () => ({ innerHTML: '', attrs: {}, handlers: {}, style: { setProperty() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.handlers[k] = fn; },
    showModal() { this.open = true; }, close() { this.open = false; },
    remove() { const i = dialogs.indexOf(this); if (i >= 0) dialogs.splice(i, 1); },
  }),
  body: { append: d => dialogs.push(d) },
};
const { achievementDetail } = await import('../app/js/achievement-view.js');
for (const d of [...TIERED, ...CHALLENGES]) {
  achievementDetail(d.id);
  check('only one detail: ' + d.id, dialogs.length, 1);
  check('detail opens modally: ' + d.id, dialogs[0].open, true);
  check('detail description: ' + d.id, dialogs[0].innerHTML.includes(t('ach.' + d.id + '.d')), true);
  if (d.th) check('all five detail thresholds: ' + d.id, d.th.every(n => dialogs[0].innerHTML.includes('· ' + num(n))), true);
  else check('challenge date or lock: ' + d.id, dialogs[0].innerHTML.includes(gotAt(d.id) === null ? t('ach.locked') : t('ach.got', { d: dateTime(gotAt(d.id)) })), true);
}
achievementDetail('letters.finished');
check('detail displays remaining progress', dialogs[0].innerHTML.includes(t('ach.toGo', { n: num(20), tier: t('tier.rare') })), true);
let prevented = false, stopped = false;
dialogs[0].handlers.keydown({ key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
check('Escape closes detail without navigating away', [dialogs[0].open, prevented, stopped], [false, true, true]);
globalThis.document = noticeDocument;
globalThis.setTimeout = realTimeout;
Date.now = realNow;

console.log(fail ? `${fail} of ${pass + fail} achievement tests FAILED` : `all ${pass} achievement tests passed`);
process.exit(fail ? 1 : 0);
