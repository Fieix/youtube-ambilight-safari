# Ambient Light for YouTube, сборка под Safari

Личное расширение. Свечение вокруг плеера на youtube.com/watch.
Кадр ролика один раз рисуется в центр, наружу уходит кромка. Размытие накладывается уже после растягивания, поэтому ползунок Blur её смягчает. Если Safari кадр не отдаёт, тот же приём делается с одного снимка плеера.

## Как включить (Safari 26)

1. Распакуй архив. Внутри должна лежать папка с `manifest.json`.
2. Safari → Settings → Advanced → включи Show features for web developers.
3. Safari → Settings → Developer → включи Allow Unsigned Extensions.
4. Меню Develop → Add Temporary Extension… → выбери эту папку.
5. Открой любое видео на youtube.com.

Расширение временное: после выхода из Safari его надо добавить заново.
Пункт Allow Unsigned Extensions тоже сбрасывается при выходе.

Если в меню Develop нет Add Temporary Extension, эта Safari старее. Тогда папку само не подхватит, нужен Xcode: `xcrun safari-web-extension-packager` на эту папку, и Run с бесплатным Apple ID.

Кнопка AL в плеере и иконка расширения открывают настройки: Blur, Spread, фильтры, стороны, кадры и режимы. Это те же пункты, что в оригинале. Чёрные полосы, тени страницы и статистика в эту сборку не входят.

Основано на [youtube-ambilight](https://github.com/WesselKroos/youtube-ambilight) Wessel Kroos, лицензия ISC.
