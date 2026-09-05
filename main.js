const COLS = 28;
const ROWS = 12;
const TOTAL_NUMBERS = COLS * ROWS;

const container = document.getElementById('matrix-container');
const grid = document.getElementById('matrix-grid');
const totalPercentEl = document.getElementById('total-percent');
const winScreen = document.getElementById('win-screen');

let removedCount = 0;
let binProgress = Array(5).fill(0);
let cells = [];
let predefinedGroups = {};

let currentZoom = 1.0;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

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
let initialZoomOnPinchStart = 1.0;

function initMatrix() {
    grid.innerHTML = '';
    cells = [];
    removedCount = 0;
    binProgress = Array(5).fill(0);
    predefinedGroups = {};
    currentZoom = 1.0;

    grid.style.transform = "scale(1)";
    grid.style.transformOrigin = "center center";

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('num-cell');
            cell.textContent = Math.floor(Math.random() * 10);
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.index = r * COLS + c;

            grid.appendChild(cell);
            cells.push(cell);

            cell.addEventListener('pointerdown', onPointerDown);
        }
    }

    cells.forEach(cell => {
        const index = parseInt(cell.dataset.index);
        const centerRow = parseInt(cell.dataset.row);
        const centerCol = parseInt(cell.dataset.col);
        const attachedIndices = [];

        cells.forEach(neighbor => {
            if (neighbor === cell) return;
            const nr = parseInt(neighbor.dataset.row);
            const nc = parseInt(neighbor.dataset.col);

            if (Math.abs(nr - centerRow) <= 1 && Math.abs(nc - centerCol) <= 1) {
                if (Math.random() < 0.45) {
                    attachedIndices.push(parseInt(neighbor.dataset.index));
                }
            }
        });
        predefinedGroups[index] = attachedIndices;
    });

    container.addEventListener('wheel', onContainerWheel, { passive: false });
    container.addEventListener('pointerdown', onContainerPointerDown);
    container.addEventListener('pointermove', onContainerPointerMove);
    container.addEventListener('pointerup', onContainerPointerUp);
    container.addEventListener('pointercancel', onContainerPointerUp);
}

function onContainerWheel(e) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const originX = ((e.clientX - rect.left) / rect.width) * 100;
    const originY = ((e.clientY - rect.top) / rect.height) * 100;

    if (e.deltaY < 0) {
        if (currentZoom < MAX_ZOOM) currentZoom += ZOOM_STEP;
    } else {
        if (currentZoom > MIN_ZOOM) currentZoom -= ZOOM_STEP;
    }

    grid.style.transformOrigin = originX + "% " + originY + "%";
    grid.style.transform = "scale(" + currentZoom + ")";
}

function onContainerPointerDown(e) {
    const index = activeTouches.findIndex(t => t.pointerId === e.pointerId);
    if (index > -1) {
        activeTouches.splice(index, 1, e);
    } else {
        activeTouches.push(e);
    }

    if (activeTouches.length === 2) {
        if (isDragging) cancelDrag();

        const firstTouch = activeTouches.at(0);
        const secondTouch = activeTouches.at(1);

        initialPinchDistance = getDistance(firstTouch, secondTouch);
        initialZoomOnPinchStart = currentZoom;

        const rect = container.getBoundingClientRect();
        const midX = (firstTouch.clientX + secondTouch.clientX) / 2 - rect.left;
        const midY = (firstTouch.clientY + secondTouch.clientY) / 2 - rect.top;

        grid.style.transformOrigin = ((midX / rect.width) * 100) + "% " + ((midY / rect.height) * 100) + "%";
    }
}

function onContainerPointerMove(e) {
    const index = activeTouches.findIndex(t => t.pointerId === e.pointerId);
    if (index > -1) {
        activeTouches.splice(index, 1, e);
    }

    if (activeTouches.length === 2) {
        const firstTouch = activeTouches.at(0);
        const secondTouch = activeTouches.at(1);

        const currentDistance = getDistance(firstTouch, secondTouch);
        if (initialPinchDistance > 0) {
            const factor = currentDistance / initialPinchDistance;
            let targetZoom = initialZoomOnPinchStart * factor;

            targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
            currentZoom = targetZoom;
            grid.style.transform = "scale(" + currentZoom + ")";
        }
    }
}

function onContainerPointerUp(e) {
    activeTouches = activeTouches.filter(t => t.pointerId !== e.pointerId);
    if (activeTouches.length < 2) {
        initialPinchDistance = 0;
    }
}

