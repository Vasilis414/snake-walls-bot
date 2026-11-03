'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('./planner.js');
const base={width:10,height:9,body:[[3,4],[2,4],[1,4],[0,4]],direction:[1,0],growth:0,walls:[],apples:[[7,4],[5,2],[5,6]]};
assert(P.legal(base.body,P.choose(base),new Set(base.apples.map(P.key)),new Set()));
assert.notDeepEqual(P.choose({...base,walls:[[4,4]]}),[4,4]);
assert.equal(P.choose({...base,walls:[[4,4],[3,3],[3,5]]}),null);
const fruits=new Set(['4,4']);
let s=P.step(base,[4,4],fruits);
assert.equal(s.body.length,4,'eating does not retain the tail on this step');
assert.equal(s.growth,1,'growth is pending for the following step');
s=P.step(s,[5,4],new Set());
assert.equal(s.body.length,5,'pending growth retains the tail on the next step');
assert.equal(s.growth,0);
const loop=[[1,1],[1,2],[0,2],[0,1]];
assert(P.legal(loop,[0,1],new Set(),new Set(),0),'tail vacates without pending growth');
assert(P.legal(loop,[0,1],new Set(),new Set(),1),'Google excludes its last tail segment from collision checks even with pending growth');
const overlap=P.step({body:loop,growth:1},[0,1],new Set());
assert(P.same(overlap.body[0],overlap.body.at(-1)),'preserve the real one-step head/tail overlap when simulating growth');
const trap={...base,apples:[[3,3],[8,8]],walls:[[2,3],[4,3],[3,2]]};
assert.notDeepEqual(P.choose(trap),[3,3],'do not eat into a closed pocket');
function checkWitness(board,choice){
  assert(choice.next && choice.route.length && choice.witness.length);
  assert(P.same(choice.next,choice.route[0])&&P.same(choice.next,choice.witness[0]));
  let future={body:board.body,growth:board.growth||0},remaining=new Set(board.apples.map(P.key));
  const walls=new Set(board.walls.map(P.key));
  for(const next of choice.witness){
    assert(P.legal(future.body,next,remaining,walls,future.growth),'escape witness collides with a wall or body');
    future=P.step(future,next,remaining);remaining.delete(P.key(next));
  }
  assert(P.neighbors(future.body[0],board).some(next=>P.legal(future.body,next,remaining,walls,future.growth)),'checked continuation must not terminate in a dead end');
}
const growthChoice=require('./growth-choice-regression.json');
P.reset();
checkWitness(growthChoice,P.plan({...growthChoice,budgetMs:100}));
const dense=require('./dense-regression.json');
P.reset();
checkWitness(dense,P.plan({...dense,budgetMs:100}));
const recordedTrap=require('./trap-regression.json');
P.reset();const escape=P.plan({...recordedTrap,budgetMs:100});
checkWitness(recordedTrap,escape);
assert(escape.witness.length>=recordedTrap.body.length+10,'look ahead beyond a full tail cycle in the recorded trap');
assert.notDeepEqual(escape.route,[[6,3],[6,2],[5,2]],'replace the recorded trapping shortcut with a checked detour');

// A snake alternates checkerboard colors. A full-board endgame with a
// permanent imbalance beyond one cannot be filled; allow the one possible
// additional wall when zero growth is pending before an odd-score meal.
const hopeless=require('./unwinnable-regression.json');
assert.match(P.unwinnable(hopeless),/35\/39/);
const tinyWalls=[[0,0],[2,0]],tinyBody=[[3,3],[3,2],[3,1],[3,0]],tinyFood=[];
for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(![...tinyWalls,...tinyBody].some(p=>P.same(p,[x,y])))tinyFood.push([x,y]);
const imbalanced={width:4,height:4,mode:1,score:0,growth:0,walls:tinyWalls,body:tinyBody,apples:tinyFood};
assert.equal(P.unwinnable(imbalanced),null,'do not reject a board that a final wall might repair');
assert(P.unwinnable({...imbalanced,growth:1}),'with pending growth no repair wall can spawn');

// Unwinnability changes the objective; it must never discard remaining food.
P.reset();
const harvestChoice=P.plan({...hopeless,budgetMs:100});
assert(harvestChoice.next,'continue collecting apples on a proven unwinnable board');
assert.equal(harvestChoice.objective,'score');
assert(P.legal(hopeless.body,harvestChoice.next,new Set(hopeless.apples.map(P.key)),new Set(hopeless.walls.map(P.key)),hopeless.growth));

