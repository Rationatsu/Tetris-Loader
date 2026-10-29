(() => {
const COLS=10, ROWS=20, COLORS={I:'#b7dcd2',O:'#f3d69f',T:'#c7b3ed',S:'#a8d6bb',Z:'#f2b5c8',J:'#a9c8ed',L:'#f0c1a2'};
const SHAPES={
 I:[[1,1,1,1]], O:[[1,1],[1,1]], T:[[0,1,0],[1,1,1]],
 S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]]
};
const MUSIC_ICON='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>';
const $=id=>document.getElementById(id);
const canvas=$('board'),ctx=canvas.getContext('2d'),nextCanvas=$('next'),nctx=nextCanvas.getContext('2d');

let board=newBoard(), piece=null, nextType=null;
let running=false, paused=false, over=false, counting=false;
let score=0, lines=0, level=1, best=+(localStorage.getItem('pastelTetrisBest')||0);
let last=0, dropCounter=0, particles=[], clearRows=[], clearingUntil=0;
let musicOn=true, waitingBind=null, manualPause=false, sysPause=false;
let animOn=localStorage.getItem('pastelTetrisAnim')!=='off';
let revealStart=performance.now();           // animasi load canvas per blok
const popCells=new Map();                     // animasi blok saat mendarat
const colors={bg:'#f0eaf4',accent:'#b8a1e3'};

/* ---------- SFX ---------- */
const SFX={click:'assets/sfx/click.mp3',drop:'assets/sfx/drop.mp3',lose:'assets/sfx/lose.mp3'};
const sfxBase={};Object.entries(SFX).forEach(([k,src])=>{const a=new Audio(src);a.preload='auto';sfxBase[k]=a});
function sfx(k){try{const a=sfxBase[k].cloneNode();a.volume=.6;a.play().catch(()=>{})}catch{}}

/* ---------- Helpers ---------- */
const clamp01=v=>Math.max(0,Math.min(1,v));
const easeOutBack=p=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2)};
const easeOutCubic=p=>1-Math.pow(1-p,3);
function fmt(n){return String(n).padStart(6,'0')}
function newBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(null))}
function randomType(){return Object.keys(SHAPES)[Math.floor(Math.random()*7)]}

function setHud(id,val){
  const el=$(id);if(el.textContent===val)return;
  el.textContent=val;
  if(animOn){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}
}
function updateHud(){
  setHud('score',fmt(score));setHud('best',fmt(best));
  setHud('lines',String(lines).padStart(2,'0'));setHud('level',String(level).padStart(2,'0'));
}
function addScore(n){
  score+=n;
  if(score>best){best=score;localStorage.setItem('pastelTetrisBest',best)}
  updateHud();
}
function setPaused(){
  const was=paused;paused=manualPause||sysPause;
  $('pauseOverlay').classList.toggle('hide',!(paused&&running&&!over));
  if(was&&!paused){last=performance.now();dropCounter=0}
}

/* ---------- Keybinds ---------- */
const defaults={left:'ArrowLeft',right:'ArrowRight',rotate:'ArrowUp',down:'ArrowDown',drop:'Space',pause:'KeyP'};
let binds={...defaults};
try{const saved=JSON.parse(localStorage.getItem('pastelTetrisBinds')||'null');if(saved)binds={...defaults,...saved}}catch{}

