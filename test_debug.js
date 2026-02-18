const axios = require('axios');
const fs = require('fs');

const url = 'https://www.google.com/maps/@33.5854724,130.2313199,11z/data=!4m3!11m2!2s8S9-M7GPQJrUF9DStlvLNdKihu3xZw!3e3?entry=ttu&g_ep=EgoyMDI2MDIwMy4wIKXMDSoASAFQAw%3D%3D';

(async () => {
    try {
        console.log('Sending request to server...');
        const response = await axios.post('http://localhost:3000/crawl', { url });
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2)); /* Full dump */
        
        // Find the item with debugHtml
        const debugItem = response.data.data.find(i => i.debugHtml);
        if (debugItem) {
            fs.writeFileSync('item_debug.html', debugItem.debugHtml);
            console.log('Debug HTML written to item_debug.html');
        } else {
            console.log('No debug HTML found in response');
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
})();
