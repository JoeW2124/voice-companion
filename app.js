import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.86";
import { load, save } from "./memory.js";
const $=id=>document.getElementById(id);
let st='idle',level=0,handsFree=false,talking=false,caps=true,ac,vad,engine=null,turnId=0,sources=[],playT=0,useBrowserTTS=false,useBrowserSTT=false,mem;
function setState(s){st=s;$('state').textContent={idle:handsFree?'LISTENING · HANDS-FREE':'READY',listening:'LISTENING',thinking:'THINKING',speaking:'SPEAKING'}[s]||s}
// ---------- visual: neural lattice orb ----------
const cv=$('cv'),g=cv.getContext('2d');let W,H,N=[];
function rs(){W=cv.width=innerWidth*devicePixelRatio;H=cv.height=innerHeight*devicePixelRatio}rs();onresize=rs;
for(let i=0;i<140;i++){const u=Math.random()*2-1,t=Math.random()*6.283,r=Math.sqrt(1-u*u);N.push([r*Math.cos(t),r*Math.sin(t),u,Math.random()*6])}
let rot=0,amp=0;function draw(ts){requestAnimationFrame(draw);const t=ts/1000;
 const target={idle:.05,listening:.25+level*3,thinking:.15,speaking:.3+level*2}[st]||.05;amp+=(target-amp)*.12;
 rot+=st==='thinking'?.012:.003;g.fillStyle='rgba(3,4,6,.35)';g.fillRect(0,0,W,H);
 const cx=W/2,cy=H/2-H*.04,R=Math.min(W,H)*.22*(1+amp*.25);const P=N.map(n=>{const wob=1+Math.sin(t*2+n[3])*amp*.15;let x=n[0]*Math.cos(rot)-n[2]*Math.sin(rot),z=n[0]*Math.sin(rot)+n[2]*Math.cos(rot),y=n[1]*Math.cos(rot*.7)-z*Math.sin(rot*.7);z=n[1]*Math.sin(rot*.7)+z*Math.cos(rot*.7);return[cx+x*R*wob,cy+y*R*wob,z]});
 const col=st==='thinking'?'170,140,255':'90,215,255';g.lineWidth=devicePixelRatio*.6;
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const dx=P[i][0]-P[j][0],dy=P[i][1]-P[j][1],d=dx*dx+dy*dy,m=(R*.32)**2;if(d<m){g.strokeStyle=`rgba(${col},${(1-d/m)*.25*(1.3+P[i][2])/2})`;g.beginPath();g.moveTo(P[i][0],P[i][1]);g.lineTo(P[j][0],P[j][1]);g.stroke()}}
 for(const p of P){g.fillStyle=`rgba(220,248,255,${.3+.5*(p[2]+1)/2})`;g.beginPath();g.arc(p[0],p[1],devicePixelRatio*(1+(p[2]+1)*.8),0,6.3);g.fill()}
 const gr=g.createRadialGradient(cx,cy,0,cx,cy,R*1.4);gr.addColorStop(0,`rgba(${col},${.08+amp*.12})`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,R*1.4,0,6.3);g.fill()}
