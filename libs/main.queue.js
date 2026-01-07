/**
 * ============================================================================
 * OKUNMAMIŞ MESAJ QUEUE SİSTEMİ (AutoJS6) - v9.0 SIMPLE
 * ============================================================================
 * 
 * SimpleBadgeFinder ile basitleştirilmiş versiyon
 */

var SimpleBadgeFinder = require("./improved_badge_finder.js").SimpleBadgeFinder;
var guard = require("./guard.js").guard;
(function() {
    "use strict";
    
    var UnreadQueue = {
        VERSION: "9.0.0-simple",
        DEBUG: true,
        
        device: {
            width: 0,
            height: 0,
            density: 0,
            model: "",
            initialized: false,
            visibleTop: 0,
            visibleBottom: 0,
            swipeStartY: 0,
            swipeEndY: 0,
            swipeUpStartY: 0,
            swipeUpEndY: 0,
            centerX: 0
        },
        
        config: {
            APP_PACKAGE: "com.fiya.android",
            BASE_DELAY: 150,
            SCROLL_DELAY: 200,
            SWIPE_DURATION: 180,
            FIND_TIMEOUT: 500,
            MAX_ATTEMPTS: 25,
            MAX_SCROLL_TO_TOP: 10,
            PROCESSED_USER_EXPIRY: 1000 * 9,
            MAX_PROCESSED_USERS: 150,
            MAX_RETRIES: 3,
            RETRY_DELAY: 200
        },

        state: {
            isActive: false,
            isWaiting: false,
            attemptCount: 0,
            scrollSteps: 0,
            totalFoundCount: 0,
            errorCount: 0,
            lastError: null,
            loopCount: 0,
            pendingScrollToTop: false,
            pendingScrollReason: null,
        },

        processedUsers: {},
        badgeFinder: null,

        handlers: {
            onFound: null,
            onMaxAttempts: null,
            onError: null
        },

        _log: function(msg) {
            if (this.DEBUG) {
                try {
                    console.log("[UQ] " + msg);
                } catch(e) {}
            }
        },
        
        _logError: function(msg, err) {
            var errorMsg = msg + (err ? ": " + String(err) : "");
            console.error("[UQ ERROR] " + errorMsg);
            this.state.lastError = errorMsg;
            this.state.errorCount++;
        },

        _initDevice: function() {
            if (this.device.initialized) return true;
            
            try {
                this.device.width = device.width || 720;
                this.device.height = device.height || 1280;
                this.device.density = device.density || 2;
                this.device.model = device.model || "unknown";
                this.device.centerX = Math.floor(this.device.width / 2);
                
                sleep(300);
                
                this._calibrateVisibleArea();
                this._calibrateSwipe();
                this._calibrateTiming();
                
                this.device.initialized = true;
                
                this._log("📱 Cihaz: " + this.device.model);
                this._log("   Ekran: " + this.device.width + "x" + this.device.height);
                this._log("   Görünür: Y " + this.device.visibleTop + "-" + this.device.visibleBottom);
                
                return true;
                
            } catch (e) {
                this._logError("Cihaz init hatası", e);
                
                this.device.width = 720;
                this.device.height = 1280;
                this.device.centerX = 360;
                this.device.visibleTop = 250;
                this.device.visibleBottom = 1350;
                this.device.swipeStartY = 900;
                this.device.swipeEndY = 350;
                this.device.initialized = true;
                
                return true;
            }
        },

        _calibrateVisibleArea: function() {
            try {
                var recycler =
                    id(this.config.APP_PACKAGE + ":id/id_recycler_view").findOne(600) ||
                    id("id_recycler_view").findOne(600);

                if (recycler) {
                    var bounds = recycler.bounds();
                    this.device.visibleTop = bounds.top + 10;
                    this.device.visibleBottom = bounds.bottom - 10;
                    this._log("   RecyclerView: " + bounds.top + "-" + bounds.bottom);
                    return;
                }
            } catch (e) {}

            this.device.visibleTop = Math.floor(this.device.height * 0.18);
            this.device.visibleBottom = Math.floor(this.device.height * 0.97);
            this._log("   RecyclerView bulunamadı, oran kullanıldı");
        },

        _calibrateSwipe: function() {
            var visibleHeight = this.device.visibleBottom - this.device.visibleTop;
            
            this.device.swipeStartY = this.device.visibleTop + Math.floor(visibleHeight * 0.75);
            this.device.swipeEndY = this.device.visibleTop + Math.floor(visibleHeight * 0.20);
            this.device.swipeUpStartY = this.device.visibleTop + Math.floor(visibleHeight * 0.25);
            this.device.swipeUpEndY = this.device.visibleTop + Math.floor(visibleHeight * 0.80);
        },

        _calibrateTiming: function() {
            var density = this.device.density;
            
            if (density <= 1.5) {
                this.config.BASE_DELAY = 250;
                this.config.SCROLL_DELAY = 350;
                this.config.SWIPE_DURATION = 280;
                this._log("   Düşük performans modu");
            } else if (density >= 3) {
                this.config.BASE_DELAY = 100;
                this.config.SCROLL_DELAY = 150;
                this.config.SWIPE_DURATION = 150;
                this._log("   Yüksek performans modu");
            }
        },

        _isAppForeground: function() {
            // Yöntem 1: UI elementleri (en güvenilir)
            try {
                if (id(this.config.APP_PACKAGE + ":id/id_recycler_view").exists()) {
                    return true;
                }
                if (id(this.config.APP_PACKAGE + ":id/id_conv_tab_all").exists()) {
                    return true;
                }
                if (text("Hepsi").exists() && text("Mesajlar").exists()) {
                    return true;
                }
            } catch (e) {}
            
            // Yöntem 2: Package kontrolü (fallback)
            try {
                var pkg = currentPackage();
                if (pkg && pkg.indexOf("fiya") !== -1) {
                    return true;
                }
            } catch (e) {}
            
            // Yöntem 3: Activity kontrolü (son çare)
            try {
                var act = currentActivity();
                if (act && act.indexOf("fiya") !== -1) {
                    return true;
                }
            } catch (e) {}
            
            return false;
        },

        _ensureOnMessagesPage: function() {
            try {
                var convTab = id(this.config.APP_PACKAGE + ":id/id_main_bottomtab_conv")
                    .findOne(500);
                
                if (!convTab) {
                    convTab = id("id_main_bottomtab_conv").findOne(500);
                }

                if (convTab) {
                    var isSelected = false;
                    try { isSelected = convTab.selected(); } catch(e) {}
                    
                    if (!isSelected) {
                        this._log("   → Mesajlar sekmesine tıklanıyor");
                        convTab.click();
                        sleep(300);
                    }
                }
            } catch(e) {
                this._log("   ⚠️ Mesajlar sayfası kontrolü hatası: " + e);
            }
        },

        _handlePopups: function() {
            // Popup handling
            return false;
        },

        _isUserProcessed: function(userName) {
            if (!userName) return false;
            
            var entry = this.processedUsers[userName];
            if (!entry) return false;
            
            var now = Date.now();
            if (now - entry.timestamp > this.config.PROCESSED_USER_EXPIRY) {
                delete this.processedUsers[userName];
                return false;
            }
            
            return true;
        },

        _markUserProcessed: function(userName) {
            if (!userName) return;
            
            this.processedUsers[userName] = {
                timestamp: Date.now()
            };
            
            var keys = Object.keys(this.processedUsers);
            if (keys.length > this.config.MAX_PROCESSED_USERS) {
                var sorted = keys.map(function(k) {
                    return { key: k, time: this.processedUsers[k].timestamp };
                }.bind(this));
                
                sorted.sort(function(a, b) { return a.time - b.time; });
                
                for (var i = 0; i < 50; i++) {
                    delete this.processedUsers[sorted[i].key];
                }
            }
        },

        _scrollDown: function() {
            try {
                var x = this.device.centerX;
                var y1 = this.device.swipeStartY;
                var y2 = this.device.swipeEndY;
                
                swipe(x, y1, x, y2, this.config.SWIPE_DURATION);
                this.state.scrollSteps++;
                
                sleep(this.config.SCROLL_DELAY);
                
            } catch (e) {
                this._logError("scrollDown hatası", e);
            }
        },

        _scrollToTop: function() {
            this._log("⬆️ Liste başına gidiliyor...");
            
            try {
                var W = this.device.width;
                var H = this.device.height;
                
                var x = Math.floor(W * 0.5);
                var y1 = Math.floor(H * 0.35);
                var y2 = Math.floor(H * 0.80);
                
                for (var i = 0; i < this.config.MAX_SCROLL_TO_TOP; i++) {
                    try {
                        if (text("Bildirimler").exists()) {
                            this._log("✅ Başa ulaşıldı! (Bildirimler görünür)");
                            sleep(this.config.BASE_DELAY);
                            return true;
                        }
                    } catch (e) {}
                    
                    for (var j = 0; j < 3; j++) {
                        swipe(x, y1, x, y2, 150);
                        sleep(100);
                    }
                    
                    sleep(100);
                }
                
                this._log("⚠️ Max scroll tamamlandı");
                return false;
                
            } catch (e) {
                this._logError("scrollToTop hatası", e);
                return false;
            }
        },

        _findUnreadMessage: function() {
            try {
                if (!this.badgeFinder) {
                    this.badgeFinder = Object.create(SimpleBadgeFinder);
                    this.badgeFinder.config.APP_PACKAGE = this.config.APP_PACKAGE;
                    this.badgeFinder.DEBUG = this.DEBUG;
                }

                var result = this.badgeFinder.findUnreadMessage(this.processedUsers);
                
                if (result.found) {
                    this._log("✅ Badge bulundu: " + result.userName + " (" + result.unreadCount + ")");
                    return result;
                } else {
                    this._log("   ℹ️ Badge bulunamadı: " + result.reason);
                    return result;
                }
                
            } catch(e) {
                this._logError("_findUnreadMessage hatası", e);
                return { found: false, reason: "error", error: String(e) };
            }
        },

        _openChat: function(result) {
            if (!result || !result.found) {
                return false;
            }

            try {
                if (this.badgeFinder) {
                    return this.badgeFinder.openChat(result);
                }
            } catch(e) {
                this._logError("_openChat hatası", e);
            }

            return false;
        },

        _loop: function() {
            var self = this;
            
            if (!self.state.isActive) {
                return;
            }
            
            if (self.state.isWaiting) {
                self._log("⏸️ Handler bekleniyor...");
                return;
            }
            
            self.state.loopCount++;
            
            try {
                // 1. Cihaz kalibrasyonu
                self._initDevice();
                
                // 2. Popup kontrolü
                if (self._handlePopups()) {
                    setTimeout(function() { self._loop(); }, self.config.BASE_DELAY);
                    return;
                }
                
                // 3. App kontrolü
                if (!self._isAppForeground()) {
                    self._log("⏳ App aktif değil, bekleniyor...");
                    setTimeout(function() { self._loop(); }, 1000);
                    return;
                }
                guard();
                // 4. Mesajlar sayfası kontrolü
                self._ensureOnMessagesPage();
                
                // 5. Max attempts kontrolü
                if (self.state.attemptCount >= self.config.MAX_ATTEMPTS) {
                    self._log("🔄 Max attempts, başa dönülüyor...");
                    self._scrollToTop();
                    self.state.attemptCount = 0;
                    self.state.scrollSteps = 0;
                    
                    if (self.handlers.onMaxAttempts) {
                        try { self.handlers.onMaxAttempts(); } catch(e) {}
                    }
                    
                    setTimeout(function() { self._loop(); }, self.config.BASE_DELAY);
                    return;
                }
                
                // 6. Okunmamış mesaj ara
                self.state.attemptCount++;
                self._log("\n📍 [" + self.state.attemptCount + "/" + self.config.MAX_ATTEMPTS + "] Loop #" + self.state.loopCount);
                
                var result = self._findUnreadMessage();
                
                if (result.found) {
                    // ✅ BULUNDU
                    self._log("✅ BULUNDU: " + result.userName + " (" + result.unreadCount + ")");
                    
                    var opened = self._openChat(result);
                    
                    if (opened) {
                        // Mark user processed - KALDIRILDI
                        // Handler içinde kontrol edilecek
                        self.state.totalFoundCount++;
                        self.state.isWaiting = true;
                        
                        if (self.handlers.onFound) {
                            try {
                                self.handlers.onFound(result);
                            } catch (handlerErr) {
                                self._logError("onFound handler hatası", handlerErr);
                                self.state.isWaiting = false;
                                setTimeout(function() { self._loop(); }, self.config.BASE_DELAY);
                            }
                        } else {
                            self.state.isWaiting = false;
                            setTimeout(function() { self._loop(); }, self.config.BASE_DELAY);
                        }
                    } else {
                        self._log("   ⚠️ Chat açılamadı, scroll yapılıyor");
                        self._scrollDown();
                        setTimeout(function() { self._loop(); }, 50);
                    }
                    
                } else {
                    // ⚠️ Bulunamadı, scroll yap
                    self._log("   ↓ Scroll down...");
                    self._scrollDown();
                    setTimeout(function() { self._loop(); }, 50);
                }
                
            } catch (loopErr) {
                self._logError("Loop hatası", loopErr);
                setTimeout(function() { self._loop(); }, 500);
            }
        },

        // ─────────────────────────────────────────────────────────
        // PUBLIC API
        // ─────────────────────────────────────────────────────────
        init: function(opts) {
            opts = opts || {};
            
            this._log("\n" + "=".repeat(50));
            this._log("📦 UnreadQueue " + this.VERSION);
            this._log("=".repeat(50));
            
            if (opts.onFound) this.handlers.onFound = opts.onFound;
            if (opts.onMaxAttempts) this.handlers.onMaxAttempts = opts.onMaxAttempts;
            if (opts.onError) this.handlers.onError = opts.onError;
            
            if (opts.maxAttempts) this.config.MAX_ATTEMPTS = opts.maxAttempts;
            if (opts.processedUserExpiry) this.config.PROCESSED_USER_EXPIRY = opts.processedUserExpiry;
            if (typeof opts.debug !== "undefined") this.DEBUG = opts.debug;
            
            this.state.isActive = false;
            this.state.isWaiting = false;
            this.state.attemptCount = 0;
            this.state.scrollSteps = 0;
            this.state.loopCount = 0;
            this.state.errorCount = 0;
            
            this.device.initialized = false;
            this.badgeFinder = null;
            
            return this;
        },

        start: function() {
            if (this.state.isActive) {
                this._log("⚠️ Zaten çalışıyor");
                return this;
            }
            
            this._log("\n🚀 START");
            this.state.isActive = true;
            this.state.attemptCount = 0;
            this.state.scrollSteps = 0;
            
            var self = this;
            setTimeout(function() { self._loop(); }, 100);
            
            return this;
        },

        stop: function() {
            this._log("🛑 STOP");
            this.state.isActive = false;
            this.state.isWaiting = false;
            return this;
        },

        pause: function() {
            this._log("⏸️ PAUSE");
            this.state.isWaiting = true;
            return this;
        },

        resume: function() {
            this._log("▶️ RESUME");
            this.state.isWaiting = false;
            
            if (this.state.isActive) {
                var self = this;
                setTimeout(function() { self._loop(); }, 100);
            }
            return this;
        },

        continueAfterHandler: function() {
            if (!this.state.isWaiting) {
                this._log("⚠️ Zaten beklemiyor");
                return false;
            }
            
            this._log("🔄 Continue after handler");
            this.state.isWaiting = false;
            
            if (this.state.isActive) {
                var self = this;
                setTimeout(function() { self._loop(); }, this.config.BASE_DELAY);
            }
            
            return true;
        },

        requestScrollToTop: function(reason) {
            this.state.pendingScrollToTop = true;
            this.state.pendingScrollReason = reason || "external";
            return true;
        },

        recalibrate: function() {
            this._log("🔧 Yeniden kalibrasyon...");
            this.device.initialized = false;
            this._initDevice();
            return this;
        },

        getStatus: function() {
            return {
                version: this.VERSION,
                isActive: this.state.isActive,
                isWaiting: this.state.isWaiting,
                attemptCount: this.state.attemptCount,
                scrollSteps: this.state.scrollSteps,
                totalFound: this.state.totalFoundCount,
                loopCount: this.state.loopCount,
                errorCount: this.state.errorCount,
                lastError: this.state.lastError,
                processedUsers: Object.keys(this.processedUsers).length,
                device: {
                    model: this.device.model,
                    screen: this.device.width + "x" + this.device.height,
                    visibleArea: this.device.visibleTop + "-" + this.device.visibleBottom
                }
            };
        }
    };

    module.exports = { UnreadQueue: UnreadQueue };
})();