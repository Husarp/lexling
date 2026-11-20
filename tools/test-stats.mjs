// Fair live totals, collection, practice and online regressions without a browser.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
globalThis.document={visibilityState:'visible',documentElement:{},createRange(){return {};},addEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const { stats, newGame, counts, markPractice, putSave, getSave, recordMove, noteMove, recordGuess, recordEnd,
  recordLettersEnd, recordConnectEnd, recordTilesEnd, collect, collected, totals, tilesProgress, tilesRecord, playClock, saveStats } = await import('../app/js/store.js');
const { newGame: tilesGame, STANDARD, apply } = await import('../app/js/tiles.js');
const { readinessText } = await import('../app/js/tiles-game.js');
const blank = () => ({ rec: {}, unique: [], tl: {}, lt: {}, cn: {} });
check('new Tiles default counts', STANDARD.rating, 'score');
const base = { lang: 'en', players: [{}, { cpu: 'expert' }], first: 0, seed: 3 };
const rules = r => ({ mode: 'tiles', lang: 'en', state: tilesGame({ ...base, ...(r.wordsVote ? { players: [{}, {}] } : {}), rules: r }) });
const practiceSetups = [
 { friend: true }, { mode: 'letters', tries: 0 },
 ...[{ hints: true }, { undo: true }, { rating: true }, { open: true }, { wordsVote: true },
   { hints: true, hintMax: { small: 0, big: 1, master: 0 } }].map(rules),
];
for (const [i, fields] of practiceSetups.entries()) {
  const g = newGame({ lang: 'en', ...fields });
  check('setup practice ' + i, [g.practice, typeof g.practiceAt, counts(g)], [true, 'number', false]);
  recordMove(g, { g: 100, f: 100, moves: 100 });
  collect(g.mode, 'en', 'helped' + i, g);
  check('setup counts no statistics ' + i, stats.rec[g.id], undefined);
  check('setup counts no Collection ' + i, collected(g.mode, 'en').has('helped' + i), false);
  check('setup flag saved ' + i, JSON.parse(storage.get('wg.saves')).find(x => x.id === g.id).practice, true);
}
for (const [i, fields] of [
 {}, { cat: 'animals', diff: 'easy', band: 'short' }, { mode: 'letters', tries: 1 }, { mode: 'letters', tries: 20 },
 { mode: 'connect', n: 4, diff: 'easy', two: true }, rules({}), rules({ rating: false }),
 rules({ hints: true, hintMax: { small: 0, big: 0, master: 0 } }), rules({ veto: true }),
 rules({ rating: 'score', time: { seconds: 10, per: 'move' }, dictionary: 'common', bingo: 100 }),
].entries()) check('ordinary settings count ' + i, counts(newGame({ lang: 'en', ...fields })), true);
const g = newGame({ lang: 'en', cat: 'all' });
g.guesses.push({ w: 'cat' }); recordGuess(g, 'cat', 'cat');
const before = structuredClone(stats.rec[g.id]);
check('first Guess move counts', [before.g, before.ch, collected('guess', 'en').has('cat')], [1,3,true]);
markPractice(g);
g.guesses.push({ hint: true }, { w: 'dog' });
recordGuess(g, 'dog', 'dog'); noteMove(g, { g: 1000 });
check('first hint keeps earlier statistics', stats.rec[g.id], before);
check('later Guess word excluded from Collection', collected('guess', 'en').has('dog'), false);
check('later Guess word excluded from distinct words', stats.unique.includes('en:dog'), false);
g.friend = false; g.guesses = [];
check('practice cannot be undone', counts(g), false);
g.status = 'won'; recordEnd(g, true);
check('practice completion keeps earlier move, no solve', [stats.rec[g.id].g,stats.rec[g.id].ch,stats.rec[g.id].end], [1,3,'left']);
const cn = newGame({mode:'connect',lang:'pl',hints:0,shown:[]});
recordMove(cn,{f:2,b:1});collect('connect','pl','kot',cn);
markPractice(cn);cn.hints=1;cn.shown.push('1-1');
recordMove(cn,{f:9,b:8});collect('connect','pl','pies',cn);
cn.status='won';recordConnectEnd(cn,{f:9,b:8});
check('Connect keeps earlier counts', [stats.rec[cn.id].f,stats.rec[cn.id].b,stats.rec[cn.id].end], [2,1,'left']);
check('Connect stops later Collection',collected('connect','pl').has('pies'),false);
const lt=newGame({mode:'letters',lang:'en',tries:6});recordMove(lt,{g:2});lt.status='lost';recordLettersEnd(lt);
check('Letters exhausted tries counts as finished',totals('letters','en').finished,1);
const gave=newGame({mode:'letters',lang:'en',tries:6});recordMove(gave,{g:1});gave.status='gaveup';recordLettersEnd(gave);
check('Letters surrender is not finished',totals('letters','en').finished,1);
// Time is the one exception: visible/active practice still counts and idle/hidden time does not.
const realNow=Date.now, realInterval=globalThis.setInterval, realClear=globalThis.clearInterval;
let time=10000, tick, cleared=0;Date.now=()=>time;
globalThis.setInterval=fn=>{tick=fn;return 1;};globalThis.clearInterval=()=>{cleared++;};
const events=new Map();
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.document={visibilityState:'visible',documentElement:{},createRange(){return {};},addEventListener(){}};
const root={addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)};
const timed=newGame({lang:'en',friend:true});const timeBefore=stats.timeMs;
const stop=playClock(root,timed,()=>true);tick();
check('practice play time counts',[timed.timeMs,stats.timeMs-timeBefore],[1000,1000]);
document.visibilityState='hidden';tick();check('hidden time excluded',timed.timeMs,1000);
document.visibilityState='visible';time+=60001;tick();check('idle time excluded',timed.timeMs,1000);
events.get('pointerdown')();tick();check('activity resumes time',timed.timeMs,2000);
timed.status='won';tick();check('finished time stops',timed.timeMs,2000);
stop();check('clock cleanup', [events.size,cleared],[0,1]);
Date.now=realNow;globalThis.setInterval=realInterval;globalThis.clearInterval=realClear;

