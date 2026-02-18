const fs = require('fs');
const html = fs.readFileSync('debug.html', 'utf8');
const index = html.indexOf('fontHeadlineSmall');

if (index !== -1) {
    const start = Math.max(0, index - 1000);
    const end = Math.min(html.length, index + 2000);
    console.log(html.substring(start, end));
} else {
    console.log('fontHeadlineSmall not found');
}
