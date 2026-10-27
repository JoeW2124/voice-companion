// Liora's face: portrait dissolved into the galaxy, alive by state + voice amplitude. Canvas 2D, pre-baked layers.
// Face anchors in normalized image coords (0..1). Tuned for liora.jpg.
export const FACE={eyes:[[.436,.322],[.688,.322]],mouth:[.600,.488],mouthW:.18,mouthH:.045,face:[.60,.42],faceR:.22,hairTop:.08};
export function createPortrait(src,opts={}){
 const P={ok:false,img:null,layers:null,parts:[],twk:[],sparks:[],q:opts.quality||1,glow:0,bright:0,mouth:0};
 const img=new Image();img.decoding='async';img.onload=()=>{try{P.img=img;bake();P.ok=true;opts.onload&&opts.onload()}catch(e){opts.onerror&&opts.onerror(e)}};img.onerror=e=>{opts.onerror&&opts.onerror(e)};img.src=src;
 function bake(){const w=img.naturalWidth,h=img.naturalHeight;
  // 1) masked portrait: radial mask centered on the face, edges dissolve to space
  const m=document.createElement('canvas');m.width=w;m.height=h;const g=m.getContext('2d');g.drawImage(img,0,0);
  g.globalCompositeOperation='destination-in';const fx=FACE.face[0]*w,fy=FACE.face[1]*h;
  const gr=g.createRadialGradient(fx,fy,w*.12,fx,fy*1.05,Math.max(w,h)*.55);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(.55,'rgba(0,0,0,.85)');gr.addColorStop(1,'rgba(0,0,0,0)');
  g.save();g.translate(fx,fy);g.scale(1,1.25);g.translate(-fx,-fy);g.fillStyle=gr;g.fillRect(-w,-h,w*3,h*3);g.restore();
  // fade top/bottom edges too
  const lg=g.createLinearGradient(0,0,0,h);lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(.08,'rgba(0,0,0,1)');lg.addColorStop(.8,'rgba(0,0,0,1)');lg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=lg;g.fillRect(0,0,w,h);const xg=g.createLinearGradient(0,0,w,0);xg.addColorStop(0,'rgba(0,0,0,0)');xg.addColorStop(.2,'rgba(0,0,0,1)');xg.addColorStop(.8,'rgba(0,0,0,1)');xg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=xg;g.fillRect(0,0,w,h);
  // 2) blurred glow layer (downscale = cheap blur)
  const b=document.createElement('canvas');b.width=Math.max(16,w/16|0);b.height=Math.max(16,h/16|0);const bg=b.getContext('2d');bg.drawImage(m,0,0,b.width,b.height);
  // 3) mouth patch (lower lip + chin) with feathered mask, used for amplitude-driven displacement
  const mw=FACE.mouthW*w,mh=FACE.mouthH*h*2.4,mx=FACE.mouth[0]*w-mw/2,my=FACE.mouth[1]*h-FACE.mouthH*h*.15;
  const p=document.createElement('canvas');p.width=Math.ceil(mw);p.height=Math.ceil(mh);const pg=p.getContext('2d');pg.drawImage(img,mx,my,mw,mh,0,0,mw,mh);
  pg.globalCompositeOperation='destination-in';const rg=pg.createRadialGradient(mw/2,mh*.35,0,mw/2,mh*.35,mw*.55);rg.addColorStop(0,'rgba(0,0,0,1)');rg.addColorStop(.6,'rgba(0,0,0,.8)');rg.addColorStop(1,'rgba(0,0,0,0)');pg.fillStyle=rg;pg.fillRect(0,0,mw,mh);
  // dark inner-mouth shadow sprite (seen when lips part)
  const d=document.createElement('canvas');d.width=64;d.height=24;const dg=d.getContext('2d');const dr=dg.createRadialGradient(32,12,0,32,12,30);dr.addColorStop(0,'rgba(20,5,30,.85)');dr.addColorStop(1,'rgba(20,5,30,0)');dg.save();dg.scale(1,.4);dg.fillStyle=dr;dg.fillRect(0,0,64,60);dg.restore();
  P.layers={m,b,p,d,mx,my,mw,mh,w,h};
  // skin twinkle points inside the face ellipse
  for(let i=0;i<60;i++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*FACE.faceR;P.twk.push({x:FACE.face[0]+Math.cos(a)*r*.8,y:FACE.face[1]+Math.sin(a)*r*.9*(w/h)*1.6,ph:Math.random()*6.3,sp:.6+Math.random()*1.8})}}
 // where the portrait sits on screen
 function rect(W,H,cx,cy){const L=P.layers;const s=Math.min(W*1.15/L.w,H*.92/L.h);const dw=L.w*s,dh=L.h*s;return{x:cx-FACE.face[0]*dw,y:cy-FACE.face[1]*dh,w:dw,h:dh,s}}
 function at(r,u,v){return[r.x+u*r.w,r.y+v*r.h]}
 function draw(g,W,H,cx,cy,t,st,amp,voice,SP,dpr,dt){if(!P.ok)return null;const L=P.layers;
  const breath=1+.008*Math.sin(t*.9)+(st==='speaking'?voice*.004:0);const r0=rect(W,H,cx,cy);
  const r={...r0,w:r0.w*breath,h:r0.h*breath};const fc=at(r0,FACE.face[0],FACE.face[1]);r.x=fc[0]-FACE.face[0]*r.w;r.y=fc[1]-FACE.face[1]*r.h;
  const tb={idle:0,listening:.12,thinking:.06,speaking:.06}[st]||0;P.bright+=(tb-P.bright)*.06;
  const tg={idle:.06+.03*Math.sin(t*.5),listening:.1,thinking:.12+.04*Math.sin(t*3),speaking:.08+voice*.35}[st]||.12;P.glow+=(tg-P.glow)*(st==='speaking'?.35:.05);
  P.mouth+=((st==='speaking'?Math.min(1,voice*1.6):0)-P.mouth)*.45;
  g.globalCompositeOperation='source-over';g.globalAlpha=.92;g.drawImage(L.m,r.x,r.y,r.w,r.h);
  // speaking: lower lip/jaw patch slides down with amplitude, inner-mouth shadow opens behind it
  if(P.mouth>.02){const k=r.w/L.w,ox=r.x+L.mx*k,oy=r.y+L.my*k,ow=L.mw*k,oh=L.mh*k,dy=P.mouth*FACE.mouthH*r.h*.18;
   const [mxp,myp]=at(r,FACE.mouth[0],FACE.mouth[1]);g.globalAlpha=Math.min(.55,P.mouth*.8);const sw=ow*.55,sh=dy*2.2+1;g.drawImage(L.d,mxp-sw/2,myp-sh*.3,sw,sh);
   g.globalAlpha=1;g.drawImage(L.p,ox,oy+dy,ow,oh*(1+P.mouth*.04))}
  g.globalCompositeOperation='lighter';
  // glow (blurred self-illumination), brighter when she speaks/listens
  g.globalAlpha=Math.min(.5,P.glow+P.bright*.6);const gw=r.w*1.04,gh=r.h*1.04;g.drawImage(L.b,r.x-(gw-r.w)/2,r.y-(gh-r.h)/2,gw,gh);
  // eyes brighten when listening; soft mouth/cheek shimmer with voice
  const eyeA=.08+P.bright*1.6+(st==='speaking'?voice*.3:0);for(const e of FACE.eyes){const [x,y]=at(r,e[0],e[1]);const s=r.w*.055*(1+P.bright);g.globalAlpha=Math.min(.8,eyeA);g.drawImage(SP.self,x-s,y-s,s*2,s*2)}
  if(st==='speaking'){const [x,y]=at(r,FACE.mouth[0],FACE.mouth[1]);const s=r.w*(.07+voice*.06);g.globalAlpha=Math.min(.6,voice*.9);g.drawImage(SP.emotion,x-s,y-s*.6,s*2,s*1.2);
   for(const c of [[.45,.43],[.74,.43]]){const [cx2,cy2]=at(r,c[0],c[1]);const cs=r.w*.07;g.globalAlpha=voice*.35;g.drawImage(SP.opinion,cx2-cs,cy2-cs,cs*2,cs*2)}}
  // stars twinkling in her skin
  const nt=P.q<1?25:P.twk.length;for(let i=0;i<nt;i++){const p=P.twk[i];const a=Math.max(0,Math.sin(t*p.sp+p.ph))**6;if(a<.05)continue;const [x,y]=at(r,p.x,p.y);const s=(2+a*4)*dpr;g.globalAlpha=a*.8;g.drawImage(SP.core,x-s,y-s,s*2,s*2)}
  // light particles drifting off her hair
  const rate=(P.q<1?.25:.6)*(st==='speaking'?1.6:st==='thinking'?1.3:1);if(Math.random()<rate){const side=Math.random()<.5?-1:1,u=.5+side*(.22+Math.random()*.25),v=.06+Math.random()*.45;const [x,y]=at(r,u,v);P.parts.push({x,y,vx:side*(8+Math.random()*22)*dpr,vy:-(6+Math.random()*16)*dpr,l:0,L:3+Math.random()*4,s:(1.5+Math.random()*2.5)*dpr,c:Math.random()<.5?'opinion':'fact'})}
  P.parts=P.parts.filter(p=>p.l<p.L);for(const p of P.parts){p.l+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.995;const a=Math.sin(Math.PI*p.l/p.L);g.globalAlpha=a*.7;const s=p.s*3;g.drawImage(SP[p.c],p.x-s,p.y-s,s*2,s*2)}
  // thinking: synapse pulses flowing through hair and face
  if(st==='thinking'&&Math.random()<(P.q<1?.25:.5)){const side=Math.random()<.5?-1:1;P.sparks.push({a:at(r,.5+side*(.25+Math.random()*.2),.05+Math.random()*.3),b:at(r,FACE.face[0]+(Math.random()-.5)*.2,FACE.face[1]+(Math.random()-.3)*.15),c:at(r,.5+side*Math.random()*.3,.1+Math.random()*.2),t:t,d:.7+Math.random()*.6})}
  P.sparks=P.sparks.filter(s=>t-s.t<s.d);for(const s of P.sparks){const k=(t-s.t)/s.d;const x=(1-k)**2*s.a[0]+2*(1-k)*k*s.c[0]+k*k*s.b[0],y=(1-k)**2*s.a[1]+2*(1-k)*k*s.c[1]+k*k*s.b[1];const z=(7+6*Math.sin(Math.PI*k))*dpr;g.globalAlpha=Math.sin(Math.PI*k);g.drawImage(SP.fact,x-z,y-z,z*2,z*2)}
  g.globalAlpha=1;return{center:fc,rect:r}}
 return Object.assign(P,{draw,faceCenter:(W,H,cx,cy)=>P.ok?at(rect(W,H,cx,cy),FACE.face[0],FACE.face[1]):[cx,cy]})}
