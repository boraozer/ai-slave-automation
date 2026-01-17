/**
 * ============================================================================
 * SPEED-OPTIMIZED BADGE FINDER - Android 13+ Hız İyileştirmesi v2
 * ============================================================================
 * 
 * Ek Optimizasyonlar:
 * 1. Selector cache - tekrarlanan query'ler azaltıldı
 * 2. Try-catch bloklarının sayısı azaltıldı
 * 3. String operasyonları optimize edildi
 * 4. Regex compile sayısı minimize edildi
 * 5. Bounds hesaplamaları sadece gerektiğinde yapılıyor
 * 6. Badge arama algoritması optimize edildi
 */

(function() {
    "use strict";

    var SimpleBadgeFinder = {
        VERSION: "1.0.2-optimized",
        DEBUG: true,

        config: {
            APP_PACKAGE: "com.fiya.android"
        },

        // Cache layer
        _cache: {
            numericRegex: /^\d+\+?$/,
            lastNameNodes: null,
            lastNameNodesTime: 0
        },

        _log: function(msg) {
            if (this.DEBUG) {
                try {
                    console.log("[SBF] " + msg);
                } catch(e) {}
            }
        },

        _isNumericBadge: function(text) {
            // String length kontrolü - hızlı fail
            if (!text || typeof text !== "string" || text.length === 0) return false;
            if (text.length > 10) return false; // Badge'ler kısa olur
            
            return this._cache.numericRegex.test(text);
        },

        /**
         * OPTIMIZED: Bounds overlap check - Math hesaplamaları minimize
         */
        _boundsContainPoint: function(bounds, cx, cy) {
            return cx >= bounds.left && cx <= bounds.right && 
                   cy >= bounds.top && cy <= bounds.bottom;
        },

        /**
         * OPTIMIZED: Parent bulma - single try-catch
         */
        _findChatItemFromNameNode: function(nameNode, pkg) {
            if (!nameNode) return null;

            var targetId = pkg + ":id/ll_chat_item";
            var n = nameNode;

            // Method 1: Parent chain - loop ön kontrol
            for (var k = 0; k < 10 && n; k++) {
                try {
                    var nid = typeof n.id === "function" ? n.id() : null;
                    if (nid === targetId) return n;
                    n = n.parent();
                } catch (e) {
                    n = null;
                }
            }

            // Method 2: Bounds overlap - early return
            try {
                var b = nameNode.bounds();
                var cx = b.centerX(), cy = b.centerY();
                
                var items = className("android.view.ViewGroup")
                    .id(targetId)
                    .visibleToUser(true)
                    .find();
                
                var itemsLength = items.length;
                for (var i = 0; i < itemsLength; i++) {
                    var item = items[i];
                    var ib = item.bounds();
                    
                    if (this._boundsContainPoint(ib, cx, cy)) {
                        return item;
                    }
                }
            } catch (e) {}

            return null;
        },

        /**
         * OPTIMIZED: Badge bulma - traverse optimize
         */
        _findBadgeInChatItem: function(chatItem, userName) {
            if (!chatItem) return null;

            var self = this;
            var badges = [];
            var userNameAsString = String(userName).trim();
            var isUserNameNumeric = self._isNumericBadge(userNameAsString);

            // Recursive traverse
            function traverse(node, depth) {
                if (!node || depth > 8 || badges.length >= 2) return;

                try {
                    if (node.className && node.className() === "android.widget.TextView") {
                        var text = "";
                        
                        try { 
                            var t = node.text();
                            if (t != null) text = String(t).trim();
                        } catch(e) {}

                        if (self._isNumericBadge(text)) {
                            // Username eşleşme skip
                            if (userNameAsString && text === userNameAsString && isUserNameNumeric) {
                                return;
                            }

                            try {
                                var bounds = node.bounds();
                                badges.push({
                                    node: node,
                                    text: text,
                                    bounds: bounds,
                                    left: bounds.left
                                });
                            } catch(e) {}
                        }
                    }

                    // Children traverse - limit
                    try {
                        var childCount = node.childCount();
                        var maxChildren = Math.min(childCount, 10);
                        
                        for (var i = 0; i < maxChildren && badges.length < 2; i++) {
                            try {
                                var child = node.child(i);
                                if (child) traverse(child, depth + 1);
                            } catch(e) {}
                        }
                    } catch(e) {}
                } catch(e) {}
            }

            traverse(chatItem, 0);

            if (badges.length > 0) {
                // Sort - sağdaki badge'i al (normalde notification badge sağda olur)
                badges.sort(function(a, b) { return b.left - a.left; });
                return badges[0];
            }

            return null;
        },

        /**
         * OPTIMIZED: Excluded check - inline string checks
         */
        _isExcludedParent: function(node) {
            if (!node) return false;

            var current = node;
            var depth = 0;
            var excludedPatterns = [
                "id_group_msg_count",
                "fl_header_group",
                "family",
                "id_sugo_team",
                "fl_header_sugo",
                "fl_header_notification"
            ];

            while (current && depth < 10) {
                try {
                    var id = "";
                    if (current.id) {
                        try { id = current.id(); } catch(e) {}
                    }

                    if (id && id.length > 0) {
                        for (var j = 0; j < excludedPatterns.length; j++) {
                            if (id.indexOf(excludedPatterns[j]) !== -1) {
                                return true;
                            }
                        }
                    }

                    current = current.parent();
                    depth++;
                } catch(e) {
                    break;
                }
            }

            return false;
        },

        _clickChatItem: function(chatItem, nameNode) {
            if (!chatItem && !nameNode) return false;

            var targetNode = chatItem || nameNode;
            var b = null;

            try {
                b = targetNode.bounds();
                if (!b || b.width() <= 0 || b.height() <= 0) return false;

                var cx = b.centerX();
                var cy = b.centerY();
                
                this._log("   🎯 Tıklanıyor: (" + cx + ", " + cy + ")");
                click(cx, cy);
                return true;
            } catch(e) {}

            return false;
        },

        /**
         * OPTIMIZED: Nickname toplama - cached
         */
        _getNameNodes: function(pkg) {
            var nameNodes = [];
            var now = Date.now();

            // Cache 500ms geçerli
            if (this._cache.lastNameNodes && (now - this._cache.lastNameNodesTime) < 500) {
                return this._cache.lastNameNodes;
            }

            try {
                // Try 1: Full package path
                var coll = id(pkg + ":id/id_user_name_tv").visibleToUser(true).find();
                var size = coll.size();
                
                for (var i = 0; i < size; i++) {
                    nameNodes.push(coll.get(i));
                }
            } catch(e) {}

            // Try 2: Fallback
            if (nameNodes.length === 0) {
                try {
                    var coll2 = id("id_user_name_tv").visibleToUser(true).find();
                    var size2 = coll2.size();
                    
                    for (var i = 0; i < size2; i++) {
                        nameNodes.push(coll2.get(i));
                    }
                } catch(e) {}
            }

            // Cache
            this._cache.lastNameNodes = nameNodes;
            this._cache.lastNameNodesTime = now;

            return nameNodes;
        },

        /**
         * OPTIMIZED: Ana fonksiyon - batch processing v2
         */
        findUnreadMessage: function(processedUsers) {
            var pkg = this.config.APP_PACKAGE;
            processedUsers = processedUsers || {};
            
            var startTime = Date.now();
            var self = this;

            try {
                this._log("🔍 Badge aranıyor...");

                // 1) Nickname'leri al (cached)
                var nameNodes = this._getNameNodes(pkg);

                if (nameNodes.length === 0) {
                    return { found: false, reason: "no_nicknames" };
                }

                this._log("   ✓ " + nameNodes.length + " nickname bulundu");

                // OPTIMIZATION: Batch processing - ilk 25, sonra diğerleri
                var limits = [25, nameNodes.length];
                var currentLimit = 0;

                for (var limitIdx = 0; limitIdx < limits.length; limitIdx++) {
                    var maxToCheck = limits[limitIdx];
                    var startIdx = limitIdx === 0 ? 0 : 25;

                    for (var i = startIdx; i < maxToCheck; i++) {
                        var nameNode = nameNodes[i];
                        var userName = "";

                        try {
                            var t = nameNode.text();
                            if (t != null) userName = String(t).trim();
                        } catch(e) {
                            continue;
                        }

                        if (!userName || userName.length === 0 || processedUsers[userName]) {
                            continue;
                        }

                        if (i < 25) {
                            this._log("   [" + i + "] Taranıyor: " + userName);
                        }

                        var chatItem = this._findChatItemFromNameNode(nameNode, pkg);
                        if (!chatItem) continue;

                        var badge = this._findBadgeInChatItem(chatItem, userName);
                        if (!badge) continue;

                        this._log("      🔵 Badge bulundu: '" + badge.text + "'");

                        if (this._isExcludedParent(chatItem)) {
                            this._log("      ⚠️ Excluded");
                            continue;
                        }

                        var elapsed = Date.now() - startTime;
                        this._log("      ✅ GEÇERLİ BADGE! (" + elapsed + "ms)");

                        return {
                            found: true,
                            userName: userName,
                            unreadCount: parseInt(badge.text, 10) || 1,
                            chatItem: chatItem,
                            nameNode: nameNode,
                            badgeText: badge.text,
                            searchTime: elapsed
                        };
                    }

                    // Diğer kısım başlamadan önce log
                    if (limitIdx === 0 && nameNodes.length > 25) {
                        this._log("   ℹ️ İlk 25'te bulunamadı, devam ediliyor...");
                    }
                }

                var elapsed = Date.now() - startTime;
                this._log("⏱️ Arama tamamlandı: " + elapsed + "ms");

                return { 
                    found: false, 
                    reason: "no_valid_badges",
                    searchTime: elapsed
                };

            } catch(e) {
                this._log("❌ Hata: " + e);
                return { found: false, reason: "error", error: String(e) };
            }
        },

        openChat: function(result) {
            if (!result || !result.found) {
                this._log("❌ Geçersiz result");
                return false;
            }

            this._log("🎯 Chat açılıyor: " + result.userName);

            sleep(120);
            var clicked = this._clickChatItem(result.chatItem, result.nameNode);
            sleep(300);

            return clicked;
        },

        // Cache temizleme
        clearCache: function() {
            this._cache.lastNameNodes = null;
            this._cache.lastNameNodesTime = 0;
        }
    };

    module.exports = { SimpleBadgeFinder: SimpleBadgeFinder };
})();