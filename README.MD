# Geliştirilmiş Badge Bulma Sistemi v8.0

## 🎯 Sorun ve Çözüm

### Sorun
- Bazı cihazlarda badge'ler (`id_unread_tcv`) görünmüyor
- Nickname bulma çalışıyor ama badge'e tıklama başarısız oluyor
- Eski kod ID bazlı arama yapıyordu, bu bazı cihazlarda çalışmıyor

### Çözüm
Yeni sistem **parent-child ilişkisi** kullanarak badge'leri buluyor:

1. ✅ Nickname'leri bul (bu zaten çalışıyor)
2. ✅ Her nickname için parent satırı bul (clickable container)
3. ✅ Satır içindeki **tüm child node'ları** tara
4. ✅ Sadece sayısal TextView'ları (1, 12, 99+) badge adayı olarak işaretle
5. ✅ En uygun badge'i seç (sağdaki, küçük boyutlu)
6. ✅ Grup/Sugo badge'lerini exclude et
7. ✅ Bulduğu badge ile chat'i aç

## 📁 Dosya Yapısı

```
improved_badge_finder.js    → Badge bulma mantığı (yeniden yazıldı)
main_queue_v8.js            → Ana queue sistemi (v8 güncelleme)
example_usage.js            → Kullanım örnekleri ve testler
README.md                   → Bu dosya
```

## 🚀 Kullanım

### Temel Kullanım

```javascript
// Module'leri import et
var UnreadQueue = require("./main_queue_v8.js").UnreadQueue;

// Başlat
UnreadQueue.init({
    debug: true,
    maxAttempts: 15,
    
    onFound: function(result) {
        console.log("✅ Bulundu: " + result.userName);
        console.log("📬 Okunmamış: " + result.unreadCount);
        
        // İşlemler yap...
        sleep(3000);
        back();
        
        // Devam et
        UnreadQueue.continueAfterHandler();
    }
}).start();
```

### Manuel Test (Tek Sefer)

```javascript
var ImprovedBadgeFinder = require("./improved_badge_finder.js").ImprovedBadgeFinder;

var result = ImprovedBadgeFinder.findUnreadMessages({});

if (result.found) {
    console.log("Kullanıcı: " + result.userName);
    console.log("Badge: " + result.unreadCount);
    
    // Chat'i aç
    ImprovedBadgeFinder.openChat(result);
}
```

## 🔧 API Referansı

### UnreadQueue

#### `init(options)`
Queue sistemini başlatır.

**Parametreler:**
- `debug` (boolean): Debug log'ları açar/kapar
- `maxAttempts` (number): Maksimum scroll denemesi
- `processedUserExpiry` (number): İşlenmiş kullanıcı timeout (ms)
- `onFound(result)`: Badge bulunduğunda çağrılır
- `onMaxAttempts()`: Max attempts'e ulaşıldığında çağrılır
- `onError(error)`: Hata oluştuğunda çağrılır

#### `start()`
Queue'yu başlatır.

#### `stop()`
Queue'yu durdurur.

#### `pause()`
Queue'yu duraklatır (handler beklerken).

#### `resume()`
Queue'yu devam ettirir.

#### `continueAfterHandler()`
Handler işini bitirdikten sonra devam etmesini söyler.

#### `getStatus()`
Anlık durumu döndürür.

```javascript
{
    version: "8.0.0-prod",
    isActive: true,
    isWaiting: false,
    attemptCount: 5,
    scrollSteps: 5,
    totalFound: 3,
    loopCount: 15,
    errorCount: 0,
    processedUsers: 3,
    device: {
        model: "SM-G991B",
        screen: "1080x2400",
        visibleArea: "250-2350"
    }
}
```

### ImprovedBadgeFinder

#### `findUnreadMessages(processedUsers)`
Okunmamış mesajları bulur.

**Parametreler:**
- `processedUsers` (object): İşlenmiş kullanıcılar objesi

**Dönüş:**
```javascript
{
    found: true,
    userName: "Ahmet",
    unreadCount: 5,
    badgeNode: <UiObject>,
    badgeBounds: <Rect>,
    rowNode: <UiObject>,
    rowBounds: <Rect>
}
```

veya

```javascript
{
    found: false,
    reason: "no_nicknames" | "no_badges" | "error"
}
```

#### `openChat(result)`
Bulunan badge'in chat'ini açar.

**Parametreler:**
- `result`: `findUnreadMessages()` sonucu

**Dönüş:** `true` başarılı, `false` başarısız

## 🧪 Test Senaryoları

### Senaryo 1: Quick Debug
```javascript
// example_usage.js içinde
quickDebug();
```

- 3 kez badge aramayı dener
- Her denemede debug log'ları gösterir
- Bulamazsa scroll yapıp tekrar dener

### Senaryo 2: Manuel Test
```javascript
// example_usage.js içinde
manualBadgeTest();
```

- Tek sefer badge arar
- Bulursa detayları gösterir
- Chat açmayı dener

### Senaryo 3: Full Queue
```javascript
// example_usage.js içinde
testBadgeFinder();
```