/* ---------- Game logic ---------- */
function spawn(){
  const type=nextType||randomType();nextType=randomType();
  piece={type,matrix:SHAPES[type].map(r=>r.slice()),x:Math.floor((COLS-SHAPES[type][0].length)/2),y:0,t0:performance.now()};
  drawNext();
  if(collides(piece.matrix,piece.x,piece.y)){
    running=false;over=true;sfx('lose');$('finalScore').textContent=score;
    setTimeout(()=>$('gameOver').classList.remove('hidden'),450);
  }
}
function collides(m,x,y){
  for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)
    if(m[r][c]&&(x+c<0||x+c>=COLS||y+r>=ROWS||(y+r>=0&&board[y+r][x+c])))return true;
  return false;
}
function merge(){
  const now=performance.now();
  piece.matrix.forEach((row,r)=>row.forEach((v,c)=>{
    if(v&&piece.y+r>=0){
      board[piece.y+r][piece.x+c]=piece.type;
      if(animOn)popCells.set((piece.y+r)*COLS+piece.x+c,now);
    }
  }));
  const full=[];board.forEach((row,i)=>{if(row.every(Boolean))full.push(i)});
  sfx('drop');
  if(!full.length){spawn();return}
  clearRows=full;clearingUntil=now+(animOn?270:0);
  if(animOn)full.forEach(r=>{for(let c=0;c<COLS;c++){
    const x=(c+.5)*canvas.width/COLS,y=(r+.5)*canvas.height/ROWS;
    for(let j=0;j<7;j++)particles.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.8)*5,life:1,color:COLORS[board[r][c]],size:3+Math.random()*5});
  }});
  addScore(([0,100,300,500,800][full.length]||800)*level);
  lines+=full.length;
  const newLevel=Math.floor(lines/10)+1;
  if(newLevel>level){level=newLevel;toast('LEVEL '+String(level).padStart(2,'0')+' ✦')}
  updateHud();
}
function finishClear(){
  if(!clearRows.length)return;
  board=board.filter((row,i)=>!clearRows.includes(i));
  while(board.length<ROWS)board.unshift(Array(COLS).fill(null));
  clearRows=[];clearingUntil=0;popCells.clear();spawn();
}
function rotate(m){return m[0].map((_,i)=>m.map(row=>row[i]).reverse())}
function move(dx,dy){
  if(!running||paused||over||clearRows.length)return;
  if(!collides(piece.matrix,piece.x+dx,piece.y+dy)){piece.x+=dx;piece.y+=dy;if(dx)sfx('click');return true}
  if(dy>0)merge();
  return false;
}
function hardDrop(){
  if(!running||paused||clearRows.length)return;
  while(!collides(piece.matrix,piece.x,piece.y+1))piece.y++;
  addScore(2);merge();
}
function rotatePiece(){
  if(!running||paused||clearRows.length)return;
  const m=rotate(piece.matrix);
  if(!collides(m,piece.x,piece.y)){piece.matrix=m;sfx('click')}
  else if(!collides(m,piece.x-1,piece.y)){piece.x--;piece.matrix=m;sfx('click')}
}
function toast(t){
  const el=$('levelToast');el.textContent=t;
  if(!animOn){el.classList.remove('show');el.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.opacity=0,900);return}
  el.style.opacity='';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
}

/* ---------- Start: countdown 3 · 2 · 1 · GO! ---------- */
function resetState(){
  board=newBoard();piece=null;nextType=null;
  score=0;lines=0;level=1;particles=[];clearRows=[];clearingUntil=0;popCells.clear();
  over=false;running=false;manualPause=false;paused=false;dropCounter=0;
  updateHud();drawNext();
}
function showCount(label,isGo){
  const n=$('cdNum');
  n.textContent=label;n.className='cd-num';
  document.querySelectorAll('.cd-ring').forEach(r=>r.classList.remove('tick'));
  void n.offsetWidth;
  n.classList.add(isGo?'go':'tick');
  document.querySelectorAll('.cd-ring').forEach(r=>r.classList.add('tick'));
}
function burst(){
  if(!animOn)return;
  const cx=canvas.width/2,cy=canvas.height/2,cols=Object.values(COLORS);
  for(let i=0;i<80;i++){
    const a=Math.random()*Math.PI*2,s=2+Math.random()*6;
    particles.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,color:cols[i%cols.length],size:3+Math.random()*5});
  }
}
function startCountdown(){
  if(counting)return;
  counting=true;resetState();
  $('gameOver').classList.add('hidden');$('intro').classList.add('hide');$('pauseOverlay').classList.add('hide');
  if(musicOn)$('music').play().catch(()=>{});
  revealStart=performance.now();
  const cd=$('countdown'),seq=['3','2','1','GO!'];let i=0;
  cd.classList.remove('hide');
  const finish=()=>{cd.classList.add('hide');counting=false;beginGame()};
  const step=()=>{
    const isGo=i===3;showCount(seq[i],isGo);
    if(isGo){burst();sfx('drop');setTimeout(finish,800)}
    else{sfx('click');i++;setTimeout(step,1000)}
  };
  step();
}
function beginGame(){
  running=true;over=false;manualPause=false;
  sysPause=document.hidden||!$('settingsModal').classList.contains('hidden');
  nextType=randomType();spawn();
  last=performance.now();dropCounter=0;setPaused();
}

