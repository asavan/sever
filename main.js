let COLS = 28;
const ROWS = 12;
let TOTAL_NUMBERS = COLS * ROWS;

const monitor = document.getElementById('monitor-container');
const container = document.getElementById('matrix-container');
const grid = document.getElementById('matrix-grid');
const totalPercentEl = document.getElementById('total-percent');
const winScreen = document.getElementById('win-screen');

let removedCount = 0;
let binProgress = Array(5).fill(0);
let predefinedGroups = {};
let virtualMatrix = [];
let domCells = [];

let ZOOM_LEVELS = [];
let currentZoomIndex = 0;
let cameraColOffset = 0;
let cameraRowOffset = 0;

let draggedElement = null;
let dragGroup = [];
let isDragging = false;
let animationFrameId = null;

let startX = 0;
let startY = 0;
let mouseX = 0;
let mouseY = 0;

// Переменные для мобильного зума (Touch)
let initialPinchDistance = 0;
let initialZoomOnPinchStart = 0;

function initMatrix() {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
        COLS = 14;
        monitor.classList.add('is-portrait');
    } else {
        COLS = 28;
        monitor.classList.remove('is-portrait');
    }

    setupZoomLevels();

    TOTAL_NUMBERS = COLS * ROWS;
    grid.innerHTML = '';
    virtualMatrix = [];
    domCells = Array(TOTAL_NUMBERS).fill(null);
    removedCount = 0;
    binProgress = Array(5).fill(0);
    predefinedGroups = {};
    currentZoomIndex = 0;
    cameraColOffset = 0;
    cameraRowOffset = 0;

    for (let i = 0; i < TOTAL_NUMBERS; i++) {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        virtualMatrix.push({
            index: i, row: r, col: c,
            value: Math.floor(Math.random() * 10),
            visible: true
        });
    }

    virtualMatrix.forEach(item => {
        const attachedIndices = [];
        virtualMatrix.forEach(neighbor => {
            if (neighbor.index === item.index) return;
            if (Math.abs(neighbor.row - item.row) <= 1 && Math.abs(neighbor.col - item.col) <= 1) {
                if (Math.random() < 0.45) {
                    attachedIndices.push(neighbor.index);
                }
            }
        });
        predefinedGroups[item.index] = attachedIndices;
    });

    renderViewport();

    // 1. Десктопный зум колесиком мыши
    container.removeEventListener('wheel', onContainerWheel);
    container.addEventListener('wheel', onContainerWheel, { passive: false });

    // 2. Мобильный зум жестами Pinch (touchstart / touchmove)
    container.addEventListener('touchstart', onContainerTouchStart, { passive: true });
    container.addEventListener('touchmove', onContainerTouchMove, { passive: false });
    container.addEventListener('touchend', onContainerTouchEnd);
    container.addEventListener('touchcancel', onContainerTouchEnd);
}

function setupZoomLevels() {
    if (COLS === 14) {
        ZOOM_LEVELS = [
            { viewCols: 14, viewRows: 12, fontSize: "14px" },
            { viewCols: 9,  viewRows: 8,  fontSize: "24px" },
            { viewCols: 5,  viewRows: 5,  fontSize: "38px" }
        ];
    } else {
        ZOOM_LEVELS = [
            { viewCols: 28, viewRows: 12, fontSize: "14px" },
            { viewCols: 18, viewRows: 8,  fontSize: "24px" },
            { viewCols: 10, viewRows: 5,  fontSize: "38px" }
        ];
    }
}

function handleResize() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
        monitor.classList.add('is-portrait');
    } else {
        monitor.classList.remove('is-portrait');
    }
    renderViewport();
}

