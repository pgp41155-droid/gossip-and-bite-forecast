import {calculate} from './core.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:calculate(data.records,data.target,data.source,data.completeThrough)});}catch(error){self.postMessage({id:data.id,error:error.message||'Forecast calculation failed'});}};
