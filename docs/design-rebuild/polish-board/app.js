const IMG=__IMG__;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ICON={
  chevR:'<path d="m9 18 6-6-6-6"/>', chevL:'<path d="m15 18-6-6 6-6"/>', chevD:'<path d="m6 9 6 6 6-6"/>', check:'<path d="M20 6 9 17l-5-5"/>', checks:'<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
  plus:'<path d="M5 12h14M12 5v14"/>', minus:'<path d="M5 12h14"/>', search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  dumbbell:'<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  pill:'<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>',
  list:'<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4"/>',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  palette:'<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r=".6"/><circle cx="12" cy="7.5" r=".6"/><circle cx="15.5" cy="10" r=".6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16v4M17 18h4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  alarm:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
  split:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M6 16.5V4M6 13c0-4 5-3 9.5-5"/>'
};
const I=(n,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]||''}</svg>`;

const THEMES=[{k:'forge',n:'Forge orange',seed:'#F2601A'},{k:'indigo',n:'Indigo',seed:'#4F46E5'},{k:'berry',n:'Berry',seed:'#D6336C'},{k:'plum',n:'Plum',seed:'#9333EA'},{k:'lagoon',n:'Lagoon',seed:'#0D9488'}];
const TC=['#F2601A','#4F46E5','#D6336C','#9333EA','#0D9488'];

/* ---------- decisions (option A is always the app today) ---------- */
const D=[
{id:'font',t:'Typeface',where:'Every screen',
 prob:'The app uses the phone\'s plain system typeface at similar weights everywhere. It is clear, but it has no personality, and numbers get no more presence than labels.',
 opts:[{k:'a',n:'System typeface',why:'What you have. Neutral and free, since nothing ships with the app.'},
       {k:'b',n:'Rounded and friendly',why:'Nunito: soft round letters, extra-heavy headings and numbers. The biggest single change to how the app feels. One font file ships with the app.'},
       {k:'c',n:'Crisp and modern',why:'Plus Jakarta Sans: sharper and more grown-up, tight heavy headings. Reads more "tool" than "coach".'}],
 rec:'b',recWhy:'A habit app that says "something beats nothing" should sound warm. Round, heavy type does that before a single word is read.'},
{id:'depth',t:'How cards and buttons sit on the page',where:'Every screen',
 prob:'Cards are flat with a one-pixel border. A card you can tap looks the same as a panel you can\'t, and only the main button has any depth.',
 opts:[{k:'a',n:'Flat, hairline border',why:'What you have. Quiet and tidy.'},
       {k:'b',n:'Chunky, with an edge',why:'Thicker borders, rounder corners and a solid bottom edge on everything you can press, including Done and Fallback. Pressing pushes it down.'},
       {k:'c',n:'Soft shadow',why:'No borders, cards float on a soft shadow. Elegant, but less playful and weaker in dark mode.'}],
 rec:'b',recWhy:'Your main button already has this edge. Extending it to cards makes the whole app feel like one set of physical pieces.'},
{id:'tabhead',t:'A headline on every tab',where:'Routines, Events, Courses, To-dos',
 prob:'Only Today opens with a headline. The other four tabs open straight into a list.',
 opts:[{k:'a',n:'Title only',why:'What you have.'},
       {k:'b',n:'A headline card, like Today',why:'Each tab gets its own number in the theme colour: routines done today, the next event, the course day, to-dos open.'},
       {k:'c',n:'A slim progress bar',why:'A thick bar and one line under the title. Lighter, but only works for tabs that have a "done" count.'}],
 rec:'b',recWhy:'It is what makes Today feel finished, and it gives each tab a reason to glance at it.'},
{id:'list',t:'Routine and course cards',where:'Routines, Courses, Search',
 prob:'Each card shows two green and blue plan tiles that look like Today\'s buttons but do nothing. The card says what the plan is, not how the week went.',
 opts:[{k:'a',n:'Plan tiles',why:'What you have.'},
       {k:'b',n:'The week at a glance',why:'Seven dots for the last week: green ideal, blue fallback, grey off, ring for today. The plan moves to one line underneath.'}],
 rec:'b',recWhy:'It removes the fake buttons and shows the one thing a list of habits should show: how each one is going.'},
{id:'task',t:'Top of a task screen',where:'Every task',
 prob:'A task opens with a small icon in the header and a line of grey details. Every task looks the same at the top.',
 opts:[{k:'a',n:'Plain header',why:'What you have.'},
       {k:'b',n:'A block in the task\'s own colour',why:'A tint of the colour you gave the task, a large icon tile, the name in heavy type, and its week underneath.'}],
 rec:'b',recWhy:'People choose an icon and a colour for each task. This is the screen where that choice should pay off.'},
{id:'progress',t:'Progress screen',where:'Your consistency, all-time trend',
 prob:'The percentage is large, but the rest is a sentence, a thin bar and a row of small dots.',
 opts:[{k:'a',n:'Number, sentence, thin bar',why:'What you have.'},
       {k:'b',n:'Ring, stat tiles, thick bar',why:'The percentage sits in a ring on the theme colour. Ideal, fallback and off days each get a tile with a big count.'}],
 rec:'b',recWhy:'Same facts, drawn instead of written. The three tiles also make "fallback counts" visible as its own win.'},
{id:'awards',t:'Levels and badges',where:'Achievements, Settings, celebrations',
 prob:'Your level is a line of text over a thin bar, and locked badges are identical grey circles with a padlock.',
 opts:[{k:'a',n:'Text and outlined circles',why:'What you have.'},
       {k:'b',n:'Medallions and a thick XP bar',why:'The level becomes a gold medallion with what is left to the next one. Earned badges are solid gold; locked ones show how far along you are.'}],
 rec:'b',recWhy:'Rewards should look like objects you own. A locked badge that shows 3 of 30 gives a reason to come back.'},
{id:'rows',t:'Settings and list rows',where:'Settings, Notifications, task options, add menu',
 prob:'Settings is 0.1% colour: grey line icons on white rows. It is the screen where you choose a theme, and the theme does not appear on it.',
 opts:[{k:'a',n:'Plain line icons',why:'What you have.'},
       {k:'b',n:'Icons on a tile of the theme tint',why:'Every row icon sits on a small rounded tile in your theme\'s tint. One colour, so it stays calm.'},
       {k:'c',n:'A different colour per row',why:'Each row gets its own solid colour. Liveliest, but it brings in colours that mean other things elsewhere.'}],
 rec:'b',recWhy:'It carries the theme onto the plainest screens without adding a second palette.'},
{id:'empty',t:'Empty screens',where:'Events, To-dos, Records, Notifications, Search',
 prob:'When there is nothing to show, the screen is a single grey sentence and a lot of blank page.',
 opts:[{k:'a',n:'One line of text',why:'What you have.'},
       {k:'b',n:'A small illustration and a button',why:'A simple drawing in your theme colours, a friendly headline, and the obvious next step.'},
       {k:'c',n:'An icon in a circle',why:'The treatment Records already uses. Tidy and cheap, less charm.'}],
 rec:'b',recWhy:'Empty screens are what a new user sees most. They should feel like an invitation, not an error.'},
{id:'onboard',t:'Onboarding',where:'The seven first-run steps',
 prob:'Each step is a small icon and a headline on the page colour, with most of the screen empty.',
 opts:[{k:'a',n:'Icon and headline',why:'What you have.'},
       {k:'b',n:'A coloured top with a picture',why:'The top of each step is the theme colour with a simple drawing of the idea. Headline and button stay where they are.'}],
 rec:'b',recWhy:'It is the first thirty seconds of the app. It should look like the app at its best.'},
{id:'motion',t:'How the app reacts',where:'Logging, buttons, progress',
 prob:'When you tap Done, the card changes instantly and a toast appears. Nothing presses, pops or fills. The tiles below loop so you can compare.',
 opts:[{k:'a',n:'Instant',why:'What you have.'},
       {k:'b',n:'Responsive',why:'The button presses down, the card eases to green, the tick pops, the bar fills. Around a fifth of a second each.'},
       {k:'c',n:'Responsive, plus a little celebration',why:'Everything in B, plus a small bounce and a burst of confetti each time you log the ideal.'}],
 rec:'b',recWhy:'You chose earlier to keep big celebrations for levels and badges. B makes every tap feel good without spending that.'},
{id:'voice',t:'The voice screen',where:'Fallback AI',
 prob:'You said the microphone did not feel like AI voice. The screen behind it is still a plain circle with a mic.',
 opts:[{k:'a',n:'Microphone button',why:'What you have.'},
       {k:'b',n:'A listening orb',why:'A larger pulsing orb with moving sound bars, and the example requests as tappable chips.'}],
 rec:'b',recWhy:'Moving sound bars say "I am listening" in a way a mic icon cannot.'}
];
D.forEach((d,i)=>d.num=i+1);
const REC=Object.fromEntries(D.map(d=>[d.id,d.rec])), NOW=Object.fromEntries(D.map(d=>[d.id,'a']));
const FIXES=['Thin bars become one thick, rounded bar style everywhere (progress, XP, course days).','Numbers that matter use heavy, fixed-width digits on every screen, not only Today.','The "Due", "As-needed" and "One-time" tags get one shape and one size.','To-do rows get the same icon circle as every other task.','Notifications and Records get a short explanation and an action when empty, instead of a blank page.','Section headings, card padding and gaps are checked screen by screen against one scale.'];

/* ---------- state ---------- */
const LS='fallback-polish-board-v1';
let state={picks:{},notes:{},ui:{theme:'forge',scheme:'light',view:'new',screen:'routines'}};
const eff=()=>({...REC,...state.picks});
const seedNow=()=>(THEMES.find(x=>x.k===state.ui.theme)||THEMES[0]).seed;
const themeName=()=>(THEMES.find(x=>x.k===state.ui.theme)||THEMES[0]).n;
function T(){const t=derive(seedNow(),state.ui.scheme,{tone:'b',signal:'b',cta:'b'});
  t.onl=cr(WHITE,t.solid)>=3?WHITE:t.on; t.band=t.fill.toLowerCase()===t.solid.toLowerCase()?mix(t.fill,'#000000',.16):t.fill; t.edge=mix(t.solid,'#000000',.24); return t}
const vars=t=>`--bg:${t.bg};--card:${t.card};--surface:${t.surface};--tx:${t.text};--mu:${t.muted};--bd:${t.border};--strong:${t.strong};--off:${t.off};--solid:${t.solid};--on:${t.on};--onl:${t.onl};--band:${t.band};--edge:${t.edge};--soft:${t.soft};--acc:${t.acc};--mark:${t.mark};--i:${t.ideal};--id:${t.idealDeep};--is:${t.idealSoft};--io:${t.idealOn};--f:${t.fb};--fd:${t.fbDeep};--fs:${t.fbSoft};--fo:${t.fbOn};--g:${t.gold.fill};--gd:${t.gold.deep};--gs:${t.gold.soft}`;
const app=(P,inner,cls='')=>`<div class="app f-${P.font} d-${P.depth} r-${P.rows} ${cls}" style="${vars(T())}">${inner}</div>`;

/* ---------- pieces ---------- */
const TASKS={
  workout:{n:'Morning workout',m:'Daily · High',ic:'dumbbell',c:TC[0],ideal:'20-minute run',fb:'10 push-ups',wk:['i','f','i','o','i','f','t']},
  read:{n:'Read before bed',m:'Mon to Fri',ic:'book',c:TC[1],ideal:'Read 20 pages',fb:'Read one page',wk:['i','i','m','f','i','n','t']},
  pills:{n:'Antibiotics',m:'Course · Dose 0 of 2',ic:'pill',c:TC[2],ideal:'Take with food',fb:'Take the dose',wk:['i','i','i','t','n','n','n']}};
const status=`<div class="m-status"><span>9:41</span><span>5G</span></div>`;
const hdTab=(t,sub,ics=['search'])=>`<div class="m-hd"><div><div class="m-h1">${t}</div>${sub?`<div class="m-sub">${sub}</div>`:''}</div><span class="m-ics">${ics.map(i=>I(i)).join('')}</span></div>`;
const hdBack=(t,right='')=>`<div class="m-hd">${I('chevL',22)}<div class="m-h2 m-sp">${t}</div>${right}</div>`;
const ring=(pct,size,sw,arc,track,op,inner='',style='')=>{const r=(size-sw)/2,c=2*Math.PI*r;return `<span class="ringbox" style="width:${size}px;height:${size}px;${style}"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${track}" stroke-opacity="${op}" stroke-width="${sw}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${arc}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c*pct/100).toFixed(1)} ${c.toFixed(1)}"/></svg>${inner}</span>`};
const heroCard=(num,label,detail,pct)=>`<div class="h-card"><div class="h-top"><span class="h-num">${num}</span><span class="h-lab m-sp">${label}</span>${pct!=null?ring(pct,40,5,'var(--onl)','var(--onl)',.3):''}</div><div class="h-band"><span class="m-sp">${detail}</span>${I('chevR',16)}</div></div>`;
const sec=(a,b='')=>`<div class="m-sec"><b>${a}</b><span class="m-m">${b}</span></div>`;
const headRow=(t,right='')=>`<div class="m-top"><span class="m-av" style="background:${t.c}">${I(t.ic,19)}</span><div class="m-sp"><div class="m-b">${t.n}</div><div class="m-m">${t.m}</div></div>${right}</div>`;
const logBtns=t=>`<div class="m-btns"><span class="m-btn i s"><b>${I('checks',15)}Done</b><small>${t.ideal}</small></span><span class="m-btn f s"><b>${I('check',15)}Fallback</b><small>${t.fb}</small></span></div>`;
const todoCard=k=>{const t=TASKS[k];return `<div class="m-card"><div class="m-tk">${headRow({...t,m:k==='pills'?t.m:'Routine · Daily'})}${logBtns(t)}<span class="m-skip">Skip today</span></div></div>`};
const doneCard=(k,ideal=true)=>{const t=TASKS[k];return `<div class="m-card ${ideal?'li':'lf'}"><div class="m-tk">${headRow({...t,m:ideal?'Ideal done':'Fallback done'},`<span class="m-okc">${I(ideal?'checks':'check',16)}</span>`)}</div></div>`};
const WD=['T','W','T','F','S','S','M'];
const week=w=>`<div class="wk">${w.map((s,i)=>`<span class="wd ${s}"><i>${s==='i'?I('checks',13):s==='f'?I('check',13):s==='o'?I('minus',13):''}</i><em>${WD[i]}</em></span>`).join('')}</div>`;
const TABS=[['sun','Today'],['repeat','Routines'],['cal','Events'],['list','Courses'],['file','To-dos']];
const tabs=on=>`<div class="m-tabs p">${TABS.map(([ic,l],i)=>`<span class="m-tab ${i===on?'on':''}"><span class="pill" style="background:${i===on?'var(--soft)':'transparent'};color:inherit;padding:3px 12px">${I(ic,20)}</span>${l}</span>`).join('')}</div>`;
const fab=`<span class="m-fab">${I('plus',22)}</span>`;
const chips=`<div class="chips">${['M','T','W','T','F','S','S'].map((d,i)=>`<span class="${i?'':'on'}">${d}</span>`).join('')}</div>`;

