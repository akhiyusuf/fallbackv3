const p=(h)=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const lum=(h)=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};const [r,g,b]=p(h);return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
module.exports={cr};
if(require.main===module){const rows=JSON.parse(process.argv[2]);for(const [name,fg,...bgs] of rows)console.log(name.padEnd(26),fg,bgs.map(b=>b+'='+cr(fg,b)).join('  '));}
