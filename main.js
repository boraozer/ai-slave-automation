"auto";

const { Config, FIXED_CONFIG_PATH, EXTERNAL_CONFIG_OK, EXTERNAL_CONFIG_CREATED } = require("./conf.js");

// Zorunlu dış config yoksa: uyar + örnek dosya bırak + dur
if (!EXTERNAL_CONFIG_OK) {
  var msg = "Eksik config: " + FIXED_CONFIG_PATH + "\n";
  msg += EXTERNAL_CONFIG_CREATED
    ? "Örnek dosya oluşturuldu."
    : "Örnek dosya oluşturulamadı (izin eksik olabilir).";
  msg += "\nDosyayı düzenleyip tekrar çalıştırın.";
  toast(msg);
  sleep(2500);
  exit();
}

const { initGlobalLogger, logSafe } = require("./libs/logger.js");

const UIUtils = require("./libs/utils.js");
const Supabase = require("./libs/supabase.js");
const NotificationWatcher = require("./libs/notification.js");
const QueueWorker = require("./libs/queue.js");
const sugo = require("./automations/sugo.automation.js");

// Eski kod uyumluluğu: global logSafe
initGlobalLogger();


// Global uyumluluk: modüller globalThis üzerinden de erişebilsin
try { globalThis.Config = Config; } catch (e) {}
try { globalThis.logSafe = globalThis.logSafe || logSafe; } catch (e) {}


// -----------------------------------------------------
//  BOOTSTRAP
// -----------------------------------------------------

auto.waitFor();
logSafe("Script başlıyor...");

// Runtime state
var deviceId = null;
var DEVICE_ENUMS = null;

// Idle detector
const IDLE_MS = 1000 * 60 * 10;      // 10 dakika
const IDLE_CHECK_MS = 30 * 1000;     // 30 sn'de bir kontrol
var idleNotified = false;
var idleTimer = null;
var lastEvent = Date.now();

// 1) Cihazı Supabase'ten bul
var device = Supabase.fetchDeviceByKey(Config.DEVICE_KEY);
if (!device) {
  toast("Cihaz Supabase'te bulunamadı. DEVICE_KEY'i kontrol et.");
  logSafe("Çıkılıyor: cihaz bulunamadı.");
  exit();
}
logSafe("Cihaz bilgileri:", JSON.stringify(device));

deviceId = device.id;
logSafe("Cihaz bulundu. id=", deviceId);

// 1.1) Model enums (koordinatlar / selectorlar)
DEVICE_ENUMS = Supabase.loadDeviceEnumsByModelId(device.model_id);
logSafe("Device Enums yüklendi.");

// Sugo automation context init (AutoJs6 modül scope nedeniyle gerekli)
sugo.init({ deviceId: deviceId, deviceEnums: DEVICE_ENUMS });

// 2) Bu cihaza bağlı paket listesini çek
var watchPkgs = Supabase.fetchWatchPackages(deviceId);

// 3) Bildirim dinleyiciyi başlat (takip edilecek paket listesiyle)
NotificationWatcher.init(deviceId, watchPkgs);

// 4) Queue worker'ı başlat
QueueWorker.start(deviceId, handleEvent);

toast("Automation client başlatıldı.");
startIdleDetector();

function startIdleDetector() {
  try {
    if (idleTimer) clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      var idleFor = Date.now() - lastEvent;
      if (idleFor >= IDLE_MS && !idleNotified) {
        // "restart_app" event'i üret
        try { Supabase.insertIdleEvent(deviceId, "com.fiya.android-restart_idle"); } catch (e0) {}
        idleNotified = true;
        logSafe("IDLE: uzun süre event gelmedi. idleFor(ms)=", idleFor);
        try { toast("IDLE: uzun süre işlem yok"); } catch (e) {}
      }
    }, IDLE_CHECK_MS);
  } catch (e) {
    logSafe("Idle detector error:", e);
  }
}

setInterval(()=> {
  try { Supabase.insertIdleEvent(deviceId, "com.fiya.android-restart_idle"); } catch (e0) {}
}, 1000 * 60 * 60); // Her 1 saatte bir


function handleEvent(ev) {
  lastEvent = Date.now();
  idleNotified = false;

  var p = (ev && ev.payload) ? ev.payload : {};
  if (!p || !p.type) return;

  try {
    if (p.type === "unread_messages") {
      sugo.answerMessage(p);
      return;
    }

    if (p.type === "restart_app") {
      sugo.restartApp();
      return;
    }

    if (p.type === "fin_new_match") {
      // sugo.findNewMatch(p.pkg);
      return;
    }
  } catch (e) {
    logSafe("handleEvent error:", e);
  }
}
