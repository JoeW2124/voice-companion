import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";
let tts;
self.onmessage=async e=>{const m=e.data;
 if(m.type==='init'){try{tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:m.webgpu?"fp32":"q8",device:m.webgpu?"webgpu":"wasm",progress_callback:p=>self.postMessage({type:'progress',p})});self.postMessage({type:'ready'})}catch(err){self.postMessage({type:'error',error:String(err)})}}
 if(m.type==='say'){try{const a=await tts.generate(m.text,{voice:"af_heart"});self.postMessage({type:'audio',id:m.id,audio:a.audio,sr:a.sampling_rate},[a.audio.buffer])}catch(err){self.postMessage({type:'audio',id:m.id,error:String(err)})}}};