function renderViewport() {
    grid.innerHTML = '';
    const cfg = ZOOM_LEVELS.at(currentZoomIndex);

    grid.style.setProperty('--view-cols', cfg.viewCols);
    grid.style.setProperty('--view-rows', cfg.viewRows);
    grid.style.setProperty('--cell-font-size', cfg.fontSize);

    cameraColOffset = Math.max(0, Math.min(COLS - cfg.viewCols, cameraColOffset));
    cameraRowOffset = Math.max(0, Math.min(ROWS - cfg.viewRows, cameraRowOffset));

    for (let r = 0; r < cfg.viewRows; r++) {
        for (let c = 0; c < cfg.viewCols; c++) {
            const targetRow = cameraRowOffset + r;
            const targetCol = cameraColOffset + c;

            if (targetRow >= 0 && targetRow < ROWS && targetCol >= 0 && targetCol < COLS) {
                const vIdx = targetRow * COLS + targetCol;
                const vItem = virtualMatrix.at(vIdx);

                if (vItem && vItem.visible) {
                    const cell = document.createElement('div');
                    cell.classList.add('num-cell');
                    cell.textContent = vItem.value;
                    cell.dataset.index = vItem.index;
                    cell.dataset.row = vItem.row;
                    cell.dataset.col = vItem.col;

                    grid.appendChild(cell);
                    domCells.splice(vIdx, 1, cell);
                    cell.addEventListener('pointerdown', onPointerDown);
                } else {
                    grid.appendChild(document.createElement('div'));
                }
            } else {
                grid.appendChild(document.createElement('div'));
            }
        }
    }
}

function updateCameraFocus(focusRow, focusCol, oldZoomIdx, newZoomIdx) {
    const oldCfg = ZOOM_LEVELS.at(oldZoomIdx);
    const newCfg = ZOOM_LEVELS.at(newZoomIdx);

    const relX = (focusCol - cameraColOffset) / oldCfg.viewCols;
    const relY = (focusRow - cameraRowOffset) / oldCfg.viewRows;

    let newColOffset = Math.round(focusCol - (relX * newCfg.viewCols));
    let newRowOffset = Math.round(focusRow - (relY * newCfg.viewRows));

    cameraColOffset = Math.max(0, Math.min(COLS - newCfg.viewCols, newColOffset));
    cameraRowOffset = Math.max(0, Math.min(ROWS - newCfg.viewRows, newRowOffset));

    renderViewport();
}

function onContainerWheel(e) {
    e.preventDefault();
    if (isDragging) return;

    const targetCell = e.target.closest('.num-cell');
    let focusRow = cameraRowOffset + Math.floor(ZOOM_LEVELS.at(currentZoomIndex).viewRows / 2);
    let focusCol = cameraColOffset + Math.floor(ZOOM_LEVELS.at(currentZoomIndex).viewCols / 2);

    if (targetCell) {
        focusRow = parseInt(targetCell.dataset.row);
        focusCol = parseInt(targetCell.dataset.col);
    }

    const oldIndex = currentZoomIndex;
    if (e.deltaY < 0) {
        if (currentZoomIndex < ZOOM_LEVELS.length - 1) currentZoomIndex++;
    } else {
        if (currentZoomIndex > 0) currentZoomIndex--;
    }

    if (oldIndex !== currentZoomIndex) {
        updateCameraFocus(focusRow, focusCol, oldIndex, currentZoomIndex);
    }
}

// НАДЁЖНАЯ ТАЧ-ЛОГИКА ЗУМА: Срабатывает СТРОГО на смартфонах
function onContainerTouchStart(e) {
    if (e.touches.length === 2) {
        if (isDragging) cancelDrag(); // сбрасываем фантомы, чтобы не зависали

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialZoomOnPinchStart = currentZoomIndex;
    }
}

function onContainerTouchMove(e) {
    if (e.touches.length === 2 && initialPinchDistance > 0) {
        e.preventDefault(); // Запрещаем встроенный зум страницы браузером телефона

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        const ratio = currentDistance / initialPinchDistance;
        let targetIndex = initialZoomOnPinchStart;

        if (ratio > 1.35) targetIndex = Math.min(ZOOM_LEVELS.length - 1, initialZoomOnPinchStart + 1);
        if (ratio > 1.9)  targetIndex = ZOOM_LEVELS.length - 1;
        if (ratio < 0.75) targetIndex = Math.max(0, initialZoomOnPinchStart - 1);

        if (targetIndex !== currentZoomIndex) {
            const oldIdx = currentZoomIndex;
            currentZoomIndex = targetIndex;

            // Центрируем камеру ровно между пальцами
            const rect = container.getBoundingClientRect();
            const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

            const currentCfg = ZOOM_LEVELS.at(oldIdx);
            let focusCol = cameraColOffset + Math.floor((midX / rect.width) * currentCfg.viewCols);
            let focusRow = cameraRowOffset + Math.floor((midY / rect.height) * currentCfg.viewRows);

            updateCameraFocus(focusRow, focusCol, oldIdx, currentZoomIndex);
        }
    }
}