// This full, imbalanced board has no spawn holes. Its six cells of the rarer
// color bound the final path to 13 body cells (+ one pending growth), hence
// at most 14 - (4 + 1) = nine additional apples. Reach that bound in practice.
P.reset();
let harvestBoard={...imbalanced,growth:1},harvested=0;
for(let i=0;i<30;i++){
  const choice=P.plan({...harvestBoard,budgetMs:100});
  if(i===0)assert.equal(choice.additionalApples,9,'discover the maximum-score continuation');
  if(!choice.next)break;
  const food=new Set(harvestBoard.apples.map(P.key)),walls=new Set(harvestBoard.walls.map(P.key));
  assert(P.legal(harvestBoard.body,choice.next,food,walls,harvestBoard.growth));
  const next=P.step(harvestBoard,choice.next,food);
  assert(next.ate,'do not waste turns in a tail-following loop');
  harvested++;
  harvestBoard={...harvestBoard,...next,score:harvested,apples:harvestBoard.apples.filter(p=>!P.same(p,choice.next))};
}
assert.equal(harvested,9,'collect every apple permitted by the proven upper bound');
assert.equal(P.plan({...harvestBoard,budgetMs:100}).next,null);

// When clearing is impossible, a last apple is worth taking even if the move
// has no escape. Exercise both the exact policy and the beam fallback.
const lastMeal={width:3,height:3,mode:1,score:0,growth:1,
  body:[[1,1],[1,2]],walls:[[0,0],[2,0],[0,2],[2,2]],apples:[[1,0],[0,1],[2,1]]};
assert(P.unwinnable(lastMeal));
for(const budgetMs of [100,0]){
  P.reset();const choice=P.plan({...lastMeal,budgetMs});
  assert.equal(choice.objective,'score');
  assert(lastMeal.apples.some(p=>P.same(p,choice.next)),'take the final collectible apple instead of abandoning the run');
}

// Small complete-board positions have forced respawns, so a finish can be
// checked all the way to zero fruit, including a respawn at the old tail.
const ending={width:4,height:3,mode:0,score:4,growth:1,
  body:[[0,1],[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[2,2]],
  apples:[[1,1],[2,1],[1,2],[0,2]],walls:[]};
function replayForced(board,path,expectedWalls={}){
  let body=board.body,growth=board.growth,food=new Set(board.apples.map(P.key)),walls=new Set(board.walls.map(P.key));
  for(let t=0;t<path.length;t++){
    const q=path[t];assert(P.legal(body,q,food,walls,growth));
    const ate=food.has(P.key(q)),next=P.step({body,growth},q,food);body=next.body;growth=next.growth;
    if(ate){
      food.delete(P.key(q));for(const wall of expectedWalls[t+1]||[])walls.add(P.key(wall));
      const holes=[];for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){
        const p=[x,y];if(!body.some(b=>P.same(b,p))&&!food.has(P.key(p))&&!walls.has(P.key(p)))holes.push(p);
      }
      assert(holes.length<=1,'the fixture must have a forced respawn');
      if(holes.length)food.add(P.key(holes[0]));
    }
  }
  assert.equal(food.size,0,'finish must actually clear the fruit, not merely survive');
  assert.equal(new Set([...body.map(P.key),...walls]).size,board.width*board.height);
}
for(const growth of [0,1]){
  const board={...ending,growth},solution=P.finish(board,performance.now()+100);
  assert(solution);replayForced(board,solution.route);
}
const oneHole={...ending,body:ending.body.slice(0,-1)};
replayForced(oneHole,P.finish(oneHole,performance.now()+100).route);
const twoHoles={...ending,body:ending.body.slice(0,-2)};
P.reset();const policy=P.endgame(twoHoles,performance.now()+100);assert.equal(policy.value,1);
assert.deepEqual(policy.next,[0,2]);
for(const spawn of [[2,2],[3,2]]){
  const next=P.step(twoHoles,policy.next,new Set(twoHoles.apples.map(P.key)));
  const after={...twoHoles,...next,score:5,apples:[...twoHoles.apples.filter(p=>!P.same(p,policy.next)),spawn]};
  const solution=P.finish(after,performance.now()+100);assert(solution);replayForced(after,solution.route);
}
// Exercise the real plan() phase scheduling while simulating finish() using
// its entire allowance. The following policy phase must still have time.
let phaseClock=0;const phaseEntries=[];
const timedSandbox={module:{exports:{}},performance:{now:()=>phaseClock},
  consumeFinish:deadline=>{phaseClock=deadline;},
  enterPolicy:deadline=>phaseEntries.push({now:phaseClock,deadline})};
