"auto";


(function(){
// utils.js

// -----------------------------------------------------
//  TOKENIZER (genel amaçlı, diğer yerlerde de kullanıyorsun)
// -----------------------------------------------------
function tokenizer(title) {
    // title hiç yoksa (null/undefined) gerçekten unknown diyelim
    if (title === null || title === undefined) return "unknown";

    var original = String(title);
    var s = original.toLowerCase().trim();

    try {
        if (s.normalize) s = s.normalize("NFKD");
    } catch (e) {}

    // Türkçe karakterleri sadeleştir
    s = s
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u")
        .replace(/â/g, "a")
        .replace(/î/g, "i")
        .replace(/û/g, "u");

    // temel leetspeak
    s = s
        .replace(/0/g, "o")
        .replace(/[1!]/g, "i")
        .replace(/3/g, "e")
        .replace(/4/g, "a")
        .replace(/5/g, "s")
        .replace(/7/g, "t");

    // çok tekrar eden harfleri sıkıştır
    s = s.replace(/(.)\1{2,}/g, "$1$1");

    // harf, rakam ve boşluk dışını temizle (emoji vs.)
    s = s.replace(/[^a-z0-9\s]/g, " ");

    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/\s+/g, "_");
    s = s.replace(/^_+|_+$/g, "");

    // BURASI DEĞİŞTİ:
    if (!s) {
        // Hepsi silindiyse, orijinal title'ı (trim'lenmiş) geri ver
        var origTrim = original.trim();
        return origTrim || "unknown";
    }

    return s;
}

// -----------------------------------------------------
//  INTERNAL HELPERS
// -----------------------------------------------------

function _sleep(ms) {
    sleep(ms);
}


// Genel amaçlı: timeout'lu bekleme (UI akışlarını deterministik yapar)
function waitUntil(predicate, timeoutMs, periodMs) {
    timeoutMs = timeoutMs || 12000;
    periodMs = periodMs || 200;
    var t0 = new Date().getTime();
    while (new Date().getTime() - t0 < timeoutMs) {
        try {
            if (predicate()) return true;
        } catch (e) {}
        _sleep(periodMs);
    }
    return false;
}

function _safeCurrentPackage() {
    try {
        return (typeof currentPackage === "function") ? currentPackage() : "";
    } catch (e) {
        return "";
    }
}

// Uygulama gerçekten öne geldi mi? (pkg + kısa stabilite kontrolü)
function ensureAppForeground(pkgName, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 15000;
    var stableMs = opts.stableMs || 600;

    try {
        if (typeof auto !== "undefined" && auto.waitFor) auto.waitFor();
    } catch (e) {}

    // zaten foreground ise hızlı geç
    if (_safeCurrentPackage() === pkgName) {
        _sleep(200);
        if (_safeCurrentPackage() === pkgName) return true;
    }

    // launch
    var ok = launchAppByPkg(pkgName, timeoutMs);
    if (!ok) return false;

    // paket aynı kalsın (splash -> redirect gibi durumlarda daha güvenli)
    var stableOk = waitUntil(function () {
        return _safeCurrentPackage() === pkgName;
    }, stableMs, 100);

    return stableOk;
}

// Mesajlar sayfasında mıyız? (anchor kontrolleri)
function isOnMessagesPage(opts) {
    opts = opts || {};
    var label = opts.label || "Mesajlar";

    try {
        if (id("id_recycler_view").exists()) return true;
    } catch (e) {}

    try {
        // bazı ekranlarda başlık daha iyi anchor olur
        if (text(label).exists()) return true;
    } catch (e2) {}

    try {
        if (id("id_user_name_tv").exists()) return true;
    } catch (e3) {}

    return false;
}

// Mesajlar sayfasına gelmeyi garantile (click + wait + recovery)
function ensureMessagesPage(opts) {
    // opts: { label?:"Mesajlar", timeoutMs?:12000, x?:number, y?:number }
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 12000;

    if (isOnMessagesPage({ label: opts.label || "Mesajlar" })) return true;

    var ok = waitUntil(function () {
        if (isOnMessagesPage({ label: opts.label || "Mesajlar" })) return true;
        // butona basmayı dene (text yoksa x/y fallback'i devreye girer)
        clickMessagesButton(opts.label || opts);
        _sleep(250);
        return isOnMessagesPage({ label: opts.label || "Mesajlar" });
    }, timeoutMs, 300);

    if (ok) return true;

    // Recovery: bir geri + tekrar dene
    goBack(1);
    _sleep(400);
    clickMessagesButton(opts.label || opts);
    _sleep(500);

    return isOnMessagesPage({ label: opts.label || "Mesajlar" });
}

function _clickNodeOrParent(node) {
    if (!node) return false;
    try {
        var n = node;
        for (var i = 0; i < 6 && n; i++) {
            if (n.clickable()) {
                n.click();
                _sleep(300);
                return true;
            }
            n = n.parent();
        }
    } catch (e) {}
    return false;
}

// -----------------------------------------------------
//  STABILITY HELPERS (bekleme / doğrulama)
// -----------------------------------------------------

function _safeCurrentPackage() {
    try { return currentPackage(); } catch (e) { return ""; }
}

function waitUntil(predicate, timeoutMs, periodMs) {
    timeoutMs = timeoutMs || 12000;
    periodMs = periodMs || 200;

    var t0 = new Date().getTime();
    while (new Date().getTime() - t0 < timeoutMs) {
        try {
            if (predicate()) return true;
        } catch (e) {}
        _sleep(periodMs);
    }
    return false;
}

function ensureAppForeground(pkgName, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 15000;
    var stableMs = opts.stableMs || 500;

    // Accessibility hazır değilse selector'lar bazen boş döner
    try { if (auto && auto.waitFor) auto.waitFor(); } catch (e) {}

    // zaten öndeyse hızlı geç
    if (_safeCurrentPackage() === pkgName) return true;

    app.launchPackage(pkgName);

    var ok = waitUntil(function () {
        return _safeCurrentPackage() === pkgName;
    }, timeoutMs, 200);

    if (!ok) return false;

    // kısa bir stabilizasyon: paket aynı mı? (splash -> başka pkg gibi anlık geçişler için)
    var tStable = new Date().getTime();
    while (new Date().getTime() - tStable < stableMs) {
        if (_safeCurrentPackage() !== pkgName) return false;
        _sleep(100);
    }

    return true;
}

function isOnMessagesPage(opts) {
    opts = opts || {};
    // Bu projede mesaj listesi için kullandığın ana anchor
    var rvId = opts.recyclerViewId || "id_recycler_view";

    try {
        if (id(rvId).exists()) return true;
    } catch (e) {}

    try {
        var rv = id(rvId).findOne(200);
        if (rv) return true;
    } catch (e2) {}

    // Alternatif: kullanıcı adı satırları görünüyorsa da listede say
    try {
        if (id("id_user_name_tv").exists()) return true;
    } catch (e3) {}

    return false;
}

function ensureMessagesPage(opts) {
    // opts: { label?: "Mesajlar", timeoutMs?: 12000, x?:, y?: }
    opts = opts || {};
    var label = opts.label || "Mesajlar";
    var timeoutMs = opts.timeoutMs || 12000;

    if (isOnMessagesPage(opts)) return true;

    // Önce ilgili sekmeye/butona basmayı dene
    clickMessagesButton({
        label: label,
        timeoutMs: Math.min(2500, timeoutMs),
        x: opts.x,
        y: opts.y
    });

    // Sonra anchor gelene kadar bekle
    var ok = waitUntil(function () {
        return isOnMessagesPage(opts);
    }, timeoutMs, 200);

    if (ok) return true;

    // Recovery: 2 kez back + tekrar dene (yanlış ekranda kalma / popup)
    goBack(2);
    _sleep(400);
    clickMessagesButton({
        label: label,
        timeoutMs: Math.min(2500, timeoutMs),
        x: opts.x,
        y: opts.y
    });

    return waitUntil(function () {
        return isOnMessagesPage(opts);
    }, Math.max(2500, Math.floor(timeoutMs / 2)), 200);
}

// -----------------------------------------------------
//  1) pkg name ile uygulama launch etme
// -----------------------------------------------------
function launchAppByPkg(pkgName, timeoutMs) {
    timeoutMs = timeoutMs || 8000;

    app.launchPackage(pkgName);

    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            if (currentPackage() === pkgName) {
                return true;
            }
        } catch (e) {}
        _sleep(300);
    }
    return false;
}

