import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startOnFreePort} from './serve.mjs';
const require=createRequire(new URL('../../cloudflare/package.json',import.meta.url));
const puppeteer=require('puppeteer-core');
const server=await startOnFreePort(8851,8860);
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync),headless:true});
fs.mkdirSync('output/overlap-audit/web',{recursive:true});
const metrics=[];
const styleOnly=process.argv.includes('--style-only');
try {
for(const [width,lang,theme] of (styleOnly ? [[390,'en','light'],[1440,'en','dark']] : [[390,'en','light'],[1440,'en','dark'],[390,'pt','light'],[390,'es','dark']])) {
 const context=await browser.createBrowserContext(), page=await context.newPage(), errors=[];
 await page.setViewport({width,height:1100,hasTouch:width<600}); await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'reduce'}]); page.on('pageerror',e=>errors.push(e.message));
 const route=lang==='en'?'meeting-planner':lang+'/meeting-planner';
 await page.goto(server.url+'/'+route+'#c=Europe/London,America/New_York,Pacific/Auckland',{waitUntil:'networkidle0'});
 await page.waitForSelector('.tool-window.is-ready'); const app=await(await page.$('#heroApp')).contentFrame();
 await app.waitForSelector('#planFind:not([hidden])'); await app.select('#convZone','America/New_York'); await app.click('#planFind');
 await app.waitForSelector('.meeting-city');
 assert.equal(await app.$$eval('.meeting-city',els=>els.length),3);
 assert.equal(await app.$eval('[data-preference=mode]',el=>el.value),'next');
 assert.ok(await app.$eval('.find-commit',el=>+el.dataset.start>=Date.now()));
 // Explore a fixed civil day, while retaining the actual zone and solar engines.
 await app.click('#planFind');
 await app.evaluate(()=>window.WCConverter.apply('America/New_York',Date.parse('2026-10-22T16:00:00Z'),Date.parse('2026-10-22T17:00:00Z')));
 await app.click('#planFind'); await app.select('[data-preference=mode]','explore');
 const selected=await app.$eval('.find-commit',el=>+el.dataset.start);
 assert.equal(await app.$$eval('.meeting-option',els=>els.length),2);
 assert.ok(await app.evaluate(()=>[...document.querySelectorAll('.meeting-identity strong')].every(el=>document.querySelector('.meeting-why').textContent.includes(el.textContent))));
 assert.ok(await app.$$eval('.meeting-date',els=>els.some(el=>el.textContent.includes('23'))));
 const alignment=await app.evaluate(()=>{const tick=document.querySelector('.meeting-ticks').getBoundingClientRect(),track=document.querySelector('.meeting-track').getBoundingClientRect();return {left:Math.abs(tick.left-track.left),right:Math.abs(tick.right-track.right)};});
 assert.ok(alignment.left<1&&alignment.right<1,JSON.stringify(alignment));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const appElement=await page.$('#heroApp'); await appElement.screenshot({path:`output/overlap-audit/web/workspace-${width}-${lang}-${theme}.png`});
 console.log('layout',width,lang,await app.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,panel:document.querySelector('#planFindPanel').getBoundingClientRect().height})));
 const surfaces=await app.evaluate(()=>({canvas:getComputedStyle(document.querySelector('.find-panel')).backgroundColor,panel:getComputedStyle(document.querySelector('.meeting-workspace')).backgroundColor,solar:[...document.querySelectorAll('.meeting-city')].map(el=>({sky:el.dataset.sky,a:el.style.getPropertyValue('--meeting-sky-a'),b:el.style.getPropertyValue('--meeting-sky-b')}))}));
 if(theme==='light'){assert.equal(surfaces.canvas,'rgb(180, 217, 250)');assert.equal(surfaces.panel,'rgb(192, 223, 251)');}else{assert.equal(surfaces.canvas,'rgba(0, 0, 0, 0)');assert.notEqual(surfaces.panel,'rgb(192, 223, 251)');}
 assert.ok(surfaces.solar.every(row=>row.a===`var(--sky-${row.sky}-a)`&&row.b===`var(--sky-${row.sky}-b)`));
 assert.ok(await app.$$eval('.meeting-clock',els=>els.every(el=>!el.textContent.includes('/'))));
 console.log('surfaces',theme,surfaces);
 if(styleOnly){assert.deepEqual(errors,[]);await context.close();continue;}
 // Slider uses one-interval scoring and keeps the captured track node alive.
 await app.evaluate(()=>{window.originalTrack=document.querySelector('.meeting-track');window.previewCosts=[];const original=window.WCTime.recommendTimes;window.WCTime.recommendTimes=(...args)=>{const at=performance.now();const result=original(...args);window.previewCosts.push({ms:performance.now()-at,horizon:args[2]-args[1]});return result;};});
 await app.focus('#meetingPreviewSlider'); await page.keyboard.press('ArrowRight');
 await app.waitForFunction(start=>+document.querySelector('.find-commit').dataset.start===start+900000,{},selected);
 assert.equal(await app.evaluate(()=>document.querySelector('.meeting-track')===window.originalTrack),true);
 assert.equal(await app.$eval('[data-preview-kind]',el=>el.dataset.previewKind),'custom');
 assert.ok(await app.$$eval('.meeting-band',els=>new Set(els.map(el=>el.style.left)).size===1));
 await app.evaluate(()=>{window.trackCapture={got:0,lost:0};const node=document.querySelector('.meeting-track');node.addEventListener('gotpointercapture',()=>window.trackCapture.got++);node.addEventListener('lostpointercapture',()=>window.trackCapture.lost++);});
 const track=await app.$('.meeting-track');
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
 await app.$eval('.meeting-track',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 const box=await track.boundingBox();
 await page.mouse.move(box.x+box.width*.4,box.y+box.height/2); await page.mouse.down();
 await page.mouse.move(box.x+box.width*.6,box.y+box.height/2,{steps:8});await page.mouse.up();
 await app.waitForFunction(()=>window.previewCosts.length>=2,{timeout:3000});
 assert.equal(await app.evaluate(()=>document.querySelector('.meeting-track')===window.originalTrack),true);
 assert.deepEqual(await app.evaluate(()=>window.trackCapture),{got:1,lost:1});
 if(width<600){
   await app.$eval('.meeting-track',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
   const touchBox=await track.boundingBox();
   const session=await page.createCDPSession();
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchBox.x+touchBox.width*.3,y:touchBox.y+touchBox.height/2,id:1}]});
   await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchBox.x+touchBox.width*.7,y:touchBox.y+touchBox.height/2,id:1}]});
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await app.waitForFunction(()=>window.trackCapture.lost===2);
   assert.equal(await app.evaluate(()=>window.trackCapture.got),2); await session.detach();
 }
 const updateCosts=await app.evaluate(()=>{const values=[],slider=document.getElementById('meetingPreviewSlider');for(let n=1;n<=8;n++){const start=performance.now();slider.value=String(n);slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.meeting-workspace').getBoundingClientRect();values.push(performance.now()-start);}return values;});
 const costs=await app.evaluate(()=>window.previewCosts);assert.ok(costs.every(c=>c.horizon===1));metrics.push({width,lang,engineMaxMs:Math.max(...costs.map(c=>c.ms)),updateIncludingLayoutMaxMs:Math.max(...updateCosts),calls:costs.length});
 // Alternatives are compared to the current preview and apply their own absolute instant.
 const alternative=await app.$eval('.meeting-option',el=>+el.dataset.start);await app.click('.meeting-option');
 assert.equal(await app.$eval('.find-commit',el=>+el.dataset.start),alternative);
 assert.ok(await app.$$eval('.meeting-option .find-sub',els=>els.every(el=>el.textContent.length>15)));
 // Whole duration survives the final start in the selected day, including the dated next-day endpoint.
 await app.select('[data-preference=duration]','120');
 await app.$eval('#meetingPreviewSlider',el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await app.$eval('.find-commit',el=>+el.dataset.end-+el.dataset.start),7200000);
 assert.ok(await app.$eval('.meeting-city[data-zone="America/New_York"] .meeting-date',el=>el.textContent.includes('22')&&el.textContent.includes('23')));
 // Invalid edits clear live results. Excluded attendees stay excluded in every export.
 await app.click('.find-people summary');await app.$eval('.find-person input[type=time]',el=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await app.$$eval('.find-commit',els=>els.length),0);
 await app.$eval('.find-person input[type=time]',el=>el.dispatchEvent(new Event('change',{bubbles:true})));
 await app.evaluate(()=>[...document.querySelectorAll('.find-person')].find(el=>el.textContent.includes('Auckland')).querySelector('input[type=checkbox]').click());
 assert.equal(await app.$$eval('.meeting-city',els=>els.length),2);
 await app.evaluate(()=>{window.captured={};window.wc={...window.wc,copyText:async text=>{window.captured.copy=text;return true;},saveIcs:async payload=>{window.captured.invite=payload;return true;}};});
 await app.click('.meeting-share');
 assert.equal(await app.$eval('#planFindPanel',el=>el.hidden),true);
 assert.equal(await app.evaluate(()=>window.captured.copy.includes('Auckland')),false);
 const meeting=await app.evaluate(()=>window.WCConverter.state().meeting);
 assert.equal(meeting.participants.includes('Pacific/Auckland'),false);
 assert.deepEqual(await app.evaluate(()=>window.WCLink.parse(window.WCShareHash()).zones),meeting.participants);
 await app.click('#planIcs');assert.equal(await app.evaluate(()=>window.captured.invite.description.includes('Auckland')),false);
 assert.deepEqual(errors,[]);await context.close();
}
if(!styleOnly) fs.writeFileSync('output/overlap-audit/web/preview-performance.json',JSON.stringify(metrics,null,2));console.log(styleOnly ? 'Planner light/dark surfaces, solar palette, mobile alignment and localized ranges passed.' : 'Linked meeting workspace, full-duration preview, precise alignment, pointer/keyboard controls and exports passed.',metrics);
} finally {await browser.close();await server.close();}