function tabHead(P){
  if(P.tabhead==='b')return heroCard('2/3','done','Read before bed is still open today',67);
  if(P.tabhead==='c')return `<div class="t-slim"><div class="t-bar"><span style="width:67%"></span></div><div class="m-m"><b>2 of 3</b> routines done today</div></div>`;
  return ''}
function routineCard(P,k){const t=TASKS[k], right=`<span class="pill">Due</span>`;
  if(P.list==='b')return `<div class="m-card"><div class="m-tk">${headRow(t,right)}${week(t.wk)}<div class="plan"><span class="ci">Ideal</span> ${t.ideal} · <span class="cf">Fallback</span> ${t.fb}</div></div></div>`;
  return `<div class="m-card"><div class="m-tk">${headRow(t,right)}<div class="m-btns"><span class="p-tile i"><small>${I('checks',11)}Ideal</small>${t.ideal}</span><span class="p-tile f"><small>${I('check',11)}Fallback</small>${t.fb}</span></div></div></div>`}
function taskTop(P){const t=TASKS.workout, th=T();
  if(P.task==='b')return `<div class="tt" style="--tc:${t.c};--tcs:${mix(th.card,t.c,state.ui.scheme==='dark'?.22:.14)}"><div class="m-hd" style="padding:0">${I('chevL',22)}<span class="m-sp"></span>${I('more',20)}</div><div class="tt-main"><span class="tt-ic">${I(t.ic,28)}</span><div class="m-sp"><div class="tt-name">${t.n}</div><div class="m-m" style="color:var(--tx)">Routine · Daily · High importance</div></div></div>${week(t.wk)}</div>`;
  return `<div class="m-hd">${I('chevL',22)}<span class="m-av" style="background:${t.c};width:30px;height:30px">${I(t.ic,16)}</span><div class="m-h2 m-sp">${t.n}</div>${I('more',20)}</div><div class="m-m" style="padding:0 4px"><b style="color:var(--tx)">Routine · Daily</b> · High importance · Recommended</div>`}