// -----------------------------------------------------
//  2) Android geri tuşu
// -----------------------------------------------------
function goBack(times) {
    times = times || 1;
    for (var i = 0; i < times; i++) {
        back();
        _sleep(300);
    }
}

// -----------------------------------------------------
//  3) Ana ekrana dönme
// -----------------------------------------------------
function goHome() {
    home();
    _sleep(500);
}

// -----------------------------------------------------
//  4) Ana ekrandaki "Mesajlar" butonuna tıklama
// -----------------------------------------------------
/**
 * opts: {
 *   label?: "Mesajlar",
 *   timeoutMs?: 5000,
 *   x?: 100, y?: 200
 * }
 */
function clickMessagesButton(opts) {
    // Backward compatible: clickMessagesButton("Mesajlar") veya clickMessagesButton({label:"Mesajlar"})
    if (typeof opts === "string") opts = { label: opts };
    opts = opts || {};
    var label = opts.label || "Mesajlar";
    var timeoutMs = opts.timeoutMs || 5000;
    var x = opts.x;
    var y = opts.y;

    var start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            var btn = text(label).clickable().findOne(300);
            if (btn) {
                if (_clickNodeOrParent(btn)) return true;
            }
        } catch (e) {}

        try {
            var btn2 = textContains(label).findOnce();
            if (btn2 && _clickNodeOrParent(btn2)) return true;
        } catch (e2) {}

        _sleep(300);
    }

    if (typeof x === "number" && typeof y === "number") {
        click(x, y);
        _sleep(500);
        return true;
    }

    return false;
}


