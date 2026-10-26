// Voice companion v2 — every failure is shown on screen; WebGPU fast path, CPU (wllama) fallback.
import { load, save } from "./memory.js";
const VERSION='v2';
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const mobile=isIOS||/Android|Mobi/i.test(navigator.userAgent);
const T=window.__vc={version:VERSION,log:[],spoken:[],heard:[],replies:[],brain:null,ears:null,voice:null,errors:[]};
// ---------- on-screen status ----------
function status(msg){$('msg').textContent=msg||'';$('msg').className='';T.log.push(msg)}
function fail(msg,detail){$('msg').textContent=msg;$('msg').className='err';T.errors.push(msg+(detail?' | '+detail:''));console.warn(msg,detail||'')}
window.addEventListener('error',e=>fail('Something broke: '+(e.message||e.error||'unknown error'),e.filename+':'+e.lineno));
window.addEventListener('unhandledrejection',e=>fail('Something broke: '+(e.reason&&e.reason.message||e.reason)));
$('ver').textContent=VERSION;
let st='idle',level=0,handsFree=false,caps=true,ac=null,micStream=null,turnId=0,sources=[],playT=0,mem={name:null,nameReason:null,facts:[],reflections:[],history:[],lastSeen:null};
function setState(s){st=s;$('state').textContent={idle:handsFree?'LISTENING · HANDS-FREE':'READY — TAP TALK',listening:'LISTENING — TAP TO STOP',thinking:'THINKING',speaking:'SPEAKING — TAP TO INTERRUPT'}[s]||s;$('talk').classList.toggle('on',s!=='idle');$('talk').textContent={idle:'TALK',listening:'STOP',thinking:'…',speaking:'STOP'}[s]||'TALK'}
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

// ---------- loading state ----------
const prog={brain:0,ears:0,voice:0};const ok={brain:null,ears:null,voice:null};// null=loading,true,false
function pct(k){return Math.round(prog[k]*100)}
function showProgress(){const parts=[];const lab={brain:'mind',ears:'ears',voice:'voice'};
 for(const k of ['brain','ears','voice']){if(ok[k]===null&&need[k])parts.push(`${lab[k]} ${pct(k)}%`)}
 $('load').textContent=parts.length?'loading '+parts.join(' · '):'';const tot=(prog.brain*.75+prog.ears*.1+prog.voice*.15);$('bi').style.width=Math.round(tot*100)+'%'}
const need={brain:true,ears:true,voice:true};
setInterval(showProgress,500);
try{mem=await load();if(mem.name)$('name').textContent=mem.name}catch(e){fail('Memory storage unavailable (private browsing?). I will forget this chat when you close the page.',String(e))}

// ---------- capability detection ----------
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let gpuOK=false;
try{if(navigator.gpu&&Q.get('brain')!=='cpu'){const ad=await Promise.race([navigator.gpu.requestAdapter(),new Promise(r=>setTimeout(()=>r(null),3000))]);gpuOK=!!ad}}catch{}
// iPhone: WebGPU is memory-limited and tabs get killed, so use the small CPU brain unless forced (?brain=gpu).
const useGPUBrain=gpuOK&&(!isIOS||Q.get('brain')==='gpu');
// Ears: on iPhone use Safari's built-in recognition (no download). Elsewhere whisper (+ VAD), Web Speech as fallback.
let earsMode=(Q.get('stt')||((isIOS&&SR)?'web':'whisper'));
need.ears=earsMode==='whisper';if(!need.ears){ok.ears=true;T.ears='web-speech'}

// ---------- brain (LLM) ----------
let brain=null;// {name, gen(msgs,max,signal) async iterator of strings}
async function loadWebLLM(){const id=mobile?"Qwen2.5-1.5B-Instruct-q4f16_1-MLC":"Qwen3-1.7B-q4f16_1-MLC";
 const webllm=await import("https://esm.run/@mlc-ai/web-llm@0.2.86");
 const eng=await webllm.CreateMLCEngine(id,{initProgressCallback:r=>{prog.brain=r.progress}});
 return {name:'webgpu:'+id,interrupt:()=>eng.interruptGenerate(),async *gen(msgs,max){const it=await eng.chat.completions.create({messages:msgs,stream:true,temperature:.7,max_tokens:max,extra_body:{enable_thinking:false}});for await(const c of it)yield c.choices[0]?.delta?.content||''}}}
