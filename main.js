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
const sugo = require("./automations/sugo.automation.js");
const { UnreadQueue } = require('./libs/main.queue.js');

// Eski kod uyumluluğu: global logSafe
initGlobalLogger();


const SimpleCrashHandler = require("./libs/app.crash.handler.js");

SimpleCrashHandler.start("com.fiya.android", 5000, function(event) {
  console.log("Event:", event.type); // "crash_dialog" veya "not_foreground"
});

console.log("✅ Crash handler aktif");


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

// ✅ Yeni: onFound son çalışma zamanı (ms)
var lastOnFoundAt = 0;

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

// 4) Queue worker'ı başlat
//QueueWorker.start(deviceId, handleEvent);

toast("Automation client başlatıldı.");



const {ChatMessageHelper} = require("./libs/last.chat.message.js");
UnreadQueue
  .init({
    maxAttempts: 7,
    onFound: function(result) {
      // ✅ Yeni: onFound tetiklendiği zamanı kaydet
      lastOnFoundAt = Date.now();
      // (opsiyonel) diğer modüllerden de görülebilsin
      try { globalThis.__lastOnFoundAt = lastOnFoundAt; } catch(e) {}

      sleep(1500)
      console.log("✅ " + result.userName + " bulundu");
      var lastMsg = ChatMessageHelper.getLastReceivedMessage();
      if(lastMsg == null){
        lastMsg = {isReceived:true, text: 'çok uyumlusunuz'};
      }
      if(!lastMsg.isReceived){
        UnreadQueue.continueAfterHandler();
        return
      }

      const payload = {
        pkg: 'com.fiya.android',
        nickname: result.userName,
        messages : [lastMsg.text]
      }
      console.log(payload)
      sugo.answerMessage(payload);
      UnreadQueue.continueAfterHandler();
    },
    onMaxAttempts: function() {
      console.log("🔄 Liste baştan taranacak");
    }
  })
  .start();

try {
  events.observeNotification();
  events.onNotification(function(n) {
      try {
          var pkg = n.getPackageName();
          // Sadece hedef uygulama
          if (pkg && pkg.indexOf("fiya") !== -1) {
              // ✅ Yeni: sadece son onFound 30sn içindeyse işlem yap
              var now = Date.now();
              var diff = now - (lastOnFoundAt || 0);

              if (diff <= 30 * 1000) {
                  console.log("📩 Bildirim geldi, son onFound " + Math.round(diff/1000) + "sn önce -> işlem yapılıyor...");
                  UnreadQueue.requestScrollToTop("notification");
              } else {
                  console.log("⏭️ Bildirim geldi ama son onFound " + Math.round(diff/1000) + "sn önce -> es geçildi.");
              }
          }
      } catch (e) {
          console.log("Bildirim hatası: " + e);
      }
  });
  console.log("✅ Bildirim dinleyici aktif");
} catch (e) {
  console.log("❌ Bildirim dinleyici başlatılamadı: " + e);
}
