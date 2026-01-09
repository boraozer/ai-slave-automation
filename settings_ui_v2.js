"ui";

// conf.js'i import et (aynı yapı korundu!)
var confModule = require('./conf.js');
var Config = confModule.Config;
var FIXED_CONFIG_PATH = confModule.FIXED_CONFIG_PATH;
var saveConfig = confModule.saveConfig; // YENİ: Storage'a kaydetme fonksiyonu

// UI Layout
ui.layout(
    <vertical padding="16">
        <text text="Otomasyon Ayarları" textSize="24sp" textColor="#000000" marginBottom="20" gravity="center"/>
        
        <card cardElevation="2dp" cardCornerRadius="8dp" marginBottom="16">
            <vertical padding="16">
                <text text="Cihaz Bilgileri" textSize="18sp" textColor="#333333" marginBottom="12"/>
                
                <text text="Cihaz ID:" textSize="14sp" textColor="#666666"/>
                <input id="deviceId" hint="Backend'den aldığınız ID" marginBottom="12"/>
                
                <text text="Persona:" textSize="14sp" textColor="#666666"/>
                <input id="persona" hint="Persona bilgisi" marginBottom="12"/>
                
                <button id="saveBtn" text="Kaydet" 
                    style="Widget.AppCompat.Button.Colored" 
                    w="*"/>
            </vertical>
        </card>
        
        <card cardElevation="2dp" cardCornerRadius="8dp" marginBottom="16">
            <vertical padding="16">
                <text text="Otomasyon Kontrolü" textSize="18sp" textColor="#333333" marginBottom="12"/>
                
                <horizontal>
                    <button id="startBtn" text="Başlat" 
                        style="Widget.AppCompat.Button.Colored" 
                        w="*" layout_weight="1" marginRight="8"/>
                    <button id="stopBtn" text="Durdur" 
                        bg="#ff5252" textColor="#ffffff"
                        w="*" layout_weight="1"/>
                </horizontal>
            </vertical>
        </card>
        
        <card cardElevation="2dp" cardCornerRadius="8dp" marginBottom="16">
            <vertical padding="16">
                <text text="Mevcut Ayarlar" textSize="18sp" textColor="#333333" marginBottom="12"/>
                <text id="currentSettings" text="Yükleniyor..." textSize="14sp" textColor="#666666"/>
            </vertical>
        </card>
        
        <card cardElevation="2dp" cardCornerRadius="8dp">
            <vertical padding="16">
                <text text="Durum:" textSize="14sp" textColor="#666666" marginBottom="8"/>
                <text id="statusText" text="Hazır" textSize="16sp" textColor="#4CAF50"/>
            </vertical>
        </card>
        
        <text text="💾 Ayarlar kalıcı olarak kaydedilir" 
              textSize="12sp" textColor="#999999" marginTop="16" gravity="center"/>
    </vertical>
);

var isRunning = false;
var automationThread = null;

// Mevcut ayarları göster
function loadAndDisplaySettings() {
    try {
        var deviceKey = Config.DEVICE_KEY || "";
        var persona = Config.PERSONA || "";
        
        ui.deviceId.setText(deviceKey);
        ui.persona.setText(persona);
        
        var settingsText = "Cihaz ID: " + (deviceKey || "(boş)") + "\nPersona: " + (persona || "(boş)");
        ui.currentSettings.setText(settingsText);
        
        console.log("✅ Ayarlar gösteriliyor:", settingsText);
        
    } catch (e) {
        console.log("❌ Ayarlar gösterilemedi:", e);
        ui.currentSettings.setText("Ayarlar yüklenemedi");
    }
}

// Sayfa yüklendiğinde ayarları yükle
ui.post(() => {
    console.log("📱 UI yüklendi");
    loadAndDisplaySettings();
    
    if (Config.DEVICE_KEY && Config.PERSONA) {
        ui.statusText.setText("Ayarlar mevcut - Hazır");
        ui.statusText.setTextColor(colors.parseColor("#4CAF50"));
    } else {
        ui.statusText.setText("Ayarlar girilmedi");
        ui.statusText.setTextColor(colors.parseColor("#FF9800"));
    }
});

