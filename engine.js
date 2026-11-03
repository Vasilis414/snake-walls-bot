/* Adapter for the Google Snake version inspected on 2026-11-03.
 * Reads exact state and wraps tick only to submit a legal turn before the
 * original tick. It never changes bodies, fruit, walls, score, speed or RNG.
 */
(() => {
  'use strict';
  const point=p=>p && Number.isInteger(p.x) && Number.isInteger(p.y);
  function matches(g) {
    try {
      return typeof g?.tick==='function' && typeof g.turn==='function' &&
        Array.isArray(g.oa?.ka) && g.oa.ka.length>=2 && g.oa.ka.every(point) &&
        Array.isArray(g.wa?.ka) && g.Ba?.Aa instanceof Map &&
        Number.isInteger(g.ka?.oa?.width) && Number.isInteger(g.ka?.oa?.height) &&
        Number.isFinite(g.rb) && g.rb>0 && typeof g.Jj==='boolean';
    } catch(_) {return false;}
  }
  function find() {
    const queue=[],seen=new WeakSet();
    // Only Google controller objects attached to this game page are examined.
    for(const element of document.querySelectorAll('[jscontroller]')) {
      const value=Object.getOwnPropertyDescriptor(element,'__jscontroller')?.value;
      if(value) queue.push([value,0]);
    }
    for(let i=0;i<queue.length && i<6000;i++) {
      const [value,depth]=queue[i];
      if(!value || typeof value!=='object' || seen.has(value) || value instanceof Node || value===window) continue;
      seen.add(value);
      if(matches(value)) return value;
      if(depth>=5 || value instanceof Map || value instanceof Set || Array.isArray(value)) continue;
      for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
        if(descriptor.value && typeof descriptor.value==='object') queue.push([descriptor.value,depth+1]);
      }
    }
    throw Error('Game engine not found. Click the game’s Play button first. This game version may need an adapter update.');
  }
  function snapshot(g) {
    if(!matches(g)) throw Error('Game engine shape changed.');
    const width=g.ka.oa.width,height=g.ka.oa.height;
    const valid=p=>point(p)&&p.x>=0&&p.y>=0&&p.x<width&&p.y<height;
    const body=g.oa.ka.map(p=>[p.x,p.y]);
    const apples=g.wa.ka.filter(f=>valid(f.pos)&&f.Dh!==false&&!f.Bea).map(f=>[f.pos.x,f.pos.y]);
    const walls=[...g.Ba.Aa.values()].filter(w=>valid(w.pos)).map(w=>[w.pos.x,w.pos.y]);
    return {width,height,body,apples,walls,growth:g.oa.Ua||0,
      direction:({RIGHT:[1,0],DOWN:[0,1],LEFT:[-1,0],UP:[0,-1]})[g.oa.direction]||[1,0],
      score:g.Ii,ticks:g.ticks,tickMs:g.rb,dead:g.Jj,paused:!!g.Ic,
      won:!!g.wb&&!g.Ic&&g.wa.ka.length===0,
      mode:g.settings?.yb,countMode:g.settings?.ka,multiMode:!!g.settings?.La};
  }
  function attach(g,before,after,onError) {
    const original=g.tick,own=Object.hasOwn(g,'tick');
    let attached=true;
    function restore() {
      if(!attached) return;
      attached=false;
      if(g.tick===wrapped) {if(own) g.tick=original;else delete g.tick;}
    }
    function wrapped(...args) {
      if(!attached) return original.apply(this,args);
      // Planner errors never suppress or duplicate the original game step.
      try {before(snapshot(this));} catch(error) {restore();try{onError(error);}catch(_){}}
      const result=original.apply(this,args);
      if(attached) {try {after(snapshot(this));} catch(error) {restore();try{onError(error);}catch(_){}}}
      return result;
    }
    g.tick=wrapped;
    return restore;
  }
  function turn(g,next) {
    const head=g.oa.ka[0],dx=next[0]-head.x,dy=next[1]-head.y;
    const dir=dx===1&&dy===0?'RIGHT':dx===-1&&dy===0?'LEFT':dy===1&&dx===0?'DOWN':dy===-1&&dx===0?'UP':null;
    if(!dir) throw Error('Planner returned a non-adjacent move.');
    if(g.oa.direction!==dir) g.turn(dir);
    if(g.oa.direction!==dir) throw Error('The game queued a different turn. Stop and start a fresh run.');
  }
  globalThis.SnakeEngineAdapter={find,snapshot,attach,turn,matches};
})();