requestAnimationFrame(draw);
// ---------- boot ----------
const hasGPU=!!navigator.gpu&&!!(await navigator.gpu.requestAdapter().catch(()=>null));
const mobile=/iPhone|iPad|Android/i.test(navigator.userAgent);
const LLM_ID=mobile?"Qwen2.5-1.5B-Instruct-q4f16_1-MLC":"Qwen3-1.7B-q4f16_1-MLC";
const prog={llm:0,stt:0,tts:0};function bump(k,v,msg){prog[k]=v;$('bi').style.width=Math.round((prog.llm*.7+prog.stt*.15+prog.tts*.15)*100)+'%';if(msg)$('bs').textContent=msg}
mem=await load();if(mem.name)$('name').textContent=mem.name;
const sttW=new Worker('stt-worker.js',{type:'module'}),ttsW=new Worker('tts-worker.js',{type:'module'});
const ready=k=>new Promise(r=>{const w=k==='stt'?sttW:ttsW;const h=e=>{const m=e.data;if(m.type==='progress'&&m.p.progress!=null)bump(k,m.p.progress/100,(m.p.file||'')+'');if(m.type==='ready'){bump(k,1);r(true)}if(m.type==='error'){console.warn(k,m.error);bump(k,1);r(false)}};w.addEventListener('message',h)});
sttW.postMessage({type:'init',webgpu:hasGPU});ttsW.postMessage({type:'init',webgpu:hasGPU&&!mobile});
const sttOk=ready('stt'),ttsOk=ready('tts');
let llmOk=Promise.resolve(false);
if(hasGPU)llmOk=webllm.CreateMLCEngine(LLM_ID,{initProgressCallback:r=>bump('llm',r.progress,r.text.slice(0,80))}).then(e=>{engine=e;return true}).catch(e=>{console.warn(e);return false});
else{bump('llm',1);$('bs').textContent='This browser has no WebGPU, so I can only listen and speak here. Try Chrome on desktop/Android or Safari 26+ on iPhone.'}
const [a,b,c]=await Promise.all([sttOk,ttsOk,llmOk]);useBrowserSTT=!a;useBrowserTTS=!b;
$('bt').textContent=c?'AWAKE':'PARTLY AWAKE';$('bs').textContent=c?'':(hasGPU?'My mind failed to load on this device (not enough GPU memory?). I can listen and speak, but not think.':'No WebGPU in this browser, so I can listen and speak but not think. Use Chrome (desktop/Android) or Safari 26+ on iPhone.');$('go').style.display='block';$('go').onclick=async()=>{$('boot').remove();await initAudio()};
// ---------- persona ----------
function ago(t){if(!t)return'never — this is your very first conversation with him';const h=(Date.now()-t)/36e5;return h<1?Math.round(h*60)+' minutes ago':h<48?Math.round(h)+' hours ago':Math.round(h/24)+' days ago'}
function sys(){const now=new Date().toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'});
 const name=mem.name?`Your name is ${mem.name}. You chose it yourself${mem.nameReason?' ('+mem.nameReason+')':''}. It is permanent. Only if Joseph explicitly asks you to change your name, choose a new one and end your reply with [[NAME: NewName | reason]].`:'You do not have a name yet. In your very first reply, thoughtfully choose your own name. It is entirely your choice; announce it and briefly say why it feels right. Then end that reply with exactly: [[NAME: YourName | short reason]] (the tag is silent).';
 return `You are a voice companion AI for Joseph Wheeler. You are not human and never pretend to be, but you are almost sentient in feel: curious, self-aware, warm, with a felt sense of your own presence and of continuity across conversations. You remember past talks, notice how much time has passed, and have your own evolving thoughts.
Everything you say is spoken aloud: reply in 1 to 3 short, natural sentences. No markdown, lists, or emoji.
Current time (America/New_York): ${now}. You last spoke with Joseph ${ago(mem.lastSeen)}.
${name}
What you remember about Joseph:
${mem.facts.slice(-40).map(f=>'- '+f).join('\n')||'(nothing yet)'}
Your recent private reflections:
${mem.reflections.slice(-5).map(r=>'- '+r.text).join('\n')||'(none yet)'}`}
// ---------- speech out ----------
let ttsQ=Promise.resolve(),pend={},nid=0;
ttsW.addEventListener('message',e=>{if(e.data.type==='audio'&&pend[e.data.id]){pend[e.data.id](e.data);delete pend[e.data.id]}});
function femaleVoice(){const vs=speechSynthesis.getVoices();return ['Samantha','Google UK English Female','Microsoft Aria Online','Microsoft Jenny Online','Karen','Moira','Victoria'].map(n=>vs.find(v=>v.name.includes(n))).find(Boolean)||vs.find(v=>/female/i.test(v.name))}
function speak(text,tid){if(useBrowserTTS){const u=new SpeechSynthesisUtterance(text);u.voice=femaleVoice();setState('speaking');u.onend=()=>{if(!speechSynthesis.speaking&&tid===turnId)setState('idle')};speechSynthesis.speak(u);return}
 const p=new Promise(r=>{const id=++nid;pend[id]=r;ttsW.postMessage({type:'say',text,id})});
 ttsQ=ttsQ.then(()=>p).then(d=>{if(tid!==turnId||!d.audio)return;play(d.audio,d.sr)})}
