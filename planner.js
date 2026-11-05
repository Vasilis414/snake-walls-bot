/* Google Snake: exact delayed-growth model and bounded moving-body search.
 * A turn is scored by the continuations it leaves, not just food distance.
 */
(function(root){
  'use strict';
  const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
  const key=p=>p.join(',');
  const same=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1];
  const neighbors=(p,b)=>DIRS.map(d=>[p[0]+d[0],p[1]+d[1]]).filter(q=>q[0]>=0&&q[1]>=0&&q[0]<b.width&&q[1]<b.height);
  function legal(body,next,apples,walls,growth=0){
    // This matches Google's collision loop, including its last-tail-cell
    // exception while growth is pending. Keep overlaps in the simulated body.
    return !walls.has(key(next))&&!same(next,body[1])&&!body.slice(1,-1).some(p=>same(p,next));
  }
  function step(state,next,apples){
    const ate=apples.has(key(next));
    return {body:[next,...(state.growth>0?state.body:state.body.slice(0,-1))],growth:Math.max(0,state.growth-1)+(ate?1:0),ate};
  }
  function advance(body,next,apples,growth=0){return step({body,growth},next,apples).body;}
  function room(body,walls,b){
    const blocked=new Set([...walls,...body.slice(1,-1).map(key)]),queue=[body[0]],seen=new Set([key(body[0])]);
    for(let i=0;i<queue.length;i++)for(const q of neighbors(queue[i],b))if(!blocked.has(key(q))&&!seen.has(key(q))){seen.add(key(q));queue.push(q);}
    return {size:seen.size,tail:seen.has(key(body.at(-1)))};
  }
  function wallAllowed(cell,head,wallIds,W,H){
    const x=cell%W,y=Math.floor(cell/W);
    if(head!==null&&Math.abs(x-head%W)+Math.abs(y-Math.floor(head/W))<=3)return false;
    if((x===0||x===W-1)&&(y===1||y===H-2)||(y===0||y===H-1)&&(x===1||x===W-2))return false;
    for(const w of wallIds){const a=w%W,c=Math.floor(w/W);
      if(Math.max(Math.abs(x-a),Math.abs(y-c))<=1)return false;
      if(x===a&&(x===0||x===W-1)&&Math.abs(y-c)<=2)return false;
      if(y===c&&(y===0||y===H-1)&&Math.abs(x-a)<=2)return false;
      for(const [u,v]of [[0,0],[W-1,0],[0,H-1],[W-1,H-1]])if(Math.abs(a-u)+Math.abs(c-v)===2&&Math.abs(x-u)+Math.abs(y-v)===2&&(a===u||c===v)&&(x===u||y===v))return false;
    }
    return true;
  }
  function unwinnable(b){
    if(![0,1].includes(b.mode))return null;
    if(b.countMode!==undefined&&![1,2,3].includes(b.countMode))return null;
    const occupied=new Set([...b.body,...b.walls,...b.apples].map(key)),empty=b.width*b.height-occupied.size;
    const wall=new Set(b.walls.map(key)),colors=[0,0];
    for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(!wall.has(key([x,y])))colors[(x+y)%2]++;
    // Each extra wall uses an empty-cell resource. Pending growth does not
    // create a new hole; zero growth can supply at most one additional hole
    // before growth resumes. This is an upper bound, not a random assumption.
    let possibleWall=b.mode===1?empty+(!b.growth?1:0):0;
    if(empty===0&&!b.growth&&(b.score+1)%2!==1)possibleWall=0;
    if(Math.abs(colors[0]-colors[1])>1+possibleWall)return `Unwinnable endgame: free-cell colors ${colors[0]}/${colors[1]} cannot be covered by one snake.`;
    return null;
  }
  function finish(b,deadline){
    const W=b.width,H=b.height,N=W*H,id=p=>p[1]*W+p[0],point=i=>[i%W,Math.floor(i/W)];
    const body=b.body.map(id),wallIds=b.walls.map(id),fruitIds=b.apples.map(id);
    const empty=N-new Set(body).size-wallIds.length-fruitIds.length;
    if(empty!==0 && !(empty===1&&(b.growth||0)>0))return null;
    const bits=Array.from({length:N},(_,i)=>1n<<BigInt(i));
    const adjacent=Array.from({length:N},(_,i)=>neighbors(point(i),b).map(id));
    let fruit=0n,wall=0n;for(const i of fruitIds)fruit|=bits[i];for(const i of wallIds)wall|=bits[i];
    const seen=new Map();let nodes=0,expired=false;
    function wallAllowed(cell,head,walls){
      const [x,y]=point(cell),[hx,hy]=point(head);
      if(Math.abs(x-hx)+Math.abs(y-hy)<=3)return false;
      if((x===0||x===W-1)&&(y===1||y===H-2)||(y===0||y===H-1)&&(x===1||x===W-2))return false;
      for(const w of walls){const [a,c]=point(w);
        if(Math.max(Math.abs(x-a),Math.abs(y-c))<=1)return false;
        if(x===a&&(x===0||x===W-1)&&Math.abs(y-c)<=2)return false;
        if(y===c&&(y===0||y===H-1)&&Math.abs(x-a)<=2)return false;
        for(const [u,v]of [[0,0],[W-1,0],[0,H-1],[W-1,H-1]])
          if(Math.abs(a-u)+Math.abs(c-v)===2&&Math.abs(x-u)+Math.abs(y-v)===2&&(a===u||c===v)&&(x===u||y===v))return false;
      }
      return true;
    }
    function visit(n,depth){
      if(!n.fruit)return [];
      if(depth>N*2)return null;
      if(++nodes>14000||(nodes%16===0&&performance.now()>=deadline)){expired=true;return null;}
      const signature=n.body.join(',')+'/'+n.growth+'/'+n.fruit+'/'+n.wall+'/'+(n.score%2);
      if((seen.get(signature)??Infinity)<=depth)return null;seen.set(signature,depth);
      const options=adjacent[n.body[0]].filter(q=>!(n.wall&bits[q])&&q!==n.body[1]&&!(n.body.indexOf(q,1)>=0&&n.body.indexOf(q,1)<n.body.length-1));
      options.sort((a,c)=>{
        const foodA=!!(n.fruit&bits[a]),foodC=!!(n.fruit&bits[c]);
        if(foodA!==foodC)return foodA?-1:1;
        return adjacent[a].filter(q=>n.fruit&bits[q]).length-adjacent[c].filter(q=>n.fruit&bits[q]).length;
      });
      for(const q of options){
        const ate=!!(n.fruit&bits[q]),tail=n.body.at(-1);
        const nextBody=[q,...(n.growth>0?n.body:n.body.slice(0,-1))];
        let nextFruit=ate?n.fruit&~bits[q]:n.fruit,nextWall=n.wall,nextWalls=n.walls;
        const score=n.score+(ate?1:0);
        // Certify only deterministic endgame branches. With no empty cell,
        // or one empty cell plus pending growth, respawns often have exactly
        // one possible position. Never assume a favorable random choice.
        if(ate){
          const occupied=new Set(nextBody),holes=[];
          for(let cell=0;cell<N;cell++)if(!occupied.has(cell)&&!(nextFruit&bits[cell])&&!(nextWall&bits[cell]))holes.push(cell);
          if(b.mode===1&&score%2===1){
            const options=holes.filter(cell=>wallAllowed(cell,q,n.walls));
            if(options.length>1)continue;
            if(options.length===1){const cell=options[0];nextWall|=bits[cell];nextWalls=[...n.walls,cell];holes.splice(holes.indexOf(cell),1);}
          }
          if(holes.length>1)continue;
          if(holes.length)nextFruit|=bits[holes[0]];
        }
        const result=visit({body:nextBody,growth:Math.max(0,n.growth-1)+(ate?1:0),fruit:nextFruit,wall:nextWall,walls:nextWalls,score},depth+1);
        if(result)return [q,...result];if(expired)return null;
      }
      return null;
    }
    const path=visit({body,growth:b.growth||0,fruit,wall,walls:wallIds,score:b.score||0},0);
    return path?{route:path.map(point),nodes}:null;
  }
  let endSession=null,endLastStats=null;
  function resetSearch(){endSession=null;endLastStats=null;}
  function endgame(b,deadline,scoring=false){
    const W=b.width,H=b.height,N=W*H,id=p=>p[1]*W+p[0],point=i=>[i%W,Math.floor(i/W)];
    const initialBody=b.body.map(id),initialWalls=b.walls.map(id);
    const empty=N-new Set(initialBody).size-initialWalls.length-b.apples.length;
    endLastStats=null;
    if(empty>8||N>120)return null;
    const prefix=W+'x'+H+'/'+b.mode+'/',limit=Math.max(8,b.endgameNodeLimit??50000);
    let recovered=false;
    // A full cache is rebuilt from the actual current board, never left inert
    // for the rest of the attempt. No actions retain permanently null children.
    if(!endSession||endSession.prefix!==prefix||endSession.limit!==limit||endSession.saturated){
      recovered=!!endSession?.saturated;
      endSession={prefix,limit,graph:new Map(),heap:[],discovery:[],cursor:0,
        dirty:[],dirtySet:new Set(),rootKey:null,epoch:0,saturated:false,
        bits:Array.from({length:N},(_,i)=>1n<<BigInt(i)),
        adj:Array.from({length:N},(_,i)=>neighbors(point(i),b).map(id))};
    }
    const session=endSession,{graph,bits,adj}=session;
    let expanded=0,created=0,reused=0,discovered=0,backups=0;
    const stateKey=state=>prefix+state.body.length+':'+String.fromCharCode(...state.body)+'/'+state.growth+'/'+state.fruit+'/'+state.wall+'/'+(state.score%2);
    function get(state){
      const key=stateKey(state);
      if(graph.has(key)){reused++;return graph.get(key);}
      if(graph.size>=limit){session.saturated=true;return null;}
      let f=state.fruit,count=0;while(f){f&=f-1n;count++;}
      const node={...state,body:Uint8Array.from(state.body),key,count,value:state.fruit?0:1,
        best:null,scoreValue:0,scoreDistance:Infinity,bestScore:null,
        actions:state.fruit?null:[],parents:new Set(),epoch:0};
      graph.set(key,node);created++;return node;
    }
    const priority=n=>n.count*1000-(n.body.length+n.walls.length)*4;
    function push(n){
      const heap=session.heap;let i=heap.length;heap.push(n);
      while(i){const p=(i-1)>>1;if(priority(heap[p])<=priority(n))break;heap[i]=heap[p];i=p;}heap[i]=n;
    }
    function pop(){
      const heap=session.heap,first=heap[0],last=heap.pop();
      if(heap.length){let i=0;for(;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&priority(heap[c+1])<priority(heap[c]))c++;if(priority(last)<=priority(heap[c]))break;heap[i]=heap[c];i=c;}heap[i]=last;}
      return first;
    }
    function enqueue(n){
      if(n.epoch===session.epoch&&!session.dirtySet.has(n)){
        session.dirtySet.add(n);session.dirty.push(n);
      }
    }
    function discover(n){
      if(n.epoch===session.epoch)return;
      n.epoch=session.epoch;discovered++;
      if(n.actions===null)push(n);
      else {session.discovery.push(n);enqueue(n);}
    }
    function backup(n){
      backups++;
      if(!n.actions?.length)return;
      let best=n.value,move=n.best,score=n.scoreValue,distance=n.scoreDistance,scoreMove=n.bestScore;
      for(const action of n.actions){
        let value=0,reward=action.reward,travel=action.reward?0:1;
        for(const outcome of action.outcomes){
          value+=outcome.child.value*outcome.weight;
          reward+=outcome.child.scoreValue*outcome.weight;
          if(!action.reward)travel+=outcome.child.scoreDistance*outcome.weight;
        }
        if(value>best+1e-12){best=value;move=action.next;}
        if(reward>score+1e-9||(Math.abs(reward-score)<=1e-9&&travel<distance-1e-9)){
          score=reward;distance=travel;scoreMove=action.next;
        }
      }
      const changed=best>n.value+1e-12||score>n.scoreValue+1e-9||distance<n.scoreDistance-1e-9;
      n.value=Math.min(1,best);n.best=move;n.scoreValue=score;n.scoreDistance=distance;n.bestScore=scoreMove;
      if(changed)for(const parent of n.parents)enqueue(parent);
    }
    function drain(max){
      for(let i=0;i<max&&session.dirty.length&&performance.now()<deadline;i++){
        const n=session.dirty.pop();session.dirtySet.delete(n);backup(n);
      }
    }
    function expand(n){
      const actions=[];
      for(const q of adj[n.body[0]]){
        if(n.wall&bits[q]||q===n.body[1]||n.body.indexOf(q,1)>=0&&n.body.indexOf(q,1)<n.body.length-1)continue;
        const ate=!!(n.fruit&bits[q]),body=[q,...(n.growth>0?n.body:n.body.slice(0,-1))],fruit=ate?n.fruit&~bits[q]:n.fruit,score=n.score+(ate?1:0);
        const occupied=new Set(body),holes=[];
        if(ate)for(let cell=0;cell<N;cell++)if(!occupied.has(cell)&&!(fruit&bits[cell])&&!(n.wall&bits[cell]))holes.push(cell);
        const options=ate&&b.mode===1&&score%2===1?holes.filter(p=>wallAllowed(p,q,n.walls,W,H)):[];
        const wallChoices=options.length?options:[null],outcomes=[];
        for(const wall of wallChoices){
          const rest=holes.filter(p=>p!==wall),fruitChoices=ate&&rest.length?rest:[null];
          for(const food of fruitChoices){
            const child=get({body,growth:Math.max(0,n.growth-1)+(ate?1:0),fruit:food===null?fruit:fruit|bits[food],wall:wall===null?n.wall:n.wall|bits[wall],walls:wall===null?n.walls:[...n.walls,wall],score});
            // Commit an expansion only when every chance outcome is present.
            // An interrupted expansion remains unresolved and can be rebuilt.
            if(!child)return false;
            outcomes.push({child,weight:1/(wallChoices.length*fruitChoices.length)});
          }
        }
        actions.push({next:q,reward:ate?1:0,outcomes});
      }
      n.actions=actions;expanded++;
      for(const action of actions)for(const outcome of action.outcomes){
        outcome.child.parents.add(n);discover(outcome.child);
      }
      backup(n);return true;
    }
    let initialFruit=0n,initialWall=0n;
    for(const p of b.apples)initialFruit|=bits[id(p)];for(const p of initialWalls)initialWall|=bits[p];
    const state={body:initialBody,growth:b.growth||0,fruit:initialFruit,wall:initialWall,walls:initialWalls,score:b.score||0};
    // Reserve a slot for a new actual root even if the preceding call ended
    // exactly at capacity without trying to allocate another successor.
    if(graph.size>=limit&&!graph.has(stateKey(state))){session.saturated=true;return endgame(b,deadline,scoring);}
    const rootNode=get(state),sameRoot=session.rootKey===rootNode.key;
    if(!sameRoot){
      session.rootKey=rootNode.key;session.epoch++;
      session.heap=[];session.discovery=[];session.cursor=0;
      session.dirty=[];session.dirtySet.clear();discover(rootNode);
    }
    // Keep frontier and incremental traversal across repeated calls. Re-root
    // only when the real state changes, and discover cached descendants in
    // bounded batches rather than rewalking the entire graph every call.
    drain(8);
    const expansionLimit=b.endgameExpansionLimit??Infinity;
    while(performance.now()<deadline&&(scoring||rootNode.value<1-1e-9)){
      let worked=false;
      if(session.cursor<session.discovery.length){
        const n=session.discovery[session.cursor++];
        for(const action of n.actions)for(const outcome of action.outcomes)discover(outcome.child);
        worked=true;
      }
      if(session.heap.length&&expanded<expansionLimit){
        const n=pop();if(!expand(n)){push(n);break;}worked=true;
      }
      if(session.dirty.length){drain(16);worked=true;}
      if(!worked||expanded>=expansionLimit)break;
    }
    drain(32);
    endLastStats={expanded,created,reused,discovered,backups,cacheSize:graph.size,
      frontier:session.heap.length,pendingDiscovery:session.discovery.length-session.cursor,
      pendingBackups:session.dirty.length,saturated:session.saturated,recovered,sameRoot,
      winLowerBound:rootNode.value,additionalApples:rootNode.scoreValue};
    // Unknown states have zero lower bounds. Eating increases body length +
    // pending growth, preventing positive-reward cycles. Score ties prefer
    // progress to food instead of indefinite zero-food survival.
    if(scoring)return rootNode.scoreValue>0&&rootNode.bestScore!==null?
      {next:point(rootNode.bestScore),additionalApples:rootNode.scoreValue,objective:'score',nodes:expanded,created,search:endLastStats}:null;
    return rootNode.value>0&&rootNode.best!==null?
      {next:point(rootNode.best),value:rootNode.value,nodes:expanded,created,search:endLastStats}:null;
  }
  function plan(b){
    const started=performance.now(),budget=b.budgetMs??14,deadline=started+budget,N=b.width*b.height;
    const impossible=unwinnable(b);
    const scoring=!!impossible;
    const ending=scoring?null:finish(b,started+budget*.25);
    if(ending?.route.length)return {next:ending.route[0],route:ending.route,witness:ending.route,terminal:true,mode:'complete-board finish',nodes:ending.nodes,depth:ending.route.length,reservedGrowth:0,elapsedMs:performance.now()-started};
    const policy=endgame(b,started+budget*.70,scoring);
    if(policy)return {next:policy.next,route:[policy.next],witness:[policy.next],endgame:true,search:policy.search,objective:scoring?'score':'win',additionalApples:policy.additionalApples,winLowerBound:policy.value,mode:scoring?'maximize apples · endgame policy':'endgame policy search',nodes:policy.nodes,depth:1,reservedGrowth:0,elapsedMs:performance.now()-started};
    const id=p=>p[1]*b.width+p[0],point=i=>[i%b.width,Math.floor(i/b.width)];
    const adj=Array.from({length:N},(_,i)=>neighbors(point(i),b).map(id));
    const wall=new Uint8Array(N);for(const p of b.walls)wall[id(p)]=1;
    const freeBoard=N-b.walls.length,reserveLimit=scoring?0:(b.reserveGrowth??(b.apples.length>=5?2:1));
    const wallIds=b.walls.map(id),spawnOK=new Uint8Array(N),colors=[0,0];
    for(let i=0;i<N;i++)if(!wall[i]){colors[(i%b.width+Math.floor(i/b.width))%2]++;if(wallAllowed(i,null,wallIds,b.width,b.height))spawnOK[i]=1;}
    const colorDifference=colors[0]-colors[1];
    const fruitIndex=new Int16Array(N);fruitIndex.fill(-1);
    const fruitBits=b.apples.map((p,i)=>{fruitIndex[id(p)]=i;return 1n<<BigInt(i);});
    const allFruit=(1n<<BigInt(b.apples.length))-1n;
    const initialBody=b.body.map(id),pending=b.growth||0;
    const blocks=(body,q)=>q===body[1]||body.indexOf(q,1)>=0&&body.indexOf(q,1)<body.length-1;
    const moves=body=>adj[body[0]].filter(q=>!wall[q]&&!blocks(body,q));
    const firstMoves=moves(initialBody);
    if(!firstMoves.length)return {next:null,objective:scoring?'score':'win',reason:scoring?'Unwinnable board · no legal move remains after scoring run':'No legal move remains',mode:'blocked',nodes:0,depth:0};
    // Stamped arrays avoid allocating a Set for each flood fill in the beam.
    const blocked=new Uint32Array(N),seen=new Uint32Array(N),queue=new Int32Array(N);
    let stamp=0,nodes=0;
    function evaluate(n){
      stamp++;
      for(let i=1;i<n.body.length-1;i++)blocked[n.body[i]]=stamp;
      let count=1,read=0;queue[0]=n.body[0];seen[n.body[0]]=stamp;
      const tail=n.body.at(-1);let tailReach=tail===n.body[0];
      while(read<count){
        const p=queue[read++];
        for(const q of adj[p])if(!wall[q]&&blocked[q]!==stamp&&seen[q]!==stamp){seen[q]=stamp;queue[count++]=q;if(q===tail)tailReach=true;}
      }
      const exits=moves(n.body).length;
      n.exits=exits;
      let distance=N;
      for(let i=0;i<b.apples.length;i++)if(n.fruit&fruitBits[i]){
        const p=b.apples[i],h=point(n.body[0]);distance=Math.min(distance,Math.abs(p[0]-h[0])+Math.abs(p[1]-h[1]));
      }
      // Food is a secondary objective. A beam must survive the entire horizon
      // before this reward can influence the final first-turn choice.
      const inaccessible=Math.max(0,freeBoard-n.body.length+2-count);
      n.value=n.eaten*(scoring?10000:50)+count*2+(tailReach?100:0)+exits*18-(exits===1?35:0)-distance*.8;
      // Empty pockets cut off by the body can become unreachable fruit-spawn
      // locations. Preserve access to the board, rather than sealing it off.
      n.value-=inaccessible*(n.body.length>freeBoard*.5?12:4);
      n.value+=n.balance||0;
      if(!exits)n.value-=100000;
      n.value-=Math.min(15,b.visits?.[key(point(n.first))]||0)*2;
      return n.value;
    }
    function next(n,q){
      const bit=fruitIndex[q]<0?0n:fruitBits[fruitIndex[q]],ate=!!(n.fruit&bit);
      const body=[q,...(n.growth>0?n.body:n.body.slice(0,-1))];
      // Future respawns are unknown. In the search only, reserve space for up
      // to two extra growth steps after meals. The real engine model in step()
      // remains exact; the controller replans whenever actual fruit changes.
      const reserve=n.depth>=3&&n.depth%4===0&&n.eaten>n.reserved&&n.reserved<reserveLimit?1:0;
      let balance=n.balance||0;
      if(ate&&!n.eaten&&b.mode===1&&(b.score+1)%2===1){
        const occupied=new Set(body),counts=[0,0],remaining=n.fruit&~bit;
        const head=point(q);
        for(let cell=0;cell<N;cell++)if(spawnOK[cell]&&!occupied.has(cell)){
          const fruit=fruitIndex[cell]<0?0n:fruitBits[fruitIndex[cell]],p=point(cell);
          if(!(remaining&fruit)&&Math.abs(p[0]-head[0])+Math.abs(p[1]-head[1])>3)counts[(p[0]+p[1])%2]++;
        }
        const total=counts[0]+counts[1];
        if(total){
          const current=Math.max(0,Math.abs(colorDifference)-freeBoard%2),parity=(freeBoard-1)%2;
          const expected=(counts[0]*Math.max(0,Math.abs(colorDifference-1)-parity)+counts[1]*Math.max(0,Math.abs(colorDifference+1)-parity))/total;
          balance=40*(current-expected);
        }
      }
      const out={body,growth:Math.max(0,n.growth-1)+(ate?1:0)+reserve,reserved:n.reserved+reserve,fruit:ate?n.fruit&~bit:n.fruit,
        eaten:n.eaten+(ate?1:0),balance,first:n.first??q,parent:n,cell:q,depth:n.depth+1,value:0};
      evaluate(out);nodes++;return out;
    }
    const initial={body:initialBody,growth:pending,fruit:allFruit,eaten:0,reserved:0,balance:0,first:null,parent:null,depth:0};
    const roots=firstMoves.map(q=>[next(initial,q)]);
    const betterHarvest=(a,c)=>a.eaten>c.eaten||(a.eaten===c.eaten&&(a.value>c.value||(a.value===c.value&&a.depth<c.depth)));
    let harvest=roots.flat().reduce((a,c)=>betterHarvest(c,a)?c:a);
    let beams=roots,complete=roots,depth=1;
    const width=b.beamWidth??10,horizon=b.horizon??Math.min(N*2,Math.max(34,initialBody.length+16));
    let timedOut=false;
    for(let d=2;d<=horizon;d++){
      const round=[];
      for(let r=0;r<beams.length;r++){
        const candidates=[],unique=new Set();
        for(const n of beams[r])for(const q of moves(n.body)){
          if(performance.now()>=deadline){timedOut=true;break;}
          const child=next(n,q);
          if(scoring&&betterHarvest(child,harvest))harvest=child;
          if(!child.exits)continue;
          // Full body order matters: identical occupancy does not mean the
          // same future tail movement. Hashing is used only to prune duplicates.
          let hash=2166136261;for(const cell of child.body)hash=Math.imul(hash^cell,16777619);
          const signature=hash+'|'+child.growth+'|'+child.fruit+'|'+child.reserved;
          if(!unique.has(signature)){unique.add(signature);candidates.push(child);}
        }
        if(timedOut)break;
        candidates.sort((a,c)=>c.value-a.value);
        // Keep some distinct head positions so greedy food paths don't erase
        // every longer escape route from a root's beam.
        const selected=[],heads=new Map();
        for(const n of candidates){const k=n.body[0],count=heads.get(k)||0;if(count>=3)continue;selected.push(n);heads.set(k,count+1);if(selected.length===width)break;}
        if(selected.length<width)for(const n of candidates)if(!selected.includes(n)){selected.push(n);if(selected.length===width)break;}
        round.push(selected);
      }
      // Never compare one root searched deeply against another that merely
      // ran out of CPU time. Only completed, common-depth rounds count.
      if(timedOut)break;
      if(round.every(beam=>beam.length===0))break;
      for(let r=0;r<round.length;r++)if(round[r].length===0)round[r]=[];
      complete=round;beams=round;depth=d;
    }
    const survivors=complete.flat();
    // If every root dies early, use the deepest preceding states; the chosen
    // move is still checked against the exact current body before execution.
    const pool=survivors.length?survivors:roots.flat();pool.sort((a,c)=>c.value-a.value);
    const best=scoring&&harvest.eaten?harvest:pool[0],path=[];
    for(let n=best;n.parent;n=n.parent)path.unshift(point(n.cell));
    // New fruit and walls are unknown after eating. Follow only the checked
    // prefix to the first apple, then replan from the newly observed game state.
    const fruitSet=new Set(b.apples.map(key));let end=path.findIndex(p=>fruitSet.has(key(p)));
    const route=end>=0?path.slice(0,end+1):path;
    return {next:point(best.first),route,witness:path,objective:scoring?'score':'win',mode:scoring?'maximize apples · moving-body search':best.eaten?'food route with escape search':'tail and space survival',
      search:endLastStats,nodes,depth,reservedGrowth:best.reserved,score:best.value,elapsedMs:performance.now()-started};
  }
  const choose=b=>plan(b).next;
  root.SnakePlanner=Object.assign(root.SnakePlanner||{},{plan,choose,step,advance,room,legal,key,same,neighbors,wallAllowed,unwinnable,finish,endgame,reset:resetSearch,endgameStats:()=>endLastStats&&({...endLastStats}),version:'2.2.1'});
  if(typeof module!=='undefined')module.exports=root.SnakePlanner;
})(globalThis);
