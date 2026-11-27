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
  recordLettersMove, recordLettersEnd, recordConnectEnd, recordTilesEnd, collect, collected, totals, tilesProgress, tilesRecord, playClock, saveStats, bestGuessWin, listSaves, deleteSave, SAVE_LIMIT } = await import('../app/js/store.js');
const { newGame: tilesGame, STANDARD, apply, premiums, sizeOf } = await import('../app/js/tiles.js');
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
  check('setup records participation only ' + i, [stats.rec[g.id].pr, stats.rec[g.id].ms, stats.rec[g.id].g, stats.rec[g.id].f, stats.rec[g.id].moves], [1,0,undefined,undefined,undefined]);
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
check('first hint keeps earlier fields and flags practice', stats.rec[g.id], {...before,pr:1});
check('later Guess word excluded from Collection', collected('guess', 'en').has('dog'), false);
check('later Guess word excluded from distinct words', stats.unique.includes('en:dog'), false);
g.friend = false; g.guesses = [];
check('practice cannot be undone', counts(g), false);
g.status = 'won'; recordEnd(g, true);
check('practice completion keeps earlier move and outcome', [stats.rec[g.id].g,stats.rec[g.id].ch,stats.rec[g.id].end], [1,3,'won']);
check('practice Guess quality excluded', [totals('guess','en').guesses,bestGuessWin()], [0,0]);
const cn = newGame({mode:'connect',lang:'pl',hints:0,shown:[]});
recordMove(cn,{f:2,b:1});collect('connect','pl','kot',cn);
markPractice(cn);cn.hints=1;cn.shown.push('1-1');
recordMove(cn,{f:9,b:8});collect('connect','pl','pies',cn);
cn.status='won';recordConnectEnd(cn,{f:9,b:8});
check('Connect keeps earlier fields and outcome', [stats.rec[cn.id].f,stats.rec[cn.id].b,stats.rec[cn.id].end], [2,1,'won']);
check('Connect practice quality excluded', [totals('connect','pl').words,totals('connect','pl').bonus], [0,0]);
check('Connect stops later Collection',collected('connect','pl').has('pies'),false);
const lt=newGame({mode:'letters',lang:'en',tries:6});recordMove(lt,{g:2});lt.status='lost';recordLettersEnd(lt);
check('Letters exhausted tries counts as finished',totals('letters','en').finished,1);
const gave=newGame({mode:'letters',lang:'en',tries:6});recordMove(gave,{g:1});gave.status='gaveup';recordLettersEnd(gave);
check('Letters surrender is not finished',totals('letters','en').finished,1);
// Time is the one exception: visible, active practice still counts.
const realNow=Date.now, realInterval=globalThis.setInterval, realClear=globalThis.clearInterval;
let time=10000, nextTimer=0, modal=false, canPlay=true;
const timers=new Map();
Date.now=()=>time;
globalThis.setInterval=fn=>{timers.set(++nextTimer,fn);return nextTimer;};
globalThis.clearInterval=id=>timers.delete(id);
const tick=(ms=1000)=>{time+=ms;for(const fn of [...timers.values()]) fn();};
const eventTarget=()=>{
  const events=new Map();
  return {events,addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)};
};
globalThis.window=eventTarget();
globalThis.document={ ...document, body:{}, querySelector:()=>modal };
const timed=newGame({lang:'en',friend:true});recordGuess(timed,'cat','cat');const timeBefore=stats.timeMs;
const gameHash='#/game/'+timed.id;
globalThis.location={hash:gameHash};
const clockScreen={...eventTarget(),isConnected:true};
const stop=playClock(clockScreen,timed,()=>canPlay);
tick();check('opening a game without input adds no time',timed.timeMs,0);
clockScreen.events.get('pointerdown')();tick();
check('practice play time counts',[timed.timeMs,stats.timeMs-timeBefore],[1000,1000]);
check('practice record time ticks',stats.rec[timed.id].ms,1000);
document.visibilityState='hidden';tick();check('hidden time excluded',timed.timeMs,1000);
document.visibilityState='visible';
modal=true;tick();check('open dialog excludes time despite recent gameplay',timed.timeMs,1000);
tick(60001);
window.events.get('keydown')({target:document.body});
modal=false;tick();check('dialog input does not extend gameplay',timed.timeMs,1000);
window.events.get('keydown')({target:document.body});tick();
check('keyboard play with focus on the page counts',timed.timeMs,2000);
canPlay=false;tick();check('a covered board or a turn the player cannot take excludes time',timed.timeMs,2000);
tick(60001);clockScreen.events.get('pointerdown')();
canPlay=true;tick();check('input while play was blocked does not extend gameplay',timed.timeMs,2000);
clockScreen.events.get('input')();tick();check('phone keyboard input resumes time',timed.timeMs,3000);
const replacement={...eventTarget(),isConnected:true};
playClock(replacement,timed);
stop();
check('re-render replaces the clock and removes earlier listeners',[timers.size,clockScreen.events.size,window.events.size],[1,0,2]);
replacement.events.get('pointerdown')();tick();
check('replacement adds exactly one tick',[timed.timeMs,stats.timeMs-timeBefore,stats.rec[timed.id].ms],[4000,4000,4000]);
location.hash='#/';tick();
check('menu stops the clock even before the previous screen is removed',[timed.timeMs,timers.size,replacement.events.size,window.events.size],[4000,0,0,0]);
location.hash=gameHash;
playClock(replacement,timed);
replacement.events.get('pointerdown')();
replacement.isConnected=false;tick();
check('detached screen cleans up',[timed.timeMs,timers.size,replacement.events.size,window.events.size],[4000,0,0,0]);
playClock(clockScreen,timed);
clockScreen.events.get('pointerdown')();timed.status='won';tick();
check('finished game cleans up',[timed.timeMs,timers.size,clockScreen.events.size,window.events.size],[4000,0,0,0]);
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
const noTime={played:1,timeMs:0,timedGames:0,avgTime:null};
check('historical Guess totals',totals('guess','all',historical),{...noTime,finished:3,guesses:23,distinct:2,letters:69});
check('language-filtered Guess totals',totals('guess','en',historical),{...noTime,finished:1,guesses:3,distinct:1,letters:9});
check('historical Letters totals',totals('letters','all',historical),{...noTime,finished:8,solved:3,wonPct:37.5,letters:0,green:0,yellow:0});
check('historical Connect totals',totals('connect','all',historical),{...noTime,finished:6,words:44,bonus:10,bonusPerGame:2});
check('historical Tiles totals',totals('tiles','all',historical),{...noTime,played:7,finished:0,words:52,tiles:5,
 wordsFormed:0,wordPoints:0,avgWordPoints:null,bestWord:null,longest:null,seven:0,bonuses:{d:0,t:0,D:0,T:0}});