// -----------------------------------------------------
//  6) Chat ekranında verilen koordinatlara tıklama
// -----------------------------------------------------
function tap(x, y, delayMs) {
    delayMs = delayMs || 300;
    click(x, y);
    _sleep(delayMs);
}

// -----------------------------------------------------
//  7) Text ile metin yazma (hızlı)
// -----------------------------------------------------
function typeText(text) {
    if (!text && text !== "") return;

    try {
        if (typeof setText === "function") {
            setText(String(text));
            _sleep(200);
            return;
        }
    } catch (e) {}

    try {
        input(String(text));
        _sleep(200);
    } catch (e2) {}
}

// -----------------------------------------------------
//  8) Text ile metin yazma (harf harf, yavaş)
// -----------------------------------------------------
function typeTextSlow(text, perCharDelay) {
    if (!text && text !== "") return;
    perCharDelay = perCharDelay || 70;

    var s = String(text);
    for (var i = 0; i < s.length; i++) {
        try {
            input(s.charAt(i));
        } catch (e) {}
        _sleep(perCharDelay);
    }
}

function pullDownTimes(times, durationMs, pauseMs) {
    if (times == null) times = 5;
    if (durationMs == null) durationMs = 700;
    if (pauseMs == null) pauseMs = 900;

    var x = Math.floor(device.width * 0.5);
    var yStart = Math.floor(device.height * 0.22); // üstten başla
    var yEnd   = Math.floor(device.height * 0.82); // aşağı çek

    for (var i = 0; i < times; i++) {
      swipe(x, yStart, x, yEnd, durationMs);
      sleep(pauseMs);
    }
  }

  function openChatExactByNick(targetText, pkg) {
    var DEBUG_OPENCHAT = false;
    function dlog() { if (DEBUG_OPENCHAT) console.log.apply(console, arguments); }

    console.log("🔍 Arama başlıyor: " + targetText);

    var scrollCount = 0;

    // ✅ Sadece 5 kere ara/scroll et
    var maxScrollAttempts = 5;

    var seenConfigurations = [];

    var chatItemSelector = className("android.view.ViewGroup")
      .id(pkg + ":id/ll_chat_item")
      .visibleToUser(true);

    var nameTvSelectorBase = className("android.widget.TextView")
      .id(pkg + ":id/id_user_name_tv")
      .visibleToUser(true);

    var nameTvSelectorTarget = className("android.widget.TextView")
      .id(pkg + ":id/id_user_name_tv")
      .text(targetText)
      .visibleToUser(true);

    function findChatItemFromNameNode(nameNode) {
      try {
        var n = nameNode;
        for (var k = 0; k < 10 && n; k++) {
          try {
            if (typeof n.id === "function" && n.id() === (pkg + ":id/ll_chat_item")) return n;
          } catch (e0) {}
          try { n = n.parent(); } catch (e1) { n = null; }
        }
      } catch (e2) {}

      try {
        var b = nameNode.bounds();
        var cx = b.centerX(), cy = b.centerY();
        var items = chatItemSelector.find();
        for (var i = 0; i < items.length; i++) {
          var ib = items[i].bounds();
          if (cx >= ib.left && cx <= ib.right && cy >= ib.top && cy <= ib.bottom) return items[i];
        }
      } catch (e3) {}

      return null;
    }

    function safeClickChatItem(nameNode) {
      var item = findChatItemFromNameNode(nameNode);
      if (item) {
        var ib = item.bounds();
        click(ib.centerX(), ib.centerY()); // ✅ satırın ortası
        return true;
      } else {
        var b = nameNode.bounds();
        click(b.centerX(), b.centerY());
        return false;
      }
    }

    // ✅ 5 denemelik arama/scroll döngüsü (liste AŞAĞI iner)
    for (var attempt = 0; attempt < maxScrollAttempts; attempt++) {
      var directNode = null;
      try { directNode = nameTvSelectorTarget.findOnce(); } catch (e1) {}

      if (directNode) {
        dlog("✅ BULUNDU:", targetText);
        sleep(120);
        safeClickChatItem(directNode);
        sleep(300);
        return { status: true, scroll_count: scrollCount, target: targetText };
      }

      // Konfigürasyon / liste sonu kontrolü
      var nameNodes = null;
      try { nameNodes = nameTvSelectorBase.find(); } catch (e2) { nameNodes = null; }

      if (!nameNodes || nameNodes.length === 0) {
        // ✅ aşağı in: parmak yukarı
        swipe(360, 1000, 360, 500, 250);
        sleep(170);
        scrollCount++;
        continue;
      }

      var currentConfig = [];
      for (var i = 0; i < nameNodes.length; i++) {
        try {
          var t = nameNodes[i].text();
          if (t != null) currentConfig.push(String(t).trim());
        } catch (e3) {}
      }

      var configStr = currentConfig.join("|");
      if (seenConfigurations.indexOf(configStr) !== -1) {
        console.log("✗ Liste sonu");
        return { status: false, scroll_count: scrollCount, target: targetText, reason: "Liste sonu" };
      }
      seenConfigurations.push(configStr);
      if (seenConfigurations.length > 5) seenConfigurations.shift();

      // ✅ aşağı in: parmak yukarı
      swipe(360, 1000, 360, 500, 250);
      sleep(170);
      scrollCount++;
    }

    console.log("✗ 5 denemede bulunamadı");
    return { status: false, scroll_count: scrollCount, target: targetText, reason: "Max attempts(5)" };
  }



