const puppeteer = require('puppeteer');

async function scrapeList(url) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    // Optimization: Block details that are not needed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    try {
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for list to load
        await page.waitForSelector('.fontHeadlineSmall', { timeout: 30000 });

        // Scroll Logic
        const scrollableSelector = await page.evaluate(() => {
            const containers = Array.from(document.querySelectorAll('div'));
            const scrollable = containers.find(el => {
                const style = window.getComputedStyle(el);
                return (style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight;
            });
            
            if (scrollable) {
                if (scrollable.className) {
                    return '.' + scrollable.className.trim().split(/\s+/).join('.');
                }
                return 'div[role="feed"]'; 
            }
            return null;
        }) || '.m6QErb';

        console.log(`Identified scrollable container selector: ${scrollableSelector}`);

        // Scroll to bottom
        await page.evaluate(async (selector) => {
            let container = null;
            try {
                container = document.querySelector(selector);
            } catch (e) {
                console.warn('Invalid selector:', selector);
            }
            
            if (!container) {
                 container = document.querySelector('div[role="feed"]') || document.querySelector('.m6QErb');
            }

            if (!container) {
                console.log('No scrollable container found, skipping scroll.');
                return;
            }
            
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 1000;
                const timer = setInterval(() => {
                    const scrollHeight = container.scrollHeight;
                    container.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        if (container.scrollHeight > scrollHeight) {
                        } else {
                            clearInterval(timer);
                            resolve();
                        }
                    }
                }, 200);
            });
        }, scrollableSelector);

        await new Promise(r => setTimeout(r, 2000));

        // Extraction
        const places = await page.evaluate(() => {
            const items = document.querySelectorAll('.BsJqK'); 
            const results = [];
            
            items.forEach(item => {
                const nameEl = item.querySelector('.fontHeadlineSmall');
                const noteEl = item.querySelector('.u5DVOd');
                
                if (nameEl) {
                    results.push({
                        name: nameEl.innerText.trim(),
                        note: noteEl ? noteEl.innerText.trim() : null
                    });
                }
            });
            return results;
        });

        console.log(`Scraped ${places.length} places.`);
        return places;

    } catch (error) {
        console.error('Scrape error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeList };
