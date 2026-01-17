AI Messaging Automation (AutoJs6)

Bu proje, OpenAutoJs ile yazılmış otomasyon kodlarının AutoJs6 modül yapısına uyarlanmış halidir.

Klasör yapısı
- project.json        : AutoJs6 proje manifesti (APK build için)
- main.js             : bootstrap / worker başlatma
- conf.js             : cihaz + supabase + chat api ayarları
- libs/               : yardımcı modüller
  - logger.js         : logSafe (global uyumluluk)
  - supabase.js       : Supabase REST client + queue helpers
  - notification.js   : bildirim dinleyici -> queue event üretir
  - queue.js          : queue consumer (polling)
  - request.js        : Chat API client
  - utils.js          : UI yardımcıları (tap, text, wait, security rules, vb.)
- automations/
  - sugo.automation.js : uygulama içi otomasyon akışı

Çalıştırma
1) conf.js içindeki değerleri kontrol edin (DEVICE_KEY, SUPABASE_*, CHAT_API_*).

Cihaz bazlı config (sabit yol)
- /sdcard/automation_config.txt dosyasından sadece iki alan okunur:
    DEVICE_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    PERSONA=yeliz

  (İsterseniz aynı dosyaya JSON da koyabilirsiniz: {"device_key":"...","persona":"..."})

2) Cihazda AutoJs6 uygulamasını açın, Accessibility iznini verin.
3) Bu klasörü cihazdaki script dizinine kopyalayın (örnek):
   adb push AI-Messaging-Automation /sdcard/Scripts/AI-Messaging-Automation
4) AutoJs6 içinde projeyi açın ve main.js'i çalıştırın.

APK olarak derleme
- AutoJs6 uygulamasında projeyi açıp "Build / Export APK" (adı sürüme göre değişebilir) ile APK üretebilirsiniz.
- Sonra:
   adb install -r /path/to/your.apk

Notlar
- OpenAutoJs tarafında bazı modüller global değişkenlere (logSafe, deviceId, DEVICE_ENUMS) dayanıyordu.
  AutoJs6'da modül scope daha sıkı olduğu için bunlar init() ile context'e taşındı.


  dosya çekme = adb pull /sdcard/Scripts/build/PakizeyeYasMama_v1.2.5.apk ~/Desktop/
  ip alma= adb shell ip -f inet addr show wlan0     
  adb çek= adb shell uiautomator dump --compressed /sdcard/window_dump.xml && adb pull /sdcard/window_dump.xml .
  adb install -r "PakizeyeYasMama_v1.2.6.apk"
  adb push "example_config.txt" "/sdcard/automation_config.txt"

  adb push . /sdcard/Scripts/ 