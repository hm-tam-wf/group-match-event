function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  if (action === "state") return jsonResponse(getState());
  if (!action)            return serveHtml();
  return jsonResponse({ ok: true, msg: "alive" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return jsonResponse({ ok: false, reason: "busy" }); }
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "claim") return jsonResponse(claim(data));
    return jsonResponse({ ok: false, reason: "unknown_action" });
  } catch (err) {
    return jsonResponse({ ok: false, reason: "error", detail: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function serveHtml() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Linh Thú Của Bạn")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Dùng trong Index.html: <?!= include('Styles') ?>
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
