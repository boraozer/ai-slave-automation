Aşağıdaki “operatör akışı” Samsung A10’da tek seferde en kritik 3 izni (Erişilebilirlik + Bildirim okuma + Tüm dosyalar) ADB ile hızlıca açmak için. Komutları CMD’de satır satır çalıştır.

0) Bağlantı kontrol
adb devices

1) (Varsa) “Kısıtlı ayarlar” kilidini aç (zararı yok, dursun)
adb shell cmd appops set com.bora.aimessagingautomation ACCESS_RESTRICTED_SETTINGS allow

2) Tüm dosyalara erişim (All files access)
adb shell appops set --uid com.bora.aimessagingautomation MANAGE_EXTERNAL_STORAGE allow


(İsteğe bağlı, bazı sürümlerde gerekebilir)

adb shell pm grant com.bora.aimessagingautomation android.permission.MANAGE_EXTERNAL_STORAGE

3) Erişilebilirlik (Sende çalışan yöntem — component hazır)
adb shell settings put --user 0 secure enabled_accessibility_services "com.bora.aimessagingautomation/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher"
adb shell settings put --user 0 secure accessibility_enabled 1


Kontrol:

adb shell settings get --user 0 secure enabled_accessibility_services

adb shell settings get --user 0 secure enabled_accessibility_services
4) Bildirimleri okuma (Notification Listener)

Önce servis component’ini bul:

adb shell dumpsys package com.bora.aimessagingautomation | findstr /I BIND_NOTIFICATION_LISTENER_SERVICE

 8953ea7 com.bora.aimessagingautomation/org.autojs.autojs.core.notification.NotificationListenerService filter cccbf54 permission android.permission.BIND_NOTIFICATION_LISTENER_SERVICE


Çıktıda şuna benzer bir component görmelisin:
com.bora.aimessagingautomation/.SomeNotificationListener

Sonra o component’i şu komutta kullan:

adb shell cmd notification allow_listener "com.bora.aimessagingautomation/org.autojs.autojs.core.notification.NotificationListenerService"


Eğer bu komut cihazında yok/hata verirse (yedek yöntem):

adb shell settings put --user 0 secure enabled_notification_listeners "com.bora.aimessagingautomation/.SomeNotificationListener"


Kontrol:

adb shell settings get --user 0 secure enabled_notification_listeners

İstersen “tek blok” kopyala-yapıştır (Notification component’i hariç)

Bu blok, bildirim listener hariç her şeyi tek seferde yapar:

adb devices
adb shell cmd appops set com.bora.aimessagingautomation ACCESS_RESTRICTED_SETTINGS allow
adb shell appops set --uid com.bora.aimessagingautomation MANAGE_EXTERNAL_STORAGE allow
adb shell settings put --user 0 secure enabled_accessibility_services "com.bora.aimessagingautomation/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher"
adb shell settings put --user 0 secure accessibility_enabled 1


Bildirim listener için bulduğun satırı buraya yapıştır (BIND_NOTIFICATION_LISTENER_SERVICE çıktısı). Ben de component’i tam isimle yerine koyup sana “tek satır net komut” olarak geri vereyim.