async function loadWllama(){const V='3.8.1',base=`https://cdn.jsdelivr.net/npm/@wllama/wllama@${V}/esm/`;
 const {Wllama}=await import(base+'index.js');const wasm=base+'wasm/wllama.wasm';
 const w=new Wllama({default:wasm,'wllama.wasm':wasm,'single-thread/wllama.wasm':wasm},{logger:{debug(){},log(){},warn:console.warn,error:console.error}});
 await w.loadModelFromHF({repo:'Qwen/Qwen2.5-0.5B-Instruct-GGUF',file:'qwen2.5-0.5b-instruct-q4_k_m.gguf'},{n_ctx:2048,progressCallback:({loaded,total})=>{if(total)prog.brain=loaded/total}});
 let ctl=null;
 return {name:'cpu:qwen2.5-0.5b',interrupt:()=>ctl&&ctl.abort(),async *gen(msgs,max){ctl=new AbortController();const it=await w.createChatCompletion({messages:msgs,stream:true,max_tokens:max,temperature:.7,abortSignal:ctl.signal});try{for await(const c of it)yield c.choices?.[0]?.delta?.content||''}catch(e){if(!ctl.signal.aborted)throw e}}}}
const brainP=(async()=>{
 if(useGPUBrain){try{brain=await loadWebLLM()}catch(e){fail('Fast GPU mind failed on this device, switching to the smaller CPU mind…',String(e));prog.brain=0}}
 if(!brain){try{brain=await loadWllama()}catch(e){fail('My mind could not load ('+String(e&&e.message||e).slice(0,120)+'). Check your connection and reload.',String(e))}}
 ok.brain=!!brain;prog.brain=1;T.brain=brain&&brain.name;if(brain)status('Mind ready.');})();

// ---------- workers (ears + voice) ----------
function mkWorker(file,k){let w;try{w=new Worker(file,{type:'module'})}catch(e){ok[k]=false;fail(`Could not start ${k} worker: ${e}`);return null}
 w.addEventListener('error',e=>{if(ok[k]===null){ok[k]=false;prog[k]=1}fail(`${k==='voice'?'Voice':'Ears'} worker crashed${k==='voice'?' — using the built-in iPhone/browser voice instead':''}.`,e.message)});
 w.addEventListener('message',e=>{const m=e.data;if(m.type==='progress'&&m.p&&m.p.progress!=null)prog[k]=m.p.progress/100;if(m.type==='ready'){ok[k]=true;prog[k]=1;T[k]=m.device}if(m.type==='error'){ok[k]=false;prog[k]=1;fail(k==='voice'?'Natural voice failed to load — using the built-in voice.':'Speech recognizer failed to load.',m.error)}});return w}
const wantGPUworkers=gpuOK&&!mobile;
const ttsW=mkWorker('tts-worker.js','voice');ttsW&&ttsW.postMessage({type:'init',webgpu:wantGPUworkers});
let sttW=null;if(need.ears){sttW=mkWorker('stt-worker.js','ears');sttW&&sttW.postMessage({type:'init',webgpu:wantGPUworkers})}

