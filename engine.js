/* Adapter for the Google Snake versions inspected on 2026-11-03 and 2026-11-05.
 * Reads exact state and wraps tick only to submit a legal turn before the
 * original tick. It never changes bodies, fruit, walls, score, speed or RNG.
 */
(() => {
  'use strict';
  const point=p=>p && Number.isInteger(p.x) && Number.isInteger(p.y);
  // Keep verified layouts explicit. Never guess a controller from a single
  // minified field; require its methods, complete body, board and state flags.
  const layouts=[
    {id:'2026-11-05',snake:'Yc',fruit:'oa',walls:'Tw',wallMap:'wa',growth:'Ra',interval:'Ya',score:'Ci',dead:'yj',paused:'kc',won:'Ua',active:'yh',poison:'Vea'},
    {id:'2026-11-03',snake:'oa',fruit:'wa',walls:'Ba',wallMap:'Aa',growth:'Ua',interval:'rb',score:'Ii',dead:'Jj',paused:'Ic',won:'wb',active:'Dh',poison:'Bea'}
  ];
  function parts(g) {
    try {
      if(typeof g?.tick!=='function'||typeof g.turn!=='function')return null;
      for(const layout of layouts){
        const snake=g[layout.snake],fruit=g[layout.fruit]?.ka,walls=g[layout.walls]?.[layout.wallMap];
        if(Array.isArray(snake?.ka)&&snake.ka.length>=2&&snake.ka.every(point)&&
          Array.isArray(fruit)&&walls instanceof Map&&
          Number.isInteger(g.ka?.oa?.width)&&Number.isInteger(g.ka?.oa?.height)&&
          Number.isFinite(g[layout.interval])&&g[layout.interval]>0&&
          typeof g[layout.dead]==='boolean')return {layout,snake,fruit,walls};
      }
    } catch(_) {}
    return null;
  }
  const matches=g=>!!parts(g);
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
    throw Error('Game engine not found. Start a fresh board with the game’s Play button. If the board is already visible, this Google game build needs an adapter update.');
  }
  function snapshot(g) {
    const state=parts(g);
    if(!state)throw Error('Game engine shape changed.');
    const {layout,snake,fruit,walls:wallMap}=state;
    const width=g.ka.oa.width,height=g.ka.oa.height;
    const valid=p=>point(p)&&p.x>=0&&p.y>=0&&p.x<width&&p.y<height;
    const body=snake.ka.map(p=>[p.x,p.y]);
    const apples=fruit.filter(f=>valid(f.pos)&&f[layout.active]!==false&&!f[layout.poison]).map(f=>[f.pos.x,f.pos.y]);
    const walls=[...wallMap.values()].filter(w=>valid(w.pos)).map(w=>[w.pos.x,w.pos.y]);
    return {width,height,body,apples,walls,growth:snake[layout.growth]||0,
      direction:({RIGHT:[1,0],DOWN:[0,1],LEFT:[-1,0],UP:[0,-1]})[snake.direction]||[1,0],
      idle:snake.direction==='NONE',engineLayout:layout.id,
      score:g[layout.score],ticks:g.ticks,tickMs:g[layout.interval],
      dead:g[layout.dead],paused:!!g[layout.paused],
      won:!!g[layout.won]&&!g[layout.paused]&&fruit.length===0,
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
    const state=parts(g);if(!state)throw Error('Game engine shape changed.');
    const snake=state.snake,head=snake.ka[0],dx=next[0]-head.x,dy=next[1]-head.y;
    const dir=dx===1&&dy===0?'RIGHT':dx===-1&&dy===0?'LEFT':dy===1&&dx===0?'DOWN':dy===-1&&dx===0?'UP':null;
    if(!dir) throw Error('Planner returned a non-adjacent move.');
    if(snake.direction!==dir) g.turn(dir);
    if(snake.direction!==dir) throw Error('The game queued a different turn. Stop and start a fresh run.');
  }
  globalThis.SnakeEngineAdapter={find,snapshot,attach,turn,matches};
})();
