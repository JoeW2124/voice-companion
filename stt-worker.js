import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm";
let asr;
self.onmessage=async e=>{const m=e.data;
 if(m.type==='init'){try{asr=await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en',{device:m.webgpu?'webgpu':'wasm',dtype:m.webgpu?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',progress_callback:p=>self.postMessage({type:'progress',p})});self.postMessage({type:'ready'})}catch(err){self.postMessage({type:'error',error:String(err)})}}
 if(m.type==='run'){try{const r=await asr(m.audio);self.postMessage({type:'text',id:m.id,text:(r.text||'').trim()})}catch(err){self.postMessage({type:'text',id:m.id,text:'',error:String(err)})}}};
