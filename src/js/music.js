export function initMusicPlayer(document) {
    const musicToggle = document.getElementById("music-toggle");
    const bgMusic = document.getElementById("bg-music");

    if (!musicToggle || !bgMusic) {
        return;
    }

    const playOrPause = () => {
        if (bgMusic.paused) {
            // Запускаем музыку
            bgMusic.play().then(() => {
                musicToggle.style.backgroundColor = "#4df3ff";
                musicToggle.style.color = "#011625";
                musicToggle.style.boxShadow = "0 0 15px #4df3ff";
            }).catch(err => {
                console.log("Браузер заблокировал автовоспроизведение. Нужен ручной клик:", err);
            });
        } else {
            // Останавливаем музыку
            bgMusic.pause();
            musicToggle.style.backgroundColor = "transparent";
            musicToggle.style.color = "#4df3ff";
            musicToggle.style.boxShadow = "none";
        }
    };

    musicToggle.addEventListener("click", (e) => {
        e.preventDefault();
        playOrPause();
    });

    return {
        playOrPause
    };
}
