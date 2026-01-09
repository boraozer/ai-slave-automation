/**
 * app.health.monitor.js
 * Gelişmiş uygulama sağlık izleme - ANR, freeze, crash detection
 */

(function() {
    
    const AppHealthMonitor = (function() {
        
        var isMonitoring = false;
        var monitorThread = null;
        var targetPackage = null;
        var config = {
            checkInterval: 3000,          // Kontrol aralığı (ms)
            maxIdleTime: 30000,           // 30 saniye hiç activity yoksa restart
            maxSameScreenTime: 120000,    // 2 dakika aynı ekranda kalırsa restart
            autoRestart: true,            // Otomatik restart
            clearCacheOnRestart: false    // Restart'ta cache temizle
        };
        
        var lastActivityTime = Date.now();
        var lastScreenHash = null;
        var sameScreenStartTime = Date.now();
        var crashCount = 0;
        var restartCount = 0;
        
        var onEventCallback = null;
        
        /**
         * Ekranın hash'ini hesaplar (basit)
         */
        function getScreenHash() {
            try {
                var pkg = currentPackage();
                var activity = currentActivity();
                return pkg + ":" + activity;
            } catch (e) {
                return null;
            }
        }
        
        /**
         * Crash/ANR dialog kontrolü
         */
        function checkCrashDialogs() {
            try {
                var crashKeywords = [
                    "yanıt vermiyor", "isn't responding", "not responding",
                    "durduruldu", "has stopped", "stopped working",
                    "keeps stopping", "unfortunately", "maalesef"
                ];
                
                for (var i = 0; i < crashKeywords.length; i++) {
                    if (textMatches(new RegExp(crashKeywords[i], "i")).exists()) {
                        return true;
                    }
                }
                
                return false;
            } catch (e) {
                return false;
            }
        }
        
        /**
         * Crash dialog'unu kapat
         */
        function closeCrashDialog() {
            try {
                var buttons = ["Tamam", "OK", "Close", "Kapat", "Got it"];
                
                for (var i = 0; i < buttons.length; i++) {
                    var btn = text(buttons[i]).findOne(1000);
                    if (btn) {
                        btn.click();
                        sleep(500);
                        return true;
                    }
                    
                    btn = desc(buttons[i]).findOne(1000);
                    if (btn) {
                        btn.click();
                        sleep(500);
                        return true;
                    }
                }
                
                back();
                sleep(500);
                return true;
            } catch (e) {
                return false;
            }
        }
        
        /**
         * Activity kontrolü - ekranda bir değişiklik var mı?
         */
        function checkActivity() {
            try {
                var currentHash = getScreenHash();
                
                if (!currentHash) {
                    return false;
                }
                
                // Ekran değişti mi?
                if (currentHash !== lastScreenHash) {
                    console.log("🔄 Ekran değişti:", currentHash);
                    lastActivityTime = Date.now();
                    sameScreenStartTime = Date.now();
                    lastScreenHash = currentHash;
                    return true;
                }
                
                // Aynı ekran ne kadar süredir?
                var sameScreenDuration = Date.now() - sameScreenStartTime;
                
                if (sameScreenDuration > config.maxSameScreenTime) {
                    console.log("⚠️ Aynı ekranda çok uzun süre:", Math.round(sameScreenDuration / 1000) + "s");
                    return false;
                }
                
                return true;
            } catch (e) {
                return true; // Hata durumunda sorun yok kabul et
            }
        }
        
        /**
         * Uygulamayı yeniden başlat (ROOT GEREKMİYOR)
         */
        function restartApp() {
            try {
                console.log("🔄 Uygulama restart ediliyor:", targetPackage);
                restartCount++;
                
                if (onEventCallback) {
                    onEventCallback({
                        type: "restart",
                        package: targetPackage,
                        restartCount: restartCount,
                        crashCount: crashCount,
                        timestamp: Date.now()
                    });
                }
                
                // 1) Uygulamayı kapat - app.openAppSetting() ile kullanıcı kapatabilir
                //    VEYA basitçe başka bir app aç sonra tekrar dön
                console.log("🔄 Uygulama yeniden başlatılıyor");
                
                // 2) Ana ekrana git (uygulamayı arka plana atar)
                home();
                sleep(1000);
                
                // 3) Cache temizle sadece clearCacheOnRestart=true ve ROOT varsa
                // Root yoksa atlıyoruz
                
                // 4) Uygulamayı başlat - launch() root gerektirmez
                console.log("🚀 Başlatılıyor:", targetPackage);
                launch(targetPackage);
                sleep(3000);
                
                // 5) Kesin ön plana getir (root gerektirmeyen yöntemler)
                var maxAttempts = 3;
                for (var i = 0; i < maxAttempts; i++) {
                    var currentPkg = currentPackage();
                    if (currentPkg === targetPackage) {
                        console.log("✅ Uygulama ön planda:", currentPkg);
                        break;
                    }
                    
                    console.log("⚠️ Uygulama ön planda değil (deneme " + (i + 1) + "/" + maxAttempts + ")");
                    
                    // Yöntem 1: launch() tekrar dene (root gerektirmez)
                    launch(targetPackage);
                    sleep(2000);
                    
                    // Yöntem 2: app.launchPackage (root gerektirmez)
                    if (currentPackage() !== targetPackage) {
                        try {
                            app.launchPackage(targetPackage);
                            sleep(2000);
                        } catch (e) {
                            console.log("app.launchPackage hatası:", e);
                        }
                    }
                    
                    // Yöntem 3: Intent ile (root gerektirmez)
                    if (currentPackage() !== targetPackage) {
                        try {
                            var intent = context.getPackageManager().getLaunchIntentForPackage(targetPackage);
                            if (intent) {
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                                context.startActivity(intent);
                                sleep(2000);
                            }
                        } catch (e) {
                            console.log("Intent launch hatası:", e);
                        }
                    }
                }
                
                // 6) Final kontrol
                var finalPkg = currentPackage();
                if (finalPkg !== targetPackage) {
                    console.log("⚠️ UYARI: Uygulama ön plana getirilemedi! Mevcut:", finalPkg);
                } else {
                    console.log("✅ Restart başarılı - Uygulama ön planda");
                }
                
                // State'i sıfırla
                lastActivityTime = Date.now();
                sameScreenStartTime = Date.now();
                lastScreenHash = null;
                
                console.log("✅ Restart tamamlandı (Toplam restart:", restartCount + ")");
                return true;
                
            } catch (e) {
                console.log("Restart hatası:", e);
                return false;
            }
        }
        
        /**
         * Ana monitoring loop
         */
        function monitorLoop() {
            console.log("👁️ Health monitoring başladı:", targetPackage);
            console.log("⚙️ Config:", JSON.stringify(config));
            
            while (isMonitoring) {
                try {
                    var now = Date.now();
                    var needsRestart = false;
                    var restartReason = "";
                    
                    // 1) Crash dialog kontrolü
                    if (checkCrashDialogs()) {
                        console.log("🚨 Crash dialog tespit edildi");
                        crashCount++;
                        closeCrashDialog();
                        sleep(500);
                        needsRestart = true;
                        restartReason = "crash_dialog";
                        
                        if (onEventCallback) {
                            onEventCallback({
                                type: "crash",
                                package: targetPackage,
                                crashCount: crashCount,
                                timestamp: now
                            });
                        }
                    }
                    
                    // 2) Uygulama çalışıyor mu ve ön planda mı? (ROOT GEREKMİYOR)
                    var currentPkg = currentPackage();
                    if (currentPkg !== targetPackage) {
                        console.log("⚠️ Uygulama ön planda değil, mevcut:", currentPkg);
                        console.log("🔄 Ön plana getiriliyor:", targetPackage);
                        
                        // Yöntem 1: launch() - root gerektirmez
                        launch(targetPackage);
                        sleep(2000);
                        
                        // Yöntem 2: app.launchPackage - root gerektirmez
                        if (currentPackage() !== targetPackage) {
                            console.log("⚠️ launch() yeterli olmadı, app.launchPackage deneniyor");
                            try {
                                app.launchPackage(targetPackage);
                                sleep(1500);
                            } catch (e) {
                                console.log("app.launchPackage hatası:", e);
                            }
                        }
                        
                        // Yöntem 3: Intent ile - root gerektirmez
                        if (currentPackage() !== targetPackage) {
                            console.log("⚠️ app.launchPackage da yeterli olmadı, Intent deneniyor");
                            try {
                                var intent = context.getPackageManager().getLaunchIntentForPackage(targetPackage);
                                if (intent) {
                                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                                    context.startActivity(intent);
                                    sleep(1500);
                                }
                            } catch (e) {
                                console.log("Intent launch hatası:", e);
                            }
                        }
                        
                        lastActivityTime = now;
                        sameScreenStartTime = now;
                        lastScreenHash = null;
                    }
                    
                    // 3) Activity kontrolü
                    checkActivity();
                    
                    // 4) Idle time kontrolü
                    var idleTime = now - lastActivityTime;
                    if (idleTime > config.maxIdleTime) {
                        console.log("⚠️ Çok uzun süre idle:", Math.round(idleTime / 1000) + "s");
                        needsRestart = true;
                        restartReason = "idle_timeout";
                    }
                    
                    // 5) Same screen kontrolü
                    var sameScreenTime = now - sameScreenStartTime;
                    if (sameScreenTime > config.maxSameScreenTime) {
                        console.log("⚠️ Aynı ekranda çok uzun süre:", Math.round(sameScreenTime / 1000) + "s");
                        needsRestart = true;
                        restartReason = "same_screen_timeout";
                    }
                    
                    // Restart gerekiyorsa
                    if (needsRestart && config.autoRestart) {
                        console.log("🔧 Restart sebebi:", restartReason);
                        restartApp();
                    }
                    
                    sleep(config.checkInterval);
                    
                } catch (e) {
                    console.log("Monitor loop hatası:", e);
                    sleep(config.checkInterval);
                }
            }
            
            console.log("👁️ Health monitoring durduruldu");
        }
        
        /**
         * Activity kaydı - dış modüllerden çağrılabilir
         */
        function recordActivity() {
            lastActivityTime = Date.now();
        }
        
        /**
         * Monitoring'i başlat
         */
        function start(pkg, userConfig, callback) {
            if (isMonitoring) {
                console.log("⚠️ Monitoring zaten çalışıyor");
                return;
            }
            
            targetPackage = pkg;
            onEventCallback = callback || null;
            
            // Config'i merge et
            if (userConfig) {
                for (var key in userConfig) {
                    if (userConfig.hasOwnProperty(key)) {
                        config[key] = userConfig[key];
                    }
                }
            }
            
            isMonitoring = true;
            lastActivityTime = Date.now();
            sameScreenStartTime = Date.now();
            lastScreenHash = null;
            
            monitorThread = threads.start(function() {
                monitorLoop();
            });
            
            console.log("✅ AppHealthMonitor başlatıldı");
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
            
            console.log("🛑 AppHealthMonitor durduruldu");
            console.log("📊 İstatistikler - Restart:", restartCount, "Crash:", crashCount);
        }
        
        /**
         * Manuel restart
         */
        function forceRestart() {
            return restartApp();
        }
        
        /**
         * Stats
         */
        function getStats() {
            return {
                restartCount: restartCount,
                crashCount: crashCount,
                lastActivityTime: lastActivityTime,
                currentIdleTime: Date.now() - lastActivityTime,
                isMonitoring: isMonitoring
            };
        }
        
        return {
            start: start,
            stop: stop,
            recordActivity: recordActivity,
            forceRestart: forceRestart,
            getStats: getStats
        };
        
    })();
    
    module.exports = AppHealthMonitor;
    
    })();