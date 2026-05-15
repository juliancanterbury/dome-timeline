/*
Dome Admin Upload v9
- Browser resizes images to Small 1200px high and Large 3000px high before upload.
- Uploads to GitHub Images/Small and Images/Large with same .jpg filename.
- Appends filename to FILES if missing.
- Adds/updates DATA row by filename and explicitly writes Headline/Text/Caption.
- Existing manual text is protected unless blank or "Untitled".
*/

const CONFIG = {
  githubOwner: 'juliancanterbury',
  githubRepo: 'dome-timeline',
  githubBranch: 'main',
  smallPath: 'Images/Small',
  largePath: 'Images/Large',

  spreadsheetId: '1wDHuoi8_cpGx0wYemSWE86Oxwiz9_QIUAVNxUAhAk8A',
  filesSheetName: 'FILES',
  dataSheetName: 'DATA'
};

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('Dome Admin Upload v9')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadImages(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Upload already running. Wait a moment and try again.');

  try {
    if (!payload || !Array.isArray(payload.files) || !payload.files.length) {
      throw new Error('No files supplied.');
    }

    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) throw new Error('Missing GITHUB_TOKEN in Script Properties.');

    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const filesSheet = ss.getSheetByName(CONFIG.filesSheetName);
    const dataSheet = ss.getSheetByName(CONFIG.dataSheetName);
    if (!filesSheet) throw new Error('Could not find FILES sheet.');
    if (!dataSheet) throw new Error('Could not find DATA sheet.');

    const results = [];
    const seenThisBatch = {};

    payload.files.forEach(file => {
      const finalName = cleanFileName(file.finalName || file.fileName || '');
      if (!finalName) throw new Error('Missing filename.');
      if (!/\.jpe?g$/i.test(finalName)) throw new Error('Final filename must be .jpg: ' + finalName);

      if (seenThisBatch[finalName]) {
        results.push(finalName + ': duplicate in this batch skipped');
        return;
      }
      seenThisBatch[finalName] = true;

      const headline = normalText(file.headline) || 'Untitled';
      const text = normalText(file.text);
      const caption = normalText(file.caption);
      const dateParts = parseDateFromFileName(finalName);

      const smallResult = putGithubFileIfMissing(
        token,
        CONFIG.smallPath + '/' + finalName,
        stripDataUrl(file.smallBase64),
        'Upload small ' + finalName
      );

      const largeResult = putGithubFileIfMissing(
        token,
        CONFIG.largePath + '/' + finalName,
        stripDataUrl(file.largeBase64),
        'Upload large ' + finalName
      );

      const filesResult = ensureFilenameInFilesSheet(filesSheet, finalName);
      const dataResult = ensureDataRowAndMetadata(dataSheet, {
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        headline,
        text,
        caption,
        filename: finalName
      });

      results.push([
        finalName + ':',
        filesResult,
        dataResult,
        'Small ' + smallResult,
        'Large ' + largeResult
      ].join(' '));
    });

    SpreadsheetApp.flush();
    return {
      ok: true,
      message: payload.files.length + ' image(s) processed.',
      results
    };
  } finally {
    lock.releaseLock();
  }
}

function getHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  values.forEach((h, i) => {
    const key = String(h || '').trim().toLowerCase();
    if (key) map[key] = i + 1;
  });
  return map;
}

function findHeader(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const key = names[i].toLowerCase();
    if (headers[key]) return headers[key];
  }
  return null;
}

function ensureFilenameInFilesSheet(sheet, filename) {
  const headers = getHeaders(sheet);
  let filenameCol = findHeader(headers, ['Filename', 'Filenames', 'FileName']);
  if (!filenameCol) {
    filenameCol = 1;
    sheet.getRange(1, 1).setValue('Filename');
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow >= 2) {
    const names = sheet.getRange(2, filenameCol, lastRow - 1, 1).getValues().flat().map(v => String(v || '').trim());
    if (names.includes(filename)) return 'already existed in FILES;';
  }

  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, filenameCol).setValue(filename);
  return 'added to FILES;';
}