const taskLog=()=>`<div class="m-card"><div class="m-tk">${sec('Today','Mon Nov 16')}${logBtns(TASKS.workout)}<span class="m-skip">Skip today</span></div></div>`;
const row=(ic,l,v,i=0,right)=>`<div class="m-row"><span class="m-ri" style="--rc:${TC[i%5]}">${I(ic,18)}</span><span class="m-b m-sp">${l}</span>${v?`<span class="m-m">${v}</span>`:''}${right||I('chevR',16)}</div>`;
function progressBody(P){
  const bar=th=>`<div class="pbar ${th?'th':''}"><span style="width:60%;background:var(--i)"></span><span style="width:25%;background:var(--f)"></span><span style="width:5%;background:var(--off)"></span></div>`;
  if(P.progress==='b')return `<div class="h-card"><div class="h-top" style="padding:14px 12px 12px;gap:14px">${ring(85,84,9,'var(--onl)','var(--onl)',.3,'<span class="h-num" style="font-size:24px;position:relative">85%</span>')}<span class="h-lab m-sp">Showed up</span></div><div class="h-band"><span class="m-sp">17 of 20 counted days · last 30</span></div></div>
   <div class="sts"><div class="st"><u style="background:var(--is);color:var(--id)">${I('checks',15)}</u><b>12</b><span>Ideal</span></div><div class="st"><u style="background:var(--fs);color:var(--fd)">${I('check',15)}</u><b>5</b><span>Fallback</span></div><div class="st"><u style="background:var(--surface);color:var(--mu)">${I('minus',15)}</u><b>1</b><span>Off day</span></div></div>${bar(1)}`;
  return `<div class="m-card"><div class="m-tk"><div><span class="m-big" style="font-size:30px">85%</span> <span class="m-m">showed up</span></div><div style="font-size:13.5px">12 ideal + 5 fallback = 17 of 20 counted days</div>${bar(0)}<div class="leg"><span><i style="background:var(--i)"></i>Ideal · 12</span><span><i style="background:var(--f)"></i>Fallback · 5</span><span><i style="background:var(--off)"></i>Off · 1</span><span><i style="border:1px solid var(--strong)"></i>Missed · 3</span></div></div></div>`}
