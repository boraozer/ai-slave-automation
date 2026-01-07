/**
 * ============================================================================
 * CHAT MESAJ HELPER (AutoJS6)
 * ============================================================================
 * 
 * Gorev: Chat ekraninda karsi tarafin son mesajini bul ve dondur
 * SADECE AVATAR OLAN MESAJLARI DIKKATE AL!
 * 
 * XML yapisi:
 * - Kendi mesajlarimiz: sagda, avatar sag tarafta (buyuk X degeri)
 * - Karsi tarafin mesajlari: solda, avatar sol tarafta (kucuk X degeri)
 * - Sistem mesajlari: AVATAR YOK, skip et!
 * 
 * Algoritma: Tum avatar olan mesajlari sondan geriye tara,
 * avatar solda olan ilk mesaji dondur (karsi tarafin son mesaji)
 */

(function() {
    var ChatMessageHelper = {
        
        config: {
            APP_PACKAGE: "com.fiya.android",
            MSG_TEXT_ID: "id_chat_msg_text",
            MSG_CONTENT_ID: "id_chat_msg_content",
            GIFT_SUMMARY_ID: "id_chatting_gift_summary_tv",
            VOICE_TIME_ID: "id_chatting_voice_time_tv",
            USER_AVATAR_ID: "id_user_avatar_iv"
        },

        /**
         * Karsi tarafin son mesajini bul
         * Son 2 AVATAR OLAN mesajda karsi taraftan bir mesaj varsa onu kabul et
         * @returns { text, type, timestamp }
         */
        getLastReceivedMessage: function() {
            try {
                console.log("[*] getLastReceivedMessage() cagrildi");

                // Tum LinearLayout konteynerlerini bul
                var messageContainers = className("android.widget.LinearLayout")
                    .visibleToUser(true)
                    .find();

                console.log("[+] " + messageContainers.length + " toplam konteyneri bulundu");

                if (!messageContainers || messageContainers.length === 0) {
                    console.log("[-] Mesaj bulunamadi");
                    return null;
                }

                // ONCE: AVATAR OLAN tum mesajlari bul
                var messagesWithAvatar = [];
                for (var i = 0; i < messageContainers.length; i++) {
                    var container = messageContainers[i];
                    try {
                        var avatars = container.find(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.USER_AVATAR_ID)
                        );
                        
                        // Avatar var mi?
                        if (avatars && avatars.length > 0) {
                            messagesWithAvatar.push({
                                container: container,
                                index: i,
                                avatarBounds: avatars[0].bounds()
                            });
                            console.log("   [Container " + i + "] AVATAR VAR - Ekle");
                        } else {
                            console.log("   [Container " + i + "] AVATAR YOK - SKIP");
                        }
                    } catch (e) {
                        console.log("   [Container " + i + "] Kontrol hatasi: " + e);
                    }
                }

                console.log("[+] Avatar olan " + messagesWithAvatar.length + " mesaj bulundu");

                if (messagesWithAvatar.length === 0) {
                    console.log("[-] Avatar olan mesaj bulunamadi");
                    return null;
                }

                // TUM avatar olan mesajlarda sondan geriye dogru karsi tarafin mesajini ara
                console.log("[*] " + messagesWithAvatar.length + " avatar olan mesajda araniliyor...");

                for (var i = messagesWithAvatar.length - 1; i >= 0; i--) {
                    var msgWithAvatar = messagesWithAvatar[i];
                    
                    try {
                        var result = this._analyzeMessageContainer(
                            msgWithAvatar.container, 
                            msgWithAvatar.index,
                            msgWithAvatar.avatarBounds
                        );
                        if (result && result.isReceived) {
                            console.log("[OK] Karsi tarafin mesaji bulundu!");
                            return result;
                        }
                    } catch (e) {
                        console.log("[-] Analiz hatasi: " + e);
                    }
                }

                console.log("[-] Avatar olan mesajlarda karsi tarafin mesaji bulunamadi");
                return null;

            } catch (error) {
                console.log("[ERROR] getLastReceivedMessage() genel hatasi: " + error);
                return null;
            }
        },

        /**
         * Mesaj konteynerini analiz et (avatar zaten kontrol edilmis)
         * @private
         */
        _analyzeMessageContainer: function(container, index, avatarBounds) {
            try {
                var containerBounds = container.bounds();

                // Avatar sagda mi solda mi kontrol et
                var avatarX = avatarBounds.left;
                var containerLeft = containerBounds.left;
                var containerRight = containerBounds.right;
                var containerCenter = (containerLeft + containerRight) / 2;

                console.log("   [Container " + index + "]");
                console.log("      Container: [" + containerLeft + "-" + containerRight + "], center=" + containerCenter);
                console.log("      Avatar X: " + avatarX);

                // Sol tarafta (kucuk X) = karsi taraf, Sag tarafta (buyuk X) = bizim mesaj
                var isReceived = avatarX < containerCenter;
                console.log("      IsReceived: " + isReceived);

                if (!isReceived) {
                    console.log("      --> Bizim mesaj, skip");
                    return null;
                }

                console.log("      --> Karsi tarafin mesaji!");

                // Mesaj icerigini bul
                var messageText = null;
                var messageType = "text";
                var mediaInfo = null;

                // 1. Text mesaji ara
                try {
                    var textNode = container.findOne(
                        id(this.config.APP_PACKAGE + ":id/" + this.config.MSG_TEXT_ID)
                    );
                    if (textNode) {
                        messageText = textNode.text();
                        messageType = "text";
                        console.log("      [TEXT] " + messageText);
                    }
                } catch (e) {}

                // 2. Hediye mesaji ara
                if (!messageText) {
                    try {
                        var giftNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.GIFT_SUMMARY_ID)
                        );
                        if (giftNode) {
                            messageText = giftNode.text();
                            messageType = "gift";
                            console.log("      [GIFT] " + messageText);
                        }
                    } catch (e) {}
                }

                // 3. Resim/Video gibi medya ara
                if (!messageText) {
                    try {
                        var mediaContentNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.MSG_CONTENT_ID)
                        );
                        if (mediaContentNode) {
                            messageType = "media";
                            messageText = "[Medya]";
                            console.log("      [MEDIA]");
                        }
                    } catch (e) {}
                }

                // 4. Ses kaydi ara
                if (!messageText) {
                    try {
                        var voiceTimeNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.VOICE_TIME_ID)
                        );
                        if (voiceTimeNode) {
                            messageText = "[Ses Kaydi]";
                            messageType = "voice";
                            console.log("      [VOICE]");
                        }
                    } catch (e) {}
                }

                if (!messageText) {
                    console.log("      [-] Mesaj icerigi bulunamadi");
                    return null;
                }

                // Zamani ara
                var timestamp = this._findTimestamp(container);

                return {
                    isReceived: true,
                    text: messageText,
                    type: messageType,
                    timestamp: timestamp,
                    mediaInfo: mediaInfo,
                    containerIndex: index
                };

            } catch (error) {
                console.log("      [ERROR] Analiz hatasi: " + error);
                return null;
            }
        },

        /**
         * Mesaj zamanini bul
         * @private
         */
        _findTimestamp: function(container) {
            try {
                var timeNode = container.findOne(
                    id(this.config.APP_PACKAGE + ":id/id_chatting_time_tv")
                );
                if (timeNode) {
                    return timeNode.text();
                }
            } catch (e) {}
            return null;
        },

        /**
         * Son N mesaji al (karsi taraftan, SADECE AVATAR OLANLAR)
         * @param count - Kac mesaj alinacak
         */
        getLastNReceivedMessages: function(count) {
            try {
                console.log("[*] getLastNReceivedMessages(" + count + ") cagrildi");

                var messageContainers = className("android.widget.LinearLayout")
                    .visibleToUser(true)
                    .find();

                // ONCE: Avatar olan mesajlari filtrele
                var messagesWithAvatar = [];
                for (var i = 0; i < messageContainers.length; i++) {
                    var container = messageContainers[i];
                    try {
                        var avatars = container.find(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.USER_AVATAR_ID)
                        );
                        
                        if (avatars && avatars.length > 0) {
                            messagesWithAvatar.push({
                                container: container,
                                index: i,
                                avatarBounds: avatars[0].bounds()
                            });
                        }
                    } catch (e) {}
                }

                var receivedMessages = [];

                // Son N avatarli mesajdan geriye dogru tara
                for (var i = messagesWithAvatar.length - 1; i >= 0 && receivedMessages.length < count; i--) {
                    try {
                        var msgWithAvatar = messagesWithAvatar[i];
                        var result = this._analyzeMessageContainer(
                            msgWithAvatar.container,
                            msgWithAvatar.index,
                            msgWithAvatar.avatarBounds
                        );
                        if (result && result.isReceived) {
                            receivedMessages.push(result);
                        }
                    } catch (e) {}
                }

                console.log("[OK] " + receivedMessages.length + " mesaj bulundu");
                return receivedMessages;

            } catch (error) {
                console.log("[ERROR] getLastNReceivedMessages() hatasi: " + error);
                return [];
            }
        }
    };

    // ============================================================================
    // EXPORTS
    // ============================================================================

    module.exports = {
        ChatMessageHelper: ChatMessageHelper
    };

})();