/**
 * Okunmamış mesaj bulma - DOĞRUDAN ELEMENT TABANI (v3 - Daha güvenilir)
 * id_unread_tcv node'larını doğrudan bul ve tıkla
 */

function findAndClickUnreadMessage() {
    try {
        console.log("🔍 Okunmamış mesajlar taranıyor...");

        // ⭐ DOĞRUDAN: Tüm id_unread_tcv (okunmamış sayaç) node'larını bul
        const unreadCountNodes = id("com.fiya.android:id/id_unread_tcv")
            .visibleToUser(true)
            .find();

        if (!unreadCountNodes || unreadCountNodes.length === 0) {
            console.log("⚠️  id_unread_tcv node'u bulunamadı");
            return { found: false, reason: "no_unread_nodes" };
        }

        console.log(`📋 ${unreadCountNodes.length} okunmamış sayaç bulundu`);

        // İlk okunmamış mesajı işle
        for (let i = 0; i < unreadCountNodes.length; i++) {
            const unreadNode = unreadCountNodes[i];

            try {
                const unreadText = unreadNode.text();
                const unreadCount = parseInt(unreadText, 10);

                if (unreadCount <= 0) continue;

                console.log(`✅ Okunmamış bulundu: ${unreadCount}`);

                // Parent chain'de kullanıcı adını bul
                let userName = "Bilinmiyor";
                try {
                    // unreadNode -> parent -> parent -> içinde id_user_name_tv ara
                    let node = unreadNode;
                    for (let depth = 0; depth < 5 && node; depth++) {
                        try {
                            const nameNode = node.findOne(
                                id("com.fiya.android:id/id_user_name_tv")
                            );
                            if (nameNode) {
                                userName = nameNode.text();
                                break;
                            }
                        } catch (e) {}
                        
                        try {
                            node = node.parent();
                        } catch (e) {
                            node = null;
                        }
                    }
                } catch (e) {}

                // Parent ViewGroup'u bul (ll_chat_item veya genel ViewGroup)
                let targetParent = null;
                try {
                    let node = unreadNode;
                    for (let depth = 0; depth < 8 && node; depth++) {
                        try {
                            const nodeId = node.id ? node.id() : "";
                            const nodeClass = node.className ? node.className() : "";
                            
                            // ll_chat_item veya ViewGroup bulunca dur
                            if (nodeId.includes("ll_chat_item") || 
                                nodeClass.includes("ViewGroup")) {
                                targetParent = node;
                                // ViewGroup buldu, ama ll_chat_item varsa o'yu tercih et
                                if (nodeId.includes("ll_chat_item")) break;
                            }
                        } catch (e) {}
                        
                        try {
                            node = node.parent();
                        } catch (e) {
                            node = null;
                        }
                    }
                } catch (e) {}

                let clickSuccess = false;
                const unreadBounds = unreadNode.bounds();

                // 1️⃣ Parent ViewGroup varsa, onu tıkla
                if (targetParent) {
                    const parentBounds = targetParent.bounds();
                    console.log(`   📍 Parent tıklanıyor: (${parentBounds.centerX()}, ${parentBounds.centerY()})`);
                    click(parentBounds.centerX(), parentBounds.centerY());
                    clickSuccess = true;
                }
                // 2️⃣ Yoksa unreadNode'un yakınını (örn solunu) tıkla
                else {
                    console.log(`   📍 Unread node yanı tıklanıyor: (${unreadBounds.left - 100}, ${unreadBounds.centerY()})`);
                    click(unreadBounds.left - 100, unreadBounds.centerY());
                    clickSuccess = true;
                }

                sleep(500);

                return {
                    found: true,
                    userName: userName,
                    unreadCount: unreadCount,
                    index: i,
                    method: targetParent ? "parent_bounds" : "unread_adjacent",
                    clickSuccess: clickSuccess
                };

            } catch (itemError) {
                console.log(`⚠️  Node ${i} işlenirken hata: ${itemError}`);
                continue;
            }
        }

        console.log("⚠️  Geçerli okunmamış mesaj bulunamadı");
        return { found: false, reason: "no_valid_unread" };

    } catch (error) {
        console.log("❌ Hata:", error);
        return { found: false, reason: "error", error: error.toString() };
    }
}

/**
 * Düzenli aralıklarla okunmamış mesaj kontrolü
 */
function startUnreadMessageMonitor(intervalMs, pkg) {
    intervalMs = intervalMs || 8000;
    pkg = pkg || "com.fiya.android";

    console.log(`🔍 Monitor başladı (${intervalMs}ms aralık)`);

    setInterval(() => {
        try {
            if (currentPackage() !== pkg) {
                return;
            }

            if (!id("com.fiya.android:id/id_recycler_view").exists()) {
                return;
            }

            const result = findAndClickUnreadMessage();
            if (result.found) {
                console.log(`✅ Başarılı: ${result.userName} (${result.unreadCount} mesaj)`);
            }

        } catch (e) {
            console.log("Monitor hatası:", e);
        }
    }, intervalMs);
}

/**
 * Manuel test
 */
function testUnreadNow() {
    console.log("\n🔎 Okunmamış mesaj kontrolü...\n");
    const result = findAndClickUnreadMessage();
    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2), "\n");
    return result;
}

/**
 * Tüm okunmamış mesajları listele (debug)
 */
function listAllUnread() {
    try {
        const unreadNodes = id("com.fiya.android:id/id_unread_tcv")
            .visibleToUser(true)
            .find();

        console.log(`\n📋 Toplam ${unreadNodes.length} okunmamış sayaç:\n`);

        for (let i = 0; i < unreadNodes.length; i++) {
            const unreadNode = unreadNodes[i];
            const count = unreadNode.text();

            let userName = "?";
            try {
                let node = unreadNode;
                for (let d = 0; d < 5 && node; d++) {
                    const nameNode = node.findOne(
                        id("com.fiya.android:id/id_user_name_tv")
                    );
                    if (nameNode) {
                        userName = nameNode.text();
                        break;
                    }
                    node = node.parent();
                }
            } catch (e) {}

            console.log(`  ${i + 1}. ${userName}: ${count} mesaj`);
        }
        console.log();

    } catch (error) {
        console.log("Debug hatası:", error);
    }
}

// EXPORTS
module.exports = {
    findAndClickUnreadMessage: findAndClickUnreadMessage,
    startUnreadMessageMonitor: startUnreadMessageMonitor,
    testUnreadNow: testUnreadNow,
    listAllUnread: listAllUnread
};

// ============================================================================
// KULLANIM:
// ============================================================================

// 🚀 Başlat
// startUnreadMessageMonitor(8000);

// 🔍 Test et
// testUnreadNow();

// 📋 Debug: Tüm okunmamış mesajları listele
// listAllUnread();