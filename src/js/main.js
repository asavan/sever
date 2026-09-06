export default function game(window, document) {
    let BASE_COLS = 28;
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

    let activeTouches = [];
    let initialPinchDistance = 0;
    let initialZoomOnPinchStart = 0;

    function initMatrix() {
        const isPortrait = window.innerHeight > window.innerWidth;

        if (isPortrait) {
            COLS = 14;
            BASE_COLS = 14;
            monitor.classList.add('is-portrait');
        } else {
            COLS = 28;
            BASE_COLS = 28;
            monitor.classList.remove('is-portrait');
        }

        setupZoomLevels();

        TOTAL_NUMBERS = COLS * ROWS;
        grid.innerHTML = '';
        virtualMatrix = [];
        removedCount = 0;
        binProgress = Array(5).fill(0);
        predefinedGroups = {};
        currentZoomIndex = 0;
        cameraColOffset = 0;
        cameraRowOffset = 0;

        for (let i = 0; i < TOTAL_NUMBERS; i++) {
            virtualMatrix.push({
                index: i,
                row: Math.floor(i / BASE_COLS),
                col: i % BASE_COLS,
                value: Math.floor(Math.random() * 10),
                visible: true
            });
        }

        for (let item of virtualMatrix) {
            let attached = [];
            for (let n of virtualMatrix) {
                if (n.index !== item.index && Math.abs(n.row - item.row) <= 1 && Math.abs(n.col - item.col) <= 1) {
                    if (Math.random() < 0.45) attached.push(n.index);
                }
            }
            predefinedGroups[item.index] = attached;
        }

        renderViewport();

        container.removeEventListener('wheel', onContainerWheel);
        container.addEventListener('wheel', onContainerWheel, {passive: false});

        container.removeEventListener('touchstart', onContainerTouchStart);
        container.removeEventListener('touchmove', onContainerTouchMove);
        container.addEventListener('touchstart', onContainerTouchStart, {passive: true});
        container.addEventListener('touchmove', onContainerTouchMove, {passive: false});
        container.addEventListener('touchend', onContainerTouchEnd);
        container.addEventListener('touchcancel', onContainerTouchEnd);
    }


    function setupZoomLevels() {
        if (COLS === 14) {
            ZOOM_LEVELS = [
                {viewCols: 14, viewRows: 12, fontSize: "14px"},
                {viewCols: 9, viewRows: 8, fontSize: "24px"},
                {viewCols: 5, viewRows: 5, fontSize: "38px"}
            ];
        } else {
            ZOOM_LEVELS = [
                {viewCols: 28, viewRows: 12, fontSize: "14px"},
                {viewCols: 18, viewRows: 8, fontSize: "24px"},
                {viewCols: 10, viewRows: 5, fontSize: "38px"}
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
                    const vIdx = targetRow * BASE_COLS + targetCol;
                    const vItem = virtualMatrix.at(vIdx);

                    if (vItem && vItem.visible) {
                        const cell = document.createElement('div');
                        cell.classList.add('num-cell');
                        cell.textContent = vItem.value;
                        cell.dataset.index = vItem.index;
                        cell.dataset.row = vItem.row;
                        cell.dataset.col = vItem.col;
                        // Добавляем уникальный ID для бритвенно-точного поиска
                        cell.id = "cell-id-" + vItem.index;

                        grid.appendChild(cell);
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

    function onContainerTouchStart(e) {
        if (e.touches.length === 2) {
            if (isDragging) cancelDrag();
            const t1 = e.touches.item(0);
            const t2 = e.touches.item(1);
            if (t1 && t2) {
                initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                initialZoomOnPinchStart = currentZoomIndex;
            }
        }
    }

    function onContainerTouchMove(e) {
        if (e.touches.length === 2 && initialPinchDistance > 0) {
            e.preventDefault();
            const t1 = e.touches.item(0);
            const t2 = e.touches.item(1);
            if (!t1 || !t2) return;

            const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const ratio = currentDistance / initialPinchDistance;
            let targetIndex = initialZoomOnPinchStart;

            if (ratio > 1.35) targetIndex = Math.min(ZOOM_LEVELS.length - 1, initialZoomOnPinchStart + 1);
            if (ratio > 1.9) targetIndex = ZOOM_LEVELS.length - 1;
            if (ratio < 0.75) targetIndex = Math.max(0, initialZoomOnPinchStart - 1);

            if (targetIndex !== currentZoomIndex) {
                const oldIdx = currentZoomIndex;
                currentZoomIndex = targetIndex;

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
        const vLeader = virtualMatrix.at(leaderIndex);

        const cellWidth = centerCell.offsetWidth || 30;
        const cellHeight = centerCell.offsetHeight || 30;

        group.push({
            el: centerCell, vIdx: leaderIndex, currentX: 0, currentY: 0,
            targetX: 0, targetY: 0, isLeader: true, gridOffsetX: 0, gridOffsetY: 0
        });

        const savedNeighborIndices = predefinedGroups[leaderIndex] || [];

        savedNeighborIndices.forEach(idx => {
            const vItem = virtualMatrix.at(idx);
            if (vItem && vItem.visible) {
                const cell = document.getElementById("cell-id-" + idx);
                const offsetX = (vItem.col - vLeader.col) * cellWidth;
                const offsetY = (vItem.row - vLeader.row) * cellHeight;

                group.push({
                    el: cell,
                    vIdx: idx, currentX: 0, currentY: 0, targetX: 0, targetY: 0, isLeader: false,
                    gridOffsetX: offsetX, gridOffsetY: offsetY
                });
            }
        });
        return group;
    }

    function onPointerDown(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (!e.isPrimary || isDragging) return;

        draggedElement = e.currentTarget;
        if (draggedElement.style.visibility === "hidden") return;

        isDragging = true;
        draggedElement.setPointerCapture(e.pointerId);

        startX = e.clientX;
        startY = e.clientY;
        mouseX = e.clientX;
        mouseY = e.clientY;

        const rawGroup = getAttachedGroup(draggedElement);
        const currentFontSizeStr = ZOOM_LEVELS.at(currentZoomIndex).fontSize;
        document.documentElement.style.setProperty('--phantom-font-size', currentFontSizeStr);

        const leaderRect = draggedElement.getBoundingClientRect();

        dragGroup = rawGroup.map(item => {
            if (item.el) item.el.style.opacity = "0.0";

            const phantom = document.createElement('div');
            phantom.classList.add('phantom-cell');
            phantom.classList.add(item.isLeader ? 'leader' : 'follower');

            const vItem = virtualMatrix.at(item.vIdx);
            phantom.textContent = vItem ? vItem.value : "0";

            let pLeft = leaderRect.left + item.gridOffsetX;
            let pTop = leaderRect.top + item.gridOffsetY;

            phantom.style.left = pLeft + "px";
            phantom.style.top = pTop + "px";
            phantom.style.width = leaderRect.width + "px";
            phantom.style.height = leaderRect.height + "px";

            document.body.appendChild(phantom);

            return {
                ...item,
                phantomEl: phantom,
                phantomStartX: pLeft,
                phantomStartY: pTop
            };
        });

        updateDragAnimation();
        draggedElement.addEventListener('pointermove', onPointerMove);
        draggedElement.addEventListener('pointerup', onPointerUp);
        draggedElement.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        mouseX = e.clientX;
        mouseY = e.clientY;

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

    function updateDragAnimation() {
        if (!isDragging) return;

        const screenEl = document.querySelector('.screen');
        const screenRect = screenEl.getBoundingClientRect();

        const currentFontSizeStr = ZOOM_LEVELS.at(currentZoomIndex).fontSize;
        const baseFontSize = parseInt(currentFontSizeStr) || 14;

        const visualLeaderWidth = baseFontSize * 1.4;
        const visualLeaderHeight = baseFontSize * 1.4;
        const radiusX = visualLeaderWidth / 2;
        const radiusY = visualLeaderHeight / 2;

        let clampedMouseX = mouseX;
        let clampedMouseY = mouseY;

        if (clampedMouseX < screenRect.left + radiusX) clampedMouseX = screenRect.left + radiusX;
        if (clampedMouseX > screenRect.right - radiusX) clampedMouseX = screenRect.right - radiusX;
        if (clampedMouseY < screenRect.top + radiusY) clampedMouseY = screenRect.top + radiusY;
        if (clampedMouseY > screenRect.bottom) clampedMouseY = screenRect.bottom;

        const leader = dragGroup.find(item => item.isLeader);

        leader.targetX = clampedMouseX - startX;
        leader.targetY = clampedMouseY - startY;
        leader.currentX += (leader.targetX - leader.currentX) * 0.35;
        leader.currentY += (leader.targetY - leader.currentY) * 0.35;

        dragGroup.forEach(item => {
            if (!item.phantomEl) return;

            let idealTranslateX = 0;
            let idealTranslateY = 0;

            // Восстановленный кусок логики смещений
            if (item.isLeader) {
                idealTranslateX = leader.currentX;
                idealTranslateY = leader.currentY;
            } else {
                const compressionFactor = 0.6;
                item.targetX = leader.currentX + (item.gridOffsetX * (compressionFactor - 1));
                item.targetY = leader.currentY + (item.gridOffsetY * (compressionFactor - 1));
                item.currentX += (item.targetX - item.currentX) * 0.15;
                item.currentY += (item.targetY - item.currentY) * 0.15;

                idealTranslateX = item.currentX;
                idealTranslateY = item.currentY;
            }

            const cellW = item.phantomEl.offsetWidth || 30;
            const cellH = item.phantomEl.offsetHeight || 30;
            let finalCenterX = item.phantomStartX + (cellW / 2) + idealTranslateX;
            let finalCenterY = item.phantomStartY + (cellH / 2) + idealTranslateY;

            const currentScale = item.isLeader ? 1.4 : 1.0;
            const visibleRadiusX = (baseFontSize * currentScale) / 2;
            const visibleRadiusY = (baseFontSize * currentScale) / 2;

            if (finalCenterX - visibleRadiusX < screenRect.left) finalCenterX = screenRect.left + visibleRadiusX;
            if (finalCenterX + visibleRadiusX > screenRect.right) finalCenterX = screenRect.right - visibleRadiusX;
            if (finalCenterY - visibleRadiusY < screenRect.top) finalCenterY = screenRect.top + visibleRadiusY;
            if (finalCenterY > screenRect.bottom) finalCenterY = screenRect.bottom;

            const finalTranslateX = (finalCenterX - (cellW / 2)) - item.phantomStartX;
            const finalTranslateY = (finalCenterY - (cellH / 2)) - item.phantomStartY;

            item.phantomEl.style.transform = "translate(" + finalTranslateX + "px, " + finalTranslateY + "px) scale(" + currentScale + ")";
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
                if (item.phantomEl) item.phantomEl.remove();
                const vItem = virtualMatrix.at(item.vIdx);
                if (vItem) vItem.visible = false;
                if (item.el) resetElementStyles(item.el);
            });

            updateBinProgress(binIndex, dragGroup.length);
            renderViewport();
        } else {
            dragGroup.forEach(item => {
                if (item.phantomEl) {
                    item.phantomEl.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
                    item.phantomEl.style.transform = 'translate(0px, 0px)';
                }
                setTimeout(() => {
                    if (item.phantomEl) item.phantomEl.remove();
                    if (item.el) resetElementStyles(item.el);
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
            if (item.el) resetElementStyles(item.el);
        });
        draggedElement = null;
        dragGroup = [];
    }

    function resetElementStyles(el) {
        el.style.opacity = "";
        el.classList.remove('dragging', 'drag-group');
        el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
        el.style.transform = '';
        setTimeout(() => {
            el.style.transition = '';
        }, 300);
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

        if (removedCount >= TOTAL_NUMBERS) {
            const bgMusic = document.getElementById('bg-music');
            const musicToggle = document.getElementById('music-toggle');
            if (bgMusic && bgMusic.paused) {
                bgMusic.play().then(() => {
                    if (musicToggle) {
                        musicToggle.style.backgroundColor = '#4df3ff';
                        musicToggle.style.color = '#011625';
                        musicToggle.style.boxShadow = '0 0 15px #4df3ff';
                    }
                }).catch(err => console.log(err));
            }
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
}
