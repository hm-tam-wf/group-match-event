function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Thời gian", "Biểu tượng"].concat(FIELD_LABELS).concat(["PlayerID"]));
    sh.setFrozenRows(1);
  }
  return sh;
}