- Tam queue sistemi ile çalışır
- Sürekli badge arar ve işler
- Handler ile mesaj gönderme simülasyonu yapar

## 🔍 Debug ve Sorun Giderme

### Log Seviyeleri

```javascript
// Detaylı log
ImprovedBadgeFinder.DEBUG = true;
UnreadQueue.DEBUG = true;

// Sessiz mod
ImprovedBadgeFinder.DEBUG = false;
UnreadQueue.DEBUG = false;
```

### Yaygın Sorunlar

#### 1. "no_nicknames" Hatası
**Sebep:** Nickname node'ları bulunamıyor
**Çözüm:** 
- Mesajlar sayfasında olduğunuzdan emin olun
- Listeyi yukarı kaydırın
- App'ın güncel olduğundan emin olun

#### 2. "no_badges" Hatası
**Sebep:** Badge adayı bulunamıyor
**Olası Nedenler:**
- Hiç okunmamış mesaj yok
- Badge'ler farklı bir view hierarchy'de
- Sayısal badge'ler text formatı farklı

**Debug:**
```javascript
// Manuel XML dump al
var xml = currentComponent().getXml();
console.log(xml);
```

#### 3. Badge Bulunuyor Ama Chat Açılmıyor
**Sebep:** Tıklama koordinatları veya clickable parent bulunamıyor
**Çözüm:**
- `_openChat()` fonksiyonundaki 3 fallback metodu sırasıyla dener
- Log'lara bakın hangi metod çalışıyor

## 🎨 Algoritma Detayları

### Badge Bulma Algoritması

```
1. Nickname node'larını bul
   ├─ id_user_name_tv (package'li)
   ├─ id_user_name_tv (packagesiz)
   └─ FAIL → return no_nicknames

2. Her nickname için:
   ├─ Parent clickable container'ı bul (max 15 level)
   ├─ Container bounds'unu al
   └─ Container'ın TÜM child'larını recursive tara (max 8 level)
       ├─ TextView mi?
       ├─ Text sadece sayısal mı? (^\d+\+?$)
       ├─ Container içinde mi?
       ├─ Boyutu badge boyutunda mı? (15-80px)
       ├─ Sağ tarafta mı? (>%55)
       └─ EVET → badge adayı ekle

3. Tüm badge adaylarını al
   ├─ En sağdakini seç (highest score)
   ├─ Excluded parent kontrolü (grup/sugo)
   └─ PASS → candidate ekle

4. Tüm candidate'leri yukarıdan aşağıya sırala
   └─ İlk candidate'i döndür
```

### Chat Açma Algoritması

```
1. Method 1: Row node direkt click
   └─ rowNode.click()

2. Method 2: Row bounds center koordinat
   └─ press(centerX, centerY, 60)

3. Method 3: Badge'den sola offset tıklama
   └─ press(badgeLeft - 22%, badgeCenterY, 60)
```

## 📊 Performans

- **Badge bulma süresi:** ~200-500ms
- **Chat açma süresi:** ~200-300ms
- **Scroll süresi:** 180-280ms (cihaza göre)
- **Memory:** Minimal (her loop'ta temizlenir)

## 🔒 Güvenlik ve İstikrar

### Hata Yönetimi
- Tüm kritik noktalar try-catch ile korunmuş
- Fallback mekanizmaları mevcut
- Infinite loop koruması var (max attempts)

### Cleanup
- İşlenmiş kullanıcılar otomatik temizlenir
- Memory leak yok
- Graceful shutdown desteklenir

## 🆕 v8.0 Yenilikleri

1. **Tamamen Yeniden Yazılmış Badge Bulma**
   - Parent-child traversal
   - ID'ye bağımlılık yok
   - Recursive child scanning

2. **Çoklu Fallback Mekanizması**
   - 3 farklı tıklama metodu
   - 2 farklı nickname bulma yolu
   - Dinamik koordinat hesaplama

3. **Geliştirilmiş Debug**
   - Daha detaylı log'lar
   - Step-by-step tracking
   - Error reporting

4. **Cihaz Desteği**
   - Android 10+ optimize
   - Farklı view hierarchy'ler
   - Farklı ekran boyutları
   - Farklı yoğunluklar

## 📝 Notlar

- Badge'ler genelde sağ tarafta (%55+) bulunur
- Badge boyutu genelde 15-80px arasındadır
- Grup/Sugo badge'leri otomatik exclude edilir
- Saat değerleri (02:12) badge olarak algılanmaz (: karakteri var)

## 🐛 Bilinen Sınırlamalar

1. Çok derin view hierarchy'lerde (>15 level) parent bulunamayabilir
2. Badge'i olmayan ama başka sayısal TextView'ları olan satırlar false positive olabilir (ancak excluded parent kontrolü ile önlenir)
3. Animasyon sırasında bounds değişebilir (retry mekanizması ile çözülür)

## 📞 Destek

Sorun yaşarsanız:
1. Debug log'ları açın
2. XML dump alın
3. Hangi cihazda olduğunu belirtin
4. Error mesajını paylaşın