const placed=[{r:7,c:7,ch:'a'},{r:7,c:8,ch:'t'}];
const start={...tilesGame(base),racks:[['a','t'],['s']]};
const state=apply(start,{type:'place',placed},()=>true);
check('blank counts as one placed tile',tilesRecord({...state,moves:[{...state.moves[0],placed:[{ch:'a',blank:true},{ch:'t'}]}]},0).tiles,2);
check('local human totals',[tilesRecord(state,0).moves,tilesRecord(state,0).tiles],[1,2]);
check('CPU seat counts nothing',[tilesRecord(state,1).moves,tilesRecord(state,1).tiles,tilesRecord(state,1).finished],[0,0,0]);
const three={...state,players:[{}, {cpu:'hard'},{}],hints:[0,0,0],scores:[0,0,0],racks:[[],[],[]],
 moves:[{...state.moves[0],p:0},{...state.moves[0],p:1},{...state.moves[0],p:2}]};
check('shared device counts only humans',[tilesRecord(three,-1).moves,tilesRecord(three,-1).tiles],[2,4]);
check('linked device excludes remote human',[tilesRecord(three,0).moves,tilesRecord(three,0).tiles],[1,2]);
const pending={...state,pending:{before:{moves:[]}}};
check('pending placement does not count',[tilesRecord(pending,0).moves,tilesRecord(pending,0).tiles],[0,0]);
const local=newGame({mode:'tiles',lang:'en',state:three});local.statsDone=0;
recordMove(local,tilesProgress(local,0));
check('settled local progress',[stats.rec[local.id].moves,stats.rec[local.id].tiles],[1,2]);
noteMove(local,tilesProgress(local,0));
check('replay does not duplicate totals',[stats.rec[local.id].moves,stats.rec[local.id].tiles],[1,2]);
local.statsDone=three.moves.length; // Rebuilt guest seat starts here.
local.state={...three,moves:[...three.moves,{...state.moves[0],p:2}]};
noteMove(local,tilesProgress(local,2));
check('seat change counts only new owned actions',[stats.rec[local.id].moves,stats.rec[local.id].tiles],[2,4]);
for(const [reason,out,finished] of [['out',[false,false,false],1],['passes',[false,false,false],1],['out',[true,false,false],0],['resign',[true,false,false],0],['ended',[false,false,false],0]]) {
 const terminal={...three,out,over:{reason,winner:2}};
 check('completion '+reason+' '+out,tilesRecord(terminal,0).finished,finished);
}
local.state={...local.state,out:[true,false,false],over:{reason:'out',winner:2}};
recordTilesEnd(local,0,{});
check('removed seat keeps words/tiles, no completion',[stats.rec[local.id].moves,stats.rec[local.id].tiles,stats.rec[local.id].finished],[2,4,0]);
// Older fields are read as totals only when their meaning matches; they are never rewritten away.
const historical={...blank(),won:2,words:20,letters:60,unique:['en:cat','pl:kot'],
 lt:{won:3,lost:4,streak:9},cn:{solved:5,words:40,bonus:8},tl:{'en|hard':{played:6,moves:50,points:999}},
 rec:{a:{m:'guess',lang:'en',g:3,ch:9,end:'won'},b:{m:'letters',lang:'pl',end:'lost'},
 c:{m:'connect',lang:'pl',f:4,b:2,end:'won'},d:{m:'tiles',lang:'en',end:'done',moves:2,tiles:5}}};