const timedSource=fs.readFileSync(__dirname+'/planner.js','utf8')
  .replace('function finish(b,deadline){',
    'function finish(b,deadline){const result=realFinish(b,deadline);consumeFinish(deadline);return result;} function realFinish(b,deadline){')
  .replace('function endgame(b,deadline,scoring=false){',
    'function endgame(b,deadline,scoring=false){enterPolicy(deadline);');
vm.runInNewContext(timedSource,timedSandbox);
const timedChoice=timedSandbox.module.exports.plan({...twoHoles,budgetMs:14});
assert(phaseEntries[0].deadline>phaseEntries[0].now,'reserve policy time even when finish exhausts its budget');
assert(timedChoice.search.expanded>0,'the subsequent policy actually performs useful work');
assert.equal(timedChoice.winLowerBound,1);

// A tiny expansion quota makes incremental frontier behavior deterministic,
// independent of CPU speed. Repeated calls must advance, not restart traversal.
P.reset();let previousSize=0;
for(let i=0;i<5;i++){
  P.endgame({...twoHoles,endgameExpansionLimit:1},performance.now()+100);
  const stats=P.endgameStats();
  assert.equal(stats.expanded,1,'use the retained frontier to expand one new state');
  assert(stats.cacheSize>previousSize,'new search work must accumulate across calls');
  assert.equal(stats.sameRoot,i>0);
  if(i>0)assert(stats.discovered<=3,'do not rediscover the entire cached graph on an unchanged board');
  previousSize=stats.cacheSize;
}
// Simulate saturation cheaply. Recovery must create a usable new graph, not
// leave the attempt unable to allocate states. No partial chance action may
// be committed as if its missing outcomes had a permanent value of zero.
P.reset();
P.endgame({...twoHoles,endgameNodeLimit:8},performance.now()+100);
assert(P.endgameStats().saturated);
P.endgame({...twoHoles,endgameNodeLimit:8},performance.now()+100);
assert(P.endgameStats().recovered,'rebuild saturated caches instead of remaining disabled');
assert(P.endgameStats().expanded>0);
assert(P.endgameStats().cacheSize<=8);
// Re-root the cached graph to an actual successor and recover the same proven
// finish, with no work spent backing up unreachable previous chance branches.
P.reset();P.endgame(twoHoles,performance.now()+100);
const moved=P.step(twoHoles,[0,2],new Set(twoHoles.apples.map(P.key)));
const reroot={...twoHoles,...moved,score:5,apples:[...twoHoles.apples.filter(p=>!P.same(p,[0,2])),[2,2]]};
const rerootPolicy=P.endgame(reroot,performance.now()+100);
assert.equal(rerootPolicy.value,1);
assert.equal(P.endgameStats().sameRoot,false);
assert(P.legal(reroot.body,rerootPolicy.next,new Set(reroot.apples.map(P.key)),new Set(),reroot.growth));
P.reset();

const serpentine=[];for(let y=0;y<5;y++)for(let j=0;j<5;j++)serpentine.push([y%2?4-j:j,y]);
const wallEnding={width:5,height:5,mode:1,score:0,growth:0,body:serpentine.slice(0,22).reverse(),apples:serpentine.slice(22),walls:[]};
const wallFinish=P.finish(wallEnding,performance.now()+100);assert(wallFinish);
replayForced(wallEnding,wallFinish.route,{1:[[0,0]]});

