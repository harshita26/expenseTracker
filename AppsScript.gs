/**
 * MONEY LEDGER — Apps Script backend
 * -----------------------------------
 * Paste this into the Apps Script editor attached to your Google Sheet
 * (Extensions > Apps Script in the Sheet menu).
 *
 * It turns your Sheet into a tiny private API:
 *   - doGet   -> returns all rows as JSON (for the dashboard to read)
 *   - doPost  -> appends a new row (for the dashboard to write)
 *
 * PRIVACY: this script runs under YOUR Google account only. When you
 * deploy it (Deploy > New deployment > Web app), set "Who has access"
 * to "Only myself" if you want it locked to your Google login, or
 * "Anyone with the link" if you want to open it from the dashboard
 * without a Google login prompt (the URL itself is the secret —
 * don't share it). Your data never leaves Google's servers either way.
 */

const SHEET_NAME = 'Entries'; // the tab this script reads/writes

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'date', 'type', 'category', 'amount', 'note']);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const data = rows.slice(1)
    .filter(r => r[0] !== '') // skip blank rows
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    if (body.action === 'add') {
      const id = Utilities.getUuid();
      sheet.appendRow([
        id,
        body.date,
        body.type,       // "expense" | "income" | "investment" | "fd" | "interest"
        body.category,
        Number(body.amount),
        body.note || ''
      ]);
      return jsonOut_({ ok: true, id });
    }

    if (body.action === 'delete') {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === body.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonOut_({ ok: true });
    }

    return jsonOut_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