// En başa git
function scrollToTop(pkg) {
    console.log("⬆️  En başa gidiliyor...");

    var maxAttempts = 100;
    var lastTopValue = -1;
    var sameTopCount = 0;

    var chatItemSelector = className("android.view.ViewGroup")
        .id(pkg + ":id/ll_chat_item")
        .visibleToUser(true);

    for (var i = 0; i < maxAttempts; i++) {

        var chatItems = chatItemSelector.find();

        if (chatItems.length === 0) {
            swipe(360, 600, 360, 1100, 300);
            sleep(100);
            continue;
        }

        var firstItemTop = chatItems[0].bounds().top;

        console.log("📍 Deneme " + (i + 1) + ": Top = " + firstItemTop);

        if (firstItemTop === lastTopValue) {
            sameTopCount++;
            if (sameTopCount >= 2) {
                console.log("✅ En başa ulaşıldı! (Top: " + firstItemTop + ")");
                return { 
                    status: true,
                    attempts: i,
                    topPosition: firstItemTop
                };
            }
        } else {
            sameTopCount = 0;
        }

        lastTopValue = firstItemTop;

        swipe(360, 600, 360, 1100, 300);
        sleep(100);
    }

    console.log("✅ Maksimum deneme tamamlandı");
    return { 
        status: true,
        attempts: maxAttempts
    };
}
function waitUntil(fn, timeoutMs, intervalMs) {
    // Default'lar: undefined gelirse NaN olup anında false dönmesin.
    if (timeoutMs == null) timeoutMs = 12000;
    if (intervalMs == null) intervalMs = 200;
    if (intervalMs < 10) intervalMs = 10;

    const end = Date.now() + timeoutMs;
    let now;
    while ((now = Date.now()) < end) {
        try { if (fn()) return true; } catch (e) {}
        sleep(intervalMs);
    }
    return false;
}

  function waitStable(condFn, stableMs, timeoutMs, intervalMs) {
    if (stableMs == null) stableMs = 800;
    if (timeoutMs == null) timeoutMs = 15000;
    if (intervalMs == null) intervalMs = 200;
    if (intervalMs < 10) intervalMs = 10;

    const end = Date.now() + timeoutMs;
    let okSince = 0;

    while (Date.now() < end) {
      const ok = !!condFn();
      if (ok) {
        if (!okSince) okSince = Date.now();
        if (Date.now() - okSince >= stableMs) return true;
      } else {
        okSince = 0;
      }
      sleep(intervalMs);
    }
    return false;
  }

  function launchAndWaitText(pkg, text) {
    if (!launchAppByPkg(pkg, 8000)) return false;

    // Paket gerçekten önde mi?
    if (!waitUntil(() => currentPackage() === pkg, 15000, 200)) return false;

    // "Mesajlar" text'i geldi mi? (contains daha toleranslı)
    const mesajlarReady = () =>
      (text(text).exists() || textContains(text).exists());

    if (!waitUntil(mesajlarReady, 45000, 200)) {
      log("[FAIL] '"+text+"' text'i gelmedi");
      return false;
    }

    // Kısa süre stabil kalsın (splash/transition false-positive'lerini azaltır)
    if (!waitStable(() => currentPackage() === pkg && mesajlarReady(), 800, 15000, 200)) {
      log("[FAIL] '"+text+"' stabil değil / app yeniden başlamış olabilir");
      return false;
    }

    return true;
  }

  function waitForText(txt, timeout) {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      if (text(txt).findOne(100) != null) {
        return true;
      }
      sleep(200);
    }

    return false;
  }

  function runSecurityRules(rules) {
    // rules: [{ handle: ()=> boolean }] -> handle false => popup yakalandı / işlem durdurulmalı
    var triggered = false;
    rules = rules || [];
    for (let i = 0; i < rules.length; i++) {
        var rule = rules[i];
        try {
            sleep(200);
            const ok = rule && typeof rule.handle === "function" ? rule.handle() : true;
            if (!ok) {
                triggered = true;
                // Birden fazla popup arka arkaya çıkabiliyor; hepsini denemek için devam ediyoruz.
            }
        } catch (e) {
            try { log("Security rule error:", e); } catch (e2) {}
        }
    }
    return triggered;
}