function ensureDataRowAndMetadata(sheet, item) {
  const headers = getHeaders(sheet);

  const colYear = findHeader(headers, ['Year']);
  const colMonth = findHeader(headers, ['Month']);
  const colDay = findHeader(headers, ['Day']);
  const colHeadline = findHeader(headers, ['Headline']);
  const colText = findHeader(headers, ['Text']);
  const colCaption = findHeader(headers, ['Caption']);
  const colFilename = findHeader(headers, ['Filename', 'Filenames', 'FileName']);

  if (!colFilename) throw new Error('Could not find Filename column in DATA.');
  if (!colHeadline) throw new Error('Could not find Headline column in DATA.');
  if (!colText) throw new Error('Could not find Text column in DATA.');
  if (!colCaption) throw new Error('Could not find Caption column in DATA.');

  let row = findRowByFilename(sheet, colFilename, item.filename);

  if (!row) {
    row = sheet.getLastRow() + 1;
    if (colYear) sheet.getRange(row, colYear).setValue(item.year || '');
    if (colMonth) sheet.getRange(row, colMonth).setValue(item.month || '');
    if (colDay) sheet.getRange(row, colDay).setValue(item.day || '');
    sheet.getRange(row, colFilename).setValue(item.filename);
  } else {
    if (colYear && isBlank(sheet.getRange(row, colYear).getValue())) sheet.getRange(row, colYear).setValue(item.year || '');
    if (colMonth && isBlank(sheet.getRange(row, colMonth).getValue())) sheet.getRange(row, colMonth).setValue(item.month || '');
    if (colDay && isBlank(sheet.getRange(row, colDay).getValue())) sheet.getRange(row, colDay).setValue(item.day || '');
  }

  writeIfSafe(sheet.getRange(row, colHeadline), item.headline || 'Untitled', true);
  writeIfSafe(sheet.getRange(row, colText), item.text || '', false);
  writeIfSafe(sheet.getRange(row, colCaption), item.caption || '', false);

  return 'metadata written to DATA row ' + row + ';';
}

function findRowByFilename(sheet, filenameCol, filename) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, filenameCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === filename) return i + 2;
  }
  return null;
}

function writeIfSafe(range, newValue, allowUntitledReplace) {
  const current = String(range.getValue() || '').trim();
  const incoming = String(newValue || '').trim();

  if (!incoming) return;

  if (isBlank(current)) {
    range.setValue(incoming);
    return;
  }

  if (allowUntitledReplace && current.toLowerCase() === 'untitled') {
    range.setValue(incoming);
    return;
  }
}

function isBlank(value) {
  return String(value || '').trim() === '';
}

function normalText(value) {
  return String(value || '').trim();
}

function cleanFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[\\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ');
}

function parseDateFromFileName(fileName) {
  const name = String(fileName || '');
  const m = name.match(/(20\d{2})[-_ ](\d{1,2})[-_ ](\d{1,2})/);
  if (!m) return { year: '', month: '', day: '' };
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3])
  };
}

function stripDataUrl(base64) {
  const s = String(base64 || '');
  const comma = s.indexOf(',');
  return comma >= 0 ? s.slice(comma + 1) : s;
}

function githubApiUrl(path) {
  return 'https://api.github.com/repos/' +
    encodeURIComponent(CONFIG.githubOwner) + '/' +
    encodeURIComponent(CONFIG.githubRepo) + '/contents/' +
    path.split('/').map(encodeURIComponent).join('/');
}

function githubFileExists(token, path) {
  const res = UrlFetchApp.fetch(githubApiUrl(path) + '?ref=' + encodeURIComponent(CONFIG.githubBranch), {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json'
    }
  });

  if (res.getResponseCode() === 200) return true;
  if (res.getResponseCode() === 404) return false;
  throw new Error('GitHub check failed for ' + path + ': ' + res.getContentText());
}

function putGithubFileIfMissing(token, path, contentBase64, message) {
  if (!contentBase64) throw new Error('Missing image content for ' + path);

  if (githubFileExists(token, path)) {
    return 'already catalogued; upload skipped;';
  }

  const payload = {
    message: message,
    content: contentBase64,
    branch: CONFIG.githubBranch
  };

  const res = UrlFetchApp.fetch(githubApiUrl(path), {
    method: 'put',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify(payload)
  });

  const code = res.getResponseCode();
  if (code >= 200 && code < 300) return 'created new file;';

  throw new Error('GitHub upload failed for ' + path + ': ' + res.getContentText());
}
