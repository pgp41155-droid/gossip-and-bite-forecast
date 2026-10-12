import {catalogue} from './catalogue.js';
import {advancedCandidates,advancedNames} from './models.js';
export const iso = d=>new Date(d).toISOString().slice(0,10);
export const addDays=(d,n)=>iso(new Date(d+'T12:00:00Z').getTime()+n*86400000);
export const dayGap=(a,b)=>Math.round((new Date(a+'T12:00:00Z')-new Date(b+'T12:00:00Z'))/86400000);
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export const quantile=(a,q)=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.ceil((b.length+1)*q)-1)]??b[0]};
const median=a=>quantile(a,.5);
const norm=s=>s.toLowerCase().replace(/\[forwarded\]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const aliases=new Map(catalogue.flatMap(c=>c.aliases.map(a=>[norm(a),c])));
const unitMap={kg:['kg','kgs','kilo','k'],g:['gm','gms','gram','grams','g'],pkt:['pkt','pkts','packet','packets','paket','pket'],pc:['pc','pcs','piece','pieces'],carton:['carton','cartons','cotan','cottan','cotttan','cottton','cotton','cottn','cottns','cotten','cotan'],tray:['tray','trays','tery','teri'],dozen:['darjan','dozen','darzan'],tin:['tin','ten'],tub:['galn','gallon','galan','galon'],bottle:['bottal','bottel','bottle'],box:['dibba','box'],litre:['litre','liter','ltr','l']};
unitMap.pkt.push('packed');unitMap.pc.push('pice');unitMap.carton.push('cartoon');unitMap.tray.push('tre');unitMap.tin.push('teen');unitMap.box.push('diba');unitMap.kg.push('kge');
const unitLookup=new Map(Object.entries(unitMap).flatMap(([k,v])=>v.map(x=>[x,k])));
const quantityRE=new RegExp('(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*('+[...unitLookup.keys()].sort((a,b)=>b.length-a.length).join('|')+')(?![a-z])','gi');
export function messages(text){
 let result=[]; const rx=/^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)\]\s*(.*)$/gmi;const all=[...text.matchAll(rx)];
 if(all.length){for(let i=0;i<all.length;i++){const m=all[i];const year=m[3].length===2?'20'+m[3]:m[3];const date=`${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;const h=+m[4]%12+(m[6].toUpperCase()==='PM'?12:0);const sep=m[7].indexOf(': ');result.push({date,hour:h+(+m[5])/60,body:(sep>=0?m[7].slice(sep+2):'')+'\n'+text.slice(m.index+m[0].length,all[i+1]?.index??text.length),sourceLine:text.slice(0,m.index).split('\n').length});}}
 else {let date=null,current=null;for(const [i,line] of text.split(/\r?\n/).entries()){const d=line.match(/^## (\d{1,2}) (\w+) (\d{4})/);if(d){const month=['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(d[2])+1;date=`${d[3]}-${String(month).padStart(2,'0')}-${d[1].padStart(2,'0')}`;current=null;continue}const m=line.match(/^\[(\d+):(\d+)\s*(am|pm)\]\s*\*\*[^*]+:\*\*\s*(.*)/i);if(m&&date){current={date,hour:+m[1]%12+(m[3].toLowerCase()==='pm'?12:0)+(+m[2])/60,body:m[4],sourceLine:i+1};result.push(current)}else if(current&&!/^---|^\[/.test(line)) current.body+='\n'+line;}}
 return result;
}
export function parseChat(text){
// Markdown exports include quoted reply previews; these are not new orders.
let inQuote=false;text=text.split(/\r?\n/).map(line=>{if(/^> _/.test(line)){inQuote=!line.trim().endsWith('_')||line.trim()==='> _';return ''}if(inQuote){if(line.trim().endsWith('_'))inQuote=false;return ''}return line}).join('\n');
const ms=messages(text), records=[],review=[],seen=new Set();let duplicates=0,ignored=0;
for(const [mi,m] of ms.entries()){
 if(!m.body.trim()){ignored++;continue;}
 const lines=m.body.split(/\r?\n/).flatMap(x=>{const parts=x.split(/\s+aur\s+/i);return parts.length>1&&parts.every(p=>[...p.matchAll(quantityRE)].length>0)?parts:[x]}).map(x=>x.trim()).filter(Boolean);
 const fingerprint=m.date+'|'+Math.floor(m.hour*12)+'|'+norm(m.body);if(seen.has(fingerprint)){duplicates++;continue}seen.add(fingerprint);
 const count=lines.filter(l=>/\d/.test(l)).length;
 const nearbyNightly=m.hour>=23&&ms.some(other=>other.date===m.date&&other.hour>=23&&Math.abs(other.hour-m.hour)<5/60&&[...other.body.matchAll(quantityRE)].length>=4);
 const structuredNightly=/^(sabji|chikan|chiakn|bared|bread|baba|rashan|durga|coke|pepsi|disposable)\s*$/im.test(m.body)||count>=4;
 const strongUrgent=/urgent|abhi|please|ouder kar|order kar|oder kar/i.test(m.body);
 const nightlyContext=structuredNightly||(nearbyNightly&&!strongUrgent);
 const urgent=m.hour>=6&&m.hour<23.5&&(strongUrgent||/jaldi/i.test(m.body))&&count<=3&&!nightlyContext;
 const overlap=m.hour>=23&&m.hour<23.5;
 const serviceDate=m.hour>=23&&!urgent?addDays(m.date,1):m.date;
 const kind=m.hour<6||(m.hour>=23&&!urgent)?'nightly':'top-up';
 for(const [li,raw] of lines.entries()){
 if(!/\d/.test(raw)||/cash|case hai|galy|galymey|payment|rupee|bill|screenshot|secrnshot|total|andvas|advance|omitted|deleted|http|\?/.test(raw.toLowerCase())){ignored++;continue;}
 const q=[...raw.matchAll(quantityRE)];if(!q.length){review.push({id:`r${mi}-${li}`,date:serviceDate,raw,reason:'Quantity or unit not recognized',sourceLine:m.sourceLine+li});continue;}
 if(q.length>1){review.push({id:`r${mi}-${li}`,date:serviceDate,raw,reason:'Multiple quantities on one line; split into individual items',sourceLine:m.sourceLine+li});continue;}
 const match=q[0];let name=raw.slice(0,match.index).trim();const suffix=raw.slice(match.index+match[0].length).trim();
 if(!name||/^(aur|bhaiya|bhayya|sir)$/i.test(name)) name=(name+' '+suffix).trim();
 name=norm(name).replace(/^(aur |bhaiya |bhayya |sir )+/,'').replace(/\b\d+\s*(ml|ench|inch)\b/g,'').replace(/\b(jaldi|ouder|oudr|order|oder|kar|bol|sir|aana|please|dejiga|dijiye|dena|thoda|bhi|waly|shy|hai)\b.*$/,'').replace(/\s+/g,' ').trim();
 let item=aliases.get(name);
 if(!item){review.push({id:`r${mi}-${li}`,date:serviceDate,raw,reason:'Uncertain item name — please map to catalogue',sourceLine:m.sourceLine+li});continue;}
 let unit=unitLookup.get(match[2].toLowerCase()),qty=+match[1];if(unit==='g'){unit='kg';qty/=1000;}
 // Keep sizes and physical packaging separate instead of inventing conversions.
 let variant='';const size=raw.match(/\b(\d+)\s*(ml|ench|inch)\b/i);if(size)variant=` ${size[1]}${/ml/i.test(size[2])?'ml':'in'}`;
 if(/zero/i.test(suffix)&&!item.name.includes('Zero')){const zero=aliases.get(name+' zero');if(zero)item=zero;else variant+=' Zero';}
 if(/green|red|paking|picking/i.test(suffix)&&item.category==='Supplies')variant+=' '+norm(suffix);
 const flags=[];if(overlap&&!nightlyContext)flags.push('11–11:30 p.m. timing overlap');if(qty<=0||qty>5000)flags.push('Check quantity');
 records.push({id:`o${mi}-${li}`,date:serviceDate,item:item.id,variant,unit,qty,kind,flags,raw,sourceLine:m.sourceLine+li,source:'orders'});
 }
}
return {version:1,records,review,meta:{messages:ms.length,duplicates,ignored,importedAt:new Date().toISOString(),first:ms[0]?.date,last:ms.at(-1)?.date}};
}
export function seriesFrom(records,source='orders'){
const map=new Map();for(const r of records){if(r.excluded||r.source!==source||r.stockout||!Number.isFinite(r.qty)||r.qty<0)continue;const key=r.item+'|'+r.unit+'|'+(r.variant||'');if(!map.has(key))map.set(key,{key,item:r.item,unit:r.unit,variant:r.variant||'',days:new Map()});const s=map.get(key);s.days.set(r.date,(s.days.get(r.date)||0)+r.qty)}
return [...map.values()].map(s=>({...s,values:[...s.days].map(([date,y])=>({date,y})).sort((a,b)=>a.date.localeCompare(b.date)),days:undefined}));}
export const modelNames=['Last observation','Recent mean (7)','Recent median (7)','Recent mean (21)','Smooth level (0.2)','Smooth level (0.5)','Weekday blend','Simple ensemble',...advancedNames];
export function candidates(history,date){const h=history.filter(x=>dayGap(date,x.date)<=84).slice(-56);const a=(h.length?h:history).map(x=>x.y);if(!a.length)return modelNames.map(()=>0);const last=a.at(-1),m7=avg(a.slice(-7)),med=median(a.slice(-7)),m21=avg(a.slice(-21));const es=alpha=>a.reduce((s,y)=>alpha*y+(1-alpha)*s,a[0]);const week=(h.length?h:history).filter(x=>new Date(x.date+'T12:00:00Z').getUTCDay()===new Date(date+'T12:00:00Z').getUTCDay()).slice(-6).map(x=>x.y);const weekday=week.length?avg(week)*week.length/(week.length+3)+m7*3/(week.length+3):m7;const e2=es(.2),e5=es(.5);return [last,m7,med,m21,e2,e5,weekday,avg([m7,med,e2,weekday]),...advancedCandidates(history,date)];}
function selection(past){if(past.length<7)return 7;const recent=past.slice(-28);const losses=modelNames.map((_,j)=>avg(recent.map(p=>Math.abs(p.actual-p.candidates[j]))));return losses.indexOf(Math.min(...losses));}
export function evaluateSeries(series,target){
 const values=series.values.filter(x=>x.date<target),past=[],predictions=[];const start=addDays(target,-28);
 for(let i=0;i<values.length;i++){if(i<10)continue;const h=values.slice(0,i);if(dayGap(values[i].date,h.at(-1).date)>7)continue;const c=candidates(h,values[i].date);const selected=selection(past);const errors=past.slice(-42).map(p=>Math.abs(p.actual-p.pred));const radius=errors.length>=10?quantile(errors,.8):null;const p={date:values[i].date,actual:values[i].y,pred:c[selected],baseline:c[0],candidates:c,selected,low:radius===null?null:Math.max(0,c[selected]-radius),high:radius===null?null:c[selected]+radius};past.push(p);if(p.date>=start)predictions.push(p);}
 const selected=selection(past),c=candidates(values,target),forecast=c[selected],errors=past.slice(-42).map(p=>Math.abs(p.actual-p.pred)),radius=errors.length>=10?quantile(errors,.8):null;
 const denom=predictions.reduce((s,p)=>s+p.actual,0);const mae=avg(predictions.map(p=>Math.abs(p.actual-p.pred)));const wape=denom>0?predictions.reduce((s,p)=>s+Math.abs(p.actual-p.pred),0)/denom:null;
 const baseline=denom>0?predictions.reduce((s,p)=>s+Math.abs(p.actual-p.baseline),0)/denom:null;
 const scaled=predictions.map(p=>{const train=values.filter(x=>x.date<p.date);const scale=avg(train.slice(1).map((x,i)=>Math.abs(x.y-train[i].y)));return scale>0?Math.abs(p.actual-p.pred)/scale:null}).filter(x=>x!==null);
 const bounds=predictions.filter(p=>p.low!==null);const coverage=bounds.length?avg(bounds.map(p=>p.actual>=p.low&&p.actual<=p.high?1:0)):null;
 return {...series,values,forecast,model:modelNames[selected],low:radius===null?null:Math.max(0,forecast-radius),high:radius===null?null:forecast+radius,mae,wape,baseline,mase:scaled.length?avg(scaled):null,coverage,testN:predictions.length,intervalN:bounds.length,predictions,score:wape===null?null:100*(1-wape),n:values.length,last:values.at(-1)?.date,stale:!values.length||dayGap(target,values.at(-1).date)>7,frequency:values.length?values.filter(x=>x.date>=addDays(target,-28)).length/28:0};
}
export function calculate(records,target,source='orders',completeThrough=addDays(target,-1)){
records=records.filter(r=>r.date<=completeThrough);
const rows=seriesFrom(records,source).map(s=>evaluateSeries(s,target));const eligible=rows.filter(r=>r.testN>=7&&r.wape!==null&&!r.stale);return {rows,eligible,score:eligible.length?avg(eligible.map(r=>r.score)):null,baseline:eligible.length?100*(1-avg(eligible.map(r=>r.baseline))):null,tests:eligible.reduce((s,r)=>s+r.testN,0),passed:eligible.filter(r=>r.score>=90).length};}
export function orderQuantity(forecast,{source='orders',stock=0,incoming=0,buffer=0,multiplier=1,step=1,override=null}={}){
if(override!==null&&Number.isFinite(override)&&override>=0)return override;const base=forecast*multiplier*(1+buffer/100)-(source==='usage'?stock+incoming:0);return Math.max(0,Math.round(Math.ceil(Math.max(0,base)/Math.max(.001,step)-1e-10)*Math.max(.001,step)*1000)/1000);}
export function validRecord(r){return typeof r==='object'&&r!==null&&catalogue.some(c=>c.id===r.item)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&!isNaN(new Date(r.date).getTime())&&iso(r.date)===r.date&&Number.isFinite(r.qty)&&r.qty>=0&&r.qty<=100000&&['orders','usage'].includes(r.source)&&Object.keys(unitMap).includes(r.unit);}
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(new Date(d).getTime())&&iso(d)===d;
export function normalizeWorkspace(data){
 if(!data||data.version!==1||!Array.isArray(data.records)||data.records.length>100000||!data.records.every(validRecord)||!Array.isArray(data.review)||!data.review.every(r=>r&&typeof r.raw==='string'&&validDate(r.date)))throw new Error('This is not a valid GnB backup. Use a chat TXT/MD or an exported GnB JSON.');
 const records=data.records.map((r,i)=>({...r,id:typeof r.id==='string'?r.id:'record-'+i,variant:typeof r.variant==='string'?r.variant.slice(0,80):'',raw:typeof r.raw==='string'?r.raw.slice(0,3000):'',kind:typeof r.kind==='string'?r.kind:'manual',flags:Array.isArray(r.flags)?r.flags.filter(x=>typeof x==='string'):[],excluded:r.excluded===true,reviewed:r.reviewed===true,stockout:r.stockout===true}));
 if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('Duplicate record IDs in backup. Please import a fresh chat or valid backup.');
 const plans={};for(const [key,p] of Object.entries(data.plans||{})){if(!/^\d{4}-\d{2}-\d{2}\|(orders|usage)$/.test(key)||!p||typeof p!=='object')continue;const items={};for(const [k,v] of Object.entries(p.items||{})){if(!v||typeof v!=='object'||k==='__proto__'||k==='constructor')continue;const o={};if(typeof v.include==='boolean')o.include=v.include;for(const prop of ['step','stock','incoming','override'])if(Number.isFinite(v[prop])&&v[prop]>=0&&v[prop]<=100000)o[prop]=v[prop];if(o.step===0)delete o.step;items[k]=o;}plans[key]={buffer:Number.isFinite(p.buffer)?Math.max(0,Math.min(40,p.buffer)):0,multiplier:Number.isFinite(p.multiplier)?Math.max(.25,Math.min(2,p.multiplier)):1,items};}
 const latest=records.map(r=>r.date).sort().at(-1);return {version:1,records,review:data.review.map((r,i)=>({id:typeof r.id==='string'?r.id:'review-'+i,raw:r.raw.slice(0,3000),date:r.date,reason:typeof r.reason==='string'?r.reason:'Please review',resolved:r.resolved===true,sourceLine:Number.isFinite(r.sourceLine)?r.sourceLine:null})),source:data.source==='usage'?'usage':'orders',plans,meta:{demo:data.meta?.demo===true,completeThrough:validDate(data.meta?.completeThrough)?data.meta.completeThrough:latest?addDays(latest,-1):undefined,messages:Number(data.meta?.messages)||0,duplicates:Number(data.meta?.duplicates)||0,ignored:Number(data.meta?.ignored)||0,importedAt:typeof data.meta?.importedAt==='string'?data.meta.importedAt:null}};
}
