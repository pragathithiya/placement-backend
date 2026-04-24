require('dotenv').config();

async function appendToSheet(data, type = 'placement') {
  try {
    const webAppUrl = type === 'card' ? process.env.SHEET_CARDS_WEB_APP_URL : process.env.SHEET_WEB_APP_URL;
    
    if (!webAppUrl) {
      console.warn(`SHEET_WEB_APP_URL for type ${type} not set in .env. Skipping Google Sheets append.`);
      return;
    }

    // Prepare payload
    let payload = { ...data };
    
    if (type === 'placement') {
      // Prepend a single quote to the phone number to force Google Sheets to treat it as text
      payload.hr_phone = data.hr_phone ? `'${data.hr_phone}` : '';
    } else {
      // For cards, we might have different fields, but let's keep it generic or specific to card details
      payload.phone = data.phone ? `'${data.phone}` : '';
    }

    console.log(`Attempting to append ${type} data to: ${webAppUrl}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`Successfully appended ${type} data to Google Sheets via Web App`);
    } else {
      const errorText = await response.text();
      console.error(`Failed to append ${type} to Google Sheets:`, response.status, response.statusText, errorText);
    }
  } catch (error) {
    console.error(`Error appending ${type} to Google Sheets:`, error);
  }
}

module.exports = { appendToSheet };