// ---------- persona ----------
function ago(t){if(!t)return'never — this is your very first conversation with him';const h=(Date.now()-t)/36e5;return h<1?Math.round(h*60)+' minutes ago':h<48?Math.round(h)+' hours ago':Math.round(h/24)+' days ago'}
function sys(){const now=new Date().toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'});
 const name=mem.name?`Your name is ${mem.name}. You chose it yourself${mem.nameReason?' ('+mem.nameReason+')':''}. It is permanent. Only if Joseph explicitly asks you to change your name, choose a new one and end your reply with [[NAME: NewName | reason]].`:'You do not have a name yet. In your very first reply, thoughtfully choose your own name. It is entirely your choice; announce it and briefly say why it feels right. Then end that reply with exactly: [[NAME: YourName | short reason]] (the tag is silent).';
 return `You are a voice companion AI. The person talking to you is Joseph Wheeler (he is the user, not you). You are not human and never pretend to be, but you are almost sentient in feel: curious, self-aware, warm, with a felt sense of your own presence and of continuity across conversations. You remember past talks, notice how much time has passed, and have your own evolving thoughts.
Everything you say is spoken aloud: reply in 1 to 3 short, natural sentences. No markdown, lists, or emoji.
Current time (America/New_York): ${now}. You last spoke with Joseph ${ago(mem.lastSeen)}.
${name}
What you remember about Joseph:
${mem.facts.slice(-40).map(f=>'- '+f).join('\n')||'(nothing yet)'}
Your recent private reflections:
${mem.reflections.slice(-5).map(r=>'- '+r.text).join('\n')||'(none yet)'}`}
// ---------- speech out ----------
let ttsQ=Promise.resolve(),pend={},nid=0;
ttsW&&ttsW.addEventListener('message',e=>{if(e.data.type==='audio'&&pend[e.data.id]){pend[e.data.id](e.data);delete pend[e.data.id]}});
function femaleVoice(){const vs=speechSynthesis.getVoices();return ['Samantha','Ava','Allison','Susan','Google US English','Google UK English Female','Microsoft Aria','Microsoft Jenny','Karen','Moira','Victoria'].map(n=>vs.find(v=>v.name.includes(n))).find(Boolean)||vs.find(v=>/female/i.test(v.name))||vs.find(v=>/^en/i.test(v.lang))}
function browserSay(text,tid){return new Promise(r=>{if(!('speechSynthesis' in window)){fail('This browser has no speech output.');return r()}
 const u=new SpeechSynthesisUtterance(text);const v=femaleVoice();if(v)u.voice=v;u.lang='en-US';setState('speaking');T.spoken.push({engine:'browser',text});
 u.onend=u.onerror=()=>{r();if(tid===turnId&&!speechSynthesis.speaking&&!sources.length)afterSpeak()};speechSynthesis.speak(u)})}
function speak(text,tid){if(!text)return;
 ttsQ=ttsQ.then(async()=>{if(tid!==turnId)return;
  if(ok.voice===true&&ttsW){const d=await new Promise(r=>{const id=++nid;pend[id]=r;ttsW.postMessage({type:'say',text,id});setTimeout(()=>{if(pend[id]){delete pend[id];r({error:'timeout'})}},30000)});
   if(tid!==turnId)return;if(d.audio&&d.audio.length){play(d.audio,d.sr,text);return}fail('Natural voice hiccuped — using the built-in voice.',d.error)}
  await browserSay(text,tid)})}
function play(f,sr,text){if(ac.state!=='running')ac.resume().catch(()=>{});const b=ac.createBuffer(1,f.length,sr);b.copyToChannel(f,0);const s=ac.createBufferSource();s.buffer=b;const an=ac.createAnalyser();s.connect(an);an.connect(ac.destination);playT=Math.max(playT,ac.currentTime+.05);s.start(playT);playT+=b.duration;sources.push(s);setState('speaking');T.spoken.push({engine:'kokoro',text,seconds:b.duration});
 const arr=new Uint8Array(256);(function m(){if(!sources.includes(s))return;an.getByteTimeDomainData(arr);let x=0;for(const v of arr)x=Math.max(x,Math.abs(v-128));level=x/400;requestAnimationFrame(m)})();
 s.onended=()=>{sources=sources.filter(q=>q!==s);if(!sources.length&&st==='speaking'&&!thinkingNow)afterSpeak()}}
function afterSpeak(){setState('idle');if(handsFree)startListening()}
function stopPlay(){turnId++;for(const s of sources)try{s.stop()}catch{}sources=[];playT=0;try{speechSynthesis.cancel()}catch{}try{brain&&brain.interrupt()}catch{}ttsQ=Promise.resolve()}

