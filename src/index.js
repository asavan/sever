import starter from "./js/main.js";
import {fullscreen} from "./js/fullscreen.js";
import {lidsSetup} from "./js/lids.js";


if (__USE_SERVICE_WORKERS__) {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js", {scope: "./"});
    }
}

starter(window, document);
fullscreen(window, document);
lidsSetup(window, document);