check('historical storage fields untouched',historical,untouched);
historical.rec.d.finished=1;
check('known natural Tiles finish counts',totals('tiles','all',historical).finished,1);
// Loading and saving an actual old-format payload preserves all stored records and historical totals.
const oldLoad=spawnSync(process.execPath,['--input-type=module','-e',`
 let value=process.argv[1];
 Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>k==='wg.stats'?value:null,setItem:(k,v)=>{if(k==='wg.stats')value=v;}}});
 const {stats,saveStats}=await import(${JSON.stringify(new URL('../app/js/store.js',import.meta.url).href)});
 saveStats(); const saved=JSON.parse(value); console.log(JSON.stringify([saved.rec,saved.lt,saved.cn,saved.tl]));
`,JSON.stringify(historical)],{encoding:'utf8'});
check('old-format load succeeds',oldLoad.status,0);
check('old-format records and totals survive load/save',JSON.parse(oldLoad.stdout),[historical.rec,historical.lt,historical.cn,historical.tl]);
for (const mode of ['guess','letters','connect','tiles']) {
 const sample=newGame({mode,lang:'en'});sample.timeMs=1234;recordMove(sample,{});
 check(mode+' record keeps per-game active time',stats.rec[sample.id].ms,1234);
}
const lettering=newGame({mode:'letters',lang:'pl',tries:6,secret:'żółw',len:4});
lettering.guesses.push('wółw');recordLettersMove(lettering,'wółw');
lettering.guesses.push('łżów');recordLettersMove(lettering,'łżów');
check('Letters submitted feedback counts with repeats and Polish letters',
 [stats.rec[lettering.id].ch,stats.rec[lettering.id].gr,stats.rec[lettering.id].yl],[8,4,3]);
