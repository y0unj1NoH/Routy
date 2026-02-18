const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set viewport to a reasonable size
    await page.setViewport({ width: 1280, height: 800 });

    const url = 'https://www.google.com/maps/@33.5854724,130.2313199,11z/data=!4m3!11m2!2s8S9-M7GPQJrUF9DStlvLNdKihu3xZw!3e3?entry=ttu&g_ep=EgoyMDI2MDIwMy4wIKXMDSoASAFQAw%3D%3D';
    
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded. Waiting a bit for dynamic content...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Dumping HTML...');
    const html = await page.content();
    fs.writeFileSync('debug.html', html);
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'debug.png' });

    console.log('Done. Check debug.html and debug.png');
    await browser.close();
})();
