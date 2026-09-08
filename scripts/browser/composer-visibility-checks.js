async page => {
 const results=[];let error;
 try {
  await page.goto(page.url().split('/').slice(0,3).join('/')+'/#agent');await page.reload();await page.getByRole('textbox',{name:'Message Pathway',exact:true}).waitFor();
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:width===375?812:1000});const n=await page.locator('.agent-turn').count();const box=page.getByRole('textbox',{name:'Message Pathway',exact:true});
   await box.fill('Send the office email.');await box.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n+1&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n);
   const detail=await box.evaluate(n=>{const r=n.getBoundingClientRect(),s=document.querySelector('.conversation-stream'),c=document.querySelector('.agent-composer').getBoundingClientRect();return {width:innerWidth,height:innerHeight,top:r.top,bottom:r.bottom,focused:document.activeElement===n,newest:Math.abs(s.scrollHeight-s.clientHeight-s.scrollTop)<2,uncovered:c.top>=s.getBoundingClientRect().bottom-1};});
   const pass=detail.top>=0&&detail.bottom<=detail.height&&detail.focused&&detail.newest&&detail.uncovered;results.push({name:'visible focused composer with newest transcript at '+width,pass,detail});if(!pass)throw new Error('composer visibility failed at '+width);
   await page.screenshot({path:'output/playwright/composer-'+width+'.png',fullPage:false});
  }
 }catch(caught){error=String(caught);}
 return {schema:'pathway-composer-visibility-browser-v1',timestamp:new Date().toISOString(),environment:page.url().startsWith('https:')?'Public Render':'Local production build',results,...(error?{error}:{})};
}