function awards(P){
  const B=[['award','7 days',1],['lock','30 days',0,'7/30'],['shield','Never zero',1],['lock','50 shown up',0,'17/50']];
  if(P.awards==='b')return `<div class="m-card"><div class="aw gold"><div class="m-top"><span class="medal">2</span><div class="m-sp"><div class="m-m" style="font-weight:700;color:var(--gd)">Level 2</div><div class="big">Warming up</div></div></div><div class="gbar th"><span style="width:62%"></span></div><div class="m-m" style="color:var(--tx)"><b>96 XP</b> to Level 3</div></div></div>${sec('Badges','2 of 12')}<div class="bdg">${B.map(([ic,l,on,pr])=>`<span class="bd fill ${on?'on':''}"><i>${I(ic,on?20:16)}</i>${l}${pr?`<small>${pr}</small>`:''}</span>`).join('')}</div>`;
  return `<div class="m-card"><div class="aw"><div class="m-m" style="color:var(--tx);font-weight:600">Level 2 · Warming up</div><div class="xp">154 / 250 XP</div><div class="gbar"><span style="width:62%"></span></div><div class="m-m">254 XP all time</div></div></div>${sec('Badges')}<div class="bdg">${B.map(([ic,l,on])=>`<span class="bd ${on?'on':''}"><i>${I(ic,18)}</i>${l}</span>`).join('')}</div>`}