function getDistance(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function getAttachedGroup(centerCell) {
    const group = [];
    const leaderRow = parseInt(centerCell.dataset.row);
    const leaderCol = parseInt(centerCell.dataset.col);

    const cellWidth = centerCell.offsetWidth || 30;
    const cellHeight = centerCell.offsetHeight || 30;

    group.push({
        el: centerCell,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        isLeader: true,
        gridOffsetX: 0,
        gridOffsetY: 0
    });

    const leaderIndex = parseInt(centerCell.dataset.index);
    const savedNeighborIndices = predefinedGroups[leaderIndex] || [];

    savedNeighborIndices.forEach(idx => {
        const cell = cells.find(c => parseInt(c.dataset.index) === idx);
        if (cell && cell.style.visibility !== "hidden") {
            const nr = parseInt(cell.dataset.row);
            const nc = parseInt(cell.dataset.col);

            group.push({
                el: cell,
                currentX: 0,
                currentY: 0,
                targetX: 0,
                targetY: 0,
                isLeader: false,
                gridOffsetX: (nc - leaderCol) * cellWidth,
                gridOffsetY: (nr - leaderRow) * cellHeight
            });
        }
    });

    return group;
}

function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (activeTouches.length >= 2) return;

    draggedElement = e.currentTarget;
    if (draggedElement.style.visibility === "hidden") return;

    isDragging = true;
    draggedElement.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;
    mouseX = e.clientX;
    mouseY = e.clientY;

    dragGroup = getAttachedGroup(draggedElement);

    dragGroup.forEach(item => {
        if (item.isLeader) {
            item.el.classList.add('dragging');
        } else {
            item.el.classList.add('drag-group');
        }
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
    checkBinsHover(mouseX, mouseY);
}

function updateDragAnimation() {
    if (!isDragging) return;

    const leader = dragGroup.find(item => item.isLeader);

    leader.targetX = (mouseX - startX) / currentZoom;
    leader.targetY = (mouseY - startY) / currentZoom;

    leader.currentX += (leader.targetX - leader.currentX) * 0.35;
    leader.currentY += (leader.targetY - leader.currentY) * 0.35;

    dragGroup.forEach(item => {
        if (item.isLeader) {
            item.el.style.transform = "translate(" + item.currentX + "px, " + item.currentY + "px)";
        } else {
            const compressionFactor = 0.6;

            item.targetX = leader.currentX + (item.gridOffsetX * (compressionFactor - 1));
            item.targetY = leader.currentY + (item.gridOffsetY * (compressionFactor - 1));

            item.currentX += (item.targetX - item.currentX) * 0.15;
            item.currentY += (item.targetY - item.currentY) * 0.15;

            item.el.style.transform = "translate(" + item.currentX + "px, " + item.currentY + "px)";
        }
    });

    animationFrameId = requestAnimationFrame(updateDragAnimation);
}

function checkBinsHover(x, y) {
    const bins = document.querySelectorAll('.bin');
    bins.forEach(bin => {
        const rect = bin.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            bin.classList.add('drag-over');
        } else {
            bin.classList.remove('drag-over');
        }
    });
}

function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    cancelAnimationFrame(animationFrameId);

    const x = e.clientX;
    const y = e.clientY;

    let droppedInBin = null;
    const bins = document.querySelectorAll('.bin');

    bins.forEach(bin => {
        const rect = bin.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            droppedInBin = bin;
        }
        bin.classList.remove('drag-over');
    });

    if (droppedInBin) {
        const binIndex = parseInt(droppedInBin.dataset.bin) - 1;
        const itemsCount = dragGroup.length;

        dragGroup.forEach(item => {
            item.el.style.visibility = "hidden";
            resetElementStyles(item.el);
        });

        updateBinProgress(binIndex, itemsCount);
    } else {
        dragGroup.forEach(item => {
            resetElementStyles(item.el);
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
        resetElementStyles(item.el);
    });
    draggedElement = null;
    dragGroup = [];
}

function resetElementStyles(el) {
    el.classList.remove('dragging', 'drag-group');
    el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
    el.style.transform = '';

    setTimeout(() => {
        el.style.transition = '';
    }, 300);
}

function updateBinProgress(binIndex, count) {
    removedCount += count;

    // Рассчитываем «вместимость» одной коробки (20% от общего числа цифр)
    const binCapacity = TOTAL_NUMBERS / 5;

    // Считаем, сколько процентов добавляет каждая перетащенная цифра
    const percentPerItem = 100 / binCapacity;

    const currentProgress = binProgress.at(binIndex);
    // Прибавляем прогресс на основе количества перетащенных цифр (count)
    const newProgress = Math.min(100, Math.floor(currentProgress + (count * percentPerItem)));
    binProgress.splice(binIndex, 1, newProgress);

    document.getElementById("fill-" + (binIndex + 1)).style.width = newProgress + "%";
    document.getElementById("percent-" + (binIndex + 1)).textContent = newProgress + "%";

    const totalPercent = Math.min(100, Math.floor((removedCount / TOTAL_NUMBERS) * 100));
    totalPercentEl.textContent = totalPercent + "%";

    if (removedCount >= TOTAL_NUMBERS) {
        for(let i = 1; i <= 5; i++) {
            document.getElementById("fill-" + i).style.width = '100%';
            document.getElementById("percent-" + i).textContent = '100%';
        }
        totalPercentEl.textContent = '100%';

        setTimeout(() => {
            winScreen.classList.add('active');
        }, 500);
    }
}

initMatrix();
