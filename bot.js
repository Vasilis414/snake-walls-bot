(() => {
  'use strict';
  if(document.getElementById('snake-bot-panel'))return;
  const P=globalThis.SnakePlanner,E=globalThis.SnakeEngineAdapter;
  const host=document.createElement('div');host.id='snake-bot-panel';host.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483647';
  const ui=host.attachShadow({mode:'open'});
  ui.innerHTML=`<style>:host{font:14px system-ui;color:#eaf2ff}section{width:280px;padding:16px;background:#142033;border:1px solid #496080;border-radius:14px;box-shadow:0 8px 32px #0005}h2{font-size:17px;margin:0 0 10px}p{font-size:12px;line-height:1.5;color:#bdcce0}button{font:inherit;padding:8px;border-radius:7px;border:0;margin:3px 3px 3px 0;cursor:pointer;background:#9ce26c;color:#142033}button.stop{background:#f6bb87}button.close{float:right;background:none;color:white;padding:0}output{display:block;white-space:pre-wrap;font-size:12px;line-height:1.5;margin-top:12px}</style>
<section><button class="close">×</button><h2>Snake Bot 2.2.1 · strategy</h2><p>Choose Walls and multiple apples, then click the game’s Play. Start on a fresh board. Keep this tab visible.</p><label style="display:block;font-size:12px;margin:10px 0"><input class="retry" type="checkbox"> Auto-run · retry until a win</label><button class="start">Start bot</button><button class="stop">Stop & menu</button><button class="report">Save diagnostics</button><output>Ready · existing synchronized turns</output></section>`;
  document.documentElement.append(host);
  const gameCanvas=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(gameCanvas){const r=gameCanvas.getBoundingClientRect();if(innerWidth-r.right<330&&r.left>330){host.style.left='12px';host.style.right='auto';}}
  const status=ui.querySelector('output');
  let engine=null,detach=null,running=false,pendingInitial=null,expected=null,visits={},lastScore=0,steps=0,maxPlanMs=0,lastPlanMs=0,lastMode='',result='ready',route=[],routeSignature='',lastDepth=0,lastSearch=null;
  let retryTimer=null,attempt=0;
  const history=[];
  const worldSignature=s=>s.apples.map(P.key).sort().join(';')+'|'+s.walls.map(P.key).sort().join(';');
  const trace=[];
  function record(type,data={}){trace.push({time:performance.now(),type,...data});if(trace.length>2000)trace.shift();}
  function keypress(key){const n={ArrowRight:39,ArrowDown:40,ArrowLeft:37,ArrowUp:38,Escape:27}[key];for(const type of ['keydown','keyup'])document.dispatchEvent(new KeyboardEvent(type,{key,code:key,keyCode:n,which:n,bubbles:true,cancelable:true}));}
  function render(s){
    const completed=history.filter(h=>['win','loss','unwinnable'].includes(h.kind));
    const best=Math.max(s.score,0,...history.map(h=>h.score)),average=completed.length?(completed.reduce((sum,h)=>sum+h.score,0)/completed.length).toFixed(1):'—';
    status.textContent=`${result}\nAttempt ${attempt} · ${s.score} apples · ${steps} steps\nBest ${best} · average ${average} · wins ${completed.filter(h=>h.kind==='win').length}\n${completed.length} finished · ${completed.filter(h=>h.kind==='unwinnable').length} unwinnable\n${s.width} × ${s.height} · ${s.body.length} body cells · ${s.walls.length} walls\n${lastMode} · depth ${lastDepth}${lastSearch?`\nEndgame +${lastSearch.expanded} states · cache ${lastSearch.cacheSize} · frontier ${lastSearch.frontier}${lastSearch.recovered?' · rebuilt':''}`:''}\nPlan ${lastPlanMs.toFixed(1)} ms · max ${maxPlanMs.toFixed(1)} ms\nEngine interval ${s.tickMs.toFixed(2)} ms`;
    // Visible diagnostic state is useful for automated UI checks and debugging.
    host.dataset.result=result;host.dataset.score=String(s.score);host.dataset.steps=String(steps);
  }
  function stop(message,menu=false){if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;}const wasRunning=running;running=false;if(detach){detach();detach=null;}result=message;record('stop',{message});try{if(wasRunning){const kind=message.startsWith('WIN')?'win':message.startsWith('Unwinnable')?'unwinnable':/No legal|Game over/.test(message)?'loss':'interrupted';history.push({attempt,kind,result:message,score:E.snapshot(engine).score,steps});}}catch(_){}if(menu)keypress('Escape');try{render(E.snapshot(engine));}catch(_){status.textContent=message;}}
  function retry(message){
    stop(message,true);
    if(!ui.querySelector('.retry').checked)return;
    result='Retrying · '+message;try{render(E.snapshot(engine));}catch(_){}
    retryTimer=setTimeout(()=>{
      retryTimer=null;
      if(document.hidden||!ui.querySelector('.retry').checked){stop('Retry paused');return;}
      const play=document.querySelector('[aria-label="Play"][role="button"]');
      if(!play?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})){stop('Retry stopped: game menu not visible');return;}
      play.click();
      retryTimer=setTimeout(()=>{retryTimer=null;if(ui.querySelector('.retry').checked&&!document.hidden)ui.querySelector('.start').click();},350);
    },1700);
  }
  function choose(s){
    const start=performance.now(),choice=P.plan({...s,visits});lastPlanMs=performance.now()-start;maxPlanMs=Math.max(maxPlanMs,lastPlanMs);lastMode=choice.mode;lastDepth=choice.depth||0;lastSearch=choice.search||null;
    record('plan',{state:s,choice,ms:lastPlanMs});return choice;
  }
  const ended=s=>{record('ended',{state:s});return s.won?'WIN · apples cleared':s.paused?'Paused or ended by game control':`Game over · ${s.score} apples`;};
  function before(s){
    if(!running)return;
    if(document.hidden){stop('Stopped: tab hidden',true);return;}
    if(s.dead||s.won){const message=ended(s);if(!s.won&&!s.paused&&ui.querySelector('.retry').checked)retry(message);else stop(message);return;}
    const appleSet=new Set(s.apples.map(P.key)),wallSet=new Set(s.walls.map(P.key));
    const routeValid=route.length && routeSignature===worldSignature(s) &&
      P.legal(s.body,route[0],appleSet,wallSet,s.growth);
    let choice;
    if(!pendingInitial&&routeValid){
      choice={next:route.shift(),mode:'following checked route',nodes:0};lastMode=choice.mode;lastPlanMs=0;record('plan',{state:s,choice,ms:0});
    }else{
      route=[];routeSignature='';choice=pendingInitial||choose(s);
      if(choice.route?.length){route=choice.route.slice(1);routeSignature=worldSignature(s);}
    }
    pendingInitial=null;
    if(!choice.next){retry(choice.reason||'No legal move remains');return;}
    if(!P.legal(s.body,choice.next,appleSet,wallSet,s.growth))throw Error('Rejected an illegal planned move.');
    E.turn(engine,choice.next);
    expected=P.step(s,choice.next,appleSet);
  }
  function after(s){
    if(!running)return;
    steps++;
    if(s.dead||s.won){const message=ended(s);if(!s.won&&!s.paused&&ui.querySelector('.retry').checked)retry(message);else stop(message);return;}
    if(expected && (expected.body.length!==s.body.length || expected.body.some((p,i)=>!P.same(p,s.body[i])))){
      record('state mismatch',{expected,actual:s});stop('Stopped: engine movement differed from prediction');return;
    }
    if(s.score!==lastScore){visits={};lastScore=s.score;route=[];routeSignature='';}
    visits[P.key(s.body[0])]=(visits[P.key(s.body[0])]||0)+1;
    record('step',{state:s});result=P.unwinnable?.(s)?'Maximizing apples · board cannot be cleared':'Running · synchronized to engine';render(s);
  }
  ui.querySelector('.start').onclick=()=>{
    if(running)return;
    if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;}
    try{
      engine=E.find();const s=E.snapshot(engine);
      if(s.dead||s.won||s.score!==0||!s.idle)throw Error('Click the game’s Play first and start on a fresh board.');
      if(s.multiMode || ![0,1].includes(s.mode))throw Error('This bot supports classic and Walls modes. Choose Walls first.');
      if(s.countMode!==undefined&&![1,2,3].includes(s.countMode))throw Error('Choose the fixed 3, 5 or many-apple setting. Random-count and special modes need a different model.');
      if(s.apples.length<2)throw Error('Choose multiple apples first.');
      P.reset?.();visits={};steps=0;lastScore=0;maxPlanMs=0;trace.length=0;expected=null;route=[];routeSignature='';lastDepth=0;
      pendingInitial=choose(s);if(!pendingInitial.next)throw Error('No legal starting move.');
      detach=E.attach(engine,before,after,error=>stop(`Stopped: ${error.message}`));
      attempt++;running=true;result='Running · synchronized to engine';render(s);
      ui.activeElement?.blur();document.activeElement?.blur();
      const delta=[pendingInitial.next[0]-s.body[0][0],pendingInitial.next[1]-s.body[0][1]];
      keypress(delta[0]===1?'ArrowRight':delta[0]===-1?'ArrowLeft':delta[1]===1?'ArrowDown':'ArrowUp');
    }catch(error){stop(error.message);}
  };
  ui.querySelector('.stop').onclick=()=>stop('Stopped by user',true);
  ui.querySelector('.close').onclick=()=>{stop('Closed',running);host.remove();};
  ui.querySelector('.report').onclick=()=>{
    let state=null;try{state=E.snapshot(engine);}catch(_){}
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:P.version||'2.2.1',result,steps,attempt,history,maxPlanMs,state,trace},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='snake-bot-v2-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
