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
      // Ensure location is always present
      payload.location = data.location || '';
    } else {
      // For cards, we map phone and ensure address is clearly passed
      payload.phone = data.phone ? `'${data.phone}` : '';
      // Some scripts might expect 'location' instead of 'address', so we provide both to be safe
      payload.address = data.address || '';
      payload.location = data.address || ''; 
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

    const responseText = await response.text();
    console.log(`Google Sheets Response [${response.status}]:`, responseText);

    if (response.ok) {
      console.log(`Successfully appended ${type} data to Google Sheets via Web App`);
    } else {
      console.error(`Failed to append ${type} to Google Sheets:`, response.status, response.statusText, responseText);
    }
  } catch (error) {
    console.error(`Error appending ${type} to Google Sheets:`, error);
  }
}

module.exports = { appendToSheet };
