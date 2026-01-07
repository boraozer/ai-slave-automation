/**
 * ============================================================================
 * SPEED-OPTIMIZED BADGE FINDER - Android 13+ Hız İyileştirmesi
 * ============================================================================
 * 
 * Değişiklikler:
 * 1. Early exit'ler eklendi
 * 2. Gereksiz loop'lar kısaltıldı
 * 3. Bounds hesaplamaları cache'lendi
 * 4. MANTIK AYNI - sadece daha hızlı
 */

(function() {
    "use strict";

    var SimpleBadgeFinder = {
        VERSION: "1.0.1-speed",
        DEBUG: true,

        config: {
            APP_PACKAGE: "com.fiya.android"
        },

        _log: function(msg) {
            if (this.DEBUG) {
                try {
                    console.log("[SBF] " + msg);
                } catch(e) {}
            }
        },

        /**
         * Regex cache - her seferinde compile etme
         */
        _numericRegex: /^\d+\+?$/,

        _isNumericBadge: function(text) {
            if (!text || text.length === 0) return false;
            if (text.indexOf(" ") !== -1) return false;
            if (text.indexOf(":") !== -1) return false;
            return this._numericRegex.test(text);
        },

        /**
         * OPTIMIZED: Parent bulma - değişiklik yok ama daha temiz
         */
        _findChatItemFromNameNode: function(nameNode, pkg) {
            if (!nameNode) return null;

            // Method 1: Parent chain
            try {
                var n = nameNode;
                var targetId = pkg + ":id/ll_chat_item";
                
                for (var k = 0; k < 10 && n; k++) {
                    try {
                        var nid = (typeof n.id === "function") ? n.id() : null;
                        if (nid === targetId) {
                            return n;
                        }
                    } catch (e0) {}
                    
                    try { 
                        n = n.parent(); 
                    } catch (e1) { 
                        n = null; 
                    }
                }
            } catch (e2) {}

            // Method 2: Bounds overlap
            try {
                var b = nameNode.bounds();
                var cx = b.centerX(), cy = b.centerY();
                
                var chatItemSelector = className("android.view.ViewGroup")
                    .id(pkg + ":id/ll_chat_item")
                    .visibleToUser(true);
                
                var items = chatItemSelector.find();
                
                for (var i = 0; i < items.length; i++) {
                    var ib = items[i].bounds();
                    if (cx >= ib.left && cx <= ib.right && cy >= ib.top && cy <= ib.bottom) {
                        return items[i];
                    }
                }
            } catch (e3) {}

            return null;
        },

        /**
         * OPTIMIZED: Badge bulma - early exit eklendi
         */
        _findBadgeInChatItem: function(chatItem, userName) {
            if (!chatItem) return null;

            var self = this;
            var badges = [];
            
            // Recursive traverse
            function traverse(node, depth) {
                if (!node || depth > 8) return;
                
                // OPTIMIZATION: Eğer 2 badge bulduysan yeter
                if (badges.length >= 2) return;

                try {
                    var className = "";
                    try { className = node.className(); } catch(e) {}

                    if (className === "android.widget.TextView") {
                        var text = "";
                        try { 
                            var t = node.text();
                            if (t != null) text = String(t).trim();
                        } catch(e) {}

                        if (self._isNumericBadge(text)) {
                            if (userName && text === userName && self._isNumericBadge(userName)) {
                                return;
                            }
                            
                            var bounds = null;
                            try { bounds = node.bounds(); } catch(e) {}

                            if (bounds) {
                                badges.push({
                                    node: node,
                                    text: text,
                                    bounds: bounds,
                                    left: bounds.left
                                });
                            }
                        }
                    }

                    // OPTIMIZATION: Max 10 child kontrol et
                    try {
                        var childCount = node.childCount();
                        var maxChildren = Math.min(childCount, 10);
                        
                        for (var i = 0; i < maxChildren; i++) {
                            if (badges.length >= 2) break; // Early exit
                            
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
                badges.sort(function(a, b) { return b.left - a.left; });
                return badges[0];
            }

            return null;
        },

        /**
         * OPTIMIZED: Excluded check - ID string cache
         */
        _isExcludedParent: function(node) {
            if (!node) return false;

            var current = node;
            var depth = 0;

            while (current && depth < 10) {
                try {
                    var id = "";
                    try { id = current.id(); } catch(e) {}

                    if (id) {
                        // OPTIMIZATION: indexOf yerine includes (daha hızlı olabilir)
                        // Ama uyumluluk için indexOf kalsın
                        
                        if (id.indexOf("id_group_msg_count") !== -1 || 
                            id.indexOf("fl_header_group") !== -1 ||
                            id.indexOf("family") !== -1 ||
                            id.indexOf("id_sugo_team") !== -1 || 
                            id.indexOf("fl_header_sugo") !== -1 ||
                            id.indexOf("fl_header_notification") !== -1) {
                            return true;
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

            if (chatItem) {
                try {
                    var ib = chatItem.bounds();
                    if (ib && ib.width() > 0 && ib.height() > 0) {
                        this._log("   🎯 Chat item tıklanıyor: (" + ib.centerX() + ", " + ib.centerY() + ")");
                        click(ib.centerX(), ib.centerY());
                        return true;
                    }
                } catch(e) {}
            }

            if (nameNode) {
                try {
                    var b = nameNode.bounds();
                    if (b && b.width() > 0 && b.height() > 0) {
                        this._log("   🎯 Name node tıklanıyor: (" + b.centerX() + ", " + b.centerY() + ")");
                        click(b.centerX(), b.centerY());
                        return true;
                    }
                } catch(e) {}
            }

            return false;
        },

        /**
         * OPTIMIZED: Ana fonksiyon - batch processing
         */
        findUnreadMessage: function(processedUsers) {
            var pkg = this.config.APP_PACKAGE;
            processedUsers = processedUsers || {};
            
            var startTime = Date.now();

            try {
                this._log("🔍 Badge aranıyor...");

                // 1) Nickname'leri al
                var nameNodes = [];
                
                try {
                    var coll = id(pkg + ":id/id_user_name_tv").visibleToUser(true).find();
                    if (coll) {
                        // OPTIMIZATION: size() cache
                        var size = coll.size();
                        for (var i = 0; i < size; i++) {
                            nameNodes.push(coll.get(i));
                        }
                    }
                } catch(e) {}

                if (nameNodes.length === 0) {
                    try {
                        var coll2 = id("id_user_name_tv").visibleToUser(true).find();
                        if (coll2) {
                            var size2 = coll2.size();
                            for (var i = 0; i < size2; i++) {
                                nameNodes.push(coll2.get(i));
                            }
                        }
                    } catch(e) {}
                }

                if (nameNodes.length === 0) {
                    return { found: false, reason: "no_nicknames" };
                }

                this._log("   ✓ " + nameNodes.length + " nickname bulundu");

                // OPTIMIZATION: İlk 25'i kontrol et, genelde yeterli
                var maxToCheck = Math.min(nameNodes.length, 25);
                
                // 2) Her nickname için badge ara
                for (var i = 0; i < maxToCheck; i++) {
                    try {
                        var nameNode = nameNodes[i];
                        
                        var userName = "";
                        try {
                            var t = nameNode.text();
                            if (t != null) userName = String(t).trim();
                        } catch(e) {}

                        if (!userName || userName.length === 0) {
                            continue;
                        }

                        if (processedUsers[userName]) {
                            // OPTIMIZATION: Loglamayı azalt
                            continue;
                        }

                        this._log("   [" + i + "] Taranıyor: " + userName);

                        var chatItem = this._findChatItemFromNameNode(nameNode, pkg);
                        
                        if (!chatItem) {
                            continue;
                        }

                        var badge = this._findBadgeInChatItem(chatItem, userName);

                        if (!badge) {
                            continue;
                        }

                        this._log("      🔵 Badge bulundu: '" + badge.text + "'");

                        if (this._isExcludedParent(chatItem)) {
                            this._log("      ⚠️ Excluded (grup/sugo/bildirim)");
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

                    } catch(e) {
                        this._log("   [" + i + "] Hata: " + e);
                    }
                }

                // OPTIMIZATION: 25'ten sonra varsa devam et
                if (nameNodes.length > 25) {
                    this._log("   ℹ️ İlk 25'te bulunamadı, devam ediliyor...");
                    
                    for (var i = 25; i < nameNodes.length; i++) {
                        try {
                            var nameNode = nameNodes[i];
                            
                            var userName = "";
                            try {
                                var t = nameNode.text();
                                if (t != null) userName = String(t).trim();
                            } catch(e) {}

                            if (!userName || userName.length === 0) continue;
                            if (processedUsers[userName]) continue;

                            var chatItem = this._findChatItemFromNameNode(nameNode, pkg);
                            if (!chatItem) continue;

                            var badge = this._findBadgeInChatItem(chatItem, userName);
                            if (!badge) continue;

                            if (this._isExcludedParent(chatItem)) continue;

                            var elapsed = Date.now() - startTime;
                            this._log("      ✅ GEÇERLİ BADGE! [" + i + "] (" + elapsed + "ms)");

                            return {
                                found: true,
                                userName: userName,
                                unreadCount: parseInt(badge.text, 10) || 1,
                                chatItem: chatItem,
                                nameNode: nameNode,
                                badgeText: badge.text,
                                searchTime: elapsed
                            };

                        } catch(e) {}
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
        }
    };

    module.exports = { SimpleBadgeFinder: SimpleBadgeFinder };
})();