function onContainerTouchEnd(e) {
    if (e.touches.length < 2) {
        initialPinchDistance = 0;
    }
}


function getAttachedGroup(centerCell) {
    const group = [];
    const leaderIndex = parseInt(centerCell.dataset.index);

    const leaderRect = centerCell.getBoundingClientRect();
    const lCenterX = leaderRect.left + leaderRect.width / 2;
    const lCenterY = leaderRect.top + leaderRect.height / 2;

    group.push({
        el: centerCell, vIdx: leaderIndex, currentX: 0, currentY: 0,
        targetX: 0, targetY: 0, isLeader: true, gridOffsetX: 0, gridOffsetY: 0
    });

    const savedNeighborIndices = predefinedGroups[leaderIndex] || [];

    savedNeighborIndices.forEach(idx => {
        const vItem = virtualMatrix.at(idx);
        if (vItem && vItem.visible) {
            const cell = domCells.at(idx);
            if (cell) {
                const cellRect = cell.getBoundingClientRect();
                group.push({
                    el: cell, vIdx: idx, currentX: 0, currentY: 0, targetX: 0, targetY: 0, isLeader: false,
                    gridOffsetX: (cellRect.left + cellRect.width / 2) - lCenterX,
                    gridOffsetY: (cellRect.top + cellRect.height / 2) - lCenterY
                });
            } else {
                const cW = centerCell.offsetWidth;
                const cH = centerCell.offsetHeight;
                const vLeader = virtualMatrix.at(leaderIndex);
                group.push({
                    el: null, vIdx: idx, currentX: 0, currentY: 0, targetX: 0, targetY: 0, isLeader: false,
                    gridOffsetX: (vItem.col - vLeader.col) * cW,
                    gridOffsetY: (vItem.row - vLeader.row) * cH
                });
            }
        }
    });
    return group;
}

function onPointerMove(e) {
    if (!isDragging) return;
    mouseX = e.clientX; mouseY = e.clientY;

    const bins = document.querySelectorAll('.bin');
    bins.forEach(bin => {
        const r = bin.getBoundingClientRect();
        if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) {
            bin.classList.add('drag-over');
        } else {
            bin.classList.remove('drag-over');
        }
    });
}

function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // ФИКС: вместо activeTouches проверяем, является ли это касание основным
    if (!e.isPrimary || isDragging) return;

    draggedElement = e.currentTarget;
    if (draggedElement.style.visibility === "hidden") return;

    isDragging = true;
    draggedElement.setPointerCapture(e.pointerId);

    startX = e.clientX; startY = e.clientY;
    mouseX = e.clientX; mouseY = e.clientY;

    const rawGroup = getAttachedGroup(draggedElement);
    const currentFontSize = ZOOM_LEVELS.at(currentZoomIndex).fontSize;
    document.documentElement.style.setProperty('--phantom-font-size', currentFontSize);

    dragGroup = rawGroup.map(item => {
        item.el.style.opacity = "0.0";

        const phantom = document.createElement('div');
        phantom.classList.add('phantom-cell');
        phantom.classList.add(item.isLeader ? 'leader' : 'follower');
        phantom.textContent = item.el.textContent;

        const rect = item.el.getBoundingClientRect();
        phantom.style.left = rect.left + "px";
        phantom.style.top = rect.top + "px";
        phantom.style.width = rect.width + "px";
        phantom.style.height = rect.height + "px";

        document.body.appendChild(phantom);

        return {
            ...item,
            phantomEl: phantom,
            phantomStartX: rect.left,
            phantomStartY: rect.top
        };
    });

    updateDragAnimation();
    draggedElement.addEventListener('pointermove', onPointerMove);
    draggedElement.addEventListener('pointerup', onPointerUp);
    draggedElement.addEventListener('pointercancel', onPointerUp);
}