noteMove(lettering,{g:2});
check('Letters non-row updates do not recount letters',stats.rec[lettering.id].ch,8);
const beforeQuality=structuredClone(stats.rec[lettering.id]);markPractice(lettering);
lettering.guesses.push('żółw');recordLettersMove(lettering,'żółw');
check('Letters practice freezes prior row fields',[stats.rec[lettering.id].ch,stats.rec[lettering.id].gr,stats.rec[lettering.id].yl],
 [beforeQuality.ch,beforeQuality.gr,beforeQuality.yl]);
check('Letters practice omitted from typed totals',totals('letters','pl').letters,0);

const prem=premiums(state.board), n=sizeOf(state.board);
const bonusTiles=['d','t','D','T'].map(k=>{const i=prem.indexOf(k);return {r:Math.floor(i/n),c:i%n,ch:'a'};});
const wordMove={p:0,kind:'play',placed:bonusTiles,words:[{w:'cat',score:6},{w:'letters',score:14}],score:70};
const owned=newGame({mode:'tiles',lang:'en',state:{...three,moves:[wordMove,
 {...wordMove,p:1,words:[{w:'computer',score:999}]},
 {...wordMove,p:2,words:[{w:'remoteplayer',score:888}]},
 {...wordMove,hinted:'small',words:[{w:'hinted',score:777}]},
 {...wordMove,approved:['invented'],words:[{w:'invented',score:666}]}]}});
owned.statsDone=0;recordMove(owned,tilesProgress(owned,0));
let detail=stats.rec[owned.id];
check('Tiles counts all words, uses word points without rack bonus',[detail.wc,detail.wp,detail.seven],[2,20,1]);
check('Tiles best single word and longest word',[detail.bw.w,detail.bw.score,typeof detail.bw.at,detail.long.w],['letters',14,'number','letters']);
check('Tiles bonus squares split by kind',detail.bx,{d:1,t:1,D:1,T:1});
const ownedFields=structuredClone([detail.wc,detail.wp,detail.bw,detail.long,detail.bx]);
noteMove(owned,tilesProgress(owned,0));
check('Tiles quality replay is idempotent',[detail.wc,detail.wp,detail.bw,detail.long,detail.bx],ownedFields);
const repeated=newGame({mode:'tiles',lang:'en',state:{...three,rules:{...three.rules,premiums:'always'},moves:[{
 p:0,kind:'play',placed:[],words:[{w:'at',score:4,r:7,c:7,across:true},{w:'at',score:4,r:7,c:7,across:false}]
}]}});
repeated.statsDone=0;recordMove(repeated,tilesProgress(repeated,0));
check('always premiums include occupied centre only once per move',stats.rec[repeated.id].bx,{d:0,t:0,D:1,T:0});
check('new engine moves retain word positions for reused squares',
 ['r','c','across'].every(k=>k in state.moves[0].words[0]),true);
const training=newGame({mode:'tiles',lang:'en',state:{...state,rules:{...state.rules,undo:true}}});
training.timeMs=5000;training.statsDone=0;recordMove(training,tilesProgress(training,0));
training.state={...training.state,over:{reason:'out',winner:0}};
recordTilesEnd(training,0,{});
check('real practice Tiles game retains time and finish but no word quality',
 [stats.rec[training.id].pr,stats.rec[training.id].ms,stats.rec[training.id].end,stats.rec[training.id].finished,
 stats.rec[training.id].wc,stats.rec[training.id].wp,stats.rec[training.id].bw],[1,5000,'done',1,undefined,undefined,undefined]);
