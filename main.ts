const fs = require('fs');
const path = require('path');
const input = process.env.MAKEFUN_INPUT_DIR || '/input';
const output = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function solve(text) {
  const rows = text.replace(/\r/g, '').split('\n');
  if (rows[rows.length - 1] === '') rows.pop();
  const w = Math.max(...rows.map(r => r.length)) + 2, h = rows.length + 2, n = w * h;
  const floor = new Uint8Array(n), goal = new Uint8Array(n), boxes = new Uint8Array(n);
  let player = -1;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const c = rows[y][x], p = (y + 1) * w + x + 1;
    if (' .$*@+'.includes(c)) floor[p] = 1;
    if ('.*+'.includes(c)) goal[p] = 1;
    if ('$*'.includes(c)) boxes[p] = 1;
    if ('@+'.includes(c)) player = p;
  }
  const dirs = [-w, w, -1, 1], letters = 'udlr';
  function walk(start, allowed, occupied) {
    const prev = new Int32Array(n).fill(-1), move = new Int8Array(n), q = [start];
    prev[start] = start;
    for (let i = 0; i < q.length; i++) for (let d = 0; d < 4; d++) {
      const t = q[i] + dirs[d];
      if (allowed[t] && !occupied[t] && prev[t] < 0) { prev[t] = q[i]; move[t] = d; q.push(t); }
    }
    return {prev, move, q};
  }
  function route(bfs, target) {
    if (bfs.prev[target] < 0) return null;
    let s = ''; while (bfs.prev[target] !== target) { s += letters[bfs.move[target]]; target = bfs.prev[target]; }
    return s.split('').reverse().join('');
  }
  // Remove the hallway, then identify each connected room and its unique door.
  const hallY = Math.floor(player / w), seen = new Uint8Array(n), rooms = [];
  for (let p = 0; p < n; p++) if (floor[p] && Math.floor(p / w) !== hallY && !seen[p]) {
    const q = [p]; seen[p] = 1;
    for (let i = 0; i < q.length; i++) for (const d of dirs) {
      const t = q[i] + d;
      if (floor[t] && Math.floor(t / w) !== hallY && !seen[t]) { seen[t] = 1; q.push(t); }
    }
    const doors = q.filter(c => dirs.some(d => floor[c+d] && Math.floor((c+d)/w) === hallY));
    const bs = q.filter(c => boxes[c]), gs = q.filter(c => goal[c]);
    if (bs.length || gs.length) rooms.push({cells:q, door:doors[0], bs, gs, valid:doors.length === 1 && bs.length === gs.length});
  }
  const totalBoxes = boxes.reduce((a,b)=>a+b,0), totalGoals = goal.reduce((a,b)=>a+b,0);
  if (!rooms.length || rooms.some(r => !r.valid) || rooms.reduce((a,r)=>a+r.bs.length,0) !== totalBoxes || rooms.reduce((a,r)=>a+r.gs.length,0) !== totalGoals) {
    rooms.length = 0;
    rooms.push({cells:Array.from({length:n},(_,i)=>i).filter(i=>floor[i]), door:player, bs:Array.from({length:n},(_,i)=>i).filter(i=>boxes[i]), gs:Array.from({length:n},(_,i)=>i).filter(i=>goal[i]), whole:true});
  }
  function search(room, budget, weight) {
    const allowed = new Uint8Array(n); for (const p of room.cells) allowed[p] = 1;
    const entrance = room.whole ? room.door : room.door + (Math.floor(room.door / w) < hallY ? w : -w);
    allowed[entrance] = 1;
    const dist = room.gs.map(g => {
      const a = new Int16Array(n).fill(-1), q = [g]; a[g] = 0;
      for (let i = 0; i < q.length; i++) for (const d of dirs) {
        const from = q[i] - d, stand = from - d;
        if (allowed[from] && allowed[stand] && a[from] < 0) { a[from] = a[q[i]] + 1; q.push(from); }
      }
      return a;
    });
    const cache = new Map();
    function heuristic(bs) {
      const key = bs.join(','); if (cache.has(key)) return cache.get(key);
      let dp = [0];
      for (let i = 0; i < bs.length; i++) {
        const next = new Array(1 << bs.length).fill(1e6);
        for (let mask = 0; mask < dp.length; mask++) if (dp[mask] !== undefined && dp[mask] < 1e6)
          for (let j = 0; j < bs.length; j++) if (!(mask & (1 << j)) && dist[j][bs[i]] >= 0)
            next[mask | (1 << j)] = Math.min(next[mask | (1 << j)], dp[mask] + dist[j][bs[i]]);
        dp = next;
      }
      const v = dp[(1 << bs.length)-1] ?? 1e6; cache.set(key,v); return v;
    }
    function freeze(occ, p) {
      for (const dy of [-w,0]) for (const dx of [-1,0]) {
        const a = p + dy + dx, cells = [a,a+1,a+w,a+w+1];
        if (cells.every(c => !allowed[c] || occ[c]) && cells.some(c => occ[c] && !goal[c])) return true;
      }
      return false;
    }
    let seq = 0; const heap = [];
    function less(a,b) { return a.f !== b.f ? a.f < b.f : a.h !== b.h ? a.h < b.h : a.seq < b.seq; }
    function push(v) { let i=heap.length; heap.push(v); while(i) { const p=(i-1)>>1; if(!less(v,heap[p])) break; heap[i]=heap[p]; i=p; } heap[i]=v; }
    function pop() { const a=heap[0], v=heap.pop(); if(heap.length) { let i=0; while(true) { let j=i*2+1; if(j>=heap.length) break; if(j+1<heap.length && less(heap[j+1],heap[j])) j++; if(!less(heap[j],v)) break; heap[i]=heap[j]; i=j; } heap[i]=v; } return a; }
    const initial = room.bs.slice().sort((a,b)=>a-b), h0 = heuristic(initial), best = new Map();
    function add(bs, pos, g, parent, segment) {
      const occ = new Uint8Array(n); for (const b of bs) occ[b]=1;
      const reachable = walk(pos, allowed, occ); let rep = pos; for(const p of reachable.q) if(p<rep) rep=p;
      const key = bs.join(',')+'|'+rep, old=best.get(key); if(old !== undefined && old <= g) return;
      const hv = heuristic(bs); if(hv >= 1e6) return;
      best.set(key,g); push({bs,pos,g,h:hv,f:g+weight*hv,seq:seq++,parent,segment,key});
    }
    if(h0 >= 1e6) return null;
    add(initial,entrance,0,null,'');
    let expanded=0;
    while(heap.length && expanded++ < budget) {
      const cur=pop(); if(best.get(cur.key)!==cur.g) continue;
      const occupied = new Uint8Array(n); for (const b of cur.bs) occupied[b] = 1;
      cur.reachable = walk(cur.pos, allowed, occupied);
      if(cur.h===0 && cur.reachable.prev[entrance]>=0) {
        let parts=[], a=cur; while(a.parent) { parts.push(a.segment); a=a.parent; }
        parts.reverse(); parts.push(route(cur.reachable,entrance)); return parts.join('');
      }
      const occ = new Uint8Array(n); for(const b of cur.bs) occ[b]=1;
      for(let i=0;i<cur.bs.length;i++) for(let d=0;d<4;d++) {
        const b=cur.bs[i], dest=b+dirs[d], stand=b-dirs[d];
        if(!allowed[dest] || (!room.whole && dest===room.door) || occ[dest] || cur.reachable.prev[stand]<0) continue;
        occ[b]=0; occ[dest]=1;
        if(!freeze(occ,dest)) {
          const next=cur.bs.slice(); next[i]=dest; next.sort((a,b)=>a-b);
          add(next,b,cur.g+1,cur,route(cur.reachable,stand)+letters[d]);
        }
        occ[b]=1; occ[dest]=0;
      }
      cur.reachable = null;
    }
    return null;
  }
  let answer = '';
  for(const room of rooms) {
    const entrance = room.whole ? room.door : room.door + (Math.floor(room.door / w) < hallY ? w : -w);
    const access=route(walk(player,floor,boxes),entrance); if(access===null) return '';
    const solution=search(room,150000,1) ?? search(room,150000,3); if(solution===null) return '';
    for(const c of access+solution) {
      const d=dirs[letters.indexOf(c)], t=player+d;
      if(boxes[t]) { boxes[t]=0; boxes[t+d]=1; } player=t;
    }
    answer+=access+solution;
  }
  return answer;
}
fs.mkdirSync(output,{recursive:true});
for(const id of fs.readdirSync(input).sort()) {
  const file=path.join(input,id,'level.txt'); if(!fs.existsSync(file)) continue;
  let answer=''; try { answer=solve(fs.readFileSync(file,'utf8')); } catch(e) { console.error(id, e); }
  fs.mkdirSync(path.join(output,id),{recursive:true}); fs.writeFileSync(path.join(output,id,'solution.txt'),answer);
}
