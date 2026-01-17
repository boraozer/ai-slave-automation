/**
 * app.crash.handler.lightweight.js
 * Lightweight Crash Handler - Sadece CRASH ve 30 dakika Foreground
 * 
 * Özellikler:
 * 1. SADECE crash dialog tespit eder
 * 2. Foreground kontrol 30 dakikada bir
 * 3. Minimal overhead - çok hızlı
 * 4. isAppForeground() cache sistemi (3sn TTL)
 * 5. Foreground check thread yok - sadece Timer kullanıyor
 */

(function() {
    
    const SimpleCrashHandler = (function() {
        
        var isMonitoring = false;
        var monitorThread = null;
        var foregroundCheckTimer = null;
        var targetPackage = null;
        var checkInterval = 5000;           // Crash check: 5 saniye
        var foregroundCheckInterval = 1800000; // 30 dakika = 1800 saniye
        var onCrashCallback = null;
        
        // OPTIMIZATION: Cache sistemi
        var _foregroundCache = {
            value: true,
            timestamp: 0,
            ttl: 3000 // 3 saniye cache
        };
        
        /**
         * OPTIMIZED: Uygulama ön planda mı? (Cache ile)
         */
        function isAppForeground() {
            var now = Date.now();
            
            // Cache kontrolü - 3 saniye içinde tekrar sorma
            if (now - _foregroundCache.timestamp < _foregroundCache.ttl) {
                return _foregroundCache.value;
            }
            
            try {
                var pkg = currentPackage();
                var activity = currentActivity();
                
                // Package kontrolü
                if (pkg !== targetPackage) {
                    _foregroundCache.value = false;
                    _foregroundCache.timestamp = now;
                    return false;
                }
                
                // Activity kontrolü
                if (!activity || activity.length < 5) {
                    _foregroundCache.value = false;
                    _foregroundCache.timestamp = now;
                    return false;
                }
                
                // Activity doğru ise foreground'da demek
                _foregroundCache.value = true;
                _foregroundCache.timestamp = now;
                return true;
                
            } catch (e) {
                console.log("isAppForeground hatası:", e);
                _foregroundCache.value = false;
                _foregroundCache.timestamp = now;
                return false;
            }
        }
        
        /**
         * Crash/ANR dialog var mı kontrol et
         */
        function hasCrashDialog() {
            try {
                // Türkçe ve İngilizce crash keywords
                var crashKeywords = [
                    "yanıt vermiyor", "yanit vermiyor", "durduruldu", "durdu", 
                    "kapandı", "kapandi", "çalışmıyor", "calısmiyor",
                    "isn't responding", "not responding", "has stopped", 
                    "stopped working", "keeps stopping", "unfortunately",
                    "app has stopped", "crashed"
                ];
                
                for (var i = 0; i < crashKeywords.length; i++) {
                    var keyword = crashKeywords[i];
                    
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
         */
        function clickOkButton() {
            try {
                var buttonTexts = [
                    "Tamam", "TAMAM", "tamam",
                    "Kapat", "KAPAT", "kapat",
                    "OK", "Ok", "ok",
                    "Close", "CLOSE", "close"
                ];
                
                for (var i = 0; i < buttonTexts.length; i++) {
                    var btnText = buttonTexts[i];
                    
                    var btn = text(btnText).findOne(500);
                    if (btn && btn.clickable()) {
                        console.log("✅ Buton bulundu (text):", btnText);
                        btn.click();
                        sleep(500);
                        return true;
                    }
                    
                    btn = desc(btnText).findOne(500);
                    if (btn && btn.clickable()) {
                        console.log("✅ Buton bulundu (desc):", btnText);
                        btn.click();
                        sleep(500);
                        return true;
                    }
                }
                
                // Fallback: ID kontrol
                try {
                    btn = id("android:id/button1").findOne(500);
                    if (btn && btn.clickable()) {
                        console.log("✅ Buton bulundu (id): android:id/button1");
                        btn.click();
                        sleep(500);
                        return true;
                    }
                } catch (e) {}
                
                // Son çare: Back tuşu
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
         * Uygulamayı ön plana getir
         */
        function bringToForeground() {
            try {
                console.log("📱 Uygulama ön plana getiriliyor:", targetPackage);
                
                // Cache'i temizle
                _foregroundCache.timestamp = 0;
                
                // Yöntem 1: launch() (en hızlı)
                try {
                    launch(targetPackage);
                    sleep(1500);
                    
                    if (isAppForeground()) {
                        console.log("✅ Ön planda (launch)");
                        return true;
                    }
                } catch (e) {}
                
                // Yöntem 2: app.launchPackage()
                try {
                    app.launchPackage(targetPackage);
                    sleep(1500);
                    
                    if (isAppForeground()) {
                        console.log("✅ Ön planda (app.launchPackage)");
                        return true;
                    }
                } catch (e) {}
                
                // Yöntem 3: Intent ile başlat
                try {
                    var context = android.app.Activity.currentActivity();
                    var pm = context.getPackageManager();
                    var intent = pm.getLaunchIntentForPackage(targetPackage);
                    if (intent) {
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        context.startActivity(intent);
                        sleep(1500);
                        
                        if (isAppForeground()) {
                            console.log("✅ Ön planda (intent)");
                            return true;
                        }
                    }
                } catch (e) {}
                
                console.log("⚠️ Ön plana getirilemedi");
                return false;
                
            } catch (e) {
                console.log("bringToForeground hatası:", e);
                return false;
            }
        }
        
        /**
         * Uygulamayı restart et (kısa kontrol)
         */
        function restartApp() {
            try {
                console.log("🔄 Uygulama restart ediliyor...");
                
                // Cache'i temizle
                _foregroundCache.timestamp = 0;
                
                bringToForeground();
                
                // 15 saniye bekle
                sleep(15000);
                
                if (isAppForeground()) {
                    console.log("✅ Restart başarılı - uygulama foreground'da");
                    return true;
                } else {
                    console.log("⚠️ Restart sonrası uygulama foreground'da değil");
                    return false;
                }
                
            } catch (e) {
                console.log("❌ Restart hatası:", e);
                return false;
            }
        }
        
        /**
         * OPTIMIZED: Ana crash monitoring loop (5 saniyede bir)
         */
        function monitorLoop() {
            console.log("👁️ Crash monitoring başladı:", targetPackage);
            console.log("🚨 SADECE CRASH DIALOG KONTROL");
            console.log("⏱️ Crash kontrol aralığı: 5 saniye");
            console.log("👁️ Foreground kontrol aralığı: 30 dakika");
            
            while (isMonitoring) {
                try {
                    if (hasCrashDialog()) {
                        console.log("🚨 CRASH DIALOG TESPİT EDİLDİ!");
                        
                        if (onCrashCallback) {
                            try {
                                onCrashCallback({
                                    type: "crash_dialog",
                                    package: targetPackage,
                                    timestamp: Date.now()
                                });
                            } catch (e) {}
                        }
                        
                        clickOkButton();
                        sleep(1000);
                        
                        restartApp();
                    }
                    
                    sleep(checkInterval);
                    
                } catch (e) {
                    console.log("Monitor loop hatası:", e);
                    sleep(checkInterval);
                }
            }
            
            console.log("👁️ Crash monitoring durduruldu");
        }
        
        /**
         * 30 dakikada bir foreground kontrol
         */
        function scheduleForegroundCheck() {
            console.log("⏲️ Foreground kontrol zamanlanıyor (30 dakika sonra)");
            
            foregroundCheckTimer = setInterval(function() {
                try {
                    if (!isMonitoring) {
                        clearInterval(foregroundCheckTimer);
                        return;
                    }
                    
                    console.log("👁️ [30dk Kontrol] Foreground kontrol yapılıyor...");
                    
                    // Cache'i temizle ki gerçek kontrol yapsın
                    _foregroundCache.timestamp = 0;
                    
                    if (!isAppForeground()) {
                        console.log("⚠️ [30dk Kontrol] Uygulama foreground'da değil!");
                        
                        if (onCrashCallback) {
                            try {
                                onCrashCallback({
                                    type: "not_foreground",
                                    package: targetPackage,
                                    timestamp: Date.now(),
                                    period: "30min_check"
                                });
                            } catch (e) {}
                        }
                        
                        bringToForeground();
                    } else {
                        console.log("✅ [30dk Kontrol] Uygulama foreground'da - OK");
                    }
                    
                } catch (e) {
                    console.log("30dk kontrol hatası:", e);
                }
            }, foregroundCheckInterval);
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
            
            // Cache reset
            _foregroundCache = {
                value: true,
                timestamp: 0,
                ttl: 3000
            };
            
            // Thread: Crash monitoring (5 saniyede bir)
            monitorThread = threads.start(function() {
                monitorLoop();
            });
            
            // Timer: Foreground kontrol (30 dakikada bir)
            scheduleForegroundCheck();
            
            console.log("✅ SimpleCrashHandler başlatıldı (Lightweight)");
            console.log("═════════════════════════════════════════");
            console.log("🚨 SADECE CRASH DIALOG KONTROL EDILECEK");
            console.log("⏱️ Crash check: 5 saniyede bir");
            console.log("👁️ Foreground check: 30 dakikada bir");
            console.log("═════════════════════════════════════════");
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
            
            if (foregroundCheckTimer) {
                try {
                    clearInterval(foregroundCheckTimer);
                    foregroundCheckTimer = null;
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
        
        /**
         * Status check
         */
        function getStatus() {
            return {
                isRunning: isMonitoring,
                package: targetPackage,
                checkInterval: checkInterval + "ms",
                foregroundCheckInterval: foregroundCheckInterval + "ms (30 min)",
                isForeground: isAppForeground()
            };
        }
        
        return {
            start: start,
            stop: stop,
            forceRestart: forceRestart,
            getStatus: getStatus
        };
        
    })();
    
    module.exports = SimpleCrashHandler;
    
})();