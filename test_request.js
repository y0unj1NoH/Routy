const axios = require('axios');

const url = 'https://www.google.com/maps/@33.5854724,130.2313199,11z/data=!4m3!11m2!2s8S9-M7GPQJrUF9DStlvLNdKihu3xZw!3e3?entry=ttu&g_ep=EgoyMDI2MDIwMy4wIKXMDSoASAFQAw%3D%3D';

(async () => {
    try {
        console.log('Sending request to server...');
        const response = await axios.post('http://localhost:3000/crawl', { url });
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Server Error:', error.response.data);
        }
    }
})();
