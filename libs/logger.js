"auto";

(function(){
/**
 * AutoJs6/OpenAutoJs uyumlu güvenli log helper.
 * - log() bazı modlarda/derlemelerde patlayabiliyor; fallback olarak console.log'a düşer.
 * - Eski kodla uyumluluk için globalThis.logSafe set edilir.
 */
function logSafe() {
  try {
    // Auto.js log()
    return log.apply(null, arguments);
  } catch (e) {
    try {
      // Bazı ortamlarda console.log daha güvenli
      return console.log.apply(console, arguments);
    } catch (e2) {
      // sessiz
    }
  }
}

function initGlobalLogger() {
  try {
    if (typeof globalThis !== "undefined") {
      globalThis.logSafe = globalThis.logSafe || logSafe;
    }
  } catch (e) {}
}

module.exports = {
  logSafe: logSafe,
  initGlobalLogger: initGlobalLogger
};

})();
