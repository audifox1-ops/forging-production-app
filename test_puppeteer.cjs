const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/#/reports/2026-06-11/input', { waitUntil: 'networkidle0' });
    
    // Wait for the error badge to appear
    await page.waitForSelector('div[title^="공유 저장 오류 상세 정보:"]', { timeout: 10000 });
    
    const title = await page.$eval('div[title^="공유 저장 오류 상세 정보:"]', el => el.getAttribute('title'));
    console.log("FOUND ERROR:", title);
    
    await browser.close();
  } catch (e) {
    console.error("Puppeteer error:", e);
    process.exit(1);
  }
})();
