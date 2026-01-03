// Pil tasarrufu muafiyeti isteme (ilk açılışta)

function requestBatteryOptimizationExemption() {
    console.log("Pil tasarrufu muafiyeti isteniyor...");
    
    try {
        // Yöntem 1: Samsung cihazları
        try {
            app.startActivity({
                action: "com.samsung.android.sm_scs.intent.action.OPEN_BIG_DATA_STORAGE",
                packageName: "com.samsung.android.sm",
                flags: 0x10000000
            });
            sleep(2000);
            console.log("Samsung pil ayarları açıldı");
            return true;
        } catch (e) {
            console.log("Samsung yöntemi başarısız:", e);
        }

        // Yöntem 2: Xiaomi/MIUI cihazları
        try {
            app.startActivity({
                action: "android.intent.action.MAIN",
                packageName: "com.miui.powerkeeper",
                className: "com.miui.powerkeeper.ui.HypnosisActivity",
                flags: 0x10000000
            });
            sleep(2000);
            console.log("Xiaomi pil ayarları açıldı");
            return true;
        } catch (e) {
            console.log("Xiaomi yöntemi başarısız:", e);
        }

        // Yöntem 3: Oppo/ColorOS cihazları
        try {
            app.startActivity({
                action: "com.coloros.powermanager.PowerUsageDetail",
                flags: 0x10000000
            });
            sleep(2000);
            console.log("Oppo pil ayarları açıldı");
            return true;
        } catch (e) {
            console.log("Oppo yöntemi başarısız:", e);
        }

        // Yöntem 4: Standart Android - Pil ayarlarına git
        try {
            app.startActivity({
                action: "android.settings.BATTERY_SAVER_SETTINGS",
                flags: 0x10000000
            });
            sleep(2000);
            console.log("Pil tasarrufu ayarları açıldı");
            return true;
        } catch (e) {
            console.log("Pil tasarrufu standart yöntemi başarısız:", e);
        }

        // Yöntem 5: Genel ayarlar
        try {
            app.startActivity({
                action: "android.settings.SETTINGS",
                flags: 0x10000000
            });
            sleep(2000);
            toast("Lütfen Pil veya Enerji ayarlarına gidin ve uygulamayı muaf tutun");
            console.log("Genel ayarlar açıldı");
            return true;
        } catch (e) {
            console.log("Genel ayarlar başarısız:", e);
        }

    } catch (e) {
        console.log("Pil tasarrufu isteme hatası:", e);
        return false;
    }
}

// İlk açılışta izinleri iste
function requestAllPermissionsOnStartup() {
    // Adım 2: Pil tasarrufu muafiyeti
    console.log("Adım 2: Pil tasarrufu muafiyeti");
    requestBatteryOptimizationExemption();
    sleep(3000);
    
    console.log("=== İZİN İSTEME SÜRECİ TAMAMLANDI ===");
}

requestAllPermissionsOnStartup()