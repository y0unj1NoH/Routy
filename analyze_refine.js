const fs = require('fs');
const html = fs.readFileSync('debug.html', 'utf8');
// Search for a typical place link pattern
const linkRegex = /href="[^"]*\/maps\/place\/[^"]*"/;
const match = linkRegex.exec(html);

if (match) {
    const start = Math.max(0, match.index - 1000);
    const end = Math.min(html.length, match.index + 2000);
    const snippet = html.substring(start, end);
    fs.writeFileSync('snippet.txt', snippet);
    console.log('Snippet written to snippet.txt');
} else {
    // Try searching for fontHeadlineSmall again
    const nameIndex = html.indexOf('fontHeadlineSmall');
    if (nameIndex !== -1) {
        const start = Math.max(0, nameIndex - 1000);
        const end = Math.min(html.length, nameIndex + 2000);
        fs.writeFileSync('snippet.txt', html.substring(start, end));
        console.log('Snippet (name) written to snippet.txt');
    } else {
        console.log('No link or name found');
    }
}
