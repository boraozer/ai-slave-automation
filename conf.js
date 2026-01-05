(function(){
  // conf.js: sabit yoldaki automation_config.txt ile DEVICE_KEY + PERSONA override eder.
  // Sabit dosya yolu:
  var FIXED_CONFIG_PATH = "/sdcard/automation_config.txt";
  var EXTERNAL_CONFIG_OK = true;
  var EXTERNAL_CONFIG_CREATED = false;

  // Varsayılanlar
  var Config = {
    DEVICE_KEY: "0ab3ed30-9489-4460-8f49-00e9ce02a8a8",
    SUPABASE_URL: "https://yhlmotkfvirccocdayoi.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobG1vdGtmdmlyY2NvY2RheW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Njg0MzYsImV4cCI6MjA4MTA0NDQzNn0.DJ48Ar05vfC_Gh8GH6r5Dd0AccycoWtPo8wZd2heO1E",
    POLL_INTERVAL_MS: 5000,
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

  // İzinleri iste (ilk açılışta)
  function requestStoragePermissions() {
    try {
      console.log("Dosya erişim izinleri isteniyor...");
      
      // Android 11+ için MANAGE_EXTERNAL_STORAGE
      if (typeof app !== "undefined" && typeof app.requestPermission === "function") {
        app.requestPermission("android.permission.READ_EXTERNAL_STORAGE");
        sleep(500);
        app.requestPermission("android.permission.WRITE_EXTERNAL_STORAGE");
        sleep(500);
        
        // Android 11+
        if (android.os.Build.VERSION.SDK_INT >= 30) {
          try {
            app.requestPermission("android.permission.MANAGE_EXTERNAL_STORAGE");
            sleep(500);
          } catch (e) {}
        }
      }
      
      console.log("İzin isteme tamamlandı");
      return true;
    } catch (e) {
      console.log("İzin isteme hatası:", e);
      return false;
    }
  }

  // Dosya var mı kontrolü (robust)
  function fileExists(path) {
    try {
      if (typeof files !== "undefined" && typeof files.exists === "function") {
        return files.exists(path);
      }
      // Fallback: okumayı dene
      try {
        if (typeof files !== "undefined" && typeof files.read === "function") {
          files.read(path);
          return true;
        }
      } catch (e) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  // Dosya oluştur (güvenli)
  function createConfigFile() {
    try {
      console.log("Konfigürasyon dosyası oluşturuluyor:", FIXED_CONFIG_PATH);
      
      var example = [
        "# AutoJs6 Automation Config",
        "# Bu dosya olmadan uygulama çalışmaz.",
        "# Format: KEY=VALUE",
        "",
        "DEVICE_KEY=",
        "PERSONA=",
        "",
        "# Not: DEVICE_KEY ve PERSONA değerlerini kendi verilerinle değiştirin"
      ].join("\n");

      // Yöntem 1: files.write (AutoJs6 native)
      if (typeof files !== "undefined" && typeof files.write === "function") {
        files.write(FIXED_CONFIG_PATH, example);
        console.log("Dosya başarıyla oluşturuldu:", FIXED_CONFIG_PATH);
        EXTERNAL_CONFIG_CREATED = true;
        return true;
      }

      // Yöntem 2: shell komutu (fallback)
      try {
        shell("echo '" + example.replace(/'/g, "\\'") + "' > " + FIXED_CONFIG_PATH, false);
        console.log("Dosya shell ile oluşturuldu");
        EXTERNAL_CONFIG_CREATED = true;
        return true;
      } catch (e) {}

      // Yöntem 3: Java ile yazma
      try {
        var FileWriter = java.io.FileWriter;
        var fw = new FileWriter(FIXED_CONFIG_PATH);
        fw.write(example);
        fw.close();
        console.log("Dosya Java ile oluşturuldu");
        EXTERNAL_CONFIG_CREATED = true;
        return true;
      } catch (e) {}

      console.log("Dosya oluşturulamadı - izinler kontrol edin");
      EXTERNAL_CONFIG_OK = false;
      return false;

    } catch (e) {
      console.log("Dosya oluşturma hatası:", e);
      EXTERNAL_CONFIG_OK = false;
      return false;
    }
  }

  // Dosya oku
  function readConfigFile() {
    try {
      if (!fileExists(FIXED_CONFIG_PATH)) {
        console.log("Konfigürasyon dosyası bulunamadı");
        return null;
      }

      if (typeof files !== "undefined" && typeof files.read === "function") {
        var raw = files.read(FIXED_CONFIG_PATH);
        console.log("Konfigürasyon dosyası okundu");
        return raw;
      }

      return null;
    } catch (e) {
      console.log("Dosya okuma hatası:", e);
      return null;
    }
  }

  // Ana load fonksiyonu
  function loadExternalConfig() {
    console.log("=== KONFIGÜRASYON YÜKLEME BAŞLADI ===");
    
    // ADIM 1: İzinleri iste
    requestStoragePermissions();
    sleep(1000);

    // ADIM 2: Dosya var mı kontrol et
    if (!fileExists(FIXED_CONFIG_PATH)) {
      console.log("Dosya yok, oluşturuluyor...");
      if (!createConfigFile()) {
        console.log("Dosya oluşturulamadı! Varsayılan değerler kullanılıyor.");
        EXTERNAL_CONFIG_OK = false;
        return;
      }
      sleep(500);
    }

    // ADIM 3: Dosyayı oku ve uygula
    var raw = readConfigFile();
    if (!raw) {
      console.log("Dosya okunamadı!");
      EXTERNAL_CONFIG_OK = false;
      return;
    }

    var trimmed = String(raw).trim();
    if (!trimmed) {
      console.log("Dosya boş!");
      EXTERNAL_CONFIG_OK = false;
      return;
    }

    // JSON mi txt mi kontrol et
    if (trimmed.startsWith("{")) {
      try {
        var obj = JSON.parse(trimmed);
        applyOverrides(obj);
        console.log("JSON konfigürasyon yüklendi");
        return;
      } catch (e) {
        console.log("JSON parse hatası, txt olarak devam et");
      }
    }

    // TXT parse et
    var kv = parseTxt(trimmed);
    var obj = {
      DEVICE_KEY: kv.DEVICE_KEY || kv.device_key || kv.deviceKey || kv.devicekey,
      PERSONA: kv.PERSONA || kv.persona || kv.Persona
    };
    applyOverrides(obj);
    console.log("TXT konfigürasyon yüklendi");
    console.log("DEVICE_KEY:", Config.DEVICE_KEY);
    console.log("PERSONA:", Config.PERSONA);
    console.log("=== KONFIGÜRASYON BAŞARILI ===");
  }

  loadExternalConfig();

  module.exports = {
    Config: Config,
    FIXED_CONFIG_PATH: FIXED_CONFIG_PATH,
    EXTERNAL_CONFIG_OK: EXTERNAL_CONFIG_OK,
    EXTERNAL_CONFIG_CREATED: EXTERNAL_CONFIG_CREATED
  };
})();