function isTextVisible(strOrRegex) {
    // Auto.js: text()/textMatches() selector + exists() 
    if (strOrRegex instanceof RegExp) return textMatches(strOrRegex).exists();
    return text(strOrRegex).exists();
  }



  // -----------------------------------------------------
//  IDLE / RECOVERY HELPERS
//  - Bildirimleri temizle
//  - Uygulamayı öldür (force stop) + yeniden launch et
// -----------------------------------------------------

function _clickNode(node) {
    if (!node) return false;
    try {
        if (typeof node.click === "function" && node.click()) return true;
    } catch (e) {}
    try {
        var b = node.bounds();
        click(b.centerX(), b.centerY());
        return true;
    } catch (e2) {}
    return false;
}

function clearAllNotifications(opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 2000;

    try { openNotification(); } catch (e) { return false; }
    sleep(600);

    var btn = null;
    try {
        btn =
            textMatches(/(Tümünü\s*(temizle|sil)|Hepsini\s*(temizle|sil)|Clear\s*all|Dismiss\s*all)/i).findOne(timeoutMs) ||
            descMatches(/(Tümünü\s*(temizle|sil)|Hepsini\s*(temizle|sil)|Clear\s*all|Dismiss\s*all)/i).findOne(timeoutMs) ||
            idMatches(/.*(clear_all|dismiss_all|clearAll|btn_clear_all|notification_clear_all).*/i).findOne(timeoutMs);
    } catch (e1) {}

    if (btn) {
        _clickNode(btn);
        sleep(300);
    }

    // paneli kapat
    try { back(); } catch (e2) {}
    sleep(250);

    return !!btn;
}

