export function lidsSetup(window, document) {
    document.addEventListener("keydown", (event) => {
        if (["1", "2", "3", "4", "5"].indexOf(event.key) >= 0) {
            const num = event.key;
            const bin = document.querySelector(`.bin[data-bin="${num}"]`);
            if (bin) {
                bin.classList.toggle("open");
            }
        }
    });
}
