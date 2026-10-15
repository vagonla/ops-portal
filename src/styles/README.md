# CSS Module Architecture

Bu dizin, `globals.css` dosyasini parcali ve bakimi kolay bir yapiya tasimak icin hazirlandi.

## Klasorler

- `core/`: token, base, util, animation katmani
- `components/`: bilesen bazli stiller
- `features/`: ozellik/akisa ozel stiller
- `presets/`: hizli ac-kapa tasarim presetleri (or. cam modu)

## Hemen Kullanilan Yapi

Su an MyProfile cam stili dogrudan component modulu icine tasindi.

- Kalici giris: `src/styles/modular.css`
- Cam stili: `src/styles/components/my-profile-sheet.css`

## Tek Satirla Gecis

`src/styles/modular.css` dosyasi su an `my-profile-sheet.css` ve `shift-chips.css` modullerini yukler.
Bu gecis arayuzden degil, yalnizca kod degisikligiyle yapilir.
