"auto";


(function(){
const { Config } = require("../conf.js");
const { logSafe } = require("./logger.js");

var CHAT_API_URL   = (Config && Config.CHAT_API_URL)   ? Config.CHAT_API_URL   : "http://localhost:9092/chat";
var CHAT_API_TOKEN = (Config && Config.CHAT_API_TOKEN) ? Config.CHAT_API_TOKEN : null;

function baseHeaders(withJson) {
  var h = {};
  if (CHAT_API_TOKEN) h["Authorization"] = "Bearer " + CHAT_API_TOKEN;
  if (withJson) h["Content-Type"] = "application/json";
  return h;
}

function buildMessagesArray(messages) {
  if (Array.isArray(messages)) return messages;
  if (typeof messages === "string") return [messages];
  return [String(messages)];
}

/**
 * Chat API'ye POST /chat isteği atar ve body'deki düz text cevabı döner.
 * @param {string|string[]} messages
 * @param {string} key (opsiyonel) idempotency/cache key
 * @returns {string|null}
 */
function sendChat(messages, key) {
  var bodyObj = {
    messages: buildMessagesArray(messages),
    key: key,
    persona: (Config && Config.PERSONA) ? Config.PERSONA : undefined
  };

  var bodyStr = JSON.stringify(bodyObj);
  logSafe("ChatAPI POST", CHAT_API_URL, bodyStr);

  var res = http.request(CHAT_API_URL, {
    method: "POST",
    headers: baseHeaders(true),
    contentType: "application/json",
    body: bodyStr
  });

  if (!res) {
    logSafe("ChatAPI: response yok");
    return null;
  }

  if (res.statusCode >= 300) {
    var errTxt = "";
    try { errTxt = res.body.string(); } catch (e) {}
    logSafe("ChatAPI error", res.statusCode, errTxt);
    return null;
  }

  try {
    var txt = res.body.string();
    return txt || null;
  } catch (e) {
    logSafe("ChatAPI body.string() error", e);
    return null;
  }
}

/**
 * Generic POST: istediğin bodyObj'i gönder, text döner.
 * @param {Object} bodyObj
 * @returns {string|null}
 */
function postRaw(bodyObj) {
  var bodyStr = JSON.stringify(bodyObj || {});
  logSafe("ChatAPI POST RAW", CHAT_API_URL, bodyStr);

  var res = http.request(CHAT_API_URL, {
    method: "POST",
    headers: baseHeaders(true),
    contentType: "application/json",
    body: bodyStr
  });

  if (!res || res.statusCode >= 300) {
    var errTxt = "";
    try { errTxt = res && res.body ? res.body.string() : ""; } catch (e) {}
    logSafe("ChatAPI POST RAW error", res ? res.statusCode : "no_res", errTxt);
    return null;
  }

  try {
    var txt = res.body.string();
    return txt || null;
  } catch (e) {
    logSafe("ChatAPI POST RAW body.string() error", e);
    return null;
  }
}

module.exports = {
  sendChat: sendChat,
  postRaw: postRaw
};

})();
