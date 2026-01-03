"auto";


(function(){
const { Config } = require("../conf.js");
const Supabase = require("./supabase.js");
const { logSafe } = require("./logger.js");

var deviceId = null;
var running = false;
var workerThread = null;


function loop(handler) {
    workerThread = threads.start(function () {
        logSafe("QueueWorker loop başlatıldı. deviceId=" + deviceId);
        while (running) {
            try {
                // Her iterasyonda "bu cihaz hayatta" bilgisini güncelle
                if (deviceId) {
                    Supabase.updateDeviceLastSignal(deviceId);
                }

                var ev = Supabase.fetchOldestPendingEvent(deviceId);
                if (!ev) {
                    // Event yoksa uyku
                    sleep(Config.POLL_INTERVAL_MS);
                    continue;
                }

                // Event bulundu → queue kontrolünü bırak, önce bunu işle
                logSafe("QueueWorker: event bulundu id=" + ev.id);
                handler(ev);

                // İşimiz bitince status = 1
                Supabase.markEventDone(ev.id);

                // Sonra hemen bir sonrakine bakabiliriz (isteğe göre ufak sleep)
                sleep(1000);
            } catch (e) {
                logSafe("QueueWorker döngü hatası:", e);
                sleep(Config.POLL_INTERVAL_MS);
            }
        }
    });
}

function start(deviceIdValue, handler) {
    deviceId = deviceIdValue;
    running = true;
    loop(handler);
}

function stop() {
    running = false;
    try {
        if (workerThread && typeof workerThread.interrupt === "function") {
            workerThread.interrupt();
        }
    } catch (e) {}
}

module.exports = {
    start: start,
    stop: stop
};
})();
