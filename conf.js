(function(){
  // conf.js: sabit yoldaki automation_config.txt ile DEVICE_KEY + PERSONA override eder.
  // Sabit dosya yolu:
  var FIXED_CONFIG_PATH = "/sdcard/automation_config.txt";
  var EXTERNAL_CONFIG_OK = true;
  var EXTERNAL_CONFIG_CREATED = false;


  // Varsayılanlar (APK tüm cihazlara aynı gider; cihaz bazlı değerler dosyadan gelir)
  var Config = {
    // Her cihaz için MANUEL gireceğin anahtar (automation_devices.device_key ile eşleşecek)
     DEVICE_KEY: "0ab3ed30-9489-4460-8f49-00e9ce02a8a8", // id 5

     // Supabase projen
     SUPABASE_URL: "https://yhlmotkfvirccocdayoi.supabase.co", // <-- kendi projene göre
     SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobG1vdGtmdmlyY2NvY2RheW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Njg0MzYsImV4cCI6MjA4MTA0NDQzNn0.DJ48Ar05vfC_Gh8GH6r5Dd0AccycoWtPo8wZd2heO1E", // <-- kendi anon key

     // Queue poll aralığı
     POLL_INTERVAL_MS: 5000, // 10 sn
     CHAT_API_URL: "https://ai-automation-dating-fc36a06297a1.herokuapp.com/chat",
     CHAT_API_TOKEN: "TOKEN",
     PERSONA: 'yeliz'
  };

  function stripQuotes(s) {
    if (typeof s !== "string") return s;
    s = s.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function applyOverrides(obj) {
    if (!obj) return;
    // case-insensitive anahtarlar
    var dk = obj.device_key || obj.deviceKey || obj.DEVICE_KEY || obj.devicekey;
    var p  = obj.persona || obj.PERSONA || obj.Persona;
    if (dk != null && String(dk).trim()) Config.DEVICE_KEY = stripQuotes(String(dk));
    if (p  != null && String(p).trim())  Config.PERSONA = stripQuotes(String(p));
  }

  function parseTxt(raw) {
    var out = {};
    if (!raw) return out;
    var lines = String(raw).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = String(lines[i] || "").trim();
      if (!line) continue;
      if (line.startsWith("#") || line.startsWith("//")) continue;

      var idx = line.indexOf("=");
      if (idx < 0) idx = line.indexOf(":");
      if (idx < 0) continue;

      var k = line.slice(0, idx).trim();
      var v = line.slice(idx + 1).trim();
      if (!k) continue;
      out[k] = stripQuotes(v);
    }
    return out;
  }

  function loadExternalConfig() {
    try {
      if (typeof files === "undefined") return;
if (!files.exists(FIXED_CONFIG_PATH)) {
  EXTERNAL_CONFIG_OK = false;
  // Örnek dosya oluştur (varsa üzerine yazma)
  try {
    var example = [
      "# AutoJs6 Automation Config",
      "# Bu dosya olmadan uygulama çalışmaz.",
      "# Format: KEY=VALUE",
      "DEVICE_KEY=PUT_DEVICE_KEY_HERE",
      "PERSONA=default"
    ].join("\n");
    files.write(FIXED_CONFIG_PATH, example);
    EXTERNAL_CONFIG_CREATED = true;
  } catch (e2) {
    // Yazma başarısız olabilir (izin yok vs.)
  }
  return;
}

      var raw = files.read(FIXED_CONFIG_PATH);
      if (!raw) return;

      var trimmed = String(raw).trim();
      if (!trimmed) return;

      // JSON destekle (isterseniz txt yerine json koyabilirsiniz)
      if (trimmed.startsWith("{")) {
        try {
          var obj = JSON.parse(trimmed);
          applyOverrides(obj);
          return;
        } catch (e) {
          // JSON parse olmadıysa txt gibi devam
        }
      }

      var kv = parseTxt(trimmed);
      // anahtarları normalize et
      var obj = {
        DEVICE_KEY: kv.DEVICE_KEY || kv.device_key || kv.deviceKey || kv.devicekey,
        PERSONA: kv.PERSONA || kv.persona || kv.Persona
      };
      applyOverrides(obj);
    } catch (e) {
      // Dosya okunamadıysa sessizce defaultlara düş.
    }
  }

  loadExternalConfig();

  module.exports = {
    Config: Config,
    FIXED_CONFIG_PATH: FIXED_CONFIG_PATH,
    EXTERNAL_CONFIG_OK: EXTERNAL_CONFIG_OK,
    EXTERNAL_CONFIG_CREATED: EXTERNAL_CONFIG_CREATED
  };
})();