function updateDragAnimation() {
    if (!isDragging) return;

    // 1. Получаем точные экранные границы рамки монитора
    const screenEl = document.querySelector('.screen');
    const screenRect = screenEl.getBoundingClientRect();

    // 2. БЛОКИРУЕМ КУРСОР МЫШИ ВНУТРИ ЭКРАНА С ЗАПАСОМ, ЧТОБЫ ОН ВСЕГДА ДОХОДИЛ ДО КРАЯ
    let clampedMouseX = mouseX;
    let clampedMouseY = mouseY;

    if (clampedMouseX < screenRect.left) clampedMouseX = screenRect.left;
    if (clampedMouseX > screenRect.right) clampedMouseX = screenRect.right;

    if (clampedMouseY < screenRect.top) clampedMouseY = screenRect.top;
    if (clampedMouseY > screenRect.bottom) clampedMouseY = screenRect.bottom;

    const leader = dragGroup.find(item => item.isLeader);

    // 3. Вычисляем сдвиг лидера на основе заблокированного курсора
    leader.targetX = clampedMouseX - startX;
    leader.targetY = mouseY - startY; // По вертикали (Y) даем полную свободу для захода в коробки

    leader.currentX += (leader.targetX - leader.currentX) * 0.35;
    leader.currentY += (leader.targetY - leader.currentY) * 0.35;

    dragGroup.forEach(item => {
        if (!item.phantomEl) return;

        let idealX = 0;
        let idealY = 0;

        // Вычисляем идеальное положение фантома на экране в пикселях
        if (item.isLeader) {
            idealX = item.phantomStartX + leader.currentX;
            idealY = item.phantomStartY + leader.currentY;
        } else {
            const compressionFactor = 0.6;
            item.targetX = leader.currentX + (item.gridOffsetX * (compressionFactor - 1));
            item.targetY = leader.currentY + (item.gridOffsetY * (compressionFactor - 1));

            item.currentX += (item.targetX - item.currentX) * 0.15;
            item.currentY += (item.targetY - item.currentY) * 0.15;

            idealX = item.phantomStartX + item.currentX;
            idealY = item.phantomStartY + item.currentY;
        }

        // 4. УМНЫЙ АДАПТИВНЫЙ CLAMP (Разрешаем вылет ровно на 50% от текущего размера фантома)
        const pRect = item.phantomEl.getBoundingClientRect();
        const allowedOutX = pRect.width / 2;
        const allowedOutY = pRect.height / 2;

        // Ограничение Лево / Право
        if (idealX + allowedOutX < screenRect.left) {
            idealX = screenRect.left - allowedOutX;
        }
        if (idealX + pRect.width - allowedOutX > screenRect.right) {
            idealX = screenRect.right - pRect.width + allowedOutX;
        }

        // Ограничение Верх / Низ (для верха блокируем жестко, для низа даем зайти на коробку)
        if (idealY + allowedOutY < screenRect.top) {
            idealY = screenRect.top - allowedOutY;
        }
        if (idealY + pRect.height - allowedOutY > screenRect.bottom) {
            // Позволяем цифре опуститься чуть глубже в коробку на большом зуме
            idealY = screenRect.bottom - pRect.height + allowedOutY;
        }

        // 5. Переводим ограниченные пиксели обратно в дельту translate для CSS
        const finalTranslateX = idealX - item.phantomStartX;
        const finalTranslateY = idealY - item.phantomStartY;

        // Отрисовываем фантомы
        if (item.isLeader) {
            item.phantomEl.style.transform = "translate(" + finalTranslateX + "px, " + finalTranslateY + "px) scale(1.4)";
        } else {
            item.phantomEl.style.transform = "translate(" + finalTranslateX + "px, " + finalTranslateY + "px)";
        }
    });

    animationFrameId = requestAnimationFrame(updateDragAnimation);
}





