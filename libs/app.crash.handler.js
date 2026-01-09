/**
 * app.crash.handler.simple.js
 * Basit crash handler - Sadece crash dialog'ları yakalar ve uygulamayı restart eder
 */

(function() {
    
    const SimpleCrashHandler = (function() {
        
        var isMonitoring = false;
        var monitorThread = null;
        var foregroundCheckThread = null; // YENİ: Ayrı foreground kontrol thread'i
        var targetPackage = null;
        var checkInterval = 5000; // 5 saniyede bir crash kontrolü
        var foregroundCheckInterval = 20000; // 20 saniyede bir foreground kontrolü
        var onCrashCallback = null;
        
        /**
         * Uygulama process'i çalışıyor mu? (arka planda bile olsa)
         */
        function isAppProcessRunning() {
            try {
                // Package manager'dan kontrol et
                var context = android.app.Activity.currentActivity();
                var am = context.getSystemService(android.content.Context.ACTIVITY_SERVICE);
                var processes = am.getRunningAppProcesses();
                
                for (var i = 0; i < processes.size(); i++) {
                    var process = processes.get(i);
                    if (process.processName === targetPackage) {
                        return true;
                    }
                }
                return false;
            } catch (e) {
                // Fallback: currentPackage kontrolü
                try {
                    var pkg = currentPackage();
                    return pkg === targetPackage;
                } catch (e2) {
                    return false;
                }
            }
        }
        
        /**
         * Uygulama ön planda mı? (En güvenilir kontrol)
         * mResumedActivity mantığı: Package + Activity kontrolü
         */
        function isAppForeground() {
            try {
                var pkg = currentPackage();
                var activity = currentActivity();
                
                // Önce package kontrolü (hızlı)
                if (pkg !== targetPackage) {
                    return false; // Kesin foreground değil
                }
                
                // Package doğru, şimdi activity kontrolü
                // Activity null veya boş olabilir mi kontrol et
                if (!activity || activity.length < 5) {
                    return false; // Activity bilgisi yok
                }
                
                // Activity yapısı: com.voicemaker.main.MainActivity
                // veya tam path: com.fiya.android/com.voicemaker.main.MainActivity
                
                // voicemaker içeriyorsa kesin fiya uygulaması
                if (activity.indexOf("voicemaker") !== -1) {
                    return true;
                }
                
                // com.fiya.android içeriyorsa kesin bizim app
                if (activity.indexOf(targetPackage) !== -1) {
                    return true;
                }
                
                // Package doğru ama activity tanınamadı
                // Güvenli tarafta kal: TRUE döndür (package zaten doğru)
                console.log("⚠️ Activity tanınamadı ama package doğru:", activity);
                return true;
                
            } catch (e) {
                console.log("isAppForeground hatası:", e);
                return false;
            }
        }
        
        /**
         * Crash/ANR dialog var mı kontrol et
         * Çoklu dil desteği
         */
        function hasCrashDialog() {
            try {
                // Tüm diller için crash kelimeleri
                var crashKeywords = [
                    // Türkçe
                    "yanıt vermiyor", "yanit vermiyor", "durduruldu", "durdu", 
                    "kapandı", "kapandi", "çalışmıyor", "calısmiyor",
                    // İngilizce
                    "isn't responding", "not responding", "has stopped", 
                    "stopped working", "keeps stopping", "unfortunately",
                    "app has stopped", "crashed",
                    // Diğer diller
                    "maalesef", "ne répond pas", "reagiert nicht", 
                    "не отвечает", "応答していません"
                ];
                
                // Her kelimeyi kontrol et
                for (var i = 0; i < crashKeywords.length; i++) {
                    var keyword = crashKeywords[i];
                    
                    // Text ve desc'de ara (case-insensitive)
                    if (textMatches(new RegExp(keyword, "i")).exists()) {
                        console.log("🚨 Crash dialog bulundu (text):", keyword);
                        return true;
                    }
                    
                    if (descMatches(new RegExp(keyword, "i")).exists()) {
                        console.log("🚨 Crash dialog bulundu (desc):", keyword);
                        return true;
                    }
                }
                
                return false;
                
            } catch (e) {
                console.log("Crash kontrol hatası:", e);
                return false;
            }
        }
        
        /**
         * Crash dialog'daki Tamam/OK butonuna bas
         * Çoklu dil desteği
         */
        function clickOkButton() {
            try {
                // Tüm diller için buton metinleri
                var buttonTexts = [
                    // Türkçe
                    "Tamam", "TAMAM", "tamam",
                    "Kapat", "KAPAT", "kapat",
                    // İngilizce
                    "OK", "Ok", "ok",
                    "Close", "CLOSE", "close",
                    "Got it", "GOT IT",
                    // Diğer diller
                    "OK", "Fermer", "Schließen", "Закрыть", "閉じる"
                ];
                
                // Her buton metnini dene
                for (var i = 0; i < buttonTexts.length; i++) {
                    var btnText = buttonTexts[i];
                    
                    // Text ile ara
                    var btn = text(btnText).findOne(500);
                    if (btn && btn.clickable()) {
                        console.log("✅ Buton bulundu (text):", btnText);
                        btn.click();
                        sleep(500);
                        return true;
                    }
                    
                    // Desc ile ara
                    btn = desc(btnText).findOne(500);
                    if (btn && btn.clickable()) {
                        console.log("✅ Buton bulundu (desc):", btnText);
                        btn.click();
                        sleep(500);
                        return true;
                    }
                    
                    // ID ile ara (bazı cihazlarda)
                    try {
                        btn = id("android:id/button1").findOne(500); // Pozitif buton
                        if (btn && btn.clickable()) {
                            console.log("✅ Buton bulundu (id): android:id/button1");
                            btn.click();
                            sleep(500);
                            return true;
                        }
                    } catch (e) {}
                }
                
                // Hiçbir buton bulunamadıysa back tuşu dene
                console.log("⬅️ Buton bulunamadı, back tuşu deneniyor");
                back();
                sleep(500);
                return true;
                
            } catch (e) {
                console.log("Buton tıklama hatası:", e);
                return false;
            }
        }
        
        /**
         * Uygulamayı ön plana getir (home() KULLANMADAN)
         */
        function bringToForeground() {
            try {
                console.log("📱 Uygulama ön plana getiriliyor:", targetPackage);
                
                // Yöntem 1: launch()
                launch(targetPackage);
                sleep(1500);
                
                if (isAppForeground()) {
                    console.log("✅ Ön planda (launch)");
                    return true;
                }
                
                // Yöntem 2: app.launchPackage()
                try {
                    app.launchPackage(targetPackage);
                    sleep(1500);
                    
                    if (isAppForeground()) {
                        console.log("✅ Ön planda (launchPackage)");
                        return true;
                    }
                } catch (e) {}
                
                // Yöntem 3: Intent ile
                try {
                    var pm = context.getPackageManager();
                    var intent = pm.getLaunchIntentForPackage(targetPackage);
                    if (intent) {
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                        context.startActivity(intent);
                        sleep(1500);
                        
                        if (isAppForeground()) {
                            console.log("✅ Ön planda (Intent)");
                            return true;
                        }
                    }
                } catch (e) {}
                
                console.log("⚠️ Ön plana getirme kısmen başarılı");
                return false;
                
            } catch (e) {
                console.log("❌ Ön plana getirme hatası:", e);
                return false;
            }
        }
        
        /**
         * Uygulamayı restart et ve 1 dakika boyunca foreground kontrolü yap
         * Crash sonrası çağrılır
         */
        function restartApp() {
            try {
                console.log("🔄 Uygulama restart ediliyor:", targetPackage);
                
                // Yöntem 1: launch()
                launch(targetPackage);
                sleep(2500);
                
                // Restart sonrası 1 dakika boyunca foreground kontrolü
                console.log("⏱️ 1 dakika boyunca foreground kontrolü başlıyor...");
                var startTime = Date.now();
                var maxWaitTime = 60000; // 1 dakika
                var checkCount = 0;
                
                while (Date.now() - startTime < maxWaitTime) {
                    checkCount++;
                    
                    // Foreground'da mı kontrol et
                    if (isAppForeground()) {
                        console.log("✅ Uygulama ön planda (" + checkCount + ". kontrol, " + Math.round((Date.now() - startTime) / 1000) + "sn sonra)");
                        sleep(3000); // 3 saniye bekle ve tekrar kontrol et
                        continue;
                    }
                    
                    // Foreground'da değil - tekrar başlat
                    console.log("⚠️ Uygulama ön planda değil (" + checkCount + ". kontrol), tekrar başlatılıyor...");
                    
                    // Yöntem 2: app.launchPackage()
                    try {
                        app.launchPackage(targetPackage);
                        sleep(2000);
                    } catch (e) {}
                    
                    // Hala başarısız - Yöntem 3: Intent
                    if (!isAppForeground()) {
                        try {
                            var pm = context.getPackageManager();
                            var intent = pm.getLaunchIntentForPackage(targetPackage);
                            if (intent) {
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                context.startActivity(intent);
                                sleep(2000);
                            }
                        } catch (e) {}
                    }
                    
                    sleep(3000); // 3 saniye bekle
                }
                
                // 1 dakika sonunda final kontrol
                if (isAppForeground()) {
                    console.log("✅ Restart başarılı - 1 dakikalık kontrol tamamlandı");
                    return true;
                } else {
                    console.log("⚠️ 1 dakikalık kontrol tamamlandı ama uygulama foreground'da değil");
                    return false;
                }
                
            } catch (e) {
                console.log("❌ Restart hatası:", e);
                return false;
            }
        }
        
        /**
         * Foreground monitoring loop (20 saniyede bir)
         * Sadece ön planda mı kontrol eder, crash sonrası değil
         */
        function foregroundMonitorLoop() {
            console.log("👁️ Foreground monitoring başladı (20sn aralıkla)");
            
            while (isMonitoring) {
                try {
                    sleep(foregroundCheckInterval);
                    
                    // Foreground'da mı kontrol et
                    if (!isAppForeground()) {
                        console.log("📱 Uygulama foreground'da değil, ön plana getiriliyor...");
                        
                        // Callback varsa çağır
                        if (onCrashCallback) {
                            try {
                                onCrashCallback({
                                    type: "not_foreground",
                                    package: targetPackage,
                                    timestamp: Date.now()
                                });
                            } catch (e) {}
                        }
                        
                        // Ön plana getir
                        bringToForeground();
                    } else {
                        console.log("✅ Foreground check: OK");
                    }
                    
                } catch (e) {
                    console.log("Foreground monitor loop hatası:", e);
                    sleep(foregroundCheckInterval);
                }
            }
            
            console.log("👁️ Foreground monitoring durduruldu");
        }
        
        /**
         * Ana crash monitoring loop (5 saniyede bir)
         * SADECE crash dialog kontrolü yapar
         */
        function monitorLoop() {
            console.log("👁️ Crash monitoring başladı:", targetPackage);
            console.log("⏱️ Crash kontrol aralığı:", checkInterval + "ms");
            console.log("ℹ️ Sadece crash dialog'ları kontrol ediliyor");
            
            while (isMonitoring) {
                try {
                    // SADECE crash dialog kontrolü
                    if (hasCrashDialog()) {
                        console.log("🚨 Crash dialog tespit edildi!");
                        
                        // Callback varsa çağır
                        if (onCrashCallback) {
                            try {
                                onCrashCallback({
                                    type: "crash_dialog",
                                    package: targetPackage,
                                    timestamp: Date.now()
                                });
                            } catch (e) {}
                        }
                        
                        // OK butonuna bas
                        clickOkButton();
                        sleep(1000);
                        
                        // Uygulamayı restart et (1 dakikalık foreground kontrolü ile)
                        restartApp();
                    }
                    
                    // Bekleme
                    sleep(checkInterval);
                    
                } catch (e) {
                    console.log("Monitor loop hatası:", e);
                    sleep(checkInterval);
                }
            }
            
            console.log("👁️ Crash monitoring durduruldu");
        }
        
        /**
         * Monitoring'i başlat
         */
        function start(pkg, interval, callback) {
            if (isMonitoring) {
                console.log("⚠️ Monitoring zaten çalışıyor");
                return;
            }
            
            targetPackage = pkg;
            checkInterval = interval || 5000;
            onCrashCallback = callback || null;
            isMonitoring = true;
            
            // Thread 1: Crash monitoring (5 saniyede bir)
            monitorThread = threads.start(function() {
                monitorLoop();
            });
            
            // Thread 2: Foreground monitoring (20 saniyede bir)
            foregroundCheckThread = threads.start(function() {
                foregroundMonitorLoop();
            });
            
            console.log("✅ SimpleCrashHandler başlatıldı");
            console.log("🔍 Crash check: 5 saniyede bir");
            console.log("👁️ Foreground check: 20 saniyede bir");
        }
        
        /**
         * Monitoring'i durdur
         */
        function stop() {
            isMonitoring = false;
            
            if (monitorThread) {
                try {
                    monitorThread.interrupt();
                    monitorThread = null;
                } catch (e) {}
            }
            
            if (foregroundCheckThread) {
                try {
                    foregroundCheckThread.interrupt();
                    foregroundCheckThread = null;
                } catch (e) {}
            }
            
            console.log("🛑 SimpleCrashHandler durduruldu");
        }
        
        /**
         * Manuel restart
         */
        function forceRestart() {
            return restartApp();
        }
        
        return {
            start: start,
            stop: stop,
            forceRestart: forceRestart
        };
        
    })();
    
    module.exports = SimpleCrashHandler;
    
    })();