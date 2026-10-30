const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),vm=require('vm'),path=require('path');const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src/renderer/time.js'),'utf8'),{window,Intl,Date});const T=window.WCTime;
const golden=require('../../shared/meeting-planner-golden.json');
for(const c of golden.cases)test('shared meeting contract: '+c.id,()=>{const i=c.input;const actual=T.recommendTimes(i.participants,i.fromMs,i.untilMs,i.durationMinutes,i.objective,i.preset);assert.deepEqual(JSON.parse(JSON.stringify(actual)),c.expected);for(let a=0;a<actual.length;a++)for(let b=a+1;b<actual.length;b++)assert.ok(actual[a].endMs<=actual[b].startMs||actual[b].endMs<=actual[a].startMs);});
test('balanced protects sleep before working headcount',()=>{const c=golden.cases[0];const r=T.recommendTimes(c.input.participants,c.input.fromMs,c.input.untilMs,60);assert.equal(r[0].avoidParticipants,0);assert.equal(new Date(r[0].startMs).toISOString(),'2026-10-22T17:30:00.000Z');assert.equal(r[0].participants.find(p=>p.zone==='Pacific/Auckland').reason,'early');});
test('whole duration exposes late boundary',()=>{const p=[{zone:'UTC',hours:{start:'09:00',end:'10:00',days:[4]}}];const r=T.recommendTimes(p,Date.parse('2026-10-22T09:45Z'),Date.parse('2026-10-22T10:00Z'),30);assert.equal(r[0].working,0);assert.equal(r[0].participants[0].penaltyUnits,134);});
test('bounded horizon and duration',()=>{const p=[{zone:'UTC'}];assert.equal(T.recommendTimes(p,0,8*86400000,60).length,0);assert.equal(T.recommendTimes(p,0,86400000,121).length,0);assert.equal(T.recommendTimes([],0,86400000,60).length,0);});
test('planner translations retain UTF-8 accents',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/i18n.js'),'utf8');
  for(const value of ['Reunião de trabalho','Duração','Chamada em família','Reunión de trabajo','Duración','Cómodo']) assert.ok(source.includes(value),value);
  assert.equal(source.split('\n').filter(line=>/plan\.(work|family|duration|participants|acceptable|reason|avoidTradeoff|fairTradeoff)/.test(line)).some(line=>line.includes('?')),false);
});
