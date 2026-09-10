import starter from "./js/main.js";
import {fullscreen} from "./js/fullscreen.js";
import {lidsSetup} from "./js/lids.js";

import settings from "./js/settings.js";



if (__USE_SERVICE_WORKERS__) {
    if ('serviceWorker' in navigator) {
        // Вычисляет абсолютный путь к sw.js относительно файла index.html
        const swUrl = new URL('sw.js', import.meta.url || window.location.href).href;

        navigator.serviceWorker.register(swUrl)
            .then((reg) => console.log('Успешный scope:', reg.scope));
    }
}

starter(window, document, settings);
fullscreen(window, document);
lidsSetup(window, document);