// Engine adapter contract: before/original/after order, one real tick,
// unchanged result, restoration, and errors never swallowing the real step.
const sandbox={Map,Set,Node:class{},document:{querySelectorAll:()=>[]},window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/engine.js','utf8'),sandbox);
const E=sandbox.SnakeEngineAdapter,events=[];
let calls=0;
class Game{
  constructor(){this.oa={ka:[{x:3,y:4},{x:2,y:4},{x:1,y:4},{x:0,y:4}],Ua:0,direction:'NONE'};this.wa={ka:[{pos:{x:7,y:4},Dh:true}]};this.Ba={Aa:new Map([[1,{pos:{x:0,y:0}}]])};this.ka={oa:{width:10,height:9}};this.rb=179.55;this.Jj=false;this.wb=false;this.Ii=0;this.ticks=0;}
  tick(){events.push('original');calls++;return 42;}
  turn(d){this.oa.direction=d;}
}
const game=new Game();assert(E.matches(game));
const snapshot=E.snapshot(game);assert.equal(snapshot.body[0][0],3,'use the real logical head, not the rendered eye cell');
assert.equal(snapshot.tickMs,179.55);assert.equal(snapshot.walls.length,1);
game.wb=true;game.Jj=true;game.Ic=true;
assert.equal(E.snapshot(game).won,false,'Google reuses the win animation flag when the player pauses');
assert.equal(E.snapshot(game).paused,true);
game.Ic=false;assert.equal(E.snapshot(game).won,false,'remaining apples rule out a win');
const oldFruit=game.wa.ka;game.wa.ka=[];assert.equal(E.snapshot(game).won,true);
game.wa.ka=oldFruit;game.wb=false;game.Jj=false;
let detach=E.attach(game,()=>events.push('before'),()=>events.push('after'),()=>assert.fail('unexpected adapter error'));
assert.equal(game.tick(),42);assert.deepEqual(events,['before','original','after']);assert.equal(calls,1);
detach();assert(!Object.hasOwn(game,'tick'),'restore inherited tick without leaving a wrapper');
let errors=0;detach=E.attach(game,()=>{throw Error('planner failed');},()=>assert.fail('after should be skipped'),()=>errors++);
assert.equal(game.tick(),42);assert.equal(calls,2);assert.equal(errors,1);assert(!Object.hasOwn(game,'tick'));
detach=E.attach(game,()=>{throw Error('planner failed again');},()=>assert.fail('unexpected after'),()=>{throw Error('error handler failed');});
assert.equal(game.tick(),42,'even a failing error handler must not swallow the original tick');assert.equal(calls,3);
E.turn(game,[4,4]);assert.equal(game.oa.direction,'RIGHT');
assert.throws(()=>E.turn(game,[8,8]),/non-adjacent/);

function simulate(seed){
  let rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  let b=structuredClone(base),score=0,visits={};
  const all=Array.from({length:90},(_,i)=>[i%10,Math.floor(i/10)]);
  const empty=()=>all.filter(p=>![...b.body,...b.walls,...b.apples].some(q=>P.same(p,q)));
  for(let i=0;i<400;i++){
    const choice=P.plan({...b,visits,budgetMs:3});
    if(!choice.next)return {seed,score,result:'blocked'};
    const set=new Set(b.apples.map(P.key));assert(P.legal(b.body,choice.next,set,new Set(b.walls.map(P.key)),b.growth));
    const future=P.step(b,choice.next,set);b.body=future.body;b.growth=future.growth;
    if(future.ate){
      score++;visits={};b.apples=b.apples.filter(p=>!P.same(p,choice.next));
      if(score%2===1){const candidates=empty().filter(p=>p[0]===0||p[0]===9||p[1]===0||p[1]===8);if(candidates.length)b.walls.push(candidates[Math.floor(rand()*candidates.length)]);}
      const available=empty();if(available.length)b.apples.push(available[Math.floor(rand()*available.length)]);
      if(!b.apples.length)return {seed,score,result:'cleared'};
    }
    visits[P.key(choice.next)]=(visits[P.key(choice.next)]||0)+1;
  }
  return {seed,score,result:'step limit'};
}
const results=process.argv.includes('--unit')?[]:[1,2,3,4,5].map(simulate);if(results.length)assert(results.some(r=>r.score>=10));
console.log('Passed: delayed growth, pending-tail collision, traps, exact-head state, tick order, tick restoration, planner error handling, full-route escape witnesses, recorded trap detour, exact endgame finishes, both fruit-spawn outcomes, and maximum-score unwinnable endgames, incremental frontier reuse, cache-cap recovery, and actual-state re-rooting.');
console.log(JSON.stringify(results,null,2));
