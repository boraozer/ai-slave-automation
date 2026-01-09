(function(){
  // conf.js: Persistent storage kullanarak config yönetimi (APK silse bile kalır)
  
  // YEDEK: Dosya yolu hala export edilir (backward compatibility)
  var appInternalPath = files.cwd();
  var FIXED_CONFIG_PATH = files.join(appInternalPath, "automation_config.txt");
  
  var EXTERNAL_CONFIG_OK = true;
  var EXTERNAL_CONFIG_CREATED = false;

  // Varsayılanlar
  var Config = {
    DEVICE_KEY: "",
    SUPABASE_URL: "https://yhlmotkfvirccocdayoi.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobG1vdGtmdmlyY2NvY2RheW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Njg0MzYsImV4cCI6MjA4MTA0NDQzNn0.DJ48Ar05vfC_Gh8GH6r5Dd0AccycoWtPo8wZd2heO1E",
    POLL_INTERVAL_MS: 5000,
    CHAT_API_URL: "https://ai-automation-dating-fc36a06297a1.herokuapp.com/chat",
    CHAT_API_TOKEN: "TOKEN",
    PERSONA: 'yeliz'
  };

  // Persistent storage (APK silse bile kalır!)
  var STORAGE_NAME = "automation_persistent_config";
  var storage = null;

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

  // Dosya var mı kontrolü (backward compatibility)
  function fileExists(path) {
    try {
      if (typeof files !== "undefined" && typeof files.exists === "function") {
        return files.exists(path);
      }
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

  // Dosya oluştur (backward compatibility - artık kullanılmıyor)
  function createConfigFile() {
    console.log("Persistent storage kullanıldığı için dosya oluşturulmayacak");
    EXTERNAL_CONFIG_CREATED = true;
    return true;
  }

  // Dosya oku (backward compatibility)
  function readConfigFile() {
    try {
      if (!fileExists(FIXED_CONFIG_PATH)) {
        return null;
      }
      if (typeof files !== "undefined" && typeof files.read === "function") {
        return files.read(FIXED_CONFIG_PATH);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // YENİ: Persistent Storage Fonksiyonları
  // ============================================
  
  /**
   * Storage'ı başlat
   */
  function initStorage() {
    try {
      storage = storages.create(STORAGE_NAME);
      console.log("✅ Persistent storage başlatıldı");
      return true;
    } catch (e) {
      console.log("❌ Storage başlatılamadı:", e);
      return false;
    }
  }
  
  /**
   * Storage'dan config yükle
   */
  function loadFromStorage() {
    if (!storage) return false;
    
    try {
      var deviceKey = storage.get("DEVICE_KEY");
      var persona = storage.get("PERSONA");
      
      if (deviceKey) Config.DEVICE_KEY = deviceKey;
      if (persona) Config.PERSONA = persona;
      
      console.log("✅ Config storage'dan yüklendi");
      return !!(deviceKey || persona);
    } catch (e) {
      console.log("❌ Storage okuma hatası:", e);
      return false;
    }
  }
  
  /**
   * Config'i storage'a kaydet (dışarıdan çağrılabilir)
   */
  function saveToStorage(deviceKey, persona) {
    if (!storage) {
      console.log("❌ Storage başlatılmamış");
      return false;
    }
    
    try {
      if (deviceKey) {
        storage.put("DEVICE_KEY", deviceKey);
        Config.DEVICE_KEY = deviceKey;
      }
      if (persona) {
        storage.put("PERSONA", persona);
        Config.PERSONA = persona;
      }
      console.log("✅ Config storage'a kaydedildi");
      return true;
    } catch (e) {
      console.log("❌ Storage yazma hatası:", e);
      return false;
    }
  }

  // Ana load fonksiyonu - HEM storage HEM dosya kontrol eder
  function loadExternalConfig() {
    console.log("=== KONFİGÜRASYON YÜKLEME BAŞLADI ===");
    
    // ADIM 1: Persistent storage'ı başlat
    var storageOk = initStorage();
    
    // ADIM 2: Storage'dan yükle (öncelik 1)
    if (storageOk && loadFromStorage()) {
      console.log("📦 Storage'dan yüklendi - DEVICE_KEY:", Config.DEVICE_KEY, "PERSONA:", Config.PERSONA);
      EXTERNAL_CONFIG_OK = true;
      console.log("=== KONFİGÜRASYON BAŞARILI (STORAGE) ===");
      return;
    }
    
    // ADIM 3: Dosyadan yükle (fallback - backward compatibility)
    console.log("ℹ️ Storage'da config yok, dosyadan deneniyor...");
    
    if (!fileExists(FIXED_CONFIG_PATH)) {
      console.log("Dosya yok, oluşturuluyor...");
      if (!createConfigFile()) {
        console.log("Dosya oluşturulamadı! Varsayılan değerler kullanılıyor.");
        EXTERNAL_CONFIG_OK = false;
        return;
      }
    }

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
        
        // Dosyadan yüklendiyse storage'a da kaydet
        if (storageOk) {
          saveToStorage(Config.DEVICE_KEY, Config.PERSONA);
        }
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
    
    // Dosyadan yüklendiyse storage'a da kaydet
    if (storageOk) {
      saveToStorage(Config.DEVICE_KEY, Config.PERSONA);
    }
    
    console.log("TXT konfigürasyon yüklendi");
    console.log("DEVICE_KEY:", Config.DEVICE_KEY);
    console.log("PERSONA:", Config.PERSONA);
    console.log("=== KONFİGÜRASYON BAŞARILI (DOSYA) ===");
  }

  loadExternalConfig();

  // ============================================
  // EXPORT - AYNI YAPI KORUNDU!
  // ============================================
  module.exports = {
    Config: Config,
    FIXED_CONFIG_PATH: FIXED_CONFIG_PATH,
    EXTERNAL_CONFIG_OK: EXTERNAL_CONFIG_OK,
    EXTERNAL_CONFIG_CREATED: EXTERNAL_CONFIG_CREATED,
    // YENİ: Storage kaydetme fonksiyonu (UI'den çağrılabilir)
    saveConfig: saveToStorage
  };
})();