const data={...blank(),rec:{
 old:{m:'tiles',lang:'en',moves:4,end:'done'},
 own:{m:'tiles',lang:'en',ms:2000,wc:2,wp:20,bw:{w:'letters',score:14,at:1},long:{w:'letters',score:14,at:1},seven:1,bx:{d:1,t:2,D:3,T:4}},
 newer:{m:'tiles',lang:'en',ms:4000,wc:1,wp:7,bw:{w:'longword',score:7,at:2},long:{w:'longword',score:7,at:2},seven:0,bx:{d:1,t:0,D:0,T:0}},
 practice:{m:'tiles',lang:'en',pr:1,ms:6000,wc:999,wp:9999,bw:{w:'cheating',score:9999,at:3},long:{w:'cheatingword',score:9999,at:3},seven:999,bx:{d:99,t:99,D:99,T:99},finished:1},
 other:{m:'tiles',lang:'pl',ms:8000,wc:1,wp:100,bw:{w:'kot',score:100,at:4}},
}};
const aggregate=totals('tiles','en',data);
check('practice counts for played, time and natural finish',[aggregate.played,aggregate.timeMs,aggregate.avgTime,aggregate.finished],[4,12000,4000,1]);
check('old/practice records excluded from per-word average',[aggregate.wordsFormed,aggregate.wordPoints,aggregate.avgWordPoints],[3,27,9]);
check('practice excluded from records and bonus use',[aggregate.bestWord.w,aggregate.longest.w,aggregate.seven,aggregate.bonuses],['letters','longword',1,{d:2,t:2,D:3,T:4}]);
check('all-language average includes new Polish record',totals('tiles','all',data).avgWordPoints,127/4);
const lettersTotals=totals('letters','all',{...blank(),rec:{
 a:{m:'letters',lang:'en',ch:10,gr:4,yl:3,end:'won'},b:{m:'letters',lang:'pl',ch:8,gr:2,yl:1,end:'lost'},
 old:{m:'letters',end:'won'},practice:{m:'letters',pr:1,ch:999,gr:999,yl:999,end:'won'}}});
