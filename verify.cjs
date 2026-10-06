/* Run with Node. Uses a locally installed Playwright and Edge/Chrome. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', 'C:/Users/Myhman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean);
let playwright; for (const candidate of candidates) {try {playwright=require(candidate);break;}catch{}}
if(!playwright)throw new Error('Playwright is required to run browser verification.');
const executablePath = [process.env.BROWSER_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await playwright.chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--allow-file-access-from-files']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await page.locator('#start').waitFor();
    assert.equal(await page.locator('h1').textContent(),'Удержи последний свет.');
    await page.screenshot({path:path.join(out,'01-menu.png'),fullPage:true});
    await page.locator('#start').click();await page.mouse.move(620,420);await page.mouse.down();await page.waitForTimeout(4500);await page.mouse.up();
    assert.equal(await page.locator('#overlay').evaluate(el=>el.classList.contains('hidden')),true);
    await page.screenshot({path:path.join(out,'02-gameplay.png'),fullPage:true});
    await page.keyboard.press('Escape');assert.equal(await page.locator('#resume').count(),1);await page.locator('#resume').click();
    await page.locator('#sound').click();assert.match(await page.locator('#sound').textContent(),/ВКЛ/);await page.locator('#sound').click();
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await mobile.locator('#start').waitFor();
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await mobile.screenshot({path:path.join(out,'03-mobile.png'),fullPage:true});await mobile.close();
    // Exercise original game functions with a test-only closure bridge.
    const testPage=await browser.newPage({viewport:{width:1440,height:1100}});testPage.on('pageerror',e=>errors.push(e.message));
    const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('<link rel="stylesheet" href="style.css">',`<style>${fs.readFileSync(path.join(__dirname,'style.css'),'utf8')}</style>`).replace('<script src="game.js"></script>','');
    await testPage.setContent(html);
    const code=fs.readFileSync(path.join(__dirname,'game.js'),'utf8').replace('  menu();requestAnimationFrame(frame);',`  window.__test={get s(){return s},get mode(){return mode},start,pause,update,updateUI,render,dash,pulse,pick,spawn,hurtEnemy,hurtPlayer,hitReactor,finish,keys,pointer,rules};menu();`);
    await testPage.addScriptTag({content:code});
    const result=await testPage.evaluate(()=>{
      const t=window.__test,checks=[];const check=(value,msg)=>{if(!value)throw new Error(msg);checks.push(msg);};
      t.start();check(t.mode==='playing'&&t.s.reactor===100,'Start resets state');
      const before=t.s.player.x;t.keys.add('KeyD');t.update(.1);t.keys.clear();check(t.s.player.x>before,'Movement changes position');
      t.dash();check(t.s.dashCd>0&&t.s.player.dash>0,'Dash starts and enters cooldown');
      const cd=t.s.dashCd;t.dash();check(t.s.dashCd===cd,'Dash cooldown blocks reuse');
      t.s.enemies=[];const e=t.spawn('tank',{x:600,y:520});e.spawn=0;t.pulse();check(e.dead&&t.s.kills===1,'Pulse kills enemies within reactor radius');
      t.start();const enemy=t.spawn('scout',{x:600,y:660});enemy.spawn=0;t.s.player.angle=Math.PI/2;t.pointer.x=600;t.pointer.y=800;t.pointer.down=true;
      for(let i=0;i<30;i++)t.update(.02);check(t.s.kills>=1,'Aimed bullets kill an enemy');
      t.pause();check(t.mode==='paused','Pause enters paused mode');t.pause();check(t.mode==='playing','Resume enters playing mode');
      t.start();t.s.reactor=50;t.s.player.hp=2;t.s.time=29.99;t.update(.02);check(t.mode==='upgrade'&&t.s.sector===1,'30 seconds opens module selection');
      t.pick(0);check(t.mode==='playing'&&Object.keys(t.s.mods).length===1&&t.s.reactor>=58&&t.s.player.hp>=3,'Module applies with transition repair');
      for(let sector=2;sector<10;sector++){t.s.time=sector*30-.001;t.update(.01);check(t.mode==='upgrade'&&t.s.sector===sector,'Sector '+sector+' transition');t.pick(0);t.render();}
      t.s.time=299.99;t.update(.02);check(t.mode==='won'&&t.s.score>0,'Five minutes triggers victory');
      t.start();t.hitReactor(100);check(t.mode==='lost','Destroyed reactor triggers defeat');
      t.start();t.s.player.invuln=0;t.s.player.hp=1;t.hurtPlayer();check(t.mode==='lost','Destroyed pilot triggers defeat');
      t.start();check(t.s.score===0&&t.s.time===0&&t.s.enemies.length===0,'Restart clears previous run');
      // Long simulation across all rules, including boss and shockwave logic.
      for(let sector=0;sector<10;sector++){t.start();t.s.sector=sector;t.s.time=sector*30+4.1;t.s.player.hp=10000;t.s.player.maxHp=10000;for(let i=0;i<400;i++){t.s.reactor=100;t.s.player.invuln=2;t.update(.02);if(t.mode!=='playing')break;}t.render();check(Number.isFinite(t.s.player.x)&&Number.isFinite(t.s.player.y),'Rule '+sector+' stays numerically valid');}
      t.start();for(let i=0;i<12;i++)t.spawn(['scout','hunter','tank','shooter'][i%4]);t.render();t.updateUI();
      return checks;
    });
    await testPage.screenshot({path:path.join(out,'04-arena.png'),fullPage:true});
    assert.deepEqual(errors,[],'No browser JavaScript errors');
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks:result,browserErrors:errors,desktop:'1440 × 1100',mobile:'390 × 844'},null,2));
    console.log(`PASS: ${result.length} game checks, desktop/mobile layout, real browser input, zero JavaScript errors. Screenshots: ${out}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
