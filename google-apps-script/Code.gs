const SHEET_NAME = "Votes";
const SYSTEM_HEADERS = ["timestamp", "submissionId"];
const CHOICE_SET_IDS = [
  "entrance-hymn",
  "first-reading",
  "responsorial-psalm",
  "second-reading",
  "offertory-hymn",
  "communion-hymn",
  "communion-meditation",
  "recessional-hymn",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const choices = payload.choices || {};
    const sheet = getVoteSheet_();
    const headers = ensureHeaders_(sheet);
    const row = headers.map((header) => {
      if (header === "timestamp") return new Date();
      if (header === "submissionId") {
        return payload.submissionId || Utilities.getUuid();
      }
      return choices[header] || "";
    });

    sheet.appendRow(row);
    return respond_({ ok: true });
  } catch (error) {
    return respond_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  return respond_(getResults_(), callback);
}

function getResults_() {
  const sheet = getVoteSheet_();
  const headers = ensureHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const counts = {};

  CHOICE_SET_IDS.forEach((setId) => {
    counts[setId] = {};
  });

  if (lastRow < 2) {
    return {
      totalSubmissions: 0,
      updatedAt: new Date().toISOString(),
      counts,
    };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  let totalSubmissions = 0;

  rows.forEach((row) => {
    if (!row[0]) return;
    totalSubmissions += 1;

    CHOICE_SET_IDS.forEach((setId) => {
      const columnIndex = headers.indexOf(setId);
      if (columnIndex < 0) return;

      const optionId = row[columnIndex];
      if (!optionId) return;

      counts[setId][optionId] = (counts[setId][optionId] || 0) + 1;
    });
  });

  return {
    totalSubmissions,
    updatedAt: new Date().toISOString(),
    counts,
  };
}

function getVoteSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("This script must be opened from Extensions > Apps Script in the vote spreadsheet.");
  }

  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const expectedHeaders = SYSTEM_HEADERS.concat(CHOICE_SET_IDS);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    return expectedHeaders;
  }

  const currentWidth = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet
    .getRange(1, 1, 1, currentWidth)
    .getValues()[0]
    .filter(Boolean);
  const missingHeaders = expectedHeaders.filter(
    (header) => currentHeaders.indexOf(header) === -1,
  );

  if (currentHeaders.length === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return expectedHeaders;
  }

  if (missingHeaders.length) {
    sheet
      .getRange(1, currentHeaders.length + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);
  }

  return currentHeaders.concat(missingHeaders);
}

function respond_(payload, callback) {
  const hasCallback =
    typeof callback === "string" && /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback);
  const body = hasCallback
    ? `${callback}(${JSON.stringify(payload)});`
    : JSON.stringify(payload);

  return ContentService.createTextOutput(body).setMimeType(
    hasCallback
      ? ContentService.MimeType.JAVASCRIPT
      : ContentService.MimeType.JSON,
  );
}
