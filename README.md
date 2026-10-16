# OPS Portal

Haftalık vardiya Excel dosyalarını ve servis güzergâhlarını tarayıcıda görüntüleyen bağımsız, açık kaynak uygulama.

## Özellikler

- Haftalık Excel dosyasını cihazda okuyup departman ve çalışan bazında görüntüleme.
- İki haftayı birlikte yükleme; gece vardiyasının önceki haftadan devrini hesaplama.
- Gün, saat, departman, vardiya tipi ve çalışma durumu filtreleri.
- Kendi çalışan kaydını seçme, vardiya özeti ve servis durağı takibi.
- **Takip listem:** Excel'den en fazla 30 çalışan seçme ve yeni dosyada adları otomatik eşleştirme.
- Mobil ve masaüstüne uygun koyu arayüz; Anek Latin yazı tipi.

Hesap veya sunucu veritabanı gerekmez. Excel, güzergâh, tercihler ve takip listesi yalnızca kullanılan tarayıcıda saklanır. Dosyalar sunucuya yüklenmez. Tarayıcı verileri silinirse yerel kayıtlar da silinir; özgün Excel dosyalarınızı saklayın. Uygulama kullanım analitiği toplamaz.

## Kurulum

Node.js 22 veya üstü ve npm gerekir.

```sh
npm ci
npm run dev
```

Geliştirme adresi: `http://localhost:3000`.

## Kontroller

```sh
npm run verify
npm run test:browser
```

İlk komut lint, Worker tip kontrolü, birim testleri ve statik üretim derlemesini çalıştırır. Tarayıcı testleri sentetik Excel verileri kullanır; Google Chrome kurulu olmalıdır. Alternatif olarak `npx playwright install chromium` sonrasında `PLAYWRIGHT_CHANNEL=chromium npm run test:browser` çalıştırın. Test sunucusu otomatik olarak 8837 portunda açılır.

## Kendi sunucunda çalıştırma

```sh
npm run build
```

Üretilen `out/` klasörünü herhangi bir statik web sunucusunda yayımlayabilirsiniz. Veritabanı, OAuth istemcisi veya gizli anahtar gerekmez. Google Fonts dosyaları derleme sırasında indirilir ve uygulamanın kendi sunucusundan servis edilir.

Cloudflare Workers kullanmak için `wrangler.jsonc` dosyasındaki `name` alanını kendi uygulamanızın adıyla düzenleyin:

```sh
npx wrangler login
npm run deploy
```

Worker yalnızca statik dosyaları ve `/api/health` sağlık yanıtını sunar. Önceki hesap ve analitik API adresleri artık `410 Gone`, yönetici sayfaları `404` döndürür. Eski sürümden kalan analitik tarayıcı kayıtları temizlenirken vardiyalar ve `ops-tracked-friends-v1` takip listesi korunur.

Bu depo gerçek çalışan Excel'lerini, kullanıcı/veritabanı kayıtlarını, üretim erişim bilgilerini veya yedekleri içermez. Örnek/test verileri sentetiktir.

## İletişim ve lisans

[vagonla.app@gmail.com](mailto:vagonla.app@gmail.com)

[MIT](LICENSE)
