import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir=process.cwd();
const srv=http.createServer((q,r)=>{const f=path.join(dir,q.url.split('?')[0].replace(/^\//,'')||'s1.html');fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end()}r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(d)})}).listen(3199);
const browser=await chromium.launch({channel:'chrome',headless:true});
const results={};
for (const [name,ctxOpts] of [['desktop 1440x900',{viewport:{width:1440,height:900}}],['phone 390x844 touch',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){
  const ctx=await browser.newContext(ctxOpts); const page=await ctx.newPage();
  await page.goto('http://localhost:3199/s1.html'); await page.evaluate(()=>window.__ready);
  const gl=await page.evaluate(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'webgl';});
  const measure=(label,act)=>page.evaluate(async([label,act])=>{
    const frames=[];let last=performance.now();let run=true;
    const tick=t=>{frames.push(t-last);last=t;if(run)requestAnimationFrame(tick)};requestAnimationFrame(tick);
    await new Promise(r=>setTimeout(r,200)); frames.length=0;
    eval(act);
    await new Promise(r=>setTimeout(r,1400)); run=false;
    const s=[...frames].sort((a,b)=>a-b);const p=q=>s[Math.min(s.length-1,Math.floor(q*s.length))];
    return {label,frames:frames.length,avg:+(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(1),p95:+p(.95).toFixed(1),max:+s[s.length-1].toFixed(1),over50:frames.filter(x=>x>50).length};
  },[label,act]);
  const out=[];
  out.push(await measure('idle map, nothing moving',''));
  out.push(await measure('open: clip-path window to full',"document.getElementById('map').className='open anim'"));
  out.push(await measure('close: clip-path full to window',"document.getElementById('map').className='win anim'"));
  out.push(await measure('open while the map flies (flyTo 1.2s)',"map.flyTo({center:[12.49,41.89],zoom:8,duration:1200});document.getElementById('map').className='open anim'"));
  out.push(await measure('page scroll over the fixed map',"window.scrollTo({top:900,behavior:'smooth'})"));
  const resizeCalls=await page.evaluate(()=>0);
  results[name]={renderer:gl,out};
  await ctx.close();
}
console.log(JSON.stringify(results,null,1));
await browser.close(); srv.close();
