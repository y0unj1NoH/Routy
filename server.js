const express = require('express');
const { scrapeList } = require('./crawler');
const { getPlaceDetails } = require('./placesService');
const app = express();
const PORT = 3000;

app.use(express.json());

app.post('/crawl', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Received crawl request for: ${url}`);
    const start = Date.now();

    try {
        // Step 1: Crawl
        console.log('Starting crawler...');
        const scrapedItems = await scrapeList(url);
        console.log(`Crawling finished. Found ${scrapedItems.length} items.`);

        // Step 2: Enrich with Places API
        // Run in parallel for speed
        console.log('Enriching data with Places API...');
        const enrichedItems = await Promise.all(scrapedItems.map(async (item) => {
            const apiDetails = await getPlaceDetails(item.name);
            return {
                ...item,
                details: apiDetails || { error: 'Place not found in API' }
            };
        }));

        const duration = (Date.now() - start) / 1000;
        console.log(`Process completed in ${duration}s`);

        res.json({
            success: true,
            total: enrichedItems.length,
            durationSeconds: duration,
            data: enrichedItems
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