function settingsBody(P,short){
  const g1=`<div class="grp">Preferences</div><div class="m-card">${row('bell','Notifications','Off',0)}${row('palette','Theme','',1)}${row('grid','Widgets','',2)}</div>`;
  const g2=`<div class="grp">Fallback AI</div><div class="m-card">${row('spark','Subscription','Free plan',3)}${row('clock','Conversation history','',4)}</div>`;
  const prof=`<div class="m-card"><div class="m-row"><span class="lvl">2</span><div class="m-sp"><div class="m-b">Level 2 · Warming up</div><div class="m-m">79% showing up, last 30 days</div></div>${I('chevR',16)}</div></div>`;
  return short?g1:prof+g1+g2}
const illus=kind=>kind==='cal'
 ?`<svg width="150" height="96" viewBox="0 0 150 96" aria-hidden="true"><ellipse cx="75" cy="56" rx="68" ry="36" style="fill:var(--soft)"/><rect x="42" y="18" width="66" height="60" rx="10" style="fill:var(--card);stroke:var(--strong);stroke-width:2"/><path d="M42 28a10 10 0 0 1 10-10h46a10 10 0 0 1 10 10v8H42z" style="fill:var(--solid)"/><rect x="56" y="11" width="5" height="13" rx="2.5" style="fill:var(--strong)"/><rect x="89" y="11" width="5" height="13" rx="2.5" style="fill:var(--strong)"/><circle cx="60" cy="50" r="5" style="fill:var(--is)"/><circle cx="75" cy="50" r="5" style="fill:var(--fs)"/><circle cx="90" cy="50" r="5" style="fill:var(--surface)"/><circle cx="60" cy="65" r="5" style="fill:var(--surface)"/><circle cx="75" cy="65" r="5" style="fill:none;stroke:var(--acc);stroke-width:2"/><path d="M122 20l2.2 5.8L130 28l-5.8 2.2L122 36l-2.2-5.8L114 28l5.8-2.2z" style="fill:var(--g)"/><circle cx="26" cy="34" r="4" style="fill:var(--g)"/></svg>`
 :`<svg width="170" height="96" viewBox="0 0 170 96" aria-hidden="true"><g transform="rotate(-6 60 50)"><rect x="18" y="22" width="84" height="46" rx="12" style="fill:#fff"/><circle cx="40" cy="45" r="11" style="fill:var(--i)"/><path d="m34.5 45 4 4 7-7.5" style="fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"/><rect x="58" y="37" width="34" height="6" rx="3" style="fill:var(--is)"/><rect x="58" y="48" width="22" height="6" rx="3" style="fill:#e8e6e0"/></g><g transform="rotate(5 112 58)"><rect x="70" y="38" width="84" height="46" rx="12" style="fill:#fff"/><circle cx="92" cy="61" r="11" style="fill:var(--f)"/><path d="m86.5 61 4 4 7-7.5" style="fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"/><rect x="110" y="53" width="34" height="6" rx="3" style="fill:var(--fs)"/><rect x="110" y="64" width="22" height="6" rx="3" style="fill:#e8e6e0"/></g></svg>`;
function emptyBody(P){
  if(P.empty==='b')return `<div class="em">${illus('cal')}<div class="big">Nothing on today</div><div class="m-m">Your calendar is clear for Monday.</div><span class="m-cta sm">Add an event</span></div>`;
  if(P.empty==='c')return `<div class="em"><span class="circ">${I('cal',26)}</span><div class="big">Nothing on today</div><div class="m-m">Your calendar is clear for Monday.</div><span class="m-cta sec sm">Add an event</span></div>`;
  return `<div class="m-m" style="padding:0 4px 60px">Nothing on the calendar for Monday.</div>`}
function onboard(P){const dots=`<div class="ob-dots">${[0,1,0,0,0,0,0].map(x=>`<i class="${x?'on':''}"></i>`).join('')}</div>`;
  const txt=`<div class="ob-h">A plan A and a plan B for every habit.</div><div style="font-size:13.5px;color:var(--mu)">Too tired for the full thing? Do the fallback. You still showed up.</div>`;
  if(P.onboard==='b')return `<div class="ob"><div class="ob-top">${dots}${illus('plans')}</div>${txt}<div style="height:6px"></div><div class="m-cta">Next</div></div>`;
  return `<div class="ob">${dots}<span class="ob-chip">${I('split',20)}</span>${txt}<div style="height:54px"></div><div class="m-cta">Next</div></div>`}
