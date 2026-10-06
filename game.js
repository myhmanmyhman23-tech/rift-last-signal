/* РАЗЛОМ — standalone Canvas 2D game. No network or dependencies. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const W = 1200, H = 840, CX = 600, CY = 420, R = 334, TAU = Math.PI * 2;
  const COLORS = {mint:'#72f6cb',cyan:'#55cce9',red:'#ff786b',orange:'#ffb477',purple:'#b49aff'};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const rules = [
    {name:'Стабильность',icon:'◎',desc:'Законы физики в норме. Пока.',color:COLORS.mint},
    {name:'Ускорение',icon:'»',desc:'Враги на 35% быстрее. Твоё оружие стреляет на 25% чаще.',color:COLORS.orange},
    {name:'Гравитация',icon:'◉',desc:'Ядро притягивает тебя. Держи дистанцию и используй рывок.',color:COLORS.purple},
    {name:'Осколки',icon:'◇',desc:'Крупные враги распадаются на два быстрых осколка.',color:COLORS.red},
    {name:'Затмение',icon:'◐',desc:'Видимость ограничена. Враги проявляются рядом с тобой и ядром.',color:COLORS.purple},
    {name:'Перегрузка',icon:'ϟ',desc:'Урон оружия ×1,6. Импульс восстанавливается вдвое быстрее.',color:COLORS.mint},
    {name:'Инерция',icon:'≈',desc:'Движение скользит. Рывок поможет резко сменить направление.',color:COLORS.cyan},
    {name:'Рой',icon:'⟐',desc:'Врагов больше, но их броня слабее. Следи за всеми направлениями.',color:COLORS.red},
    {name:'Резонанс',icon:'⌁',desc:'Из ядра идут ударные волны. Пересекай их фазовым рывком.',color:COLORS.orange},
    {name:'Последний разлом',icon:'✧',desc:'Ускорение и гравитация вместе. Продержись до закрытия разлома.',color:COLORS.purple}
  ];
  const modules = [
    {id:'power',icon:'ϟ',name:'Усилитель',desc:'Урон каждого выстрела +30%.',apply:()=>s.power*=1.3},
    {id:'rate',icon:'»',name:'Скорострельность',desc:'Интервал между выстрелами −20%.',apply:()=>s.fireRate*=.8},
    {id:'split',icon:'⋔',name:'Разветвитель',desc:'Ещё два снаряда в боковых направлениях.',apply:()=>s.multishot=Math.min(7,s.multishot+2)},
    {id:'repair',icon:'✚',name:'Ремонтный дрон',desc:'Реактор +30%. Полное восстановление брони пилота.',apply:()=>{s.reactor=Math.min(100,s.reactor+30);s.player.hp=s.player.maxHp;}},
    {id:'dash',icon:'↗',name:'Фазовый привод',desc:'Рывок заряжается на 25% быстрее и наносит больше урона.',apply:()=>{s.dashMax*=.75;s.dashPower+=8;}},
    {id:'pulse',icon:'◎',name:'Резонатор',desc:'Импульс сильнее на 35%, его радиус +25.',apply:()=>{s.pulsePower*=1.35;s.pulseRadius+=25;}},
    {id:'speed',icon:'⌁',name:'Манёвренность',desc:'Скорость движения +18%. Дополнительная единица брони.',apply:()=>{s.speed*=1.18;s.player.maxHp++;s.player.hp++;}},
    {id:'pierce',icon:'⤴',name:'Пробой',desc:'Снаряды проходят ещё сквозь одного врага.',apply:()=>s.pierce++}
  ];
  let s, mode='menu', last=0, visualTime=0, audioCtx, sound=false, choices=[], uiTick=0;
  let keys=new Set(), pointer={x:CX,y:CY-150,down:false}, stick={x:0,y:0}, shake=0, announcementTimer;
  let best=0; try {best=Number(localStorage.getItem('rift-best'))||0;} catch {}
  $('best').textContent=String(best).padStart(5,'0');
  const rand=(a,b)=>a+Math.random()*(b-a), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const timeStr=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  function fresh() {
    s={time:0,sector:0,reactor:100,score:0,kills:0,spawnTimer:1.4,fireTimer:0,dashCd:0,pulseCd:0,
      dashMax:3.5,pulseMax:12,power:1,fireRate:.16,multishot:1,pierce:0,speed:235,dashPower:14,pulsePower:14,pulseRadius:220,
      enemies:[],bullets:[],hostile:[],particles:[],orbs:[],rings:[],portals:[],waves:[],mods:{},waveTimer:5,bossSector:-1,
      player:{x:CX,y:CY+112,vx:0,vy:0,hp:5,maxHp:5,invuln:0,dash:0,dashId:0,angle:-Math.PI/2},combo:0,comboTimer:0};
    shake=0; stick={x:0,y:0};
  }
  function tone(freq,duration=.08,type='sine',volume=.05,endFreq) {
    if(!sound) return;
    try { if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=audioCtx.currentTime;
      osc.type=type;osc.frequency.setValueAtTime(freq,t);if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
      gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(t+duration);
    }catch{}
  }
  function burst(x,y,color,n=12,speed=110) {
    for(let i=0;i<n;i++){let a=rand(0,TAU),v=rand(speed*.25,speed);s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.8),max:.8,color,size:rand(1.5,3.8)});}
    if(s.particles.length>600)s.particles.splice(0,s.particles.length-600);
  }
  function announce(top,bottom) {
    $('announcement').innerHTML=`${top}<strong>${bottom}</strong>`;$('announcement').classList.add('visible');
    clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>$('announcement').classList.remove('visible'),3000);
  }
  function show(html,compact=false) {$('screen').className=`screen${compact?' compact':''}`;$('screen').innerHTML=html;$('overlay').classList.remove('hidden');}
  function hide(){$('overlay').classList.add('hidden');}
  function menu(){mode='menu';fresh();updateUI();show(`<div class="intro-symbol"><span>◈</span></div><div class="eyebrow">ОДИН ПИЛОТ. ОДНО ЯДРО. ПЯТЬ МИНУТ.</div><h2>РАЗЛОМ</h2><div class="subtitle">ПОСЛЕДНИЙ СИГНАЛ</div><p>Защити реактор от существ из разлома.<br>Каждые <strong>30 секунд</strong> реальность меняется.<br>Адаптируйся. Усиливайся. Удержи свет.</p><button class="primary-button" id="start">НАЧАТЬ ОПЕРАЦИЮ <span>↗</span></button><div class="hint">${touch?'Джойстик — движение · Огонь автоматически':'Удерживай ЛКМ для огня · Прицеливайся мышью'}</div><div class="intro-controls"><div><kbd>WASD</kbd> движение</div><div><kbd>SPACE</kbd> рывок</div><div><kbd>E</kbd> импульс</div></div>`);$('start').onclick=start;}
  function start(){fresh();mode='playing';keys.clear();pointer.down=false;hide();updateUI();tone(160,.6,'sine',.08,640);announce('ПРОТОКОЛ ЗАЩИТЫ АКТИВИРОВАН','Удержи реактор 05:00');}
  function pause(){if(mode==='playing'){mode='paused';keys.clear();pointer.down=false;stick={x:0,y:0};show(`<div class="eyebrow">СИГНАЛ ПРИОСТАНОВЛЕН</div><h2>Пауза</h2><p>Вдохни. Реактор подождёт.<br>Продолжить — Esc или кнопка ниже.</p><button id="resume" class="primary-button">ПРОДОЛЖИТЬ <span>↗</span></button><br><button id="restart" class="secondary-button">Начать заново</button>`,true);$('resume').onclick=pause;$('restart').onclick=start;}
    else if(mode==='paused'){mode='playing';hide();}}
  function finish(win){mode=win?'won':'lost';pointer.down=false;keys.clear();if(s.score>best){best=s.score;try{localStorage.setItem('rift-best',String(best));}catch{}}
    updateUI();tone(win?440:170,1,'sine',.1,win?880:40);
    show(`<div class="intro-symbol"><span>${win?'✧':'◈'}</span></div><div class="eyebrow">${win?'РАЗЛОМ ЗАКРЫТ / СИГНАЛ ВОССТАНОВЛЕН':'СИГНАЛ ПОТЕРЯН / ОПЕРАЦИЯ ЗАВЕРШЕНА'}</div><h2>${win?'Свет удержан.':'Свет погас.'}</h2><p>${win?'Пять минут в невозможном мире. Реактор жив.<br>Ты вернул этой реальности шанс.':s.reactor<=0?'Реактор не выдержал натиск.<br>Импульс отбрасывает врагов, а осколки чинят ядро.':'Броня пилота разрушена.<br>Фазовый рывок даёт неуязвимость и пробивает врагов.'}</p><div class="results"><div><strong>${timeStr(s.time)}</strong>ВРЕМЯ</div><div><strong>${s.kills}</strong>УНИЧТОЖЕНО</div><div><strong>${s.score}</strong>ОЧКИ</div></div><button id="retry" class="primary-button">${win?'ЕЩЁ ОДНА ОПЕРАЦИЯ':'ПОПРОБОВАТЬ СНОВА'} <span>↗</span></button><br><button id="home" class="secondary-button">На главный экран</button>`,true);
    $('retry').onclick=start;$('home').onclick=menu;
  }
  function upgrade(){mode='upgrade';pointer.down=false;keys.clear();stick={x:0,y:0};
    const pool=modules.filter(m=>m.id!=='split'||s.multishot<7);choices=pool.sort(()=>Math.random()-.5).slice(0,3);
    if((s.reactor<50||s.player.hp<3)&&!choices.some(m=>m.id==='repair'))choices[2]=modules.find(m=>m.id==='repair');
    show(`<div class="eyebrow">СЕКТОР ${String(s.sector+1).padStart(2,'0')} / ПЕРЕХОД</div><h2>Адаптируйся.</h2><p>Выбери модуль. Время остановлено.<br>Новая реальность: <strong>${rules[s.sector].name}</strong></p><div class="upgrade-options">${choices.map((m,i)=>`<button class="upgrade-option" data-choice="${i}"><span class="upgrade-icon">${m.icon}</span><strong>${m.name}</strong><small>${m.desc}</small><span class="pick-key">[${i+1}] УСТАНОВИТЬ ↗</span></button>`).join('')}</div><div class="hint">Бонус перехода: реактор +8% · броня пилота +1</div>`,true);
    $('screen').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>pick(Number(b.dataset.choice)));
  }
  function pick(i){if(mode!=='upgrade'||!choices[i])return;const m=choices[i];m.apply();s.mods[m.id]=(s.mods[m.id]||0)+1;s.reactor=Math.min(100,s.reactor+8);s.player.hp=Math.min(s.player.maxHp,s.player.hp+1);s.player.invuln=1.8;s.pulseCd=Math.max(0,s.pulseCd-3);mode='playing';hide();updateUI();tone(330,.35,'sine',.07,880);announce('РЕАЛЬНОСТЬ ИЗМЕНЕНА',rules[s.sector].name);}
  function spawn(type,position){let angle=rand(0,TAU);const x=position?position.x:CX+Math.cos(angle)*(R+12),y=position?position.y:CY+Math.sin(angle)*(R+12);
    const config={scout:{hp:3,r:11,speed:47,color:COLORS.red,value:35,damage:6},hunter:{hp:4,r:13,speed:66,color:COLORS.purple,value:50,damage:5},tank:{hp:13,r:20,speed:27,color:COLORS.orange,value:90,damage:12},shooter:{hp:6,r:15,speed:36,color:COLORS.cyan,value:70,damage:7},shard:{hp:1.5,r:7,speed:91,color:COLORS.red,value:15,damage:3},boss:{hp:95+s.sector*10,r:33,speed:23,color:COLORS.purple,value:700,damage:25}}[type];
    const scale=1+s.sector*.1;const e={...config,x,y,type,hp:config.hp*scale*(s.sector===7?.65:1),maxHp:config.hp*scale*(s.sector===7?.65:1),age:0,hit:0,shot:rand(1.5,3),spawn:.65,dead:false,dashHit:-1};s.enemies.push(e);
    if(!position){s.portals.push({x,y,life:.9,color:config.color});tone(100,.12,'sine',.015,50);}
    return e;
  }
  function hurtEnemy(e,damage){if(e.dead)return;e.hp-=damage;e.hit=.1;if(e.hp<=0){e.dead=true;s.kills++;s.combo=Math.min(20,s.combo+1);s.comboTimer=2.5;s.score+=Math.round(e.value*(1+Math.min(s.combo,10)*.05));burst(e.x,e.y,e.color,e.type==='boss'?65:13,e.type==='boss'?230:110);tone(e.type==='boss'?80:rand(180,240),.1,'triangle',.025,50);
      s.orbs.push({x:e.x,y:e.y,life:14,value:e.type==='boss'?15:e.type==='tank'?3:1.5});
      if(s.sector===3&&e.type!=='shard'&&e.type!=='boss'){for(let i=0;i<2;i++)spawn('shard',{x:e.x+rand(-8,8),y:e.y+rand(-8,8)});}
      if(e.type==='boss'){shake=10;s.rings.push({x:e.x,y:e.y,r:20,life:1,max:1,color:COLORS.purple,speed:220});announce('УГРОЗА УСТРАНЕНА','Страж разлома уничтожен');}}
  }
  function hurtPlayer(){const p=s.player;if(p.invuln>0||p.dash>0)return;p.hp--;p.invuln=1.5;shake=8;burst(p.x,p.y,COLORS.cyan,20,150);tone(130,.25,'sawtooth',.05,45);if(p.hp<=0)finish(false);}
  function hitReactor(n){s.reactor=Math.max(0,s.reactor-n);shake=7;burst(CX,CY,COLORS.orange,20,130);tone(70,.18,'sawtooth',.04,35);if(s.reactor<=0)finish(false);}
  function dash(){if(mode!=='playing'||s.dashCd>0)return;const p=s.player;let dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,dy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.y;const len=Math.hypot(dx,dy);if(len<.1){dx=Math.cos(p.angle);dy=Math.sin(p.angle);}else{dx/=len;dy/=len;}p.vx=dx*1000;p.vy=dy*1000;p.dash=.19;p.dashId++;p.invuln=Math.max(p.invuln,.3);s.dashCd=s.dashMax;tone(200,.18,'sine',.06,1000);}
  function pulse(){if(mode!=='playing'||s.pulseCd>0)return;s.pulseCd=s.pulseMax;shake=5;s.rings.push({x:CX,y:CY,r:42,life:.65,max:.65,color:COLORS.mint,speed:s.pulseRadius/.65});burst(CX,CY,COLORS.mint,50,200);tone(60,.65,'sine',.1,360);
    s.enemies.forEach(e=>{const dx=e.x-CX,dy=e.y-CY,d=Math.hypot(dx,dy);if(d<s.pulseRadius){hurtEnemy(e,s.pulsePower);if(!e.dead){const nr=Math.min(R+10,d+85);e.x=CX+dx/Math.max(d,1)*nr;e.y=CY+dy/Math.max(d,1)*nr;e.spawn=.45;}}});
    s.hostile=s.hostile.filter(b=>Math.hypot(b.x-CX,b.y-CY)>s.pulseRadius);
  }
  function shoot(){const p=s.player,n=s.multishot;for(let i=0;i<n;i++){const a=p.angle+(i-(n-1)/2)*.12;const dx=Math.cos(a),dy=Math.sin(a);s.bullets.push({x:p.x+dx*20,y:p.y+dy*20,vx:dx*700,vy:dy*700,life:1.3,damage:s.power*(s.sector===5?1.6:1),left:s.pierce+1,hit:new Set()});}tone(600,.035,'triangle',.012,270);}
  function update(dt){s.time=Math.min(300,s.time+dt);if(s.time>=300){s.score+=Math.round(s.reactor*25+s.player.hp*150);finish(true);return;}
    const next=Math.floor(s.time/30);if(next>s.sector){s.sector=next;upgrade();updateUI();return;}
    const p=s.player;p.invuln=Math.max(0,p.invuln-dt);p.dash=Math.max(0,p.dash-dt);s.dashCd=Math.max(0,s.dashCd-dt);s.pulseCd=Math.max(0,s.pulseCd-dt*(s.sector===5?2:1));s.comboTimer-=dt;if(s.comboTimer<=0)s.combo=0;
    let dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,dy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.y;let length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length;}
    if(p.dash<=0){if(s.sector===6){p.vx+=(dx*s.speed-p.vx)*dt*3;p.vy+=(dy*s.speed-p.vy)*dt*3;}else{p.vx=dx*s.speed;p.vy=dy*s.speed;}
      if(s.sector===2||s.sector===9){let a=Math.atan2(CY-p.y,CX-p.x);p.vx+=Math.cos(a)*65;p.vy+=Math.sin(a)*65;}}
    p.x+=p.vx*dt;p.y+=p.vy*dt;let d=Math.hypot(p.x-CX,p.y-CY);if(d>R-12){p.x=CX+(p.x-CX)/d*(R-12);p.y=CY+(p.y-CY)/d*(R-12);}
    d=Math.hypot(p.x-CX,p.y-CY);if(d<58){const a=d>.1?Math.atan2(p.y-CY,p.x-CX):Math.PI/2;p.x=CX+Math.cos(a)*58;p.y=CY+Math.sin(a)*58;}
    if(touch){let target=s.enemies.filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(target)p.angle=Math.atan2(target.y-p.y,target.x-p.x);}else p.angle=Math.atan2(pointer.y-p.y,pointer.x-p.x);
    if(p.dash>0){burst(p.x,p.y,COLORS.cyan,2,25);s.enemies.forEach(e=>{if(!e.dead&&e.dashHit!==p.dashId&&dist(p,e)<e.r+23){e.dashHit=p.dashId;hurtEnemy(e,s.dashPower);}});}
    s.fireTimer-=dt;if((pointer.down||touch||keys.has('KeyF'))&&s.fireTimer<=0){shoot();s.fireTimer=s.fireRate*(s.sector===1?.75:1);}
    s.spawnTimer-=dt;if(s.spawnTimer<=0&&s.enemies.length<100){let z=Math.random();let type=s.sector>1&&z<.17?'tank':s.sector>2&&z<.32?'shooter':s.sector>0&&z<.55?'hunter':'scout';spawn(type);s.spawnTimer=Math.max(.32,1.55-s.sector*.12)*(s.sector===7?.48:1);}
    if([3,6,9].includes(s.sector)&&s.bossSector!==s.sector&&s.time%30>4){s.bossSector=s.sector;spawn('boss');announce('ОБНАРУЖЕНА АНОМАЛИЯ','Страж разлома');tone(60,1,'sawtooth',.03,150);}
    for(const e of s.enemies){if(e.dead)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.spawn=Math.max(0,e.spawn-dt);if(e.spawn>0)continue;
      let target=e.type==='hunter'&&dist(e,p)<230?p:{x:CX,y:CY};let a=Math.atan2(target.y-e.y,target.x-e.x),coreD=Math.hypot(e.x-CX,e.y-CY);
      let velocity=e.speed*(1+s.sector*.065)*(s.sector===1||s.sector===9?1.35:1);
      if((e.type==='shooter'||e.type==='boss')&&coreD<230){a=Math.atan2(e.y-CY,e.x-CX)+Math.PI/2;velocity*=.65;e.shot-=dt;if(e.shot<=0){const t=e.type==='boss'?p:{x:CX,y:CY},sa=Math.atan2(t.y-e.y,t.x-e.x),count=e.type==='boss'?5:1;for(let j=0;j<count;j++){const ba=sa+(j-(count-1)/2)*.16;s.hostile.push({x:e.x,y:e.y,vx:Math.cos(ba)*160,vy:Math.sin(ba)*160,life:5,r:5});}e.shot=e.type==='boss'?1.8:2.7;}}
      e.x+=Math.cos(a)*velocity*dt;e.y+=Math.sin(a)*velocity*dt;
      if(coreD<e.r+43){e.dead=true;hitReactor(e.damage);if(mode!=='playing')return;}
      if(!e.dead&&dist(e,p)<e.r+12){hurtPlayer();if(mode!=='playing')return;}
    }
    for(const b of s.bullets){b.life-=dt;const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;for(const e of s.enemies){if(e.dead||e.spawn>0||b.hit.has(e)||b.left<=0)continue;const vx=b.x-ox,vy=b.y-oy,t=clamp(((e.x-ox)*vx+(e.y-oy)*vy)/(vx*vx+vy*vy||1),0,1);if(Math.hypot(e.x-ox-vx*t,e.y-oy-vy*t)<e.r+4){b.hit.add(e);b.left--;hurtEnemy(e,b.damage);if(b.left<=0)b.life=0;}}}
    for(const b of s.hostile){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.hypot(b.x-CX,b.y-CY)<44){b.life=0;hitReactor(2);if(mode!=='playing')return;}else if(dist(b,p)<16){b.life=0;hurtPlayer();if(mode!=='playing')return;}}
    for(const o of s.orbs){o.life-=dt;const d=dist(o,p);if(d<110){o.x+=(p.x-o.x)*dt*5;o.y+=(p.y-o.y)*dt*5;}if(d<22){o.life=0;s.reactor=Math.min(100,s.reactor+o.value);s.score+=10;burst(o.x,o.y,COLORS.mint,4,50);tone(820,.05,'sine',.018,1100);}}
    if(s.sector===8){s.waveTimer-=dt;if(s.waveTimer<=0){s.waveTimer=5;s.waves.push({r:52,hit:false});}for(const wave of s.waves){wave.r+=100*dt;if(!wave.hit&&Math.abs(dist(p,{x:CX,y:CY})-wave.r)<13){wave.hit=true;hurtPlayer();if(mode!=='playing')return;}}}else{s.waves=[];s.waveTimer=5;}
    s.enemies=s.enemies.filter(e=>!e.dead);s.bullets=s.bullets.filter(b=>b.life>0);s.hostile=s.hostile.filter(b=>b.life>0);s.orbs=s.orbs.filter(o=>o.life>0);s.waves=s.waves.filter(w=>w.r<R+20);
  }
  function effects(dt){for(const p of s.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-dt*2;p.vy*=1-dt*2;}s.particles=s.particles.filter(p=>p.life>0);for(const ring of s.rings){ring.r+=ring.speed*dt;ring.life-=dt;}s.rings=s.rings.filter(r=>r.life>0);for(const portal of s.portals)portal.life-=dt;s.portals=s.portals.filter(p=>p.life>0);shake=Math.max(0,shake-dt*35);}
  function updateUI(){if(!s)return;$('clock').innerHTML=`${timeStr(s.time)} <em>/ 05:00</em>`;$('sector').textContent=String(s.sector+1).padStart(2,'0');const hp=Math.ceil(s.reactor);$('reactor-percent').innerHTML=`${hp}<span>%</span>`;$('reactor-percent').style.color=hp<30?COLORS.red:COLORS.mint;$('reactor-bar').style.width=hp+'%';$('reactor-bar').style.background=hp<30?COLORS.red:COLORS.mint;$('reactor-state').textContent=hp<30?'КРИТИЧЕСКОЕ':hp<65?'ПОВРЕЖДЕНО':'СТАБИЛЬНО';$('reactor-state').style.color=hp<30?COLORS.red:COLORS.mint;
    $('health-pips').innerHTML=Array.from({length:s.player.maxHp},(_,i)=>`<i class="pip ${i>=s.player.hp?'off':''}"></i>`).join('');const rule=rules[s.sector];$('rule-name').textContent=rule.name;$('rule-icon').textContent=rule.icon;$('rule-icon').style.color=rule.color;$('rule-desc').textContent=rule.desc;let remaining=30-s.time%30;$('rift-time').textContent=timeStr(Math.ceil(remaining));$('rift-bar').style.width=remaining/30*100+'%';$('kills').textContent=String(s.kills).padStart(3,'0');$('score').textContent=String(s.score).padStart(5,'0');$('best').textContent=String(best).padStart(5,'0');
    for(const [ability,cd] of [['dash',s.dashCd],['pulse',s.pulseCd]]){$(ability+'-label').textContent=cd>0?cd.toFixed(1)+' СЕК':'ГОТОВ';$(ability+'-ring').classList.toggle('cooldown',cd>0);}
    $('coordinates').textContent=`X ${String(Math.round(s.player.x)).padStart(4,'0')} : Y ${String(Math.round(s.player.y)).padStart(4,'0')}`;$('upgrades').innerHTML=Object.entries(s.mods).length?Object.entries(s.mods).map(([id,n])=>`<div class="upgrade-chip">${modules.find(m=>m.id===id).name}${n>1?' ×'+n:''}</div>`).join(''):'<span>МОДУЛИ НЕ УСТАНОВЛЕНЫ</span>';
  }
  function circle(x,y,r,color,width=1,fill=false){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,TAU);if(fill){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}}
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function polygon(x,y,r,n,angle,color,fill){ctx.beginPath();for(let i=0;i<n;i++){const a=angle+i*TAU/n;ctx[i?'lineTo':'moveTo'](x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=1.6;if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.stroke();}
  const stars=Array.from({length:85},()=>({x:rand(0,W),y:rand(0,H),a:rand(.08,.3),size:Math.random()> .85?2:1}));
  function render(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#080f19';ctx.fillRect(0,0,W,H);ctx.save();if(shake>0&&!reduced)ctx.translate(rand(-shake,shake),rand(-shake,shake));
    const t=visualTime,rule=rules[s.sector],p=s.player;
    const bg=ctx.createRadialGradient(CX,CY,20,CX,CY,430);bg.addColorStop(0,'#142c3344');bg.addColorStop(.7,'#102a3622');bg.addColorStop(1,'#080f1900');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.55;for(let x=0;x<W;x+=40)line(x,0,x,H,'#1a3040',.5);for(let y=0;y<H;y+=40)line(0,y,W,y,'#1a3040',.5);ctx.restore();
    for(const star of stars){ctx.globalAlpha=star.a*(.8+.2*Math.sin(t+star.x));ctx.fillStyle='#9ac5cf';ctx.fillRect(star.x,star.y,star.size,star.size);}ctx.globalAlpha=1;
    circle(CX,CY,R+20,'#19343f',1);circle(CX,CY,R,'#2a5663',1.3);circle(CX,CY,R-3,'#173a44',1);circle(CX,CY,235,'#19364055');circle(CX,CY,135,'#19364055');
    for(let i=0;i<80;i++){const a=i*TAU/80,r=i%5?R+9:R+6;line(CX+Math.cos(a)*r,CY+Math.sin(a)*r,CX+Math.cos(a)*(R+14),CY+Math.sin(a)*(R+14),i%5?'#23414d':'#507d8a',1);}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;line(CX+Math.cos(a)*80,CY+Math.sin(a)*80,CX+Math.cos(a)*(R-20),CY+Math.sin(a)*(R-20),'#24455355');ctx.fillStyle='#4c7185';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(['E / 090','S / 180','W / 270','N / 000'][i],CX+Math.cos(a)*(R+40),CY+Math.sin(a)*(R+40)+3);}
    ctx.save();ctx.translate(CX,CY);ctx.rotate(t*.07);ctx.setLineDash([10,18]);circle(0,0,R-25,'#3c616144');ctx.setLineDash([]);ctx.restore();
    // Animated rifts at cardinal edges.
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.45,x=CX+Math.cos(a)*(R+12),y=CY+Math.sin(a)*(R+12);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.shadowColor=rule.color;ctx.shadowBlur=12;ctx.globalAlpha=.35+.12*Math.sin(t*2+i);ctx.strokeStyle=rule.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-32);ctx.lineTo(4,-12);ctx.lineTo(-3,1);ctx.lineTo(7,13);ctx.lineTo(0,32);ctx.stroke();ctx.restore();}
    for(const portal of s.portals){ctx.globalAlpha=portal.life;circle(portal.x,portal.y,30*(1-portal.life)+15,portal.color,2);circle(portal.x,portal.y,18,portal.color+'33',1,true);}ctx.globalAlpha=1;
    const danger=s.reactor<30;const coreColor=danger?COLORS.red:COLORS.mint;
    ctx.save();ctx.shadowBlur=35;ctx.shadowColor=coreColor;circle(CX,CY,43,coreColor+'10',1,true);circle(CX,CY,43,coreColor+'88',1.5);ctx.shadowBlur=0;circle(CX,CY,55,'#295454',1);ctx.translate(CX,CY);ctx.rotate(-t*.18);ctx.setLineDash([32,12]);circle(0,0,62,coreColor+'55',2);ctx.setLineDash([]);ctx.rotate(t*.45);polygon(0,0,30,6,0,coreColor,'#102d2b');polygon(0,0,17,6,t*.2,coreColor,coreColor+'18');ctx.shadowBlur=24;polygon(0,0,9+Math.sin(t*2)*1.5,4,Math.PI/4,'#baffdf',coreColor);ctx.restore();
    ctx.textAlign='center';ctx.font='8px monospace';ctx.fillStyle='#81baa6';ctx.fillText('Г Е Л И О С',CX,CY+82);
    if(s.sector===2||s.sector===9){for(let i=0;i<3;i++){let r=280-((t*35+i*85)%240);circle(CX,CY,r,COLORS.purple+'22',1);}}
    for(const wave of s.waves){circle(CX,CY,wave.r,COLORS.orange+'aa',3);circle(CX,CY,wave.r+7,COLORS.orange+'22',9);}
    for(const orb of s.orbs){ctx.save();ctx.shadowColor=COLORS.mint;ctx.shadowBlur=10;polygon(orb.x,orb.y,4+Math.sin(t*5)*.8,4,t,COLORS.mint,COLORS.mint+'88');ctx.restore();}
    for(const e of s.enemies){ctx.save();let visibility=s.sector===4?clamp(1-(Math.min(dist(e,p),dist(e,{x:CX,y:CY}))-85)/145,.08,1):1;ctx.globalAlpha=visibility*(e.spawn>0?.4:1);ctx.translate(e.x,e.y);const a=Math.atan2(CY-e.y,CX-e.x);ctx.rotate(a);ctx.shadowColor=e.color;ctx.shadowBlur=e.hit>0?25:9;const color=e.hit>0?'#ffffff':e.color;
      if(e.type==='tank'){polygon(0,0,e.r,6,0,color,e.color+'22');polygon(0,0,e.r*.65,6,t,color);}
      else if(e.type==='boss'){polygon(0,0,e.r,6,t*.4,color,e.color+'22');polygon(0,0,e.r*.7,3,-t*.5,color);circle(0,0,8,color,2);ctx.shadowBlur=0;ctx.rotate(-a);ctx.fillStyle='#33243c';ctx.fillRect(-40,-48,80,4);ctx.fillStyle=e.color;ctx.fillRect(-40,-48,80*e.hp/e.maxHp,4);}
      else if(e.type==='shooter'){polygon(0,0,e.r,4,Math.PI/4,color,e.color+'18');circle(0,0,4,color,1,true);}
      else if(e.type==='hunter'){polygon(0,0,e.r,3,0,color,e.color+'22');line(-10,-9,-18,0,color+'55');line(-10,9,-18,0,color+'55');}
      else{polygon(0,0,e.r,4,0,color,e.color+'22');line(-4,-4,4,4,color);line(-4,4,4,-4,color);}
      ctx.restore();
    }
    for(const b of s.bullets){ctx.save();ctx.shadowBlur=8;ctx.shadowColor=COLORS.mint;line(b.x,b.y,b.x-b.vx*.018,b.y-b.vy*.018,COLORS.mint,2.4);ctx.restore();}
    for(const b of s.hostile){ctx.save();ctx.shadowBlur=12;ctx.shadowColor=COLORS.orange;circle(b.x,b.y,4,COLORS.orange,1,true);ctx.restore();}
    for(const ring of s.rings){ctx.globalAlpha=ring.life/ring.max;circle(ring.x,ring.y,ring.r,ring.color,3);circle(ring.x,ring.y,ring.r-9,ring.color+'44',6);}ctx.globalAlpha=1;
    for(const q of s.particles){ctx.globalAlpha=clamp(q.life/q.max,0,1);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,q.size,q.size);}ctx.globalAlpha=1;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalAlpha=p.invuln>0&&Math.sin(t*35)>0?.4:1;ctx.shadowColor=COLORS.cyan;ctx.shadowBlur=16;
    ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-11,-11);ctx.lineTo(-6,0);ctx.lineTo(-11,11);ctx.closePath();ctx.fillStyle='#153e52';ctx.fill();ctx.strokeStyle='#8ae6ff';ctx.lineWidth=2;ctx.stroke();circle(0,0,3,'#ccf8ff',1,true);ctx.shadowBlur=0;
    if(mode==='playing'&&(Math.abs(p.vx)+Math.abs(p.vy)>30)){ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-21-rand(0,8),0);ctx.lineTo(-10,4);ctx.fillStyle=COLORS.cyan+'aa';ctx.fill();}ctx.restore();
    if(p.invuln>0)circle(p.x,p.y,23,COLORS.cyan+'66',1);
    if(mode==='playing'&&!touch){ctx.save();ctx.globalAlpha=.6;circle(pointer.x,pointer.y,8,COLORS.mint,1);line(pointer.x-13,pointer.y,pointer.x-5,pointer.y,COLORS.mint);line(pointer.x+5,pointer.y,pointer.x+13,pointer.y,COLORS.mint);line(pointer.x,pointer.y-13,pointer.x,pointer.y-5,COLORS.mint);line(pointer.x,pointer.y+5,pointer.x,pointer.y+13,COLORS.mint);ctx.restore();}
    if(s.sector===4){const fog=ctx.createRadialGradient(p.x,p.y,90,p.x,p.y,240);fog.addColorStop(0,'#05081200');fog.addColorStop(1,'#05081288');ctx.fillStyle=fog;ctx.fillRect(0,0,W,H);}
    if(s.combo>=3&&s.comboTimer>0&&mode==='playing'){ctx.font='12px monospace';ctx.textAlign='left';ctx.fillStyle=COLORS.orange;ctx.fillText(`СЕРИЯ ×${s.combo}`,40,95);}
    ctx.restore();
  }
  function frame(now){const dt=Math.min((now-last)/1000||0,.04);last=now;visualTime+=dt;if(mode==='playing'){update(dt);effects(dt);uiTick+=dt;if(uiTick>.1){updateUI();uiTick=0;}}render();requestAnimationFrame(frame);}
  function setPointer(event){const r=canvas.getBoundingClientRect();pointer.x=(event.clientX-r.left)/r.width*W;pointer.y=(event.clientY-r.top)/r.height*H;}
  canvas.addEventListener('pointermove',setPointer);canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;setPointer(e);pointer.down=true;canvas.setPointerCapture(e.pointerId);});window.addEventListener('pointerup',()=>pointer.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat){pause();return;}if(mode==='menu'&&e.code==='Enter'){start();return;}if(mode==='upgrade'&&['Digit1','Digit2','Digit3'].includes(e.code)){pick(Number(e.code.slice(-1))-1);return;}if(mode!=='playing')return;keys.add(e.code);if(!e.repeat&&e.code==='Space')dash();if(!e.repeat&&e.code==='KeyE')pulse();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(mode==='playing')pause();keys.clear();pointer.down=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
  $('pause').onclick=pause;$('sound').onclick=()=>{sound=!sound;$('sound').textContent='ЗВУК: '+(sound?'ВКЛ':'ВЫКЛ');$('sound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');$('sound').title=sound?'Выключить звук':'Включить звук';if(sound)tone(440,.1);};
  $('touch-dash').addEventListener('pointerdown',e=>{e.preventDefault();dash();});$('touch-pulse').addEventListener('pointerdown',e=>{e.preventDefault();pulse();});const joy=$('joystick');let joyPointer=null;
  function moveStick(e){if(e.pointerId!==joyPointer)return;const r=joy.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/35,y=(e.clientY-r.top-r.height/2)/35,n=Math.max(1,Math.hypot(x,y));stick={x:x/n,y:y/n};joy.firstElementChild.style.transform=`translate(${stick.x*27}px,${stick.y*27}px)`;}
  joy.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveStick(e);});joy.addEventListener('pointermove',moveStick);function releaseStick(){joyPointer=null;stick={x:0,y:0};joy.firstElementChild.style.transform='';}joy.addEventListener('pointerup',releaseStick);joy.addEventListener('pointercancel',releaseStick);
  menu();requestAnimationFrame(frame);
})();
