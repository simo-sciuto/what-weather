import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir=process.cwd();
// variant of the page: when open, the page layer lets events through and the map takes the finger
let html=fs.readFileSync('s1.html','utf8').replace('</style>',`
#map{touch-action:pan-y pinch-zoom}
#map.open{touch-action:none;z-index:5}
body.mapopen #page{pointer-events:none}
</style>`);
fs.writeFileSync('s2.html',html);
const srv=http.createServer((q,r)=>{const f=path.join(dir,q.url.split('?')[0].replace(/^\//,'')||'s2.html');fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end()}r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(d)})}).listen(3198);
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const page=await ctx.newPage(); await page.goto('http://localhost:3198/s2.html'); await page.evaluate(()=>window.__ready);
const cdp=await ctx.newCDPSession(page);
async function swipe(x,y0,y1,steps=12){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y0+(y1-y0)*i/steps}]});await page.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(500);
}
const state=()=>page.evaluate(()=>({scrollY:Math.round(scrollY),lat:+map.getCenter().lat.toFixed(3),lng:+map.getCenter().lng.toFixed(3)}));
const res={};
res.closedBefore=await state();
await swipe(200,600,300);   // vertical swipe over the page, map closed
res.closedAfterSwipe=await state();
await page.evaluate(()=>{window.scrollTo(0,0);document.getElementById('map').className='open anim';document.body.classList.add('mapopen')});
await page.waitForTimeout(700);
res.openBefore=await state();
await swipe(200,600,300);   // same gesture, map open
res.openAfterSwipe=await state();
// a horizontal drag must pan too
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:400}]});
for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-i*18,y:400}]});await page.waitForTimeout(16);}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(500);
res.openAfterHorizontal=await state();
console.log(JSON.stringify(res,null,1));
await browser.close(); srv.close();