function voice(P){const S=['Add a morning run','Water plants Mon and Thu','Plan my week'];
  if(P.voice==='b')return `<div class="vo"><div class="big">What should I set up for you?</div><div class="orb"><span class="bars"><i></i><i></i><i></i><i></i><i></i></span></div><div class="m-b">Tap and speak</div><div class="m-m">Audio is only processed when you tap.</div><div class="sug">${S.map(s=>`<span>${s}</span>`).join('')}</div></div>`;
  return `<div class="vo"><div class="big">What should I set up for you?</div><div class="m-m">Tap and speak, or type below.</div><span class="mic">${I('mic',28)}</span><div class="m-m">Audio is only processed when you tap.</div></div><div class="grp">Try one of these</div><div class="m-card">${S.map(s=>`<div class="m-row"><span class="m-b m-sp" style="font-weight:500">${s}</span>${I('chevR',16)}</div>`).join('')}</div>`}
function motion(P){const k=P.motion, t=TASKS.workout;
  const conf=k==='c'?`<span class="conf">${[[-34,-30,'var(--i)'],[30,-36,'var(--g)'],[-46,6,'var(--solid)'],[44,-4,'var(--f)'],[-16,-48,'var(--g)'],[18,34,'var(--i)'],[-38,30,'var(--solid)'],[8,-54,'var(--f)']].map(([x,y,c],i)=>`<i style="--dx:${x}px;--dy:${y}px;--r:${(i%2?1:-1)*(120+i*30)}deg;background:${c}"></i>`).join('')}</span>`:'';
  return `<div class="mo-wrap mo-${k}">${sec('Due today','')}<div class="mo-bar"><span></span></div><div class="mo"><div class="before">${todoCard('workout')}</div><div class="after" style="position:relative">${doneCard('workout')}${conf}</div></div></div>`}

/* whole screens for the phone */
const SCREENS={
  today:{n:'Today',f:P=>`${status}<div class="m-body">${hdTab('Today','Mon, Nov 16',['search','gear'])}${heroCard('79%','Showing up','16 of the last 30 days',79)}<div class="m-card">${row('trophy','Achievements','Level 2',0)}</div>${sec('Due today','1 of 3 done')}${doneCard('workout')}${todoCard('pills')}</div>${fab}${tabs(0)}`},
  routines:{n:'Routines',f:P=>`${status}<div class="m-body">${hdTab('Routines')}${chips}${tabHead(P)}${sec('Due Monday')}${routineCard(P,'workout')}${routineCard(P,'read')}</div>${fab}${tabs(1)}`},
  task:{n:'Task',f:P=>`${status}<div class="m-body">${taskTop(P)}${taskLog()}<div class="m-card">${row('alarm','Snooze to tomorrow','',0)}${row('cal','Step schedule','',1)}</div></div>`},
  progress:{n:'Progress',f:P=>`${status}<div class="m-body">${hdBack('Your consistency')}${progressBody(P)}<div class="m-card">${row('clock','Full history','',0)}</div></div>`},
  awards:{n:'Awards',f:P=>`${status}<div class="m-body">${hdBack('Achievements')}${awards(P)}</div>`},
  settings:{n:'Settings',f:P=>`${status}<div class="m-body">${hdBack('Settings')}${settingsBody(P)}</div>`},
  events:{n:'Events',f:P=>`${status}<div class="m-body">${hdTab('Events')}${P.tabhead==='b'?heroCard('Thu','Dentist','Next event · check-up at 7:00 PM'):''}${sec('Today')}${emptyBody(P)}</div>${fab}${tabs(2)}`}};
const TILE={
  font:P=>app(P,hdTab('Routines')+heroCard('2/3','done','Read before bed is still open today',67)+`<div class="m-cta">Save routine</div>`),
  depth:P=>app(P,todoCard('pills')+`<div class="m-card">${row('alarm','Snooze to tomorrow','',0)}</div><div class="m-cta">Save routine</div>`),
  tabhead:P=>app(P,hdTab('Routines')+chips+tabHead(P)+sec('Due Monday')+routineCard(P,'workout')),
  list:P=>app(P,routineCard(P,'workout')+routineCard(P,'read')),
  task:P=>app(P,`<div class="m-body" style="padding:6px 0 0">${taskTop(P)}${taskLog()}</div>`),
  progress:P=>app(P,progressBody(P)),
  awards:P=>app(P,awards(P)),
  rows:P=>app(P,settingsBody(P,true)),
  empty:P=>app(P,hdTab('Events')+sec('Today')+emptyBody(P)),
  onboard:P=>app(P,onboard(P)),
  motion:P=>app(P,motion(P)),
  voice:P=>app(P,voice(P))};

