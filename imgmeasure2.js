const p = require('C:/Users/ADVAN/AppData/Local/Temp/opencode/uitest/node_modules/puppeteer-core');
(async () => {
  const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const pg = await b.newPage(); await pg.setViewport({ width: 1200, height: 800 });
  await pg.goto('http://localhost/UKK-PAKET-2/imgtest.html', { waitUntil: 'domcontentloaded' });
  console.log(JSON.stringify(await pg.evaluate(() => [...document.images].map(i => ({ nat: i.naturalWidth, loaded: i.complete && i.naturalWidth > 0, box: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)], ar: getComputedStyle(i).aspectRatio }))), null, 1));
  await b.close();
})();