check('new Letters fields sum only fair rows',[lettersTotals.letters,lettersTotals.green,lettersTotals.yellow,lettersTotals.solved,lettersTotals.finished],[18,6,4,2,4]);
check('Letters win rate uses fair finished games',lettersTotals.wonPct,2/3*100);
const bonusData={...blank(),rec:{a:{m:'connect',b:2},b:{m:'connect',b:0},old:{m:'connect'},practice:{m:'connect',pr:1,b:99}}};
check('Connect average counts recorded zero and excludes missing/practice',totals('connect','all',bonusData).bonusPerGame,1);
const {migrateAchievements}=await import('../app/js/achievements.js');
migrateAchievements(bonusData);
check('achievement migration excludes practice bonus words',bonusData.ach.n['connect.bonus'],2);
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
const { statsScreen, achievementsScreen, games }=await import('../app/js/screens.js');
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
 check(lang+' exact hint warning',t('help.firstHint'),lang==='en'?'Using a hint turns this game into practice: games and time count, but word and score statistics and achievements do not.':'Podpowiedź zmienia tę grę w trening: gry i czas się liczą, ale statystyki słów i punktów oraz osiągnięcia nie.');
 check(lang+' exact setup warning',t('help.setupPractice'),lang==='en'?'With help on, this game is practice: games and time count, but word and score statistics and achievements do not.':'Z pomocą ta gra jest treningiem: gry i czas się liczą, ale statystyki słów i punktów oraz osiągnięcia nie.');
 statsScreen(screen,null,()=>{});
 for(const tab of ['general','guess','letters','connect','tiles']) {
  handlers[tab]();statsScreen(screen,null,()=>{});
  check(lang+' '+tab+' language filter',screen.innerHTML.includes('data-f-lang="pl"'),tab!=='general');
  check(lang+' '+tab+' no level filter',screen.innerHTML.includes('data-f-lv'),false);
  for(const key of ['stats.time','stats.avgTime','stats.played']) check(lang+' '+tab+' shows '+key,screen.innerHTML.includes(t(key)),true);
  check(lang+' '+tab+' all labels translated',/class="lbl">(?:<[^>]+>)*stats\./.test(screen.innerHTML),false);
  for(const key of ['stats.avgWin','stats.bestWin','stats.streakNow','stats.longest','stats.wordsPerGame','stats.hints'])
   check(lang+' '+tab+' shows only applicable '+key,screen.innerHTML.includes(t(key)),tab==='tiles'&&key==='stats.longest');
  if(tab==='general') {
   check(lang+' finished-by-mode heading',screen.innerHTML.includes(t('stats.byMode')),true);
   check(lang+' per-mode counts have glyphs',(screen.innerHTML.match(/class="lbl"><svg class="glyph /g)??[]).length,4);
  }
  if(tab==='letters') {
   for(const key of ['stats.won','stats.green','stats.yellow','stats.letters'])check(lang+' Letters '+key,screen.innerHTML.includes(t(key)),true);
   check(lang+' Letters removes duplicate solved cell',screen.innerHTML.includes(t('stats.wordsSolved')),false);
  }
  if(tab==='connect') check(lang+' Connect bonus average',screen.innerHTML.includes(t('stats.bonusPerGame')),true);
  if(tab==='tiles') for(const key of ['stats.tiles.wordsFormed','stats.tiles.avgWordPoints','stats.tiles.bestWord','stats.tiles.seven','stats.tiles.bonuses',
   'stats.tiles.bonus.d','stats.tiles.bonus.t','stats.tiles.bonus.D','stats.tiles.bonus.T'])check(lang+' Tiles '+key,screen.innerHTML.includes(t(key)),true);
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
// Owner, 2026-11-20: per-mode LRU saves, without erasing lifetime records.
for (const saved of listSaves()) deleteSave(saved.id);
// Empty lists use the same separate action footer, including online Tiles when supported.
window.__netMock = { bt: {} };
for (const mode of ['guess', 'letters', 'connect', 'tiles']) {
  games(screen, mode, () => {});
  const footer = screen.innerHTML.split('class="games-actions"')[1];
  check(mode + ' has fixed footer with one New game', [!!footer, screen.innerHTML.split(t('games.new')).length - 1], [true, 1]);
  check(mode + ' online action only where supported', footer.includes('#/online'), mode === 'tiles');
}
delete window.__netMock;
const clockBeforeLimit = Date.now;
let saveTime = clockBeforeLimit(), evictions = 0;
Date.now = () => ++saveTime;
document.dispatchEvent = event => { if (event.type === 'lexling:save-evicted') evictions++; };
const modeGames = {};
for (const mode of ['guess', 'letters', 'connect', 'tiles']) {
  modeGames[mode] = Array.from({ length: SAVE_LIMIT }, () => newGame({ mode, lang: 'en', tries: 6 }));
  check(mode + ' allows exactly 20 saves', listSaves().filter(g => g.mode === mode).length, 20);
}
check('no eviction at limit', evictions, 0);
for (const [mode, saved] of Object.entries(modeGames)) {
  const [oldest, victim] = saved;
  recordMove(victim, { g: 4 });
  putSave(oldest); // Resuming the oldest creation makes it the most recently played.
  const next = newGame({ mode, lang: 'en', tries: 6 });
  check(mode + ' remains capped', listSaves().filter(g => g.mode === mode).length, SAVE_LIMIT);
  check(mode + ' evicts least recently played', getSave(victim.id), undefined);
  check(mode + ' keeps resumed and new games', [!!getSave(oldest.id), !!getSave(next.id)], [true, true]);
  check(mode + ' keeps evicted statistics', [stats.rec[victim.id].g, stats.rec[victim.id].end], [4, 'left']);
  check(mode + ' persists eviction', JSON.parse(storage.get('wg.saves')).some(g => g.id === victim.id), false);
  const evictionsBeforeUpdate = evictions;
  putSave({ ...oldest });
  check(mode + ' updates by id without duplicate or eviction', [listSaves().filter(g => g.mode === mode).length, evictions], [SAVE_LIMIT, evictionsBeforeUpdate]);
}
check('one notice per overflowing mode', evictions, 4);
const guest = newGame({ mode: 'tiles', lang: 'en', live: true });
check('live guest does not consume save allowance', [listSaves().length, !!getSave(guest.id), evictions], [SAVE_LIMIT * 4, true, 4]);
for (const lang of ['en', 'pl']) {
  setLang(lang);
  check(lang + ' eviction notice translated', t('games.limitRemoved') !== 'games.limitRemoved', true);
}
Date.now = clockBeforeLimit;
delete document.dispatchEvent;
console.log(fail?`${fail} of ${pass+fail} stats tests FAILED`:`all ${pass} stats tests passed`);
process.exit(fail?1:0);