const untouched=structuredClone(historical);
check('historical Guess totals',totals('guess','all',historical),{finished:3,guesses:23,distinct:2,letters:69});
check('language-filtered Guess totals',totals('guess','en',historical),{finished:1,guesses:3,distinct:1,letters:9});
check('historical Letters totals',totals('letters','all',historical),{finished:8,solved:3});
check('historical Connect totals',totals('connect','all',historical),{finished:6,words:44,bonus:10});
check('historical Tiles totals',totals('tiles','all',historical),{finished:0,words:52,tiles:5});
check('historical storage fields untouched',historical,untouched);
historical.rec.d.finished=1;
check('known natural Tiles finish counts',totals('tiles','all',historical).finished,1);
// Practice survives a fresh process, while earlier record and Collection survive too.
const resume=newGame({lang:'en'});recordMove(resume,{g:3,ch:9});markPractice(resume);saveStats();
const fresh=spawnSync(process.execPath,['--input-type=module','-e',`
 const entries=new Map(JSON.parse(process.argv[1]));
 Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}});
 const {getSave,counts,stats,recordMove}=await import(${JSON.stringify(new URL('../app/js/store.js',import.meta.url).href)});
 const g=getSave(process.argv[2]);recordMove(g,{g:100,ch:300});console.log(JSON.stringify([g.practice,counts(g),stats.rec[g.id].g]));
`,JSON.stringify([...storage]),resume.id],{encoding:'utf8'});
check('practice reload succeeds',fresh.status,0);check('practice reload keeps earlier progress',JSON.parse(fresh.stdout),[true,false,3]);
const { t, setLang }=await import('../app/js/i18n.js');
const { statsScreen, achievementsScreen }=await import('../app/js/screens.js');
const { practiceBadge }=await import('../app/js/ui.js');
let handlers={};const screen={innerHTML:'',querySelector:()=>null,querySelectorAll(selector){
 if(selector==='[data-tab]')return ['general','guess','letters','connect','tiles'].map(tab=>({dataset:{tab},addEventListener:(k,fn)=>{handlers[tab]=fn;}}));
 return [];
}};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
for(const lang of ['en','pl']) {
 setLang(lang);
 check(lang+' practice badge',practiceBadge(timed).includes(t('practice')),true);
 check(lang+' clean badge',practiceBadge(cleanGame()),'');
 check(lang+' exact hint warning',t('help.firstHint'),lang==='en'?'Using a hint turns this game into practice: no statistics or achievements from then on.':'Podpowiedź zmienia tę grę w trening: od tej chwili bez statystyk i osiągnięć.');
 check(lang+' exact setup warning',t('help.setupPractice'),lang==='en'?'With help on, this game is practice: no statistics or achievements.':'Z pomocą ta gra jest treningiem: bez statystyk i osiągnięć.');
 statsScreen(screen,null,()=>{});
 for(const tab of ['general','guess','letters','connect','tiles']) {
  handlers[tab]();statsScreen(screen,null,()=>{});
  check(lang+' '+tab+' language filter',screen.innerHTML.includes('data-f-lang="pl"'),tab!=='general');
  check(lang+' '+tab+' no level filter',screen.innerHTML.includes('data-f-lv'),false);
  for(const key of ['stats.avgWin','stats.bestWin','stats.streakNow','stats.longest','stats.wordsPerGame','stats.hints'])
   check(lang+' '+tab+' no '+key,screen.innerHTML.includes(t(key)),false);
 }
 for(const kind of ['bt','web','lan','near']) {
  check(lang+' '+kind+' failed retry is translated',t(readinessText(kind,'retry'))===readinessText(kind,'retry'),false);
  if(kind!=='bt') check(lang+' '+kind+' support text matches transport',t(readinessText(kind,'unsupported')).includes(t('tiles.bt.unsupported')),false);
 }
 check(lang+' online offline translated',t(readinessText('web','offline'))==='net.ready.web.offline',false);
}
function cleanGame(){return {mode:'guess',guesses:[]};}
// Evaluate the production wait condition: absent guests block setup, never the started host rack.
const source=read('app/js/tiles-game.js');
const wait=source.match(/const waitCard = (\(\) => [^;]+);/)[1];
for(const [log,expected] of [[[],true],[[{type:'pass'}],false]])
 check('host waiting with '+log.length+' actions',runInNewContext('('+wait+')()',{host:true,asked:null,gone:()=>[1],S:{log,over:null}}),expected);
