require('dotenv').config();

async function appendToSheet(data, type = 'placement') {
  try {
    const webAppUrl = type === 'card' ? process.env.SHEET_CARDS_WEB_APP_URL : process.env.SHEET_WEB_APP_URL;
    
    if (!webAppUrl) {
      console.warn(`SHEET_WEB_APP_URL for type ${type} not set in .env. Skipping Google Sheets append.`);
      return;
    }

    // Construct the payload in the EXACT order of your Google Sheet columns
    const now = new Date();
    // Use Intl.DateTimeFormat for reliable IST string
    const dateStr = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    }).format(now).replace(',', '');
    
    let payload = {};

    if (type === 'placement') {
      payload = {
        "DATE": dateStr,
        "COMPANY NAME": data.company_name || "",
        "ROLE": data.job_role || "",
        "LOCATION AND ADDRESS": data.location || "",
        "DURATION": data.duration || "",
        "STIPEND": data.stipend || "",
        "SALARY": data.salary || "",
        "MODE": data.mode || "",
        "SKILLS": data.skills || "",
        "HR NAME": data.hr_name || "",
        "PHONE NUMBER": data.hr_phone ? `'${data.hr_phone}` : ""
      };
    } else {
      // ORDER FOR CARDS (MATCHING YOUR SCREENSHOT):
      // A: DATE, B: NAME, C: DESIGNATION, D: COMPANY, E: EMAIL, F: PHONE NO, G: WEBSITE, H: ADDRESS, I: CARD TYPE
      payload = {
        "DATE": dateStr,
        "NAME": data.name || "",
        "DESIGNATION": data.designation || "",
        "COMPANY": data.company_name || "",
        "EMAIL": data.email || "",
        "PHONE NO": data.phone ? `'${data.phone}` : "",
        "WEBSITE": data.website || "",
        "ADDRESS": data.address || "",
        "CARD TYPE": data.card_type || ""
      };
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
