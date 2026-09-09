export function lidsSetup(window, document) {
    document.addEventListener("keydown", (event) => {
        if (["1", "2", "3", "4", "5"].indexOf(event.key) >= 0) {
            const num = event.key;
            const bin = document.querySelector(`.bin[data-bin="${num}"]`);
            const allBins = document.querySelectorAll(".bin");
            for (const anotherBin of allBins) {
                if (bin && anotherBin.dataset.bin === bin.dataset.bin) {
                    continue;
                }
                anotherBin.classList.remove("open");
            }
            if (bin) {
                bin.classList.toggle("open");
            }
        }
    });
}
