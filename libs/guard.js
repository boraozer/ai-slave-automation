/**
 * Kontrol dizisini sırayla çalıştır (Senkron)
 */
function runSafetyChecks(checks) {
    for (let i = 0; i < checks.length; i++) {
        const { check, fix } = checks[i];
        
        try {
            if (!check()) {
                console.log(`Kontrol ${i + 1} başarısız, düzeltiliyor...`);
                fix();
                
                // Tekrar kontrol
                if (!check()) {
                    throw new Error(`Kontrol ${i + 1} düzeltilemedi!`);
                }
                console.log(`Kontrol ${i + 1} düzeltildi ✓`);
            } else {
                console.log(`Kontrol ${i + 1} geçti ✓`);
            }
        } catch (e) {
            console.error(`Kontrol ${i + 1} hatası: ${e.message}`);
        }
    }
    console.log("Tüm kontroller başarılı!");
}

// ============================================
// KULLANIM
// ============================================

const safetyChecks = [
    {
        check: () => {
            return id("com.fiya.android:id/tv_main_msg").exists();
        },
        fix: () => {
            console.log("Ana sayfa dışında, geri dönülüyor...");
            back();
            sleep(1000);
        }
    },
    {
        check: () => {
            return !className("android.webkit.WebView").exists();
        },
        fix: () => {
            console.log("WebView tespit edildi, geri dönülüyor...");
            back();
            sleep(1500);
        }
    }
];

module.exports = {
    guard: () => {
        return runSafetyChecks(safetyChecks);
    }
};