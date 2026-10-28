// Cosmic neural mind: every learned concept is a star; links are luminous filaments. Canvas 2D + additive blending, sprite-cached glows.
const KIND={fact:[120,230,255],self:[90,255,220],opinion:[190,150,255],emotion:[255,140,210],theme:[140,170,255],joke:[255,215,140],core:[200,250,255]};
function sprite(rgb,sz=64){const c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d'),r=sz/2,gr=g.createRadialGradient(r,r,0,r,r,r);
 gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.12,`rgba(${rgb},.9)`);gr.addColorStop(.35,`rgba(${rgb},.25)`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.fillRect(0,0,sz,sz);return c}
export function createBrain(cv,getState){
 const g=cv.getContext('2d');const dpr=Math.min(2,devicePixelRatio||1);let W=0,H=0,neb=null;
 const SP={};for(const k in KIND)SP[k]=sprite(KIND[k].join(','));const WHITE=sprite('255,255,255',32);
 let dust=[];for(let i=0;i<700;i++){const arm=i%2,r=.05+Math.random()**.8*1.0,a=arm*Math.PI+r*4.4+(Math.random()-.5)*(.5+r*.4);dust.push({x:Math.cos(a)*r+(Math.random()-.5)*.06,y:Math.sin(a)*r+(Math.random()-.5)*.06,b:Math.random(),c:Math.random()<.3?'opinion':Math.random()<.5?'fact':'theme'})}
 let stars=[];function rs(){W=cv.width=innerWidth*dpr;H=cv.height=innerHeight*dpr;stars=[];const n=Math.min(420,(W*H)/(9000*dpr));
  for(let i=0;i<n;i++)stars.push({x:Math.random(),y:Math.random(),z:Math.random()**2,p:Math.random()*6.3});neb=nebula()}
 function nebula(){const c=document.createElement('canvas'),S=c.width=c.height=Math.min(1400,Math.max(W,H));const n=c.getContext('2d');n.globalCompositeOperation='lighter';
  const cols=['120,60,200','200,50,160','30,50,160','20,160,190','90,40,180','170,60,200'];let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<26;i++){const a=rnd()*6.28,d=rnd()**.7*S*.42,x=S/2+Math.cos(a)*d,y=S/2+Math.sin(a)*d*.75,r=S*(.08+rnd()*.22);const gr=n.createRadialGradient(x,y,0,x,y,r);
   gr.addColorStop(0,`rgba(${cols[i%cols.length]},${.05+rnd()*.06})`);gr.addColorStop(1,'rgba(0,0,0,0)');n.fillStyle=gr;n.fillRect(0,0,S,S)}return c}
 rs();addEventListener('resize',rs);
 let voiceF=()=>0,lastT=performance.now(),fts=[],flies=[];// v11: the face is a <video> layer (face-clips.js); here we only keep the galaxy clear around it
 const face=null;// v11b: face is on the main screen only; the galaxy panel shows the full graph
 let graph={nodes:[],links:[]},rot=0,amp=0,anims=[],pulses=[],focus=new Set(),t0=performance.now(),tip=null,level=()=>0;
 function place(n,i){if(n.x!=null)return;const par=n.links&&n.links.length?graph.nodes.find(m=>m.id===n.links[0]&&m.x!=null):null;
  const arm=i%2,r=.14+Math.min(.82,Math.sqrt(i+1)*.085),a=arm*Math.PI+r*4.4+(Math.random()-.5)*.35,j=.03+Math.random()*.03;
  n.x=Math.cos(a)*r+(Math.random()-.5)*j;n.y=Math.sin(a)*r+(Math.random()-.5)*j;if(par&&par.kind!=='core'){n.x=n.x*.75+par.x*.25;n.y=n.y*.75+par.y*.25}}
 function setGraph(gr){graph=gr;graph.nodes.forEach(place)}
 function ignite(node){if(face&&face.ok)flies.push({id:node.id,t:performance.now()});place(node,graph.nodes.length);anims.push({id:node.id,t:performance.now()});for(const l of graph.links)if(l[1]===node.id||l[0]===node.id)pulses.push({a:l[0]===node.id?l[1]:l[0],b:node.id,t:performance.now(),dur:1400,spark:true})}
 function think(ids){focus=new Set(ids||[]);}
 function proj(n,cx,cy,R){const c=Math.cos(rot),s=Math.sin(rot);const x=n.x*c-n.y*s,y=n.x*s+n.y*c;return[cx+x*R,cy+y*R*.78]}// tilted galaxy disk
 function hit(px,py){px*=dpr;py*=dpr;const cx=W/2,cy=H*.44,R=Math.min(W,H)*.46;let best=null,bd=(28*dpr)**2;for(const n of graph.nodes){if(n.kind==='core')continue;const [x,y]=proj(n,cx,cy,R);const d=(x-px)**2+(y-py)**2;if(d<bd){bd=d;best=n}}
  if(best)tip={n:best,t:performance.now()};return best}
 function frame(){requestAnimationFrame(frame);const now=performance.now(),t=(now-t0)/1000,st=getState();const L=level();
  const target={idle:.04,listening:.12+L*2,thinking:.18,speaking:.25+L*2.5}[st]||.04;amp+=(target-amp)*.15;rot+=st==='thinking'?.0016:.0006;
  g.globalCompositeOperation='source-over';g.fillStyle='#02030a';g.fillRect(0,0,W,H);
  const cx=W/2,cy=H*.44,R=Math.min(W,H)*.46;
  // nebula (slow counter-rotation) + parallax stars
  g.globalCompositeOperation='lighter';g.save();g.translate(cx,cy);g.rotate(-rot*.4);const GAL=document.body.classList.contains('galaxy');g.globalAlpha=GAL?.9+amp*.3:.28;const S=neb.width*1.25;g.drawImage(neb,-S/2,-S/2,S,S);g.restore();g.globalAlpha=1;
  for(const s of stars){const px=((s.x+rot*(.02+s.z*.06))%1)*W,py=s.y*H;const tw=.35+.65*Math.abs(Math.sin(t*(.6+s.z)+s.p));const sz=(1+s.z*2.2)*dpr;g.globalAlpha=tw*(.25+s.z*.6)*(GAL?1:.32);g.drawImage(WHITE,px-sz*2,py-sz*2,sz*4,sz*4)}
  if(!GAL){lastT=now;return}// main screen: only faint nebula + drifting stars; full memory galaxy lives in the panel
  const dt=Math.min(.1,(now-lastT)/1000);lastT=now;fts.push(dt);if(fts.length>90){const av=fts.reduce((a,b)=>a+b)/fts.length;fts=[];}
  const V=st==='speaking'?Math.min(1,(window.__vc&&__vc.forceVL!=null?__vc.forceVL:voiceF())):0;let FC=null;
  if(face&&face.ok){const fr=face.draw(g,W,H,cx,cy-H*.02,t,st,amp,V,SP,dpr,dt);FC=fr&&fr.center;g.globalCompositeOperation='lighter'}
  for(const d of dust){const [x,y]=proj(d,cx,cy,R);const sz=(2+d.b*3)*dpr*(1+amp*.4);g.globalAlpha=(.10+d.b*.22)*(.8+.2*Math.sin(t*.7+d.b*9));g.drawImage(SP[d.c],x-sz,y-sz,sz*2,sz*2)}
  {const cs=R*(.5+amp*.35)*(FC?.45:1);g.globalAlpha=(.35+amp*.4)*(FC?.12:1);g.drawImage(SP.core,cx-cs,cy-cs*.8,cs*2,cs*1.6)}
  g.globalAlpha=1;const P={};for(const n of graph.nodes)P[n.id]=n.kind==='core'?[cx,cy]:proj(n,cx,cy,R);
  // filaments, curved like spiral arms
  g.lineWidth=.8*dpr;const CORE=new Set(graph.nodes.filter(n=>n.kind==='core').map(n=>n.id));for(const l of graph.links){const a=P[l[0]],b=P[l[1]];if(!a||!b)continue;if(FC&&(CORE.has(l[0])||CORE.has(l[1])||Math.hypot((a[0]+b[0])/2-FC[0],(a[1]+b[1])/2-FC[1])<R*.55||Math.hypot(a[0]-FC[0],a[1]-FC[1])<R*.3||Math.hypot(b[0]-FC[0],b[1]-FC[1])<R*.3))continue;const age=(now-(l[2]||0))/1000;const fresh=Math.max(0,1-age/6);const f=focus.has(l[0])||focus.has(l[1]);
   const mx=(a[0]+b[0])/2+(a[1]-b[1])*.18,my=(a[1]+b[1])/2+(b[0]-a[0])*.18;g.strokeStyle=`rgba(110,225,255,${(.07+fresh*.5+(f?.12+amp*.25:0))*(FC&&(P[l[0]]===P[0]||l[0]===0||l[1]===0)?.25:1)})`;g.beginPath();g.moveTo(a[0],a[1]);g.quadraticCurveTo(mx,my,b[0],b[1]);g.stroke()}
  // thinking: pulses race along focused filaments
  if(st==='thinking'&&Math.random()<.35){const ls=graph.links.filter(l=>focus.size?(focus.has(l[0])||focus.has(l[1])):true);const l=ls[Math.random()*ls.length|0];if(l)pulses.push(Math.random()<.5?{a:l[0],b:l[1],t:now,dur:650}:{a:l[1],b:l[0],t:now,dur:650})}
  pulses=pulses.filter(p=>now-p.t<p.dur);for(const p of pulses){const a=P[p.a],b=P[p.b];if(!a||!b)continue;const k=(now-p.t)/p.dur,mx=(a[0]+b[0])/2+(a[1]-b[1])*.18*(p.a<p.b?1:1),my=(a[1]+b[1])/2+(b[0]-a[0])*.18;
   const x=(1-k)**2*a[0]+2*(1-k)*k*mx+k*k*b[0],y=(1-k)**2*a[1]+2*(1-k)*k*my+k*k*b[1];const sz=(p.spark?16:10)*dpr;g.drawImage(SP.core,x-sz,y-sz,sz*2,sz*2)}
  // stars (neurons)
  for(const n of graph.nodes){const p=P[n.id];if(!p)continue;const an=anims.find(a=>a.id===n.id);const ig=an?Math.min(1,(now-an.t)/1200):1;
   const near=n.kind==='core'?1:Math.max(0,1-Math.hypot(p[0]-cx,p[1]-cy)/(R*.5));let sz=(n.kind==='core'?60:(7+Math.min(8,(n.w||1)*1.5)))*dpr*(1+amp*(n.kind==='core'?1.4:.6*near));
   const tw=.75+.25*Math.sin(t*1.3+(n.id%17));const f=focus.has(n.id)&&st==='thinking'?1.5:1;sz*=f*(ig<1?(.2+ig*1.6-(ig>.6?(ig-.6)*1.5:0)):1);
   g.globalAlpha=Math.min(1,tw*(ig<1?ig*1.5:1))*(FC&&n.kind==='core'?.12:1);if(FC&&n.kind==='core')sz*=.35;g.drawImage(SP[n.kind]||SP.fact,p[0]-sz,p[1]-sz,sz*2,sz*2);if(ig<1){g.globalAlpha=1-ig;const r=sz*3*ig;g.drawImage(SP.core,p[0]-r,p[1]-r,r*2,r*2)}}
  if(FC){flies=flies.filter(f=>now-f.t<1600);for(const f of flies){const p=P[f.id];if(!p)continue;const k=Math.min(1,(now-f.t)/1600),e=k*k*(3-2*k);const x=p[0]+(FC[0]-p[0])*e,y=p[1]+(FC[1]-p[1])*e-Math.sin(Math.PI*k)*40*dpr;const z=(18-8*k)*dpr;g.globalAlpha=1;g.drawImage(SP.core,x-z,y-z,z*2,z*2);if(k>.9){const rr=R*.5*(k-.9)*10;g.globalAlpha=(1-k)*8;g.drawImage(SP.emotion,FC[0]-rr,FC[1]-rr,rr*2,rr*2)}}}
  g.globalAlpha=1;anims=anims.filter(a=>now-a.t<1500);
  if(tip&&now-tip.t<2800){const p=P[tip.n.id];if(p){g.globalCompositeOperation='source-over';g.globalAlpha=Math.min(1,(2800-(now-tip.t))/500);g.font=`${12*dpr}px -apple-system,sans-serif`;g.fillStyle='#dff8ff';g.textAlign='center';
   const txt=tip.n.label.length>60?tip.n.label.slice(0,58)+'…':tip.n.label;g.fillText(txt,Math.min(W-10,Math.max(10,p[0])),p[1]-16*dpr);g.globalAlpha=1}}}
 requestAnimationFrame(frame);
 return {setGraph,ignite,think,hit,setLevel:f=>level=f,setVoice:f=>voiceF=f}}