check('Guess warns before revealing',read('app/js/game.js').includes("t('help.firstHint')"),true);
check('Connect warning rendered before hint',read('app/js/connect-game.js').includes('class="help practice-hint"'),true);
// Icon-only deletion keeps the existing second-click/three-second confirmation.
const confirm = read('app/js/ui.js').match(/export function confirmClick[\s\S]*?\n}/)[0].replace('export ', '');
for (const iconOnly of [false, true]) {
 let click, expire, actions = 0, refits = 0;
 const attrs = { 'aria-label': 'Delete', title: 'Delete' };
 const button = { dataset: {}, innerHTML: '<svg></svg>', textContent: '', isConnected: true,
  addEventListener: (_, fn) => { click = fn; }, getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
 runInNewContext(confirm + ';confirmClick(button, action, refit, iconOnly)', {
  button, iconOnly, action: () => actions++, refit: () => refits++, t: () => 'Sure?',
  setTimeout: (fn, ms) => { expire = fn; check('confirmation timeout', ms, 3000); },
 });
 click();
 check('first click only arms '+iconOnly, [actions, button.dataset.armed], [0, '1']);
 check('confirmation presentation '+iconOnly, iconOnly ? [button.innerHTML, attrs['aria-label'], attrs.title] : button.textContent,
  iconOnly ? ['<svg></svg>', 'Sure?', 'Sure?'] : 'Sure?');
 expire();
 check('timeout restores delete '+iconOnly, [button.dataset.armed, button.innerHTML, attrs['aria-label'], attrs.title],
  [undefined, '<svg></svg>', 'Delete', 'Delete']);
 click(); click();
 check('second armed click deletes '+iconOnly, actions, 1);
}
console.log(fail?`${fail} of ${pass+fail} stats tests FAILED`:`all ${pass} stats tests passed`);
process.exit(fail?1:0);
