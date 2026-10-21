// Local review artifact. Generated HTML is intentionally ignored.
(async () => {
const fs=(await import('node:fs')).default,path=(await import('node:path')).default;
const {directory,readMasters}=await import('./svg-tools.mjs');
const masters=readMasters(),palette=JSON.parse(fs.readFileSync(path.join(directory,'sky-palette.json'),'utf8'));
const rows=masters.map(({id,source})=>{
 const samples=[16,24,48].map(size=>'<span class="sample" style="--size:'+size+'px">'+source.replace('<svg ','<svg aria-hidden="true" ')+'<small>'+size+'</small></span>').join('');
 return '<article><h2>'+id+'</h2><div class="light" aria-label="Light theme">'+samples+'</div><div class="dark" aria-label="Dark theme">'+samples+'</div></article>';
}).join('\n');
const controls=['neutral','dawn','day','golden','dusk'].map(phase=>'<button type="button" data-phase="'+phase+'" aria-pressed="'+(phase==='day')+'">'+phase[0].toUpperCase()+phase.slice(1)+'</button>').join('');
const activate = function(palette) {
 const root=document.documentElement;
 function select(phase){
  for(const theme of ['light','dark']){
   const stops=phase==='neutral'?(theme==='light'?['white','white']:['#152d59','#152d59']):palette.sky[theme][phase];
   const ink=phase==='neutral'?(theme==='light'?'#152d59':'white'):palette.inks[theme][phase==='dusk'?'night':'day'];
   root.style.setProperty('--'+theme+'-a',stops[0]);root.style.setProperty('--'+theme+'-b',stops[1]);
   root.style.setProperty('--'+theme+'-ink',ink);
  }
  document.querySelectorAll('button[data-phase]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.phase===phase));
 }
 document.querySelectorAll('button[data-phase]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.phase)));
 select('day');
};
const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
'<title>Open World Clock | Playful icons</title><style>'+
':root{font:14px/1.5 system-ui;color:oklch(.46 .025 255);background:white;--light-a:oklch(.86 .07 250);--light-b:oklch(.92 .04 243);--light-ink:oklch(.46 .025 255);--dark-a:oklch(.405 .075 250);--dark-b:oklch(.345 .06 254);--dark-ink:oklch(.85 .022 252)}'+
'*{box-sizing:border-box}body{margin:24px}header{display:flex;gap:20px;justify-content:space-between;align-items:center;margin-bottom:24px}h1{font-size:26px;font-weight:650;line-height:1.2;letter-spacing:-.025em;margin:0 0 8px}p{margin:0;max-width:70ch}.controls{display:flex;flex-wrap:wrap;gap:4px}button{font:inherit;color:inherit;background:white;border:1px solid currentColor;border-radius:7px;padding:8px 12px;cursor:pointer}button[aria-pressed=true]{background:oklch(.46 .025 255);color:white}button:hover{outline:1px solid currentColor;outline-offset:2px}button:focus-visible{outline:3px solid currentColor;outline-offset:3px}'+
'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}article{border:1px solid oklch(.46 .025 255 / .2);background:white;border-radius:8px;overflow:hidden}h2{font:600 13px system-ui;margin:0;padding:10px 12px}.light,.dark{display:flex;align-items:center;justify-content:space-around;padding:12px 8px;gap:8px}.light{background:linear-gradient(180deg,var(--light-a),var(--light-b));color:var(--light-ink)}.dark{background:linear-gradient(180deg,var(--dark-a),var(--dark-b));color:var(--dark-ink)}.sample{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;width:56px;height:72px}svg{display:block;width:var(--size);height:var(--size);flex:none}small{font:10px system-ui}footer{margin-top:24px;font-size:12px}::selection{background:oklch(.86 .07 288);color:oklch(.46 .025 255)}@media(max-width:700px){header{display:block}.controls{margin-top:16px}body{margin:16px}}'+
'</style></head><body><header><div><h1>Open World Clock: Playful</h1><p>'+masters.length+' masters at 16, 24 and 48 px. Light above, dark below.</p></div><div class="controls" role="group" aria-label="Sky phase">'+controls+'</div></header><main>'+
rows+'</main><footer>Soft frames, rounded rays and buoyant arrows. Sky colours show the shared daylight palette; Neutral shows white and navy review surfaces.</footer><script>('+
activate.toString()+')('+JSON.stringify(palette)+');</script></body></html>\n';
fs.writeFileSync(path.join(directory,'contact-sheet.html'),html);
console.log('Built contact sheet with '+masters.length*6+' samples and five sky controls.');
})();
