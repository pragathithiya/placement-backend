require('dotenv').config();

async function appendToSheet(data) {
  try {
    const webAppUrl = process.env.SHEET_WEB_APP_URL;
    if (!webAppUrl) {
      console.warn('SHEET_WEB_APP_URL not set in .env. Skipping Google Sheets append.');
      return;
    }

    // Prepend a single quote to the phone number to force Google Sheets to treat it as text
    const payload = {
      ...data,
      hr_phone: data.hr_phone ? `'${data.hr_phone}` : ''
    };

    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('Successfully appended data to Google Sheets via Web App');
    } else {
      console.error('Failed to append to Google Sheets:', response.statusText);
    }
  } catch (error) {
    console.error('Error appending to Google Sheets:', error);
  }
}

module.exports = { appendToSheet };