// Kaydet butonu
ui.saveBtn.click(() => {
    var deviceId = ui.deviceId.text().trim();
    var persona = ui.persona.text().trim();
    
    if (!deviceId) {
        dialogs.alert("Hata", "Cihaz ID boş olamaz!");
        return;
    }
    
    if (!persona) {
        dialogs.alert("Hata", "Persona boş olamaz!");
        return;
    }
    
    // Persistent storage'a kaydet (conf.js'deki saveConfig fonksiyonu)
    if (saveConfig && saveConfig(deviceId, persona)) {
        toast("✓ Kaydedildi!");
        ui.statusText.setText("Bilgiler kaydedildi - Hazır");
        ui.statusText.setTextColor(colors.parseColor("#4CAF50"));
        
        // Config nesnesini manuel güncelle (export edilen referans)
        Config.DEVICE_KEY = deviceId;
        Config.PERSONA = persona;
        
        loadAndDisplaySettings();
    } else {
        dialogs.alert("Hata", "Kaydetme başarısız!\n\nLütfen uygulamayı yeniden başlatın.");
    }
});

// Başlat butonu - Orijinal main.js'i çalıştır
ui.startBtn.click(() => {
    try {
        if (!Config.DEVICE_KEY || !Config.PERSONA) {
            dialogs.alert("Hata", "Önce cihaz bilgilerini kaydedin!");
            return;
        }
        
        if (isRunning) {
            toast("Otomasyon zaten çalışıyor!");
            return;
        }
        
        isRunning = true;
        ui.statusText.setText("Çalışıyor...");
        ui.statusText.setTextColor(colors.parseColor("#FF9800"));
        toast("Otomasyon başlatıldı");
        
        // Orijinal main.js'i ayrı thread'de çalıştır
        automationThread = threads.start(function() {
            try {
                console.log("🚀 main.js başlatılıyor...");
                console.log("📊 Config: DEVICE_KEY=" + Config.DEVICE_KEY + ", PERSONA=" + Config.PERSONA);
                
                // main.js'i engines API ile çalıştır
                engines.execScriptFile("./main.js");
                
            } catch (e) {
                console.log("❌ main.js çalıştırma hatası:", e);
                ui.post(() => {
                    dialogs.alert("Hata", "Otomasyon başlatılamadı: " + e);
                    ui.statusText.setText("Hata: " + e);
                    ui.statusText.setTextColor(colors.parseColor("#f44336"));
                });
                isRunning = false;
            }
        });
        
    } catch (e) {
        dialogs.alert("Hata", "Başlatma hatası: " + e);
        isRunning = false;
    }
});

// Durdur butonu
ui.stopBtn.click(() => {
    if (!isRunning) {
        toast("Otomasyon zaten durmuş durumda!");
        return;
    }
    
    console.log("🛑 Otomasyon durduruluyor...");
    
    isRunning = false;
    
    // Thread'i interrupt et
    if (automationThread) {
        try {
            console.log("🧵 Automation thread durduruluyor...");
            automationThread.interrupt();
            automationThread = null;
        } catch (e) {
            console.log("Thread interrupt hatası:", e);
        }
    }
    
    // Tüm engine'leri durdur
    try {
        engines.stopAll();
        console.log("🛑 Tüm engine'ler durduruldu");
    } catch (e) {
        console.log("Engine durdurma hatası:", e);
    }
    
    ui.statusText.setText("Durduruldu");
    ui.statusText.setTextColor(colors.parseColor("#f44336"));
    toast("✓ Otomasyon durduruldu");
    console.log("✅ Otomasyon durduruldu");
});

// Uygulama kapanırken
events.on("exit", function() {
    console.log("🚪 Uygulama kapanıyor, temizlik yapılıyor...");
    
    isRunning = false;
    
    if (automationThread) {
        try {
            automationThread.interrupt();
            automationThread = null;
        } catch (e) {}
    }
    
    try {
        engines.stopAll();
    } catch (e) {}
    
    console.log("✅ Temizlik tamamlandı");
});