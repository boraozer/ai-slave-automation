"auto";

(function(){
const Supabase = require("./supabase.js");
const { logSafe } = require("./logger.js");

var deviceId = null;
var listenPkgs = [];
var notifQueue = null;
var notifWorkerStarted = false;
var notificationIds = []; // Bildirim ID'lerini takip etmek için
var _handlerNN = (t)=> {console.log(t)}

function _ensureNotifWorker() {
    if (notifWorkerStarted) return;
    notifWorkerStarted = true;
    try {
        notifQueue = new java.util.concurrent.LinkedBlockingQueue();
    } catch (e) {
        notifQueue = null;
    }

    threads.start(function () {
        logSafe("Notification worker started (async Supabase writes).");
        while (true) {
            try {
                if (!notifQueue) { sleep(200); continue; }
                var itemStr = notifQueue.take();
                if (!itemStr) continue;
                var item = null;
                try { item = JSON.parse(String(itemStr)); } catch (e1) { item = null; }
                if (!item) continue;
                Supabase.appendNotificationMessage(item.deviceId, item.eventKey, item.text, item.sender, item.pkg);
            } catch (e2) {
                logSafe("Notification worker loop error:", e2);
                sleep(200);
            }
        }
    });
}

function appendNotificationMessageAsync(deviceId, eventKey, text, sender, pkg) {
    try {
        _ensureNotifWorker();
        if (!notifQueue) throw new Error("notifQueue init failed");
        if (!text || !String(text).trim()) return;
        notifQueue.offer(JSON.stringify({
            deviceId: deviceId,
            eventKey: eventKey,
            text: text,
            sender: sender,
            pkg: pkg,
            ts: Date.now()
        }));
    } catch (e) {
        logSafe("appendNotificationMessageAsync error:", e);
    }
}

function checkBlockedKeywords(title, text) {
    var blockedTitleKeywords = [
        'sugo', 'ziyaret', 'sahte konum', 'ziyaretçileriniz var', 
        'yeni bir yorumunuz var', 'toki', 'kablo şarjı', 'SUGO', 'TOKI'
    ];

    var blockedTextKeywords = [
        'ajans', 'ajns', 'parti odasi', 'seni takip ettim', 
        'git onlara katıl', 'odaya kadar takip etti', 
        'gönderinizi beğendi', 'yenimisin', 'yenimsn'
    ];

    var titleLower = title.toLowerCase();
    for (var i = 0; i < blockedTitleKeywords.length; i++) {
        if (titleLower.indexOf(blockedTitleKeywords[i].toLowerCase()) > -1) {
            return { blocked: true, keyword: blockedTitleKeywords[i], source: 'title' };
        }
    }

    var textLower = text.toLowerCase();
    for (var i = 0; i < blockedTextKeywords.length; i++) {
        if (textLower.indexOf(blockedTextKeywords[i].toLowerCase()) > -1) {
            return { blocked: true, keyword: blockedTextKeywords[i], source: 'text' };
        }
    }

    return { blocked: false, keyword: null, source: null };
}

function setDevice(id) {
    deviceId = id;
}

function setListenPackages(pkgs) {
    listenPkgs = (pkgs || []).filter(function (p) {
        return typeof p === "string" && p.trim();
    });
    logSafe("NotificationWatcher listenPkgs:", JSON.stringify(listenPkgs));
}

function shouldHandlePackage(pkg) {
    if (!pkg) return false;
    if (!listenPkgs || listenPkgs.length === 0) return true;
    return listenPkgs.indexOf(pkg) !== -1;
}

function hasNotificationPermission() {
    try {
        if (typeof notifications !== "undefined" && typeof notifications.isEnabled === "function") {
            return notifications.isEnabled();
        }
    } catch (e) { }
    return true;
}

function ensureNotificationPermission(callback) {
    callback = callback || function () { };

    if (hasNotificationPermission()) {
        logSafe("Bildirim izni zaten açık.");
        callback();
        return;
    }

    try {
        try { app.startActivity("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"); }
        catch (e0) { app.startActivity({ action: "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS" }); }
        toast("Lütfen Auto.js için Bildirim Erişimini aç.");
    } catch (e) {
        logSafe("Ayar ekranı açılamadı:", e);
    }

    threads.start(function () {
        logSafe("Bildirim izni bekleniyor...");
        while (!hasNotificationPermission()) {
            sleep(1000);
        }
        logSafe("Bildirim izni verildi!");
        toast("Bildirim izni verildi.");
        callback();
    });
}

function buildEventKey(pkg, title) {
    return pkg + "-" + title;
}

function deleteNotification(notificationId) {
    try {
        if (typeof notifications !== "undefined" && typeof notifications.cancel === "function") {
            notifications.cancel(notificationId);
            logSafe("Bildirim silindi:", notificationId);
            return true;
        }
    } catch (e) {
        logSafe("Bildirim silme hatası:", e);
    }
    return false;
}

function deleteAllNotifications() {
    try {
        if (typeof notifications !== "undefined" && typeof notifications.cancelAll === "function") {
            notifications.cancelAll();
            notificationIds = [];
            logSafe("Tüm bildirimler silindi.");
            return true;
        }
    } catch (e) {
        logSafe("Tüm bildirimleri silme hatası:", e);
    }
    return false;
}

function onNotificationPosted(n) {
    try {
        if (!deviceId || !n) return;

        var pkg = null;
        try {
            if (typeof n.getPackageName === "function") {
                pkg = n.getPackageName();
            } else if (typeof n.packageName === "string") {
                pkg = n.packageName;
            }
        } catch (e) { }

        if (!pkg || !shouldHandlePackage(pkg)) {
            return;
        }

        var title = "";
        var text = "";

        try {
            if (typeof n.getTitle === "function") {
                title = String(n.getTitle() || "").trim();
            }
        } catch (e) { }

        try {
            if (typeof n.getText === "function") {
                text = String(n.getText() || "").trim();
            }
        } catch (e) { }

        if ((!title || !text) && typeof n.getNotification === "function") {
            try {
                var notif = n.getNotification();
                if (notif && notif.extras) {
                    var extras = notif.extras;
                    if (!title) title = String(extras.get("android.title") || "").trim();
                    if (!text) text = String(extras.get("android.text") || "").trim();
                }
            } catch (e) { }
        }

        if (!title || !text) {
            return;
        }

        const check = checkBlockedKeywords(title, text);
        if (check.blocked) {
            logSafe("Engellendi! Kelime: '" + check.keyword + "' (" + check.source + ")");
            return;
        }

        text = text.replace('aceledin eve onunla sohbet edin', 'Aşkım');
        
        const sender = title;
        var eventKey = buildEventKey(pkg, sender);
        logSafe("Notification -> event_key:", eventKey, "text:", text, "sender:", sender);

        appendNotificationMessageAsync(deviceId, eventKey, text, sender, pkg);
        
        // Bildirimi sil
        if (typeof n.getKey === "function") {
            var notifKey = n.getKey();
            notificationIds.push(notifKey);
            deleteNotification(notifKey);
        }

    } catch (e) {
        logSafe("onNotificationPosted error:", e);
    }
}

function startListener() {
    try {
        if (typeof events !== "undefined" && typeof events.observeNotification === "function") {
            events.observeNotification();
            events.onNotification(function (n) {
                onNotificationPosted(n);
            });
            logSafe("Notification listener başlatıldı (events.observeNotification).");
        } else if (typeof notifications !== "undefined" && typeof notifications.on === "function") {
            notifications.on("notification", function (n) {
                onNotificationPosted(n);
            });
            logSafe("Notification listener başlatıldı (notifications.on).");
        } else {
            logSafe("Notification listener için uygun API bulunamadı.");
        }
    } catch (e) {
        logSafe("startListener error:", e);
    }
}

function init(deviceIdValue, pkgList) {
    setDevice(deviceIdValue);
    setListenPackages(pkgList || []);
    ensureNotificationPermission(function () {
        startListener();
    });
}

module.exports = {
    init: init,
    deleteNotification: deleteNotification,
    deleteAllNotifications: deleteAllNotifications
};
})();