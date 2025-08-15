const xlsx = require('xlsx');

// Create sample data
const data = [
    { URL: 'https://www.nature.com/articles/d41586-024-00001-1' },
    { URL: 'https://www.theverge.com/tech' },
    { URL: 'https://www.scientificamerican.com/technology/' }
];

// Create a new workbook and worksheet
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(data);

// Add worksheet to workbook
xlsx.utils.book_append_sheet(wb, ws, 'URLs');

// Save the file
xlsx.writeFile(wb, 'sample_urls.xlsx');

console.log('Sample Excel file created: sample_urls.xlsx');