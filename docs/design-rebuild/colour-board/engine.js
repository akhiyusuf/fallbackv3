/* ---------- colour engine: one seed colour in, a whole checked theme out ---------- */
const INK='#26241f', WHITE='#ffffff';
const h2r=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const r2h=r=>'#'+r.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)};
const gam=c=>255*(c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055);
const lum=h=>{const[r,g,b]=h2r(h).map(lin);return .2126*r+.7152*g+.0722*b};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const mix=(a,b,t)=>{const x=h2r(a),y=h2r(b);return r2h(x.map((v,i)=>v+(y[i]-v)*t))};
function toLch(hex){const[r,g,b]=h2r(hex).map(lin);
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L=.2104542553*l+.793617785*m-.0040720468*s,a=1.9779984951*l-2.428592205*m+.4505937099*s,bb=.0259040371*l+.7827717662*m-.808675766*s;
  return [L,Math.hypot(a,bb),(Math.atan2(bb,a)*180/Math.PI+360)%360]}
function fromLch(L,C,H){const hr=H*Math.PI/180;
  for(let c=C;c>=0;c-=.004){const a=c*Math.cos(hr),b=c*Math.sin(hr);
    const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
    const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
    if(rgb.every(v=>v>=-.001&&v<=1.001))return r2h(rgb.map(v=>gam(Math.max(0,Math.min(1,v)))))}
  return L>.5?WHITE:'#000000'}
const NEUTRAL={
  light:{bg:'#f6f4f0',card:'#ffffff',surface:'#ebe8e1',text:'#33312b',muted:'#5f5b52',border:'#e2dfd8',strong:'#8f8a80',off:'#a8a294'},
  dark:{bg:'#211f1c',card:'#282521',surface:'#33302a',text:'#efece6',muted:'#bdb7ac',border:'#3b3831',strong:'#7a7469',off:'#6f6a60'}};
const SIGNAL={
  a:{light:{ideal:'#8FBC6B',idealDeep:'#46702A',idealSoft:'#EFF5E7',fb:'#7FB2D4',fbDeep:'#34678F',fbSoft:'#EAF2F8'},
     dark:{ideal:'#7CA95F',idealDeep:'#A8C98D',idealSoft:'#2C3323',fb:'#6C9DBE',fbDeep:'#9FC2D9',fbSoft:'#22303B'}},
  b:{light:{ideal:'#22A94E',idealDeep:'#17743A',idealSoft:'#DFF5E5',fb:'#2B93EE',fbDeep:'#1560AB',fbSoft:'#DDEEFD'},
     dark:{ideal:'#2DBE5E',idealDeep:'#6BDD90',idealSoft:'#173623',fb:'#3D9DF2',fbDeep:'#82C3FF',fbSoft:'#152D46'}}};
const GOLD={light:{fill:'#DCB863',deep:'#7D5F14',soft:'#F7F0E0'},dark:{fill:'#CBA24C',deep:'#DDBE79',soft:'#332B1C'}};
const best=bg=>cr(INK,bg)>=cr(WHITE,bg)?INK:WHITE;
/* picks: tone a|b (neutrals), signal a|b, cta a|b */
function derive(seed,scheme,p){
  const [L,C,H]=toLch(seed), dark=scheme==='dark';
  const walk=(test,dir,l0=L,c0=C)=>{let l=l0,c=fromLch(l,c0,H),n=0;while(!test(c)&&n++<90){l+=dir*.01;c=fromLch(l,c0,H)}return c};
  const N0=NEUTRAL[scheme], N={...N0};
  if(p.tone==='b'){ if(dark){N.bg=mix(N0.bg,seed,.07);N.card=mix(N0.card,seed,.08);N.surface=mix(N0.surface,seed,.11);N.border=mix(N0.border,seed,.13)}
    else{N.bg=mix(N0.bg,seed,.05);N.surface=mix(N0.surface,seed,.08);N.border=mix(N0.border,seed,.09)} }
  const fill=walk(c=>cr(WHITE,c)>=4.6,-1);                       // deepest needed for white text
  const bOn=best(seed);
  const bright=cr(bOn,seed)>=4.5?seed:walk(c=>cr(bOn,c)>=4.5,bOn===WHITE?-1:1);
  const solid=p.cta==='b'?bright:fill, on=p.cta==='b'?bOn:WHITE;
  const soft=dark?mix(N.card,seed,.26):mix(WHITE,seed,.13);
  const acc=dark?walk(c=>cr(c,N.card)>=5.2&&cr(c,soft)>=4.5,1,Math.max(L,.7),Math.min(C,.17))
                 :walk(c=>cr(c,N.bg)>=4.6&&cr(c,soft)>=4.5,-1);
  const S=SIGNAL[p.signal][scheme];
  return {seed,scheme,H,C,L,...N,fill,bright,brightOn:bOn,solid,on,soft,acc,mark:seed,
    ...S,idealOn:best(S.ideal),fbOn:best(S.fb),gold:GOLD[scheme]};
}
if(typeof module!=='undefined')module.exports={derive,cr,toLch,fromLch,mix,SIGNAL,NEUTRAL,INK,WHITE};
