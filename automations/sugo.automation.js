"auto";


(function(){
const UIUtils = require("../libs/utils.js");
const chatApi = require("../libs/request.js");
const { deleteAllNotifications } = require('../libs/notification.js');
const { logSafe } = require("../libs/logger.js");

// runtime context (main.js init eder)
let DEVICE_ENUMS = null;
let deviceId = null;

function init(ctx) {
  ctx = ctx || {};
  DEVICE_ENUMS = ctx.deviceEnums || ctx.DEVICE_ENUMS || null;
  deviceId = ctx.deviceId || ctx.deviceIdValue || null;

  // Geri uyumluluk: bazı eski modüller global değişken bekleyebilir
  try {
    if (typeof globalThis !== "undefined") {
      globalThis.DEVICE_ENUMS = DEVICE_ENUMS;
      globalThis.deviceId = deviceId;
    }
  } catch (e) {}
}

// Ekran akışında ara ara çıkan popup/yan ekranları hızlı kapatma kuralları.
// Not: Aynı objede iki tane `handle` alanı olursa JS'de sonuncusu ezilir.
// Bu yüzden kuralları ayrı objelere böldüm.
const StepRules = [
    {
        handle: () => {
            const find = UIUtils.isTextVisible("ayrılmak istediğinden emin misin?");
            if (find) {
                log('Leave popup bulundu, kapatılıyor...');
                UIUtils.tap(100, 100, 150);
                return false;
            }
            return true;
        }
    },
    {
        handle: () => {
            const find = UIUtils.isTextVisible("Sohbet odası");
            if (find) {
                log('Sohbet odası ekranı bulundu, geri çıkılıyor...');
                UIUtils.goBack(1);
                return false;
            }
            return true;
        }
    },
    {
        handle: () => {
            const find = UIUtils.isTextVisible("İlişkiler");
            if (find) {
                log('Profil sayfası kapatılıyor...');
                UIUtils.goBack(1);
                return false;
            }
            return true;
        }
    }
];

// Basit performans ölçümü (adım adım süre + toplam).
// Çok hafif: sadece Date.now() + log. İstersen PERF_LOG = false yapıp kapatabilirsin.
const PERF_LOG = true;
function makePerf(label) {
    const enabled = (typeof PERF_LOG === "undefined") ? true : PERF_LOG;
    const t0 = Date.now();
    let last = t0;
    let n = 0;

    function fmt(ms) { return (ms / 1000).toFixed(2) + "s"; }
    function safeLog(msg) { try { log(msg); } catch (e) {} }

    return {
        step: function (name) {
            if (!enabled) return;
            const now = Date.now();
            const d = now - last;
            const total = now - t0;
            n += 1;
            safeLog("[PERF] " + label + " #" + n + " " + name + " +" + fmt(d) + " (toplam " + fmt(total) + ")");
            last = now;
        },
        end: function (name) {
            if (!enabled) return;
            const now = Date.now();
            safeLog("[PERF] " + label + " " + (name || "bitti") + " toplam " + fmt(now - t0));
        }
    };
}




// chatApi çağrısını UI akışıyla paralel çalıştırmak için minimal async helper.
// Auto.js ortamında `threads` yoksa otomatik olarak sync fallback yapar.
function startChatAsync(messages, key) {
    const state = {
        done: false,
        value: "",
        error: null,
        thread: null
    };

    function run() {
        try {
            const v = chatApi.sendChat(messages, key);
            state.value = (v == null) ? "" : String(v);
        } catch (e) {
            state.error = e;
            state.value = "";
        } finally {
            state.done = true;
        }
    }

    try {
        if (typeof threads !== "undefined" && threads && typeof threads.start === "function") {
            state.thread = threads.start(run);
        } else {
            // Fallback: sync
            run();
        }
    } catch (e2) {
        // Thread başlatılamadıysa sync dene
        try { run(); } catch (e3) {}
    }

    state.await = function (timeoutMs) {
        timeoutMs = timeoutMs || 45000;
        if (!state.done) {
            // UIUtils.waitUntil mevcut; interval'i küçük tutup CPU'yu yormayalım
            UIUtils.waitUntil(function () { return state.done; }, timeoutMs, 120);
        }
        return state.value;
    };

    state.cancel = function () {
        try {
            if (state.thread && typeof state.thread.interrupt === "function") {
                state.thread.interrupt();
            }
        } catch (e) {}
    };

    return state;
}



// Artık uygulama sürekli foreground tutulacağı için ağır foreground doğrulamalarını atlıyoruz.
// (Yine de beklenmeyen durumda hafif bir recovery için mevcut bırakıldı.)
function launch(pkg) {
    try {
        if (typeof currentPackage === "function" && currentPackage() === pkg) return true;
    } catch (e) {}
    // En hafif haliyle launch dene (timeout/loop yok)
    try { app.launchPackage(pkg); } catch (e2) {}
    return true;
}

function quickSwipeDown5(opts) {
    opts = opts || {};
    var times = opts.times || 5;
    var gapMs = (opts.gapMs != null) ? opts.gapMs : 120;          // swipe'lar arası bekleme
    var durationMs = (opts.durationMs != null) ? opts.durationMs : 180; // swipe süresi

    var W = (typeof device !== "undefined" && device.width) ? device.width : 720;
    var H = (typeof device !== "undefined" && device.height) ? device.height : 1280;

    var x  = (opts.x  != null) ? opts.x  : ((W * 0.5) | 0);
    var y1 = (opts.y1 != null) ? opts.y1 : ((H * 0.38) | 0); // başlangıç üst-orta
    var y2 = (opts.y2 != null) ? opts.y2 : ((H * 0.82) | 0); // bitiş alt

    for (var i = 0; i < times; i++) {
      swipe(x, y1, x, y2, durationMs); // DOWN swipe -> içerik yukarı kayar
      sleep(gapMs);
    }
}


function answerMessage(payload, attempt) {
    attempt = attempt || 0;
    payload = payload || {};
    const pkg = payload.pkg;
    const nickname = payload.nickname;
    const messages = payload.messages;

    if (!DEVICE_ENUMS || !pkg || !DEVICE_ENUMS[pkg]) {
      logSafe("[sugo] DEVICE_ENUMS eksik veya pkg tanımsız:", pkg);
      return false;
    }
    const perf = makePerf("answerMessage " + pkg + " / " + nickname);
    perf.step("başladı");
    toast(nickname + " kullanıcısına cevap atılıyor...")
    const {messages_page_btn, chat_input_area, send_msg_btn} = DEVICE_ENUMS[pkg];
    log('answer', DEVICE_ENUMS)

    // API cevabını en baştan paralel başlat: UI işleri yapılırken cevap gelsin.
    const key = pkg + "-" + UIUtils.tokenizer(nickname) + '-' + deviceId;
    const chatFuture = startChatAsync(messages, key);
    perf.step("API isteği başlatıldı");

    // 1) Uygulama gerçekten foreground'a geldi mi?
    var launched = launch(pkg)
    perf.step("launch() çağrıldı");
    if(!launched) {
        perf.end("FAIL: launch");
        try { chatFuture.cancel(); } catch (e0) {}
        return false;
    }
    if (!UIUtils.waitForText("Ana sayfa", 6000)) {
        // Artık app foreground kalacak: HOME'a basmak yerine in-app recovery dene
        try { UIUtils.goBack(3); } catch (e1) {}
        if (!UIUtils.waitForText("Ana sayfa", 2500)) {
            perf.end("FAIL: Ana sayfa bulunamadı");
            try { chatFuture.cancel(); } catch (e2) {}
            return false;
        }
    }

    perf.step("Ana sayfa hazır");

    sleep(450)
    UIUtils.runSecurityRules(StepRules)
    // 2) Mesajlar/list ekranında olduğumuzu kanıtla
    UIUtils.clickMessagesButton({
      label: 'Mesajlar', 
      timeoutMs: 2000
    })
    UIUtils.tap(messages_page_btn.x,messages_page_btn.y, 400)
    perf.step("Mesajlar sayfasına geçildi");
    log('Şu kişinin chat ekranına gitmeliyiz >>>', nickname)
    quickSwipeDown5()
    // 3) Chat'i aç (scroll açık: ekranda değilse listede bulabilsin)
    var opened = UIUtils.openChatExactByNick(nickname, pkg);
    perf.step("Chat açma denendi");
    if (!opened.status) {
        perf.end("FAIL: chat açılamadı");
        log("[FAIL] Chat bulunamadı / açılamadı:", nickname);
        try { chatFuture.cancel(); } catch (e6) {}
        return false;
    }
    const cachedRule = UIUtils.runSecurityRules(StepRules)
    perf.step("Security rules kontrol edildi");
    if(cachedRule){
        perf.end("Yeniden dene: popup yakalandı");
        try { chatFuture.cancel(); } catch (e7) {}
      perf.step("Sohbet sekmesi (varsa) tıklandı");
        if (attempt >= 2) {
            perf.end("GIVEUP: popup loop");
            try { chatFuture.cancel(); } catch (e0) {}
            return false;
        }
        sleep(600);
        return answerMessage(payload, attempt + 1)
    }

    // 4) Uygulamanın chat sekmesi varsa (Sohbet gibi) güvenli şekilde tıkla (yoksa sorun değil)
    try {
        UIUtils.runSecurityRules(StepRules)
    } catch (e7) {}
    perf.step("Sohbet sekmesi (varsa) tıklandı");

    // 5) Mesaj yaz + gönder (koordinatlar cihazına göre zaten doğru)
    UIUtils.tap(chat_input_area.x, chat_input_area.y, 400) //input alanına tıklama
    sleep(500)
    UIUtils.showKeyboard()
    sleep(400)
    perf.step("Input focus");

    log("mesaj atılıyor", key)
    perf.step("API cevabı bekleniyor");

    // Input'a gelince cevabın hazır olmasını bekle
    const answer = chatFuture.await(45000);
    perf.step("API cevabı hazır");

    sleep(120)
    UIUtils.typeText(answer) // cevap hazır olmadan yazmaya çalışmayız.
    sleep(300)
    perf.step("Metin yazıldı");
    UIUtils.tap(send_msg_btn.x, send_msg_btn.y, 400)
    sleep(500)
    perf.step("Gönderildi");

    // 6) Temiz çıkış
    UIUtils.goBack(1)
    sleep(100)
    UIUtils.goBack(1)
    //UIUtils.scrollToTop(pkg)

    // Artık HOME'a basmıyoruz; uygulama foreground kalsın.
    sleep(350)

    perf.end("SUCCESS");
    //UIUtils.goHome()
    return true;
}

function findNewMatch(pkg)
{
    const perf = makePerf("findNewMatch " + pkg);
    perf.step("başladı");
    const {main_page_btn, new_members_btn, first_new_member} = DEVICE_ENUMS[pkg];
    var launched = launch(pkg)
    perf.step("launch() çağrıldı");
    if(!launched) {
        perf.end("FAIL: launch");
        return false;
    }
    sleep(2000)
    // 2) Mesajlar/list ekranında olduğumuzu kanıtla
    UIUtils.tap(main_page_btn.x, main_page_btn.y, 400)
    perf.step("Ana sayfa sekmesi tıklandı");
    sleep(2000)
    UIUtils.tap(new_members_btn.x, new_members_btn.y, 800)
    perf.step("Yeni üyeler açıldı");

    sleep(300)

    UIUtils.pullDownTimes(1, 800, 300)
    perf.step("Liste yenilendi (pull down)");
    UIUtils.tap(first_new_member.x, first_new_member.y, 800)
    perf.step("İlk yeni üyeye girildi");
    sleep(2000)
    // HOME'a basma; app foreground kalsın.
    perf.end("SUCCESS");

}
function restartApp() {
  packageName = 'com.fiya.android';
  
  console.log("App restart başladı:", packageName);
  
  try {
      deleteAllNotifications();
  } catch (e) {
      console.log("Bildirim silme hatası:", e);
  }

  UIUtils.forceStopApp(packageName)
  sleep(1500);
  launch(packageName)
  sleep(10000)
}


module.exports = {
    init: init,    
    answerMessage: answerMessage,
    findNewMatch: findNewMatch,
    restartApp: restartApp
}

})();
