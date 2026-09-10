import starter from "./js/main.js";
import {fullscreen} from "./js/fullscreen.js";
import {lidsSetup} from "./js/lids.js";

import settings from "./js/settings.js";



if (__USE_SERVICE_WORKERS__) {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js", {scope: "./"});
    }
}

starter(window, document, settings);
fullscreen(window, document);
lidsSetup(window, document);
