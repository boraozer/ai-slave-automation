"auto";


(function(){
const { Config } = require("../conf.js");
const { logSafe } = require("./logger.js");

var baseRestUrl = (Config && Config.SUPABASE_URL) ? (Config.SUPABASE_URL + "/rest/v1") : "";

function baseHeaders(withJson) {
    var h = {
        "apikey": Config.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + Config.SUPABASE_ANON_KEY
    };
    if (withJson) {
        h["Content-Type"] = "application/json";
        h["Prefer"] = "return=representation";
    }
    return h;
}

function buildQuery(params) {
    if (!params) return "";
    var parts = [];
    for (var k in params) {
        if (!params.hasOwnProperty(k)) continue;
        if (params[k] === null || typeof params[k] === "undefined") continue;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    }
    return parts.length ? ("?" + parts.join("&")) : "";
}

function get(path, params) {
    if (!baseRestUrl || baseRestUrl.indexOf("http") !== 0) {
        logSafe("Supabase GET error: SUPABASE_URL boş/yanlış olabilir. baseRestUrl=", baseRestUrl);
        return null;
    }
    var url = baseRestUrl + path + buildQuery(params);
    logSafe("GET", url);

    // AutoJs6 ortamında http.get bazı sürümlerde sorun çıkarabiliyor.
    // Bu yüzden tek tip olarak http.request kullanıyoruz.
    var res = null;
    try {
        res = http.request(url, {
            method: "GET",
            headers: baseHeaders(false)
        });
    } catch (e) {
        logSafe("Supabase GET exception", String(e));
        return null;
    }

    if (!res) {
        logSafe("Supabase GET: response null");
        return null;
    }

    if (res.statusCode >= 300) {
        try {
            logSafe("Supabase GET error", res.statusCode, res.body ? res.body.string() : "");
        } catch (e2) {
            logSafe("Supabase GET error", res.statusCode);
        }
        return null;
    }

    var txt = "";
    try {
        txt = res.body ? res.body.string() : "";
    } catch (e3) {
        txt = "";
    }
    if (!txt) return null;

    try {
        return JSON.parse(txt);
    } catch (e) {
        return null;
    }
}

function post(path, bodyObj) {
    var url = baseRestUrl + path;
    var bodyStr = JSON.stringify(bodyObj);
    logSafe("POST", url, bodyStr);

    // DIKKAT: http.request(url, options) şeklinde çağırıyoruz
    var res = http.request(url, {
        method: "POST",
        headers: baseHeaders(true),
        contentType: "application/json",
        body: bodyStr
    });

    if (res.statusCode >= 300) {
        logSafe("Supabase POST error", res.statusCode, res.body.string());
        return null;
    }
    var txt = res.body.string();
    if (!txt) return null;
    try {
        return JSON.parse(txt);
    } catch (e) {
        return null;
    }
}


function patch(path, queryParams, bodyObj) {
    var url = baseRestUrl + path + buildQuery(queryParams);
    var bodyStr = JSON.stringify(bodyObj);
    logSafe("PATCH", url, bodyStr);

    // Yine: ilk argüman URL, ikinci argüman options
    var res = http.request(url, {
        method: "PATCH",
        headers: baseHeaders(true),
        contentType: "application/json",
        body: bodyStr
    });

    if (res.statusCode >= 300) {
        logSafe("Supabase PATCH error", res.statusCode, res.body.string());
        return false;
    }
    return true;
}




// ------------------- DEVICES -------------------

function fetchModelEnums(modelId) {
    if (!modelId) return null;
    logSafe('fetchModelEnums modelId:', modelId);
    var data = get("/device_models", {
        id: "eq." + modelId,
        select: "enums",
        limit: 1
    });
    return data[0].enums
}

function loadDeviceEnumsByModelId(modelId) {
    return fetchModelEnums(modelId);
}

function fetchDeviceByKey(deviceKey) {
    var data = get("/automation_devices", {
        device_key: "eq." + deviceKey,
        select: "id,device_key,description,model_id,status"
    });
    if (!data || !data.length) {
        logSafe("fetchDeviceByKey: cihaz bulunamadı:", deviceKey);
        return null;
    }
    return data[0];
}

function updateDeviceLastSignal(deviceId) {
    var nowIso = new Date().toISOString();
    return patch("/automation_devices", { id: "eq." + deviceId }, {
        last_signal_at: nowIso
    });
}

// ------------------- PACKAGES -------------------

function fetchWatchPackages(deviceId) {
    // devices_watching_pkgs + target_pkg_table join
    var data = get("/devices_watching_pkgs", {
        device_id: "eq." + deviceId,
        select: "target_pkg_table(pkg_name)"
    });
    if (!data) return [];
    var pkgs = [];
    data.forEach(function (row) {
        if (row.target_pkg_table && row.target_pkg_table.pkg_name) {
            pkgs.push(String(row.target_pkg_table.pkg_name));
        }
    });
    logSafe("fetchWatchPackages:", JSON.stringify(pkgs));
    return pkgs;
}

// ------------------- QUEUE: NOTIFICATION -> EVENT -------------------

// device_id + event_key + status=0 için mevcut açık event'i bul
function findOpenEvent(deviceId, eventKey) {
    var data = get("/device_queue_events", {
        device_id: "eq." + deviceId,
        event_key: "eq." + eventKey,
        status: "eq.0",
        select: "id,payload,created_at",
        order: "created_at.asc",
        limit: 1
    });
    if (!data || !data.length) return null;
    return data[0];
}

function insertQueueEvent(deviceId, eventKey, messagesArr, sender, pkg, type) {
    var payload = {
        messages: messagesArr || [],
        type: "unread_messages",
        nickname: sender,
        pkg: pkg
    };
    var body = [{
        device_id: deviceId,
        event_key: eventKey,
        status: 0,
        payload: payload
    }];
    var data = post("/device_queue_events", body);
    if (!data || !data.length) return null;
    return data[0];
}

function insertIdleEvent(deviceId, eventKey) {
    var payload = {
        type: "restart_app",
        pkg: 'com.fiya.android'
    };
    var body = [{
        device_id: deviceId,
        event_key: eventKey,
        status: 0,
        payload: payload
    }];
    var data = post("/device_queue_events", body);
    if (!data || !data.length) return null;
    return data[0];
}

function updateQueueEventPayload(eventId, payloadObj) {
    return patch("/device_queue_events", {
        id: "eq." + eventId
    }, {
        payload: payloadObj
    });
}

// Dışarıdan kullanılacak: bildirim geldiğinde çağır
function appendNotificationMessage(deviceId, eventKey, messageText, sender, pkg) {
    try {
        if (!messageText || !messageText.trim()) return;
        var existing = findOpenEvent(deviceId, eventKey);
        if (!existing) {
            // Yeni event
            insertQueueEvent(deviceId, eventKey, [messageText], sender, pkg);
            return;
        }
        // Mevcut payload'ı parse et
        var payload = existing.payload || {};
        if (!Array.isArray(payload.messages)) {
            payload.messages = [];
        }
        payload.type = payload.type || "unread_messages";

        // basit duplicate kontrol: son mesaj aynıysa ekleme
        if (payload.messages.length > 0 &&
            payload.messages[payload.messages.length - 1] === messageText) {
            logSafe("appendNotificationMessage: aynı mesaj, atlanıyor");
            return;
        }

        payload.messages.push(messageText);
        updateQueueEventPayload(existing.id, payload);
    } catch (e) {
        logSafe("appendNotificationMessage error:", e);
    }
}

// ------------------- QUEUE: CONSUMER -------------------

function fetchOldestPendingEvent(deviceId) {
    var data = get("/device_queue_events", {
        device_id: "eq." + deviceId,
        status: "eq.0",
        select: "id,event_key,payload,created_at",
        order: "created_at.asc",
        limit: 1
    });
    if (!data || !data.length) return null;
    return data[0];
}

function markEventDone(eventId) {
    return patch("/device_queue_events", {
        id: "eq." + eventId
    }, {
        status: 1
    });
}

module.exports = {
    fetchDeviceByKey: fetchDeviceByKey,
    updateDeviceLastSignal: updateDeviceLastSignal,
    fetchWatchPackages: fetchWatchPackages,

    appendNotificationMessage: appendNotificationMessage,

    fetchOldestPendingEvent: fetchOldestPendingEvent,
    markEventDone: markEventDone,
    loadDeviceEnumsByModelId: loadDeviceEnumsByModelId,
    insertIdleEvent: insertIdleEvent
}
})();
