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
        // We know the list items are likely inside .BsJqK or similar.
        // We generally wait for the list container. 
        // Based on analysis, .m6QErb is a common container class for lists in maps, 
        // but let's wait for at least one item .BsJqK or .fontHeadlineSmall
        await page.waitForSelector('.fontHeadlineSmall', { timeout: 30000 });

        // Scroll Logic
        // We'll try to find the scrollable container.
        const scrollableSelector = await page.evaluate(() => {
            // Find a div that has scrollable vertical overflow and contains the items
            const containers = Array.from(document.querySelectorAll('div'));
            const scrollable = containers.find(el => {
                const style = window.getComputedStyle(el);
                return (style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight;
            });
            
            if (scrollable) {
                if (scrollable.className) {
                    return '.' + scrollable.className.trim().split(/\s+/).join('.');
                }
                // Fallback for no class: generate a path or use tag (risky)
                return 'div[role="feed"]'; 
            }
            return null;
        }) || '.m6QErb'; // Fallback based on observation

        console.log(`Identified scrollable container selector: ${scrollableSelector}`);

        // Scroll to bottom
        await page.evaluate(async (selector) => {
            // Handle logical OR selector trying both
            let container = null;
            try {
                container = document.querySelector(selector);
            } catch (e) {
                console.warn('Invalid selector:', selector);
            }
            
            // Fallback trial
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
                        // Check if new items loaded
                        if (container.scrollHeight > scrollHeight) {
                            // More loaded, keep scrolling
                        } else {
                            // End of list
                            clearInterval(timer);
                            resolve();
                        }
                    }
                }, 200);
            });
        }, scrollableSelector);

        // Give a moment for final items to render
        await new Promise(r => setTimeout(r, 2000));


        // Extraction with Click (High Accuracy Mode)
        console.log('Starting extraction (Click Mode)...');
        const items = await page.$$('.BsJqK'); // Element handles
        const results = [];

        console.log(`Found ${items.length} items. processing...`);
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Extract Name/Note first (safest)
            const name = await item.$eval('.fontHeadlineSmall', el => el.innerText.trim()).catch(() => null);
            const note = await item.$eval('.u5DVOd', el => el.innerText.trim()).catch(() => null);
            const category = await item.$eval('.IIrLbb span', el => el.innerText.trim()).catch(() => '');

            if (name) {
                // Click to get ID/URL
                try {
                    // Click the button part to trigger navigation
                    const button = await item.$('button');
                    if (button) {
                        await button.click();
                        // Wait for URL to change to contain '/place/' or confirm navigation
                        try {
                            // Wait up to 1.5s for URL update. It's usually instant for SPA.
                            await page.waitForFunction(() => window.location.href.includes('/place/'), { timeout: 1500 });
                        } catch (e) {
                             // Ignore timeout, capture whatever URL is there
                        }
                        const currentUrl = page.url();
                        
                        results.push({
                            name,
                            note,
                            category,
                            originalQuery: name,
                            placeUrl: currentUrl
                        });

                        // Go back to return to list view
                        await page.goBack();
                        // Wait for the list container to reappear/stabilize
                        await page.waitForSelector('.BsJqK', { timeout: 2000 });
                    }
                } catch (err) {
                    console.warn(`Failed to click/process item ${i}:`, err.message);
                    // Fallback to just name if click fails
                    results.push({ name, note, error: 'Click failed' });
                }
            }
        }
        
        console.log(`Scraped ${results.length} items with URLs.`);
        return results;

    } catch (error) {
        console.error('Scrape error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeList };
