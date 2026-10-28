import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";
let tts,Q=Promise.resolve();
const mk=gpu=>KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:gpu?"fp32":"q8",device:gpu?"webgpu":"wasm",progress_callback:p=>self.postMessage({type:'progress',p})});
self.onmessage=async e=>{const m=e.data;
 if(m.type==='init'){let dev=m.webgpu?'webgpu':'wasm';try{try{tts=await mk(m.webgpu)}catch(err){if(!m.webgpu)throw err;dev='wasm';tts=await mk(false)}self.postMessage({type:'ready',device:dev})}catch(err){self.postMessage({type:'error',error:String(err)})}}
 if(m.type==='say'){Q=Q.then(async()=>{try{const a=await tts.generate(m.text,{voice:"af_heart"});self.postMessage({type:'audio',id:m.id,audio:a.audio,sr:a.sampling_rate},[a.audio.buffer])}catch(err){self.postMessage({type:'audio',id:m.id,error:String(err)})}})}};