/* ---------- static frame ---------- */
const SHOTS=[['today','Today','15.1%',1],['routines','Routines','3.1%'],['events','Events','1.4%'],['todos','To-dos','1.0%'],['task','A task','1.0%'],['progress','Progress','1.3%'],['awards','Achievements','1.5%'],['settings','Settings','0.1%'],['notif','Notifications','0%']];
$('#strip').innerHTML=SHOTS.map(([k,l,p,ok])=>`<figure class="shot"><img src="data:image/jpeg;base64,${IMG[k]}" alt="" loading="lazy"><figcaption><i class="${ok?'ok':''}">${p} colour</i><b>${l}</b></figcaption></figure>`).join('');
$('#sw').innerHTML=THEMES.map(x=>`<button type="button" data-theme-k="${x.k}" style="--c:${x.seed}" aria-label="${x.n}" title="${x.n}"></button>`).join('');
$('#scr').innerHTML=Object.entries(SCREENS).map(([k,s])=>`<button type="button" data-screen="${k}">${s.n}</button>`).join('');
$('#tot').textContent=D.length;
$('#fixes').innerHTML=FIXES.map(x=>`<li>${x}</li>`).join('');
$('#decs').innerHTML=D.map(d=>`
 <article class="dec" id="d-${d.id}">
  <div class="dec-h"><span class="n">${String(d.num).padStart(2,'0')}</span><h3>${d.t}</h3><span class="state" id="s-${d.id}">Not decided</span></div>
  <span class="mono">Affects: ${d.where}</span>
  <p>${d.prob}</p>
  <div class="opts" role="radiogroup" aria-label="${esc(d.t)}">${d.opts.map(o=>`
   <label class="opt"><input type="radio" name="p-${d.id}" id="p-${d.id}-${o.k}" value="${o.k}">
    <div class="opt-top"><span class="k">${o.k.toUpperCase()}</span><span class="nm">${o.n}${o.k==='a'?' (today)':''}</span>${d.rec===o.k?'<span class="rec">My pick</span>':''}<span class="picked">Chosen</span></div>
    <div class="specs" id="x-${d.id}-${o.k}"></div><p class="why">${o.why}</p></label>`).join('')}</div>
  <p class="recwhy"><b>I'd choose ${d.rec.toUpperCase()}.</b> ${d.recWhy}</p>
  <details class="note"><summary>Add a note</summary><textarea id="n-${d.id}" placeholder="Anything you'd change about the option you picked" aria-label="Note for ${esc(d.t)}"></textarea></details>
 </article>`).join('');

function draw(){
  const P=eff(), ui=state.ui;
  if(!SCREENS[ui.screen])ui.screen='routines';
  document.querySelectorAll('#sw button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.themeK===ui.theme));
  document.querySelectorAll('[data-scheme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.scheme===ui.scheme));
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===ui.view));
  document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.screen===ui.screen));
  $('#tname').textContent=themeName();
  const SP=ui.view==='now'?NOW:P;
  $('#ph').innerHTML=app(SP,SCREENS[ui.screen].f(SP));
  const n=Object.keys(state.picks).length;
  $('#cap').textContent=ui.view==='now'?'This screen as it is in the app today.':n===D.length?'All twelve of your picks together.':n?`Your ${n} pick${n>1?'s':''}, with my picks for the rest.`:'My picks together. It updates as you choose.';
  D.forEach(d=>d.opts.forEach(o=>{$(`#x-${d.id}-${o.k}`).innerHTML=TILE[d.id]({...P,[d.id]:o.k})}));
  fit();
}
function fit(){const st=$('#stage'),ph=$('#ph'),box=$('#phbox');
  document.documentElement.style.setProperty('--barh',$('#bar').offsetHeight+'px');
  ph.style.transform='';box.style.height='';box.style.width='';
  if(getComputedStyle(st).position!=='sticky')return;
  const avail=innerHeight-$('#bar').offsetHeight-14-(st.offsetHeight-ph.offsetHeight)-16, k=Math.max(.6,Math.min(1,avail/ph.offsetHeight));
  if(k<1){ph.style.transform=`scale(${k})`;box.style.height=ph.offsetHeight*k+'px';box.style.width=ph.offsetWidth*k+'px'}}
addEventListener('resize',fit);

