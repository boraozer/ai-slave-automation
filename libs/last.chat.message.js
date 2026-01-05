/**
 * ============================================================================
 * CHAT MESAJ HELPER (AutoJS6)
 * ============================================================================
 * 
 * Görev: Chat ekranında karşı tarafın son mesajını bul ve döndür
 * 
 * XML yapısı:
 * - Kendi mesajlarımız: sağda, id_user_avatar_iv ile
 * - Karşı tarafın mesajları: solda, avatar sol tarafta
 */

(function() {
    var ChatMessageHelper = {
        
        config: {
            APP_PACKAGE: "com.fiya.android",
            MSG_TEXT_ID: "id_chat_msg_text",
            MSG_CONTENT_ID: "id_chat_msg_content",
            GIFT_SUMMARY_ID: "id_chatting_gift_summary_tv",
            VOICE_TIME_ID: "id_chatting_voice_time_tv",
        },

        /**
         * Karşı tarafın son mesajını bul
         * @returns { text, type, timestamp }
         */
        getLastReceivedMessage: function() {
            try {
                console.log("🔧 getLastReceivedMessage() çağrıldı");

                // Tüm LinearLayout konteynerlerini bul (her mesaj bir LinearLayout)
                var messageContainers = className("android.widget.LinearLayout")
                    .visibleToUser(true)
                    .find();

                console.log("   📋 " + messageContainers.length + " mesaj konteyneri bulundu");

                if (!messageContainers || messageContainers.length === 0) {
                    console.log("   ⚠️  Mesaj bulunamadı");
                    return null;
                }

                // Sağdan sola tara (son mesaj genelde aşağıda)
                for (var i = messageContainers.length - 1; i >= 0; i--) {
                    var container = messageContainers[i];
                    
                    try {
                        var result = this._analyzeMessageContainer(container, i);
                        if (result && result.isReceived) {
                            console.log("   ✅ Karşı tarafın mesajı bulundu");
                            return result;
                        }
                    } catch (e) {
                        console.log("   ⚠️  Container " + i + " hatası: " + e);
                    }
                }

                console.log("   ⚠️  Karşı tarafın mesajı bulunamadı");
                return null;

            } catch (error) {
                console.log("❌ getLastReceivedMessage() hatası: " + error);
                return null;
            }
        },

        /**
         * Mesaj konteynerini analiz et
         * @private
         */
        _analyzeMessageContainer: function(container, index) {
            try {
                // Avatar pozisyonunu kontrol et (sol = karşı taraf, sağ = bizim mesaj)
                var avatars = container.find(
                    id(this.config.APP_PACKAGE + ":id/id_user_avatar_iv")
                );

                if (!avatars || avatars.length === 0) {
                    return null; // Avatar yok = sistem mesajı veya boş
                }

                var avatarBounds = avatars[0].bounds();
                var containerBounds = container.bounds();

                // Avatar konteynerin solunda mı? (karşı taraf)
                // Avatar konteynerin sağında mı? (bizim mesaj)
                var avatarX = avatarBounds.left;
                var containerCenter = (containerBounds.left + containerBounds.right) / 2;

                console.log("   [Container " + index + "]");
                console.log("      Avatar X: " + avatarX + ", Container center: " + containerCenter);

                var isReceived = avatarX < containerCenter; // Sol tarafta = karşı taraf
                console.log("      İsTalınan (karşı taraf): " + isReceived);

                if (!isReceived) {
                    return null; // Bizim mesajımız, skip
                }

                // Mesaj içeriğini bul
                var messageText = null;
                var messageType = "text";
                var mediaInfo = null;

                // 1. Text mesajı ara
                try {
                    var textNode = container.findOne(
                        id(this.config.APP_PACKAGE + ":id/" + this.config.MSG_TEXT_ID)
                    );
                    if (textNode) {
                        messageText = textNode.text();
                        messageType = "text";
                        console.log("      Text: " + messageText);
                    }
                } catch (e) {}

                // 2. Hediye mesajı ara
                if (!messageText) {
                    try {
                        var giftNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.GIFT_SUMMARY_ID)
                        );
                        if (giftNode) {
                            messageText = giftNode.text();
                            messageType = "gift";
                            
                            // Hediye değerini de al
                            try {
                                var diamondNode = container.findOne(
                                    id(this.config.APP_PACKAGE + ":id/text_view_diamond_num")
                                );
                                if (diamondNode) {
                                    mediaInfo = {
                                        diamonds: diamondNode.text()
                                    };
                                }
                            } catch (e) {}
                            
                            console.log("      Hediye: " + messageText);
                        }
                    } catch (e) {}
                }

                // 3. Resim/Video gibi medya ara (id_chat_msg_content FrameLayout)
                if (!messageText) {
                    try {
                        var mediaContentNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.MSG_CONTENT_ID)
                        );
                        if (mediaContentNode) {
                            var mediaClass = mediaContentNode.className ? mediaContentNode.className() : "";
                            
                            // FrameLayout ise medya içeriğine sahip
                            if (mediaClass.indexOf("FrameLayout") !== -1 || 
                                mediaClass.indexOf("ViewGroup") !== -1) {
                                messageType = "media";
                                messageText = "[Medya İçeriği]";
                                mediaInfo = {
                                    type: "image_or_video",
                                    hasContent: true
                                };
                                console.log("      Medya: image/video");
                            }
                        }
                    } catch (e) {}
                }

                // 4. Ses kaydı ara (id_chatting_voice_time_tv)
                if (!messageText) {
                    try {
                        var voiceTimeNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/" + this.config.VOICE_TIME_ID)
                        );
                        if (voiceTimeNode) {
                            var voiceDuration = voiceTimeNode.text();
                            messageText = "[Ses Kaydı]";
                            messageType = "voice";
                            mediaInfo = {
                                type: "voice",
                                duration: voiceDuration  // örn: "00:08"
                            };
                            console.log("      Ses: " + voiceDuration);
                        }
                    } catch (e) {}
                }

                // 5. Sistem mesajı ara
                if (!messageText) {
                    try {
                        var sysNode = container.findOne(
                            id(this.config.APP_PACKAGE + ":id/id_chatting_sys_tips_tv")
                        );
                        if (sysNode) {
                            messageText = sysNode.text();
                            messageType = "system";
                            console.log("      Sistem: " + messageText);
                        }
                    } catch (e) {}
                }

                if (!messageText) {
                    console.log("      ⚠️  Mesaj içeriği bulunamadı");
                    return null;
                }

                // Zamanı ara
                var timestamp = this._findTimestamp(container);

                return {
                    isReceived: true,
                    text: messageText,
                    type: messageType,           // text, gift, media, system
                    timestamp: timestamp,
                    mediaInfo: mediaInfo,        // Ek medya bilgisi
                    containerIndex: index
                };

            } catch (error) {
                console.log("      ❌ Analiz hatası: " + error);
                return null;
            }
        },

        /**
         * Mesaj zamanını bul
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
         * Son N mesajı al (karşı taraftan)
         * @param count - Kaç mesaj alınacak
         */
        getLastNReceivedMessages: function(count) {
            try {
                console.log("🔧 getLastNReceivedMessages(" + count + ") çağrıldı");

                var messageContainers = className("android.widget.LinearLayout")
                    .visibleToUser(true)
                    .find();

                var receivedMessages = [];

                for (var i = messageContainers.length - 1; i >= 0 && receivedMessages.length < count; i--) {
                    try {
                        var result = this._analyzeMessageContainer(messageContainers[i], i);
                        if (result && result.isReceived) {
                            receivedMessages.push(result);
                        }
                    } catch (e) {}
                }

                console.log("   ✅ " + receivedMessages.length + " mesaj bulundu");
                return receivedMessages;

            } catch (error) {
                console.log("❌ getLastNReceivedMessages() hatası: " + error);
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