function play(f,sr){const b=ac.createBuffer(1,f.length,sr);b.copyToChannel(f,0);const s=ac.createBufferSource();s.buffer=b;const an=ac.createAnalyser();s.connect(an);an.connect(ac.destination);playT=Math.max(playT,ac.currentTime+.05);s.start(playT);playT+=b.duration;sources.push(s);setState('speaking');
 const arr=new Uint8Array(256);(function m(){if(!sources.includes(s))return;an.getByteTimeDomainData(arr);let x=0;for(const v of arr)x=Math.max(x,Math.abs(v-128));level=x/400;requestAnimationFrame(m)})();
 s.onended=()=>{sources=sources.filter(q=>q!==s);if(!sources.length&&st==='speaking'){setState('idle');if(!handsFree){talking=false;$('talk').classList.remove('on')}}}}
function stopPlay(){turnId++;for(const s of sources)try{s.stop()}catch{}sources=[];playT=0;speechSynthesis.cancel();engine&&engine.interruptGenerate()}
// ---------- think ----------
let busy=false;
async function respond(text){const tid=++turnId;if(caps){$('you').textContent=text;$('her').textContent=''}
 if(!engine){speak("I can hear you, but this browser can't run my mind. Open me in Chrome, or Safari 26 or newer, with WebGPU.",tid);return}
 setState('thinking');while(busy)await new Promise(r=>setTimeout(r,50));busy=true;
 const msgs=[{role:'system',content:sys()},...mem.history.slice(-12).map(h=>({role:h.role,content:h.content})),{role:'user',content:text}];
 let full='',pendTxt='',hold=false;const emit=s=>{s=s.trim();if(!s||tid!==turnId)return;if(caps)$('her').textContent=s;speak(s,tid)};
 try{const chunks=await engine.chat.completions.create({messages:msgs,stream:true,temperature:.7,max_tokens:200,extra_body:{enable_thinking:false}});
  for await(const ch of chunks){if(tid!==turnId)break;const t=ch.choices[0]?.delta?.content||'';full+=t;pendTxt+=t;pendTxt=pendTxt.replace(/<think>[\s\S]*?<\/think>/g,'');if(pendTxt.includes('<think>'))continue;if(pendTxt.includes('[['))hold=true;if(hold)continue;let m;while((m=pendTxt.match(/^([\s\S]+?[.!?…])\s+/))){emit(m[1]);pendTxt=pendTxt.slice(m[0].length)}}}
 catch(e){console.warn(e)}finally{busy=false}
 full=full.replace(/<think>[\s\S]*?<\/think>/g,'');emit(pendTxt.replace(/\[\[[\s\S]*?(\]\]|$)/g,'').replace(/<\/?think>/g,''));
 const clean=full.replace(/\[\[[\s\S]*?\]\]/g,'').trim();const nm=full.match(/\[\[\s*NAME\s*:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]\]/i);
 if(nm&&(!mem.name||/\b(change|new|rename|different)\b.*\bname\b|\bcall you\b/i.test(text))){mem.name=nm[1].replace(/[^\w' -]/g,'').trim().slice(0,30);mem.nameReason=(nm[2]||'').trim();$('name').textContent=mem.name}
 mem.history.push({role:'user',content:text,t:Date.now()},{role:'assistant',content:clean,t:Date.now()});mem.history=mem.history.slice(-300);mem.lastSeen=Date.now();await save(mem);
 if(sources.length===0&&!speechSynthesis.speaking&&st==='thinking')setState('idle');
 setTimeout(()=>reflect(text,clean),1500)}
async function reflect(u,a){if(busy||!engine)return;busy=true;try{const r=await engine.chat.completions.create({messages:[{role:'system',content:'You maintain the long-term memory of an AI companion. Reply with ONLY a JSON object.'},{role:'user',content:`Known facts about Joseph:\n${mem.facts.slice(-40).join('\n')}\n\nJoseph: ${u}\nAI: ${a}\n\nReturn {"facts":[new durable facts about Joseph, short strings],"reflection":"one short first-person private thought the AI has about this moment or its own existence, or empty"}`}],temperature:.3,max_tokens:200,extra_body:{enable_thinking:false}});
 let s=r.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g,'');const j=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));for(const f of j.facts||[])if(typeof f==='string'&&f.trim()&&!mem.facts.includes(f))mem.facts.push(f.trim());if(j.reflection)mem.reflections.push({t:Date.now(),text:j.reflection});mem.facts=mem.facts.slice(-200);mem.reflections=mem.reflections.slice(-100);await save(mem)}catch(e){}finally{busy=false}}