function forceStopApp(packageName) {
    packageName = packageName || 'com.fiya.android';
    
    console.log("Force Stop başladı:", packageName);
    
    try {
        deleteAllNotifications();
    } catch (e) {}

    // ADIM 1: Uygulamanın Uygulama Bilgileri sayfasını aç
    try {
        console.log("Uygulama Bilgileri sayfası açılıyor...");
        app.startActivity({
            action: "android.settings.APPLICATION_DETAILS_SETTINGS",
            data: "package:" + packageName,
            flags: 0x10000000
        });
        sleep(3000);
        console.log("Uygulama Bilgileri açıldı");
    } catch (e) {
        console.log("Uygulama Bilgileri açılamadı:", e);
        return false;
    }

    // ADIM 2: Ekranı scroll et (Force Stop butonu aşağıda olabilir)
    try {
        console.log("Ekran scroll ediliyor...");
        for (var i = 0; i < 5; i++) {
            swipe(device.width / 2, device.height / 2, device.width / 2, device.height / 2 - 200, 500);
            sleep(600);
        }
        sleep(1000);
    } catch (e) {
        console.log("Scroll hatası:", e);
    }

    // ADIM 3: UIAutomator ile "Force Stop" butonunu bul (EN GÜVENİLİR)
    var forceStopFound = false;
    
    // İngilizce "Force Stop"
    try {
        console.log("İngilizce Force Stop arıyor...");
        var btn = desc("Force Stop");
        if (btn && btn.findOnce()) {
            console.log("Force Stop (desc) bulundu");
            click(btn);
            sleep(1500);
            forceStopFound = true;
        }
    } catch (e) {
        console.log("Desc Force Stop hatası:", e);
    }

    // Text ile ara (İngilizce)
    if (!forceStopFound) {
        try {
            console.log("Text Force Stop arıyor...");
            var btn = text("Force Stop");
            if (btn && btn.findOnce()) {
                console.log("Force Stop (text) bulundu");
                click(btn);
                sleep(1500);
                forceStopFound = true;
            }
        } catch (e) {
            console.log("Text Force Stop hatası:", e);
        }
    }

    // Büyük harfle ara
    if (!forceStopFound) {
        try {
            console.log("FORCE STOP (uppercase) arıyor...");
            var btn = textContains("Force").find();
            for (var i = 0; i < btn.length; i++) {
                var btnText = btn[i].text();
                if (btnText && (btnText.indexOf("Force") !== -1 || btnText.indexOf("force") !== -1)) {
                    console.log("Force Stop bulundu:", btnText);
                    click(btn[i]);
                    sleep(1500);
                    forceStopFound = true;
                    break;
                }
            }
        } catch (e) {
            console.log("TextContains Force hatası:", e);
        }
    }

    // Türkçe "Uygulamayı Durdur" / "Zorla Durdur"
    if (!forceStopFound) {
        try {
            console.log("Türkçe seçenekleri arıyor...");
            var turkishOptions = [
                "Zorla Durdur",
                "Uygulamayı Durdur",
                "Durdur"
            ];
            
            for (var i = 0; i < turkishOptions.length; i++) {
                var btn = text(turkishOptions[i]);
                if (btn && btn.findOnce()) {
                    console.log("Türkçe buton bulundu:", turkishOptions[i]);
                    click(btn);
                    sleep(1500);
                    forceStopFound = true;
                    break;
                }
            }
        } catch (e) {
            console.log("Türkçe buton hatası:", e);
        }
    }

    // ADIM 4: Eğer buton hala bulunamadıysa, className ile ara (Button)
    if (!forceStopFound) {
        try {
            console.log("Button className ile arıyor...");
            var buttons = className("android.widget.Button").find();
            console.log("Toplam button sayısı:", buttons.length);
            
            // Son 3 butonu kontrol et (Force Stop genellikle sonlarda)
            for (var i = Math.max(0, buttons.length - 5); i < buttons.length; i++) {
                var btnText = buttons[i].text();
                console.log("Buton " + i + ":", btnText);
                
                if (btnText && 
                    (btnText.indexOf("Force") !== -1 || 
                     btnText.indexOf("force") !== -1 ||
                     btnText.indexOf("Durdur") !== -1 ||
                     btnText.indexOf("durdur") !== -1)) {
                    console.log("Button bulundu tıklanıyor:", btnText);
                    click(buttons[i]);
                    sleep(1500);
                    forceStopFound = true;
                    break;
                }
            }
        } catch (e) {
            console.log("Button className hatası:", e);
        }
    }

    if (!forceStopFound) {
        console.log("Force Stop butonu bulunamadı!");
    }

    // ADIM 5: Dialog/Popup çıkarsa "OK" / "TAMAM" tıkla - GARANTILI
    console.log("Dialog button tıklama başladı...");
    sleep(2000);
    
    var dialogClicked = false;
    var maxRetries = 3;
    var retryCount = 0;
    
    while (!dialogClicked && retryCount < maxRetries) {
        retryCount++;
        console.log("Dialog tıklama denemesi " + retryCount + "/" + maxRetries);
        
        try {
            // Yöntem 1: Tüm button'ları bul
            var allButtons = className("android.widget.Button").find();
            console.log("Toplam button sayısı:", allButtons.length);
            
            if (allButtons && allButtons.length > 0) {
                // Son butonu tıkla (dialog'un OK/TAMAM butonu genellikle son)
                var lastBtn = allButtons[allButtons.length - 1];
                var lastBtnText = lastBtn.text();
                console.log("Son buton text:", lastBtnText);
                
                if (lastBtnText && (lastBtnText.indexOf("OK") !== -1 || 
                                   lastBtnText.indexOf("TAMAM") !== -1 || 
                                   lastBtnText.indexOf("Tamam") !== -1 ||
                                   lastBtnText.indexOf("TAM") !== -1 ||
                                   lastBtnText.indexOf("Yes") !== -1)) {
                    console.log("Dialog butonu tıklanıyor (text):", lastBtnText);
                    lastBtn.click();
                    sleep(1500);
                    dialogClicked = true;
                    break;
                }
            }
        } catch (e) {
            console.log("Button find hatası:", e);
        }
        
        if (!dialogClicked) {
            try {
                // Yöntem 2: Koordinat ile tıkla (dialog butonu genellikle ekranın altında)
                console.log("Koordinat ile dialog button tıklanıyor...");
                var btnX = device.width / 2;
                var btnY = device.height - 150;
                tap(btnX, btnY, 300);
                sleep(1500);
                dialogClicked = true;
                break;
            } catch (e) {
                console.log("Koordinat tıklama hatası:", e);
            }
        }
        
        if (!dialogClicked) {
            sleep(500);
        }
    }
    
    if (dialogClicked) {
        console.log("Dialog butonu başarıyla tıklandı");
    } else {
        console.log("Dialog butonu tıklamada sorun yaşandı, devam ediliyor...");
    }
    
    sleep(1000);

    // ADIM 6: Ayarlardan çık
    try {
        console.log("Ayarlardan çıkılıyor...");
        for (let i = 0; i < 4; i++) {
            back();
            sleep(400);
        }
        sleep(1000);
    } catch (e) {
        console.log("Back hatası:", e);
    }

    // ADIM 7: Home'a git
    try {
        home();
        sleep(1500);
    } catch (e) {
        console.log("Home hatası:", e);
    }

    // ADIM 8: Hafıza temizliği için bekleme
    sleep(2000);

    // ADIM 9: Uygulamayı tekrar aç
    try {
        console.log("Uygulama başlatılıyor:", packageName);
        app.startActivity({
            package: packageName,
            action: "android.intent.action.MAIN",
            flags: 0x10000000
        });
        sleep(4000);
        console.log("=== FORCE STOP + RESTART BAŞARILI ===");
        return true;
    } catch (e) {
        console.log("Başlat hatası:", e);
        return false;
    }
}

