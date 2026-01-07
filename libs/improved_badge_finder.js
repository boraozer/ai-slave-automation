/**
 * ============================================================================
 * BASİT BADGE FINDER - Nickname Bazlı
 * ============================================================================
 * 
 * Mantık:
 * 1. Tüm nickname'leri bul
 * 2. Her nickname için parent chat item'ı bul
 * 3. Chat item içindeki tüm TextView'lara bak
 * 4. Sadece sayısal olanı bul (1, 2, 3, 99+)
 * 5. Varsa badge var demektir, tıkla
 */

(function() {
    "use strict";

    var SimpleBadgeFinder = {
        VERSION: "1.0.0-simple",
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
         * Bir text'in sadece sayısal olup olmadığını kontrol et
         * Kabul: "1", "12", "99+", "999"
         * Red: "02:12", "Merhaba", "", "1 2"
         */
        _isNumericBadge: function(text) {
            if (!text || text.length === 0) return false;
            
            // Boşluk varsa değil
            if (text.indexOf(" ") !== -1) return false;
            
            // Colon varsa saat, değil
            if (text.indexOf(":") !== -1) return false;
            
            // Sadece rakam veya rakam+ formatı
            return /^\d+\+?$/.test(text);
        },

        /**
         * Name node'dan parent chat item'ı bul
         * (openChatExactByNick'deki findChatItemFromNameNode mantığı)
         */
        _findChatItemFromNameNode: function(nameNode, pkg) {
            if (!nameNode) return null;

            // Method 1: Parent'lara çık, ll_chat_item ID'li olanı bul
            try {
                var n = nameNode;
                for (var k = 0; k < 10 && n; k++) {
                    try {
                        var nid = (typeof n.id === "function") ? n.id() : null;
                        if (nid === (pkg + ":id/ll_chat_item")) {
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

            // Method 2: Bounds overlap kontrolü
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
         * Chat item içindeki tüm TextView'lara bak, sayısal badge bul
         */
        _findBadgeInChatItem: function(chatItem, userName) {
            if (!chatItem) return null;

            var self = this;
            var badges = [];
            
            // Recursive traverse - tüm child'ları gez
            function traverse(node, depth) {
                if (!node || depth > 8) return;

                try {
                    // TextView mi?
                    var className = "";
                    try { className = node.className(); } catch(e) {}

                    if (className === "android.widget.TextView") {
                        var text = "";
                        try { 
                            var t = node.text();
                            if (t != null) text = String(t).trim();
                        } catch(e) {}

                        // Sayısal badge mi?
                        if (self._isNumericBadge(text)) {
                            // Kullanıcı adı tamamen sayısal ve aynı değer mi?
                            if (userName && text === userName && self._isNumericBadge(userName)) {
                                return; // Badge değil, kullanıcı adı
                            }
                            
                            var bounds = null;
                            try { bounds = node.bounds(); } catch(e) {}

                            if (bounds) {
                                badges.push({
                                    node: node,
                                    text: text,
                                    bounds: bounds,
                                    left: bounds.left  // Sağdaki öncelikli
                                });
                            }
                        }
                    }

                    // Child'lara in
                    try {
                        var childCount = node.childCount();
                        for (var i = 0; i < childCount; i++) {
                            try {
                                var child = node.child(i);
                                if (child) traverse(child, depth + 1);
                            } catch(e) {}
                        }
                    } catch(e) {}
                } catch(e) {}
            }

            traverse(chatItem, 0);

            // En sağdaki badge'i seç (genelde badge sağda olur)
            if (badges.length > 0) {
                badges.sort(function(a, b) { return b.left - a.left; });
                return badges[0];
            }

            return null;
        },

        /**
         * Excluded parent kontrolü (grup/sugo/bildirim)
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
                        // Grup
                        if (id.indexOf("id_group_msg_count") !== -1 || 
                            id.indexOf("fl_header_group") !== -1 ||
                            id.indexOf("family") !== -1) {
                            return true;
                        }

                        // Sugo
                        if (id.indexOf("id_sugo_team") !== -1 || 
                            id.indexOf("fl_header_sugo") !== -1) {
                            return true;
                        }

                        // Bildirimler
                        if (id.indexOf("fl_header_notification") !== -1) {
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

        /**
         * Chat item'a tıkla (safeClickChatItem mantığı)
         */
        _clickChatItem: function(chatItem, nameNode) {
            if (!chatItem && !nameNode) return false;

            // Method 1: Chat item var, merkezine tıkla
            if (chatItem) {
                try {
                    var ib = chatItem.bounds();
                    if (ib && ib.width() > 0 && ib.height() > 0) {
                        this._log("   📍 Chat item tıklanıyor: (" + ib.centerX() + ", " + ib.centerY() + ")");
                        click(ib.centerX(), ib.centerY());
                        return true;
                    }
                } catch(e) {}
            }

            // Method 2: Fallback - name node'a tıkla
            if (nameNode) {
                try {
                    var b = nameNode.bounds();
                    if (b && b.width() > 0 && b.height() > 0) {
                        this._log("   📍 Name node tıklanıyor: (" + b.centerX() + ", " + b.centerY() + ")");
                        click(b.centerX(), b.centerY());
                        return true;
                    }
                } catch(e) {}
            }

            return false;
        },

        /**
         * ANA FONKSİYON: Badge'li mesaj bul
         */
        findUnreadMessage: function(processedUsers) {
            var pkg = this.config.APP_PACKAGE;
            processedUsers = processedUsers || {};

            try {
                this._log("🔍 Badge aranıyor...");

                // 1) Tüm nickname node'larını al
                var nameNodes = [];
                
                try {
                    var coll = id(pkg + ":id/id_user_name_tv").visibleToUser(true).find();
                    if (coll) {
                        for (var i = 0; i < coll.size(); i++) {
                            nameNodes.push(coll.get(i));
                        }
                    }
                } catch(e) {}

                // Fallback: Packagesiz
                if (nameNodes.length === 0) {
                    try {
                        var coll2 = id("id_user_name_tv").visibleToUser(true).find();
                        if (coll2) {
                            for (var i = 0; i < coll2.size(); i++) {
                                nameNodes.push(coll2.get(i));
                            }
                        }
                    } catch(e) {}
                }

                if (nameNodes.length === 0) {
                    return { found: false, reason: "no_nicknames" };
                }

                this._log("   ✓ " + nameNodes.length + " nickname bulundu");

                // 2) Her nickname için chat item'ı bul ve badge ara
                for (var i = 0; i < nameNodes.length; i++) {
                    try {
                        var nameNode = nameNodes[i];
                        
                        // Nickname al
                        var userName = "";
                        try {
                            var t = nameNode.text();
                            if (t != null) userName = String(t).trim();
                        } catch(e) {}

                        if (!userName || userName.length === 0) {
                            continue;
                        }

                        // İşlenmiş mi?
                        if (processedUsers[userName]) {
                            this._log("   [" + i + "] " + userName + " - zaten işlendi");
                            continue;
                        }

                        this._log("   [" + i + "] Taranıyor: " + userName);

                        // Chat item'ı bul
                        var chatItem = this._findChatItemFromNameNode(nameNode, pkg);
                        
                        if (!chatItem) {
                            this._log("      ⚠️ Chat item bulunamadı");
                            continue;
                        }

                        // Chat item içinde badge ara
                        var badge = this._findBadgeInChatItem(chatItem, userName);

                        if (!badge) {
                            this._log("      ℹ️ Badge yok");
                            continue;
                        }

                        this._log("      🔵 Badge bulundu: '" + badge.text + "'");

                        // Excluded mi?
                        if (this._isExcludedParent(chatItem)) {
                            this._log("      ⚠️ Excluded (grup/sugo/bildirim)");
                            continue;
                        }

                        // ✅ Bulundu!
                        this._log("      ✅ GEÇERLİ BADGE!");

                        return {
                            found: true,
                            userName: userName,
                            unreadCount: parseInt(badge.text, 10) || 1,
                            chatItem: chatItem,
                            nameNode: nameNode,
                            badgeText: badge.text
                        };

                    } catch(e) {
                        this._log("   [" + i + "] Hata: " + e);
                    }
                }

                return { found: false, reason: "no_valid_badges" };

            } catch(e) {
                this._log("❌ Hata: " + e);
                return { found: false, reason: "error", error: String(e) };
            }
        },

        /**
         * Badge bulundu, chat'i aç
         */
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