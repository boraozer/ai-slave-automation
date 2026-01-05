/**
 * ============================================================================
 * OKUNMAMIŞ MESAJ QUEUE SİSTEMİ (AutoJS6) - v4
 * ============================================================================
 * 
 * Görevler:
 * 1. Okunmamış mesaj tespit et → handler çağır
 * 2. Max N deneme sonra liste başına dön
 * 3. App arkaplandaysa skip et, ön plana gelince devam et
 * 4. Her cihazda stabil çalış (swipe, koordinatlar)
 * 5. Handler bitince biz devam ettiririz
 */

(function() {
    var UnreadQueue = {
        // ─────────────────────────────────────────────────────────
        // AYARLAR
        // ─────────────────────────────────────────────────────────
        
        config: {
            APP_PACKAGE: "com.fiya.android",
            MAX_ATTEMPTS: 25,           // Liste kaç kez dolaşılır
            SCROLL_DELAY: 400,         // Her scroll sonrası ms (artırıldı)
            SWIPE_DURATION: 200,        // Swipe süresi ms (artırıldı)
            SWIPE_X: 360,               // Sabit X koordinat
            SWIPE_Y_START: 800,         // Aşağı scroll start (artırıldı)
            SWIPE_Y_END: 200,           // Aşağı scroll end (artırıldı)
            SWIPE_TOP_START: 200,       // Yukarı scroll start (artırıldı)
            SWIPE_TOP_END: 800,         // Yukarı scroll end (artırıldı)
            APP_CHECK_INTERVAL: 250,    // App kontrol aralığı (ms)
        },

        // ─────────────────────────────────────────────────────────
        // DURUM
        // ─────────────────────────────────────────────────────────
        
        state: {
            isActive: false,            // Queue çalışıyor mu?
            isWaiting: false,           // Handler tamamlanması bekleniyormuş?
            attemptCount: 0,            // Mevcut döngü içinde kaç kez arandı
            totalFoundCount: 0,         // Toplamda kaç mesaj bulundu
            totalAttemptCount: 0,       // Toplamda kaç kez arama yapıldı
            scrollSteps: 0,             // Kaç adım scroll edildi
        },

        handlers: {
            onFound: null,              // Mesaj bulundu
            onMaxAttempts: null,        // Max deneme tamamlandı
        },

        // ─────────────────────────────────────────────────────────
        // İNİTYALİZASYON
        // ─────────────────────────────────────────────────────────

        init: function(opts) {
            opts = opts || {};
            console.log("📦 UnreadQueue init()");
            
            if (opts.onFound) this.handlers.onFound = opts.onFound;
            if (opts.onMaxAttempts) this.handlers.onMaxAttempts = opts.onMaxAttempts;
            if (opts.maxAttempts) this.config.MAX_ATTEMPTS = opts.maxAttempts;

            console.log("   ✅ onFound handler set");
            console.log("   ✅ Max attempts: " + this.config.MAX_ATTEMPTS);
            return this;
        },

        /**
         * Queue'yu başlat
         */
        start: function() {
            console.log("\n" + "=".repeat(60));
            console.log("🚀 UnreadQueue START");
            console.log("=".repeat(60));
            
            this.state.isActive = true;
            this.state.attemptCount = 0;
            this.state.scrollSteps = 0;

            // Senkron çalışma - setTimeout yok!
            this._mainLoopSync();
            
            // Loop tamamlandığında (handler bitti veya max attempts)
            // Otomatik olarak tekrar başlat
            console.log("\n🔄 _mainLoopSync() tamamlandı, tekrar başlatılıyor...");
            this.start();
            
            return this;
        },

        /**
         * Handler tamamlandı, queue devam et
         */
        continueAfterHandler: function() {
            console.log("\n🔄 continueAfterHandler() çağrıldı");
            
            if (!this.state.isWaiting) {
                console.log("⚠️  Queue zaten beklemiyor");
                return false;
            }

            this.state.isWaiting = false;
            console.log("✅ isWaiting = false");
            console.log("   Queue senkron döngüsü devam edecek...\n");

            // Senkron döngü devam edecek, extra çağrı yok
            return true;
        },

        /**
         * Queue durumunu getir
         */
        getStatus: function() {
            return {
                isActive: this.state.isActive,
                isWaiting: this.state.isWaiting,
                attemptCount: this.state.attemptCount,
                totalFoundCount: this.state.totalFoundCount,
                totalAttemptCount: this.state.totalAttemptCount,
                scrollSteps: this.state.scrollSteps,
                maxAttempts: this.config.MAX_ATTEMPTS,
                remaining: this.config.MAX_ATTEMPTS - this.state.totalFoundCount
            };
        },

        // ─────────────────────────────────────────────────────────
        // ANA LOOP (SENKRONİK)
        // ─────────────────────────────────────────────────────────

        _mainLoopSync: function() {
            var self = this;

            console.log("🔄 _mainLoopSync() başladı (Senkron çalışma)");
            console.log("⏳ Başlangıçta 3 saniye bekleme (app stabilizasyonu için)");
            sleep(3000);

            // Ana döngü - Queue aktif olduğu sürece çalış
            while (self.state.isActive) {
                console.log("\n📍 Loop iterasyonu - attemptCount: " + self.state.attemptCount);

                // Handler bekliyor mu?
                if (self.state.isWaiting) {
                    console.log("⏸️  Handler tamamlanması bekleniyor - çık");
                    break;
                }

                // App ön yüzde değil mi?
                if (!self._isAppForeground()) {
                    console.log("⏳ App arkaplanda - 2 saniye bekle");
                    sleep(2000);
                    continue;
                }

                // Max attempts tamamlandı mı?
                if (self.state.attemptCount >= self.config.MAX_ATTEMPTS) {
                    console.log("\n⚠️  Max attempts (" + self.config.MAX_ATTEMPTS + ") tamamlandı");
                    console.log("🔄 Liste başına dönülüyor...");
                    self._scrollToTop();
                    self.state.scrollSteps = 0;
                    self.state.attemptCount = 0;

                    if (self.handlers.onMaxAttempts) {
                        console.log("🔗 onMaxAttempts handler çağrılıyor");
                        try {
                            self.handlers.onMaxAttempts();
                        } catch (e) {
                            console.log("❌ Handler hatası: " + e);
                        }
                    }

                    // Tekrar başlat
                    sleep(1000);
                    continue;
                }

                // Okunmamış mesaj ara
                self.state.attemptCount++;
                console.log("\n📍 [" + self.state.attemptCount + "/" + self.config.MAX_ATTEMPTS + "] Okunmamış mesaj aranıyor...");
                
                var result = self._findUnreadMessage();

                if (result && result.found) {
                    // ✅ BULUNDU!
                    console.log("\n✅ BULUNDU: " + result.userName);
                    console.log("   Okunmamış: " + result.unreadCount);
                    
                    self.state.isWaiting = true;
                    console.log("   isWaiting = true (handler çalışıyor)");
                    console.log("   ⏰ Handler bitince continueAfterHandler() çağır");

                    if (self.handlers.onFound) {
                        console.log("\n🔗 onFound handler çağrılıyor");
                        try {
                            self.handlers.onFound(result);
                        } catch (e) {
                            console.log("❌ Handler hatası: " + e);
                            self.state.isWaiting = false;
                        }
                    }

                    // Handler bekleniyor - çık
                    break;
                } else {
                    // ⚠️ BULUNAMADI
                    console.log("⚠️  Bulunamadı, scroll yapılıyor...");
                    self._scrollDown();
                    sleep(200);
                }
            }

            console.log("\n🏁 _mainLoopSync() tamamlandı");
        },

        // ─────────────────────────────────────────────────────────
        // TARAMA (STABİL)
        // ─────────────────────────────────────────────────────────

        _findUnreadMessage: function() {
            try {
                console.log("🔧 _findUnreadMessage() çağrıldı");

                // App kontrolü
                if (!this._isAppForeground()) {
                    console.log("   ⚠️  App arkaplanda, tarama iptal");
                    return { found: false };
                }

                var nodes = id(this.config.APP_PACKAGE + ":id/id_unread_tcv")
                    .visibleToUser(true)
                    .find();

                console.log("   📋 " + (nodes ? nodes.length : 0) + " okunmamış node bulundu");

                if (!nodes || nodes.length === 0) {
                    return { found: false };
                }

                // İlk okunmamış mesajı bul
                for (var i = 0; i < nodes.length; i++) {
                    try {
                        var node = nodes[i];
                        var text = node.text();
                        var count = parseInt(text, 10);

                        console.log("   [Node " + i + "] text='" + text + "' count=" + count);

                        if (count > 0) {
                            console.log("   ✅ Okunmamış bulundu!");
                            
                            // Kullanıcı adını bul
                            var userName = this._findUserName(node);
                            console.log("   👤 Kullanıcı: " + userName);
                            
                            // Bounds al ve merkezi hesapla
                            var bounds = node.bounds();
                            var clickX = bounds.centerX() - 50;
                            var clickY = bounds.centerY();
                            
                            console.log("   📍 Tıklama koordinatı: (" + clickX + ", " + clickY + ")");
                            
                            // Tıkla
                            try {
                                click(clickX, clickY);
                                console.log("   ✅ Tıklama başarılı");
                                sleep(600);
                            } catch (clickErr) {
                                console.log("   ⚠️  Tıklama hatası: " + clickErr);
                            }

                            return {
                                found: true,
                                userName: userName,
                                unreadCount: count
                            };
                        }
                    } catch (nodeErr) {
                        console.log("   ⚠️  Node " + i + " işleme hatası: " + nodeErr);
                        continue;
                    }
                }

                console.log("   ⚠️  Geçerli okunmamış mesaj bulunamadı");
                return { found: false };

            } catch (e) {
                console.log("   ❌ Tarama hatası: " + e);
                return { found: false };
            }
        },

        _findUserName: function(node) {
            try {
                var current = node;
                for (var i = 0; i < 5 && current; i++) {
                    try {
                        var nameNode = current.findOne(
                            id(this.config.APP_PACKAGE + ":id/id_user_name_tv")
                        );
                        if (nameNode) {
                            var name = nameNode.text();
                            console.log("      Bulundu (depth=" + i + "): " + name);
                            return name;
                        }
                    } catch (e) {}
                    
                    try {
                        current = current.parent();
                    } catch (e) {
                        break;
                    }
                }
            } catch (e) {
                console.log("      Hata: " + e);
            }
            return "Bilinmiyor";
        },

        // ─────────────────────────────────────────────────────────
        // SCROLL İŞLEMLERİ
        // ─────────────────────────────────────────────────────────

        _scrollDown: function() {
            try {
                console.log("🔧 _scrollDown() çağrıldı (LİSTE AŞAĞI İNER)");
                
                // Parmağı YUKARIYA kaydır → liste AŞAĞI iner
                swipe(
                    this.config.SWIPE_X,
                    800,  // AŞAĞIDAN BAŞLA
                    this.config.SWIPE_X,
                    200,  // YUKARIYA KAYDIR
                    this.config.SWIPE_DURATION
                );

                console.log("   ✅ Liste aşağı indi");
                this.state.scrollSteps++;

                sleep(this.config.SCROLL_DELAY);

            } catch (e) {
                console.log("❌ Scroll down hatası: " + e);
            }
        },

        _scrollToTop: function() {
            try {
                console.log("⬆️  En başa gidiliyor...");

                var maxAttempts = 50;
                var W = (typeof device !== "undefined" && device.width) ? device.width : 720;
                var H = (typeof device !== "undefined" && device.height) ? device.height : 1411;
                
                // Swipe parametreleri
                var x = (W * 0.5) | 0;              // Ekran ortası
                var y1 = (H * 0.38) | 0;            // Başlangıç (üst-orta)
                var y2 = (H * 0.82) | 0;            // Bitiş (alt)
                var durationMs = 180;               // Swipe süresi
                var gapMs = 80;                    // Swipe'lar arası bekleme

                for (var i = 0; i < maxAttempts; i++) {
                    // Bildirimler görüldü mü kontrol et
                    try {
                        if (text("Bildirimler").exists()) {
                            console.log("✅ BİLDİRİMLER GÖRÜLDÜ! En başa ulaşıldı!");
                            return;
                        }
                    } catch (e) {}

                    console.log("📍 Deneme " + (i + 1) + ": 5x Agresif swipe yapılıyor...");

                    // 5 kere agresif swipe yap (bir turda)
                    for (var j = 0; j < 5; j++) {
                        swipe(x, y1, x, y2, durationMs);
                        
                        // Son swipe'dan sonra kontrol et
                        if (j === 4) {
                            try {
                                if (text("Bildirimler").exists()) {
                                    console.log("✅ BİLDİRİMLER GÖRÜLDÜ! (swipe sırasında)");
                                    return;
                                }
                            } catch (e) {}
                        }
                        
                        sleep(gapMs);
                    }

                    sleep(100);
                }
                
                try {
                    if (text("Bildirimler").exists()) {
                        console.log("✅ BİLDİRİMLER GÖRÜLDÜ! En başa ulaşıldı!");
                        return;
                    }else{
                        return this._scrollToTop();
                    }
                } catch (e) {}

                console.log("✅ Maksimum deneme tamamlandı");

            } catch (e) {
                console.log("❌ Scroll to top hatası: " + e);
            }
        },

        /**
         * Manuel olarak liste başına dön (istediğimiz zaman)
         */
        scrollToTopManual: function() {
            console.log("\n" + "=".repeat(60));
            console.log("🔥 MANUEL SCROLL TO TOP TETİKLENDİ!");
            console.log("=".repeat(60));
            
            this._scrollToTop();
            this.state.scrollSteps = 0;
            this.state.attemptCount = 0;
            
            console.log("✅ Manuel scroll tamamlandı, sayaçlar sıfırlandı\n");
            return this;
        },

        // ─────────────────────────────────────────────────────────
        // KONTROLLER (STABİL)
        // ─────────────────────────────────────────────────────────

        _isAppForeground: function() {
            try {
                // Yöntem 1: Package kontrolü
                var pkg = currentPackage();
                console.log("   📦 currentPackage(): " + pkg);
                
                var isPkgMatch = (pkg === this.config.APP_PACKAGE || pkg.indexOf("com.fiya") === 0);
                console.log("   ✅ Package match: " + isPkgMatch);

                // Yöntem 2: UI element kontrolü (Mesajlar texti)
                var hasMessagesUI = false;
                try {
                    // Chat ekranında "Mesajlar" text'i ara
                    var messagesText = text("Mesajlar").exists() || 
                                     textContains("Mesajlar").exists();
                    hasMessagesUI = !!messagesText;
                    console.log("   💬 'Mesajlar' UI bulundu: " + hasMessagesUI);
                } catch (e) {
                    console.log("   ⚠️  UI kontrol hatası: " + e);
                }

                // Her iki şartta da true ise ön yüzde
                var isFront = isPkgMatch || hasMessagesUI;
                console.log("   ⭐ Sonuç - Ön yüzde: " + isFront);
                
                return isFront;
            } catch (e) {
                console.log("   ⚠️  _isAppForeground() hatası: " + e);
                return false;
            }
        }
    };

    // ============================================================================
    // EXPORTS
    // ============================================================================

    module.exports = {
        UnreadQueue: UnreadQueue
    };

})();