// Kullanım:
// forceStopApp('com.fiya.android');



function restart_app(pkg, opts) {
    opts = opts || {};
    var clearNotifs = (opts.clearNotifs !== false);
    var waitText = opts.waitText || null;       // ör: "Ana sayfa"
    var waitTimeout = opts.waitTimeout || 8000;

    try { log("restart_app:", pkg); } catch (e) {}

    if (clearNotifs) {
        try { clearAllNotifications(); } catch (e1) {}
    }

    try { forceStopApp(pkg); } catch (e2) {}
    sleep(250);

    try { app.launchPackage(pkg); } catch (e3) {}

    // pkg gerçekten foreground oldu mu?
    try { waitUntil(() => currentPackage() === pkg, 15000, 200); } catch (e4) {}

    if (waitText) {
        try { waitForText(waitText, waitTimeout); } catch (e5) {}
    }

    return true;
}

function showKeyboard() {
    try {
        if (typeof showInputMethod === "function") {
            showInputMethod();
            sleep(800);
            return true;
        }
    } catch (e) {
        console.log("Keyboard hatası:", e);
    }
    return false;
}

// -----------------------------------------------------
//  EXPORTS
// -----------------------------------------------------
module.exports = {
    tokenizer: tokenizer,

    // Stability helpers
    waitUntil: waitUntil,
    ensureAppForeground: ensureAppForeground,
    isOnMessagesPage: isOnMessagesPage,
    ensureMessagesPage: ensureMessagesPage,

    // Navigation / controls
    launchAppByPkg: launchAppByPkg,
    goBack: goBack,
    goHome: goHome,

    clickMessagesButton: clickMessagesButton,
    openChatExactByNick: openChatExactByNick,
    tap: tap,
    typeText: typeText,
    typeTextSlow: typeTextSlow,
    pullDownTimes: pullDownTimes,
    launchAndWaitText: launchAndWaitText,
    waitForText:waitForText,
    runSecurityRules: runSecurityRules,
    isTextVisible: isTextVisible,
    scrollToTop:scrollToTop,

      // NEW
    clearAllNotifications: clearAllNotifications,
    forceStopApp: forceStopApp,
    restart_app: restart_app,
    showKeyboard: showKeyboard
};
})();