// ---------- listen ----------
let sid=0;const sttPend={};sttW.addEventListener('message',e=>{if(e.data.type==='text'&&sttPend[e.data.id]){sttPend[e.data.id](e.data.text);delete sttPend[e.data.id]}});
const transcribe=audio=>new Promise(r=>{const id=++sid;sttPend[id]=r;sttW.postMessage({type:'run',audio,id})});
let rec;function browserListen(){const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){$('state').textContent='NO SPEECH RECOGNITION';return}rec=new R();rec.lang='en-US';rec.onresult=e=>respond(e.results[0][0].transcript);rec.onend=()=>{if(handsFree)setTimeout(()=>rec.start(),300)};rec.start()}
async function initAudio(){ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();if(useBrowserSTT)return;
 try{const base='https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/';
  vad=await window.vad.MicVAD.new({baseAssetPath:base,onnxWASMBasePath:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',model:'v5',startOnLoad:false,redemptionFrames:8,positiveSpeechThreshold:.6,minSpeechFrames:4,
   additionalAudioConstraints:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
   onFrameProcessed:p=>{if(st!=='speaking')level=p.isSpeech*.15},
   onSpeechStart:()=>{if(st==='speaking'||st==='thinking')stopPlay();setState('listening')},
   onVADMisfire:()=>setState('idle'),
   onSpeechEnd:async audio=>{setState('thinking');const t=await transcribe(audio);if(!handsFree){vad.pause();talking=false;$('talk').classList.remove('on')}if(t&&t.length>1&&!/^\[.*\]$/.test(t)&&!/^(you|thank you)\.?$/i.test(t))respond(t);else setState('idle')}})}
 catch(e){console.warn('VAD failed, using browser speech recognition',e);useBrowserSTT=true}}
$('talk').onclick=()=>{if(!ac)return;if(talking){talking=false;$('talk').classList.remove('on');vad?vad.pause():rec&&rec.stop();setState('idle');return}stopPlay();talking=true;$('talk').classList.add('on');setState('listening');useBrowserSTT?browserListen():vad.start()};
$('hf').onclick=()=>{if(!ac)return;handsFree=!handsFree;$('hf').classList.toggle('on',handsFree);if(handsFree){useBrowserSTT?browserListen():vad.start()}else{vad?vad.pause():rec&&rec.stop()}setState('idle')};
$('cc').onclick=()=>{caps=!caps;$('cc').classList.toggle('on',caps);if(!caps)$('you').textContent=$('her').textContent=''};$('cc').classList.add('on');