/* ---------- Drawing ---------- */
function drawCell(context,x,y,size,color,ghost=false,scale=1){
  context.save();context.globalAlpha=ghost?.24:1;
  if(scale!==1){const cx=x+size/2,cy=y+size/2;context.translate(cx,cy);context.scale(scale,scale);context.translate(-cx,-cy)}
  const inset=Math.max(1.5,size*.07);
  context.fillStyle=color;roundRect(context,x+inset,y+inset,size-inset*2,size-inset*2,Math.max(2,size*.17));context.fill();
  context.fillStyle='#ffffff';context.globalAlpha=ghost?.08:.34;
  roundRect(context,x+inset+1,y+inset+1,size-inset*2-2,Math.max(2,size*.14),Math.max(1,size*.08));context.fill();
  context.restore();
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function draw(){
  const now=performance.now(),w=canvas.width,h=canvas.height,cell=w/COLS;
  const rt=animOn?now-revealStart:Infinity;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle=colors.bg;ctx.fillRect(0,0,w,h);

  // grid (fade-in saat load)
  ctx.strokeStyle=document.body.dataset.theme==='dark'?'#ffffff0a':'#8d78a515';ctx.lineWidth=1;
  ctx.globalAlpha=rt<900?clamp01(rt/700):1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,h);ctx.stroke()}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(w,y*cell);ctx.stroke()}
  ctx.globalAlpha=1;

  // animasi load canvas per blok (gelombang diagonal)
  if(rt<1400){
    ctx.fillStyle=colors.accent;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const p=(rt-(r*.8+c*1.4)*22)/380;
      if(p>0&&p<1){
        const s=cell*easeOutBack(p);if(s<1)continue;
        ctx.globalAlpha=.55*(1-p);
        roundRect(ctx,c*cell+(cell-s)/2,r*cell+(cell-s)/2,s,s,cell*.17);ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  }

  // blok di papan
  board.forEach((row,r)=>row.forEach((v,c)=>{
    if(!v)return;
    const x=c*cell,y=r*cell,color=COLORS[v];
    if(clearRows.includes(r)){
      if(animOn){const prog=1-Math.max(0,(clearingUntil-now)/270);drawCell(ctx,x,y,cell,color,false,Math.max(.02,1-prog))}
      return;
    }
    let s=1;const key=r*COLS+c,t0=popCells.get(key);
    if(t0!==undefined){const p=(now-t0)/240;if(p>=1)popCells.delete(key);else s=1+.2*(1-easeOutCubic(p))}
    drawCell(ctx,x,y,cell,color,false,s);
  }));

  // piece aktif + ghost
  if(piece&&running&&!clearRows.length){
    let gy=piece.y;while(!collides(piece.matrix,piece.x,gy+1))gy++;
    let ps=1;if(animOn){const p=clamp01((now-piece.t0)/200);ps=.5+.5*easeOutBack(p)}
    piece.matrix.forEach((row,r)=>row.forEach((v,c)=>{if(v){
      drawCell(ctx,(piece.x+c)*cell,(gy+r)*cell,cell,COLORS[piece.type],true);
      drawCell(ctx,(piece.x+c)*cell,(piece.y+r)*cell,cell,COLORS[piece.type],false,ps);
    }}));
  }

  if(clearRows.length){
    const alpha=Math.max(0,(clearingUntil-now)/270);
    clearRows.forEach(r=>{ctx.fillStyle=`rgba(255,255,255,${.65-alpha*.4})`;ctx.fillRect(0,r*cell,w,cell)});
  }
  particles.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vy+=.09;p.life-=.025;if(p.life<=0)return;
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();
    ctx.arc(p.x,p.y,Math.max(.1,p.size*p.life),0,Math.PI*2);ctx.fill();
  });
  particles=particles.filter(p=>p.life>0);ctx.globalAlpha=1;
}
function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);if(!nextType)return;
  const m=SHAPES[nextType],s=19,ox=(nextCanvas.width-m[0].length*s)/2,oy=(nextCanvas.height-m.length*s)/2;
  m.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawCell(nctx,ox+c*s,oy+r*s,s,COLORS[nextType])}));
}

/* ---------- Main loop (selalu berjalan agar animasi canvas hidup) ---------- */
function frame(now){
  try{
    const dt=Math.max(0,Math.min(200,now-last));last=now;
    if(running){
      if(clearRows.length&&performance.now()>=clearingUntil)finishClear();
      if(running&&!paused&&!clearRows.length){
        dropCounter+=dt;
        if(dropCounter>Math.max(90,750-(level-1)*58)){move(0,1);dropCounter=0}
      }
    }
    draw();
  }catch(err){console.error(err)}
  requestAnimationFrame(frame);
}

