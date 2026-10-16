# OPS Portal

Haftalık vardiya Excel dosyalarını ve servis güzergâhlarını tarayıcıda görüntüleyen bağımsız, açık kaynak uygulama.

## Özellikler

- Haftalık Excel dosyasını okuyup departman ve çalışan bazında görüntüleme.
- İki haftayı birlikte yükleme ve gece vardiyasının önceki haftadan devrini gösterme.
- Gün, saat, departman, vardiya tipi ve çalışma durumu filtreleri.
- Kendi çalışan kaydını seçme, vardiya özeti ve servis durağı takibi.
- **Takip listem:** Excel'den en fazla 30 çalışan seçme ve yeni haftada adları otomatik eşleştirme.
- Mobil ve masaüstüne uygun koyu arayüz; Anek Latin yazı tipi.

Excel, güzergâh, tercihler ve takip listesi kullanılan tarayıcıda saklanır. Tarayıcı verilerini temizlediğinizde yerel kayıtlar da silinir; özgün Excel dosyalarınızı saklayın.

## Kurulum

Node.js 22 veya üstü ve npm gerekir.

```sh
npm ci
npm run dev
```

Uygulamayı `http://localhost:3000` adresinde açabilirsiniz.

## Üretim derlemesi

```sh
npm run build
```

Derlenmiş dosyalar `out/` klasörüne oluşturulur.

## Kontroller

```sh
npm run verify
npm run test:browser
```

Tarayıcı testleri sentetik Excel dosyalarıyla çalışır ve Google Chrome gerektirir. Chromium kullanmak için:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:browser
```

## İletişim ve lisans

[vagonla.app@gmail.com](mailto:vagonla.app@gmail.com)

[MIT](LICENSE)
