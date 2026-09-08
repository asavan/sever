export function fullscreen(window, document) {
    const monitor = document.getElementById("monitor-container");


    document.addEventListener("keydown", (event) => {
        console.log("keypressed " + event.key);
        // Note that "F" is case-sensitive (uppercase):
        if (event.key === "F" || event.key === "f") {
            // Check if we're in fullscreen mode
            if (document.fullscreenElement) {
                document.exitFullscreen();
                return;
            }
            // Otherwise enter fullscreen mode
            monitor.requestFullscreen().catch((err) => {
                console.error(`Error enabling fullscreen: ${err.message}`);
            });
        }
    });
}