/* ---------- Input ---------- */
function keyAction(action){
  if(action==='left')move(-1,0);
  if(action==='right')move(1,0);
  if(action==='down'){if(move(0,1))addScore(1)}
  if(action==='rotate')rotatePiece();
  if(action==='drop')hardDrop();
  if(action==='pause'&&running&&!over){manualPause=!manualPause;setPaused()}
}
document.addEventListener('keydown',e=>{
  if(waitingBind){
    e.preventDefault();
    if(Object.values(binds).includes(e.code)&&binds[waitingBind]!==e.code){$('bindStatus').textContent='Tombol itu sudah dipakai aksi lain.';return}
    binds[waitingBind]=e.code;localStorage.setItem('pastelTetrisBinds',JSON.stringify(binds));
    waitingBind=null;renderBinds();$('bindStatus').textContent='Keybind berhasil diperbarui.';return;
  }
  if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code))e.preventDefault();
  if(e.code===binds.pause&&e.repeat)return;
  const action=Object.keys(binds).find(k=>binds[k]===e.code);
  if(action)keyAction(action);
});
function keyName(code){return ({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'SPACE',KeyP:'P'})[code]||code.replace('Key','').replace('Digit','')}
function renderBinds(){
  const labels={left:'Move left',right:'Move right',rotate:'Rotate',down:'Soft drop',drop:'Hard drop',pause:'Pause'};
  $('keybinds').innerHTML='';
  Object.keys(binds).forEach(k=>{
    const row=document.createElement('div');row.className='bind-item';
    const label=document.createElement('span');label.textContent=labels[k];
    const btn=document.createElement('button');btn.textContent=keyName(binds[k]);
    btn.onclick=()=>{
      waitingBind=k;$('bindStatus').textContent='Tekan tombol keyboard untuk '+labels[k].toLowerCase()+'.';
      renderBinds();
      const b=[...$('keybinds').querySelectorAll('button')].find(x=>x.dataset.action===k);if(b)b.classList.add('listening');
    };
    btn.dataset.action=k;row.append(label,btn);$('keybinds').append(row);
  });
}

/* ---------- Theme / Animasi / Musik ---------- */
function refreshColors(){
  const s=getComputedStyle(document.body);
  colors.bg=s.getPropertyValue('--cell-bg').trim()||colors.bg;
  colors.accent=s.getPropertyValue('--accent').trim()||colors.accent;
}
function setTheme(t){
  document.body.dataset.theme=t;localStorage.setItem('pastelTetrisTheme',t);
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.themeChoice===t));
  refreshColors();draw();
}
function setAnim(on){
  animOn=on;localStorage.setItem('pastelTetrisAnim',on?'on':'off');
  document.body.classList.toggle('no-anim',!on);
  document.querySelectorAll('[data-anim-choice]').forEach(b=>b.classList.toggle('selected',(b.dataset.animChoice==='on')===on));
  if(!on){particles=[];popCells.clear()}
  else if(!running&&!counting)revealStart=performance.now();
}
function setMusicUI(){
  const t=musicOn?'Musik: aktif':'Musik: mati';
  [$('musicBtn'),$('modalMusic')].forEach(b=>b.innerHTML=MUSIC_ICON+'<span>'+t+'</span>');
}
function toggleMusic(){
  musicOn=!musicOn;
  if(musicOn)$('music').play().catch(()=>{musicOn=false;setMusicUI()});
  else $('music').pause();
  setMusicUI();
}
document.querySelectorAll('[data-anim-choice]').forEach(b=>b.onclick=()=>setAnim(b.dataset.animChoice==='on'));
setAnim(animOn);
setTheme(localStorage.getItem('pastelTetrisTheme')||'light');
setMusicUI();updateHud();

$('startBtn').onclick=startCountdown;
$('restartBtn').onclick=startCountdown;
$('settingsBtn').onclick=()=>{$('settingsModal').classList.remove('hidden');renderBinds();sysPause=true;setPaused()};
$('closeSettings').onclick=()=>{$('settingsModal').classList.add('hidden');waitingBind=null;sysPause=document.hidden;setPaused()};
$('pauseOverlay').onclick=()=>{manualPause=false;setPaused()};
$('themeBtn').onclick=()=>setTheme(document.body.dataset.theme==='light'?'dark':'light');
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>setTheme(b.dataset.themeChoice));
$('resetBinds').onclick=()=>{binds={...defaults};localStorage.setItem('pastelTetrisBinds',JSON.stringify(binds));waitingBind=null;renderBinds();$('bindStatus').textContent='Keybind default dipulihkan.'};
$('musicBtn').onclick=toggleMusic;$('modalMusic').onclick=toggleMusic;

document.querySelectorAll('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();keyAction(b.dataset.move)});
});
let touchStart=null;
canvas.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY,time:Date.now()}},{passive:true});
canvas.addEventListener('touchend',e=>{
  if(!touchStart)return;
  const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;
  if(Math.abs(dx)>22&&Math.abs(dx)>Math.abs(dy)*.85)keyAction(dx>0?'right':'left');
  else if(dy>18)keyAction('down');
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(running&&!over){sysPause=document.hidden;setPaused()}});

drawNext();
requestAnimationFrame(frame);
})();