/* ---------- picks: saved in this browser, and online when the viewer allows it ---------- */
let ref=null, dirty=false, saving=false, again=false, timer=null, gotRemote=false;
const setSave=(t,err)=>{const el=$('#save');el.textContent=t;el.classList.toggle('err',!!err)};
const lsGet=()=>{try{return JSON.parse(localStorage.getItem(LS)||'null')}catch(e){return null}};
const lsSet=()=>{try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}};
function summary(){
  const lines=['Fallback polish choices',''];
  D.forEach(d=>{const k=state.picks[d.id];const o=d.opts.find(x=>x.k===k);
    lines.push(`${String(d.num).padStart(2,'0')}. ${d.t}: ${o?`${k.toUpperCase()} (${o.n})`:'not decided'}${k&&k===d.rec?'':k?'  [differs from recommendation '+d.rec.toUpperCase()+']':''}`);
    const n=(state.notes[d.id]||'').trim(); if(n) lines.push(`    note: ${n}`);});
  return lines.join('\n');
}
function paint(){
  let n=0;
  D.forEach(d=>{const k=state.picks[d.id];const o=d.opts.find(x=>x.k===k);
    d.opts.forEach(x=>{const r=document.getElementById(`p-${d.id}-${x.k}`);if(r)r.checked=(x.k===k)});
    $('#s-'+d.id).textContent=o?`Chosen: ${k.toUpperCase()}`:'Not decided';
    $('#d-'+d.id).classList.toggle('done',!!o); if(o)n++;
    const ta=$('#n-'+d.id); if(ta&&document.activeElement!==ta){ta.value=state.notes[d.id]||''; if(ta.value)ta.closest('details').open=true}});
  $('#cnt').textContent=n; $('#fill').style.width=(100*n/D.length)+'%';
  $('#useRec').hidden=(n===D.length);
  $('#summary').value=summary(); draw();
}
function body(){const labels={};D.forEach(d=>{const o=d.opts.find(x=>x.k===state.picks[d.id]);if(o)labels[d.id]=`${String(d.num).padStart(2,'0')} ${d.t}: ${o.k.toUpperCase()} (${o.n})`});
  return {picks:{...state.picks},notes:{...state.notes},labels,decided:Object.keys(labels).length,total:D.length,updatedAt:new Date().toISOString()}}
async function flush(){
  if(!ref){setSave('Saved in this browser only. Use Copy my choices when you finish.');dirty=false;return}
  if(saving){again=true;return}
  saving=true;setSave('Saving…');
  try{await ref.set(body());dirty=false;setSave('Saved')}
  catch(e){dirty=false;ref=null;setSave("Couldn't save online. Use Copy my choices when you finish.",true)}
  saving=false; if(again){again=false;flush()}
}
function changed(fast){dirty=true;lsSet();paint();clearTimeout(timer);timer=setTimeout(flush,fast?250:900)}
const DEC_SCREEN={tabhead:'routines',list:'routines',task:'task',progress:'progress',awards:'awards',rows:'settings',empty:'events'};
document.addEventListener('change',e=>{const t=e.target;if(t.matches&&t.matches('.opt input')){const id=t.name.slice(2);state.picks[id]=t.value;if(DEC_SCREEN[id]){state.ui.screen=DEC_SCREEN[id];state.ui.view='new'}changed(true)}});
document.addEventListener('input',e=>{const t=e.target;
  if(t.matches&&t.matches('details.note textarea')){const id=t.id.slice(2);if(t.value.trim())state.notes[id]=t.value;else delete state.notes[id];dirty=true;lsSet();$('#summary').value=summary();clearTimeout(timer);timer=setTimeout(flush,1200)}});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(!b)return;
  if(b.dataset.themeK){state.ui.theme=b.dataset.themeK}else if(b.dataset.scheme){state.ui.scheme=b.dataset.scheme}else if(b.dataset.view){state.ui.view=b.dataset.view}else if(b.dataset.screen){state.ui.screen=b.dataset.screen}else return;
  lsSet();draw()});
$('#useRec').addEventListener('click',()=>{D.forEach(d=>{if(!state.picks[d.id])state.picks[d.id]=d.rec});changed(true)});
async function copy(btn){const t=summary();let ok=false;try{await navigator.clipboard.writeText(t);ok=true}catch(e){}
  if(!ok){const ta=$('#summary');ta.scrollIntoView({block:'center'});ta.focus();ta.select()}
  const old=btn.textContent;btn.textContent=ok?'Copied':'Select all, then copy';setTimeout(()=>btn.textContent=old,2200)}
$('#copy').addEventListener('click',e=>copy(e.currentTarget));$('#copy2').addEventListener('click',e=>copy(e.currentTarget));

const local=lsGet(); if(local&&local.picks){state={picks:local.picks||{},notes:local.notes||{},ui:{...state.ui,...(local.ui||{})}}}
paint();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
(async()=>{
  let db=null;
  try{ if(window.claude&&typeof window.claude.use==='function') db=await window.claude.use('db') }catch(e){db=null}
  if(!db){setSave('Saved in this browser only. Use Copy my choices when you finish.');return}
  ref=db.doc('polish/picks');
  const slow=setTimeout(()=>{if(!gotRemote)setSave("Can't reach saved picks yet. Yours are kept in this browser meanwhile.")},10000);
  ref.onSnapshot(snap=>{
    if(snap.metadata&&snap.metadata.hasPendingWrites)return;
    const fresh=!(snap.metadata&&snap.metadata.fromCache);
    if(snap.exists){const d=snap.data()||{};
      if(!dirty&&!saving){state={...state,picks:{...(d.picks||{})},notes:{...(d.notes||{})}};lsSet();paint()}
      if(fresh){gotRemote=true;clearTimeout(slow);if(!dirty&&!saving)setSave('Saved')}
    }else if(fresh){const first=!gotRemote;gotRemote=true;clearTimeout(slow);
      if(first&&Object.keys(state.picks).length){dirty=true;flush()}else if(!dirty)setSave('Picks save automatically')}
  },err=>{clearTimeout(slow);ref=null;setSave('Saved in this browser only. Use Copy my choices when you finish.')});
})();