function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    cancelAnimationFrame(animationFrameId);

    let droppedInBin = null;
    const bins = document.querySelectorAll('.bin');
    bins.forEach(bin => {
        const r = bin.getBoundingClientRect();
        if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) droppedInBin = bin;
        bin.classList.remove('drag-over');
    });

    if (droppedInBin) {
        const binIndex = parseInt(droppedInBin.dataset.bin) - 1;

        dragGroup.forEach(item => {
            // Удаляем фантом из body
            if (item.phantomEl) item.phantomEl.remove();

            // Навсегда прячем реальную цифру в виртуальной матрице
            const vItem = virtualMatrix.at(item.vIdx);
            if (vItem) vItem.visible = false;

            // Сбрасываем прозрачность на будущее
            item.el.style.opacity = "";
        });

        updateBinProgress(binIndex, dragGroup.length);
        renderViewport();
    } else {
        // Если промахнулись — возвращаем цифры на место с анимацией фантомов
        dragGroup.forEach(item => {
            if (item.phantomEl) {
                item.phantomEl.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
                item.phantomEl.style.transform = 'translate(0px, 0px)';
            }

            setTimeout(() => {
                if (item.phantomEl) item.phantomEl.remove();
                item.el.style.opacity = ""; // Возвращаем видимость оригиналу в сетке
            }, 300);
        });
    }

    if (draggedElement) {
        draggedElement.releasePointerCapture(e.pointerId);
        draggedElement.removeEventListener('pointermove', onPointerMove);
        draggedElement.removeEventListener('pointerup', onPointerUp);
        draggedElement.removeEventListener('pointercancel', onPointerUp);
    }
    draggedElement = null;
    dragGroup = [];
}

function cancelDrag() {
    isDragging = false;
    cancelAnimationFrame(animationFrameId);
    dragGroup.forEach(item => {
        if (item.phantomEl) item.phantomEl.remove();
        item.el.style.opacity = "";
    });
    draggedElement = null;
    dragGroup = [];
}

function resetElementStyles(el) {
    el.classList.remove('dragging', 'drag-group');
    el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
    el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
}

function updateBinProgress(binIndex, count) {
    removedCount += count;
    const binCapacity = TOTAL_NUMBERS / 5;
    const percentPerItem = 100 / binCapacity;

    const currentProgress = binProgress.at(binIndex);
    const newProgress = Math.min(100, Math.floor(currentProgress + (count * percentPerItem)));
    binProgress.splice(binIndex, 1, newProgress);

    document.getElementById("fill-" + (binIndex + 1)).style.width = newProgress + "%";
    document.getElementById("percent-" + (binIndex + 1)).textContent = newProgress + "%";

    const totalPercent = Math.min(100, Math.floor((removedCount / TOTAL_NUMBERS) * 100));
    totalPercentEl.textContent = totalPercent + "%";

    // Условие полной очистки экрана (победа)
    if (removedCount >= TOTAL_NUMBERS) {
        // Принудительно включаем музыку Siena Project Complete, если она спала
        const bgMusic = document.getElementById('bg-music');
        const musicToggle = document.getElementById('music-toggle');

        if (bgMusic && bgMusic.paused) {
            bgMusic.play().then(() => {
                if (musicToggle) {
                    musicToggle.style.backgroundColor = '#4df3ff';
                    musicToggle.style.color = '#011625';
                    musicToggle.style.boxShadow = '0 0 15px #4df3ff';
                }
            }).catch(err => console.log("Ошибка автоплея при победе:", err));
        }

        // Показываем экран триумфа
        winScreen.classList.add('active');
    }
}


window.addEventListener('resize', handleResize);

initMatrix();

function initMusicPlayer() {
    const musicToggle = document.getElementById('music-toggle');
    const bgMusic = document.getElementById('bg-music');

    if (!musicToggle || !bgMusic) return;

    musicToggle.addEventListener('click', () => {
        if (bgMusic.paused) {
            // Запускаем музыку
            bgMusic.play().then(() => {
                musicToggle.style.backgroundColor = '#4df3ff';
                musicToggle.style.color = '#011625';
                musicToggle.style.boxShadow = '0 0 15px #4df3ff';
            }).catch(err => {
                console.log("Браузер заблокировал автовоспроизведение. Нужен ручной клик:", err);
            });
        } else {
            // Останавливаем музыку
            bgMusic.pause();
            musicToggle.style.backgroundColor = 'transparent';
            musicToggle.style.color = '#4df3ff';
            musicToggle.style.boxShadow = 'none';
        }
    });
}

// Запускаем плеер после инициализации всего интерфейса
initMusicPlayer();
