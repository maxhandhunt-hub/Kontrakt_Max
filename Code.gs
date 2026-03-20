const SHEET_ID = '1R1ApOIfRLBVYbKLHVJCAZX0H3AqPjRT_S1ISsvVQcCU';
const SHEET_NAME = 'Заявки';

function doGet() {
  return jsonResponse({
    success: true,
    message: 'Web app is running'
  });
}

function doPost(e) {
  try {
    const sheet = getSheet_();

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        message: 'Пустое тело запроса'
      });
    }

    const data = JSON.parse(e.postData.contents);

    const row = [
      new Date(),
      data.fullName || '',
      data.age || '',
      data.city || '',
      data.phone || '',
      data.direction || '',
      data.position || '',
      data.criminalRecord || '',
      data.criminalArticles || '',
      data.chronicDiseases || '',
      data.diseasesDescription || '',
      data.rank || '',
      data.dismissed || '',
      data.dismissReason || '',
      data.consent || '',
      data.clientCreatedAt || ''
    ];

    sheet.appendRow(row);

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    sheet
      .getRange(lastRow, 1, 1, lastColumn)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    return jsonResponse({
      success: true,
      message: 'Заявка отправлена'
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error && error.message ? error.message : 'Неизвестная ошибка'
    });
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Дата создания заявки',
      'ФИО',
      'Возраст',
      'Город',
      'Телефон',
      'Направление',
      'Должность',
      'Судимость',
      'Статьи',
      'Хронические заболевания',
      'Описание заболеваний',
      'Звание',
      'Комиссован',
      'Причина комиссования / ранения',
      'Согласие',
      'Дата создания на клиенте'
    ]);

    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }

  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