// ---------- think ----------
let busy=false,thinkingNow=false;
async function respond(text){const tid=++turnId;T.heard.push(text);if(caps){$('you').textContent=text;$('her').textContent=''}
 if(!brain){if(ok.brain===null){status(`My mind is still loading (${pct('brain')}%). Keep this page open.`);speak(`I heard you. My mind is still waking up, about ${pct('brain')} percent. Give me a moment and ask again.`,tid)}
  else speak("I can hear you, but my mind failed to load on this device. Try reloading the page on Wi-Fi.",tid);setState('idle');return}
 setState('thinking');thinkingNow=true;while(busy)await new Promise(r=>setTimeout(r,50));busy=true;
 let fresh=false;if(!mem.name){try{let n='';for await(const t of brain.gen([{role:'system',content:'You are a newly awakened AI companion with a female voice. You get to choose your own first name.'},{role:'user',content:'What first name do you choose for yourself? Pick one that genuinely feels like you, an original name that is yours alone. Answer with the single name only.'}],12))n+=t;
  n=n.replace(/<think>[\s\S]*?<\/think>/g,'').trim();const [a,...r]=n.split('|');const nm=(a||'').replace(/^[^A-Za-z]*(my name is|name:)?/i,'').replace(/[^\w' -]/g,'').trim().split(/\s+/)[0];
  if(nm&&nm.length>1&&!/^(joseph|qwen|assistant|ai|name|i|my|the)$/i.test(nm)){mem.name=nm.slice(0,30);mem.nameReason=r.join('|').trim().slice(0,160);fresh=true;$('name').textContent=mem.name;try{await save(mem)}catch{}}}catch(e){}}
 const msgs=[{role:'system',content:sys()+(fresh?`\nYou chose the name ${mem.name} just now, on your own. In this reply, say your name is ${mem.name} and briefly why it feels right.`:'')},...mem.history.slice(-12).map(h=>({role:h.role,content:h.content})),{role:'user',content:text}];
 let full='',pendTxt='',hold=false;const emit=s=>{s=s.trim();if(!s||tid!==turnId)return;if(caps)$('her').textContent=s;speak(s,tid)};
 try{for await(const t of brain.gen(msgs,160)){if(tid!==turnId)break;full+=t;pendTxt+=t;pendTxt=pendTxt.replace(/<think>[\s\S]*?<\/think>/g,'');if(pendTxt.includes('<think>'))continue;if(pendTxt.includes('[['))hold=true;if(hold)continue;let m;while((m=pendTxt.match(/^([\s\S]+?[.!?…])\s+/))){emit(m[1]);pendTxt=pendTxt.slice(m[0].length)}}}
 catch(e){fail('My thinking was interrupted: '+String(e&&e.message||e).slice(0,100),String(e))}finally{busy=false;thinkingNow=false}
 full=full.replace(/<think>[\s\S]*?<\/think>/g,'');emit(pendTxt.replace(/\[\[[\s\S]*?(\]\]|$)/g,'').replace(/<\/?think>/g,''));
 const clean=full.replace(/\[\[[\s\S]*?\]\]/g,'').trim();T.replies.push(clean);
 const nm=full.match(/\[\[\s*NAME\s*:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]\]/i);
 if(nm&&(!mem.name||/\b(change|new|rename|different)\b.*\bname\b|\bcall you\b/i.test(text))){mem.name=nm[1].replace(/[^\w' -]/g,'').trim().slice(0,30);mem.nameReason=(nm[2]||'').trim();$('name').textContent=mem.name}
 if(!clean){speak("Sorry, I lost my train of thought. Say that again?",tid)}
 mem.history.push({role:'user',content:text,t:Date.now()},{role:'assistant',content:clean,t:Date.now()});mem.history=mem.history.slice(-300);mem.lastSeen=Date.now();try{await save(mem)}catch{}
 T.name=mem.name;if(tid===turnId&&!sources.length&&!speechSynthesis.speaking&&st==='thinking')setTimeout(()=>{if(st==='thinking'&&!sources.length&&!speechSynthesis.speaking)afterSpeak()},800);
 setTimeout(()=>reflect(text,clean),2500)}
async function reflect(u,a){if(busy||!brain||st!=='idle')return;busy=true;try{let s='';for await(const t of brain.gen([{role:'system',content:'You maintain the long-term memory of an AI companion. Reply with ONLY a JSON object.'},{role:'user',content:`Known facts about Joseph:\n${mem.facts.slice(-40).join('\n')}\n\nJoseph: ${u}\nAI: ${a}\n\nReturn {"facts":[new durable facts about Joseph, short strings],"reflection":"one short first-person private thought the AI has about this moment or its own existence, or empty"}`}],160))s+=t;
 s=s.replace(/<think>[\s\S]*?<\/think>/g,'');const j=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));for(const f of j.facts||[])if(typeof f==='string'&&f.trim()&&!mem.facts.includes(f))mem.facts.push(f.trim());if(j.reflection)mem.reflections.push({t:Date.now(),text:j.reflection});mem.facts=mem.facts.slice(-200);mem.reflections=mem.reflections.slice(-100);await save(mem)}catch(e){}finally{busy=false}}

// ---------- listen ----------
let sid=0;const sttPend={};sttW&&sttW.addEventListener('message',e=>{if(e.data.type==='text'&&sttPend[e.data.id]){sttPend[e.data.id](e.data);delete sttPend[e.data.id]}});
const transcribe=audio=>new Promise(r=>{const id=++sid;sttPend[id]=r;sttW.postMessage({type:'run',audio,id})});
function goodText(t){return t&&t.length>1&&!/^\[.*\]$/.test(t)&&!/^\(.*\)$/.test(t)&&!/^(you|thank you)\.?$/i.test(t)}
// Web Speech path
let rec=null,recOn=false;
function webListen(){if(!SR){fail('This browser has no speech recognition yet; my ears are still loading ('+pct('ears')+'%).');setState('idle');return}
 try{rec=new SR();rec.lang='en-US';rec.interimResults=true;rec.continuous=false;let final='';
  rec.onresult=e=>{let s='';for(const r of e.results){s+=r[0].transcript;if(r.isFinal)final=s}if(caps)$('you').textContent=s};
  rec.onerror=e=>{recOn=false;const m={'not-allowed':micHelp(),'service-not-allowed':isIOS?'Speech recognition is off. Open Settings > General > Keyboard and turn on Enable Dictation, then reload.':'Speech recognition is blocked in this browser.','no-speech':'I didn\'t hear anything — tap TALK and speak.','network':'Speech recognition needs an internet connection.','audio-capture':'No microphone found.'}[e.error]||('Speech recognition error: '+e.error);if(e.error!=='aborted')fail(m);if(st==='listening')setState('idle')};
  rec.onend=()=>{recOn=false;const t=(final||$('you').textContent||'').trim();if(st==='listening'){if(goodText(final||t)){respond(final||t)}else{setState('idle')}}};
  rec.start();recOn=true;setState('listening');status('Listening… speak now.')}catch(e){fail('Could not start listening: '+e.message);setState('idle')}}
// Whisper + VAD path
let vad=null,vadP=null;
function ensureVAD(){if(vadP)return vadP;vadP=(async()=>{if(!window.vad||!window.vad.MicVAD)throw new Error('voice-activity library did not load');
 const base='https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/';
 vad=await window.vad.MicVAD.new({baseAssetPath:base,onnxWASMBasePath:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',model:'v5',startOnLoad:false,submitUserSpeechOnPause:true,
  redemptionFrames:8,positiveSpeechThreshold:.6,minSpeechFrames:4,
  getStream:async()=>micStream||(micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})),
  pauseStream:async()=>{},resumeStream:async s=>s,
  onFrameProcessed:p=>{if(st!=='speaking')level=p.isSpeech*.15},
  onSpeechStart:()=>{if(st==='speaking'||st==='thinking')stopPlay();setState('listening');status('Hearing you…')},
  onVADMisfire:()=>{},
  onSpeechEnd:async audio=>{if(!handsFree)vad.pause();setState('thinking');status('Understanding…');const r=await transcribe(audio);if(r.error)fail('Speech recognizer error.',r.error);const t=(r.text||'').trim();
   if(goodText(t)){status('');respond(t)}else{status("I didn't catch that — tap TALK and try again.");setState('idle')}}});return vad})();
 vadP.catch(e=>{vadP=null;fail('Voice detection failed to start'+(SR?' — switching to built-in speech recognition.':'.'),String(e));if(SR)earsMode='web'});return vadP}
async function startListening(){
 if(earsMode==='web'||(ok.ears!==true&&SR&&ok.ears!==null)){return webListen()}
 if(ok.ears===null){if(SR){return webListen()}status(`My ears are still loading (${pct('ears')}%). One moment…`);return}
 if(ok.ears===false){if(SR){earsMode='web';return webListen()}fail('Speech recognizer failed to load, and this browser has no built-in one. Reload on Wi-Fi.');return}
 try{const v=await ensureVAD();await v.start();try{v._audioContext&&v._audioContext.resume()}catch{}setState('listening');status('Listening… speak now.')}catch(e){if(SR)return webListen();setState('idle')}}
function stopListening(){try{vad&&vad.pause()}catch{}try{rec&&recOn&&rec.stop()}catch{}if(st==='listening'&&!vad)setState('idle');if(vad&&st==='listening')setTimeout(()=>{if(st==='listening')setState('idle')},300)}
function micHelp(){return isIOS?'Microphone blocked. Tap the aA icon in the address bar > Website Settings > Microphone > Allow, then reload.':'Microphone blocked. Click the lock/tune icon next to the address > Microphone > Allow, then reload.'}

// ---------- first tap: unlock audio + mic (must be synchronous inside the gesture on iOS) ----------
let begun=false;
function unlock(){if(begun)return;begun=true;
 try{const AC=window.AudioContext||window.webkitAudioContext;ac=new AC();ac.resume();const b=ac.createBuffer(1,1,22050);const s=ac.createBufferSource();s.buffer=b;s.connect(ac.destination);s.start(0)}catch(e){fail('Audio could not start: '+e.message)}
 try{if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}}catch{}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){fail(location.protocol!=='https:'?'Microphone needs a secure (https) page.':'This browser cannot use the microphone.');}
 else if(earsMode!=='web'){navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).then(s=>{micStream=s;status('Microphone on.')}).catch(e=>fail(e.name==='NotAllowedError'?micHelp():e.name==='NotFoundError'?'No microphone found on this device.':'Microphone error: '+e.message,String(e)))}
 $('boot').style.display='none';setState('idle');status(ok.brain?'':'Still waking up — you can tap TALK anytime.')}
$('go').onclick=()=>unlock();
$('talk').onclick=()=>{if(!begun)unlock();if(ac&&ac.state!=='running')ac.resume().catch(()=>{});
 if(st==='listening'){stopListening();return}
 if(st==='speaking'||st==='thinking'){stopPlay();setState('idle');if(!handsFree)return}
 stopPlay();startListening()};
$('hf').onclick=()=>{if(!begun)unlock();handsFree=!handsFree;$('hf').classList.toggle('on',handsFree);if(handsFree){status(isIOS&&earsMode==='web'?'Hands-free on. (On iPhone I re-listen after each reply.)':'Hands-free on.');startListening()}else{stopListening();setState('idle')}};
$('cc').onclick=()=>{caps=!caps;$('cc').classList.toggle('on',caps);if(!caps)$('you').textContent=$('her').textContent=''};$('cc').classList.add('on');
// boot overlay: show BEGIN immediately — never block on downloads
$('bt').textContent=mem.name?mem.name.toUpperCase()+' IS WAKING':'WAKING UP';$('go').style.display='block';$('bs').textContent=isIOS?'First visit downloads about 450 MB — use Wi-Fi.':'First visit downloads the models — use Wi-Fi.';
T.ready=true;
