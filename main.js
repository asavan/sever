const COLS = 28;
const ROWS = 12;
const TOTAL_NUMBERS = COLS * ROWS;

const grid = document.getElementById('matrix-grid');
const totalPercentEl = document.getElementById('total-percent');
const winScreen = document.getElementById('win-screen');

let removedCount = 0;
let binProgress = Array(5).fill(0);
let cells = [];

// Карта постоянных связей
let predefinedGroups = {};

// Состояние Drag&Drop
let draggedElement = null;
let dragGroup = [];
let isDragging = false;
let animationFrameId = null;

// Стартовая позиция курсора и текущие координаты
let startX = 0;
let startY = 0;
let mouseX = 0;
let mouseY = 0;

function initMatrix() {
    grid.innerHTML = '';
    cells = [];
    removedCount = 0;
    binProgress = Array(5).fill(0);
    predefinedGroups = {};

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

    // Генерируем постоянные связи
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
}

function getAttachedGroup(centerCell) {
    const group = [];
    const leaderRow = parseInt(centerCell.dataset.row);
    const leaderCol = parseInt(centerCell.dataset.col);

    // Добавляем лидера
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

    // Примерный размер одной ячейки в пикселях для создания правильного масштаба смещения
    const cellWidth = centerCell.offsetWidth || 30;
    const cellHeight = centerCell.offsetHeight || 30;

    savedNeighborIndices.forEach(idx => {
        const cell = cells[idx];
        if (cell && cell.style.visibility !== 'hidden') {
            const nr = parseInt(cell.dataset.row);
            const nc = parseInt(cell.dataset.col);

            group.push({
                el: cell,
                currentX: 0,
                currentY: 0,
                targetX: 0,
                targetY: 0,
                isLeader: false,
                // Вычисляем смещение строго по разнице строк и колонок в сетке, а не по экрану
                gridOffsetX: (nc - leaderCol) * cellWidth,
                gridOffsetY: (nr - leaderRow) * cellHeight
            });
        }
    });

    return group;
}

function onPointerDown(e) {
    if (e.button !== 0) return;

    draggedElement = e.currentTarget;
    if (draggedElement.style.visibility === 'hidden') return;

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

    // Вычисляем чистый сдвиг мыши от точки клика
    leader.targetX = mouseX - startX;
    leader.targetY = mouseY - startY;

    // Мягкое сглаживание движения лидера за курсором (LERP)
    leader.currentX += (leader.targetX - leader.currentX) * 0.35;
    leader.currentY += (leader.targetY - leader.currentY) * 0.35;

    // Если мышка еще не сдвинулась с места клика, не ломаем позиционирование
    if (Math.abs(leader.targetX) < 1 && Math.abs(leader.targetY) < 1) {
        animationFrameId = requestAnimationFrame(updateDragAnimation);
        return;
    }

    dragGroup.forEach(item => {
        if (item.isLeader) {
            // Лидер плавно смещается за мышью
            item.el.style.transform = `translate(${item.currentX}px, ${item.currentY}px)`;
        } else {
            // Коэффициент притяжения: 1.0 — цифры летят строго на своих местах из сетки
            // 0.5 — немного стягиваются к лидеру в полете
            const compressionFactor = 1.0;

            item.targetX = leader.currentX + (item.gridOffsetX * compressionFactor);
            item.targetY = leader.currentY + (item.gridOffsetY * compressionFactor);

            item.currentX += (item.targetX - item.currentX) * 0.15;
            item.currentY += (item.targetY - item.currentY) * 0.15;

            item.el.style.transform = `translate(${item.currentX}px, ${item.currentY}px)`;
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
            item.el.style.visibility = 'hidden';
            resetElementStyles(item.el);
        });

        updateBinProgress(binIndex, itemsCount);
    } else {
        dragGroup.forEach(item => {
            resetElementStyles(item.el);
        });
    }

    draggedElement.releasePointerCapture(e.pointerId);
    draggedElement.removeEventListener('pointermove', onPointerMove);
    draggedElement.removeEventListener('pointerup', onPointerUp);

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
    binProgress[binIndex] = Math.min(100, binProgress[binIndex] + (count * 4));

    document.getElementById(`fill-${binIndex + 1}`).style.width = `${binProgress[binIndex]}%`;
    document.getElementById(`percent-${binIndex + 1}`).textContent = `${binProgress[binIndex]}%`;

    const totalPercent = Math.min(100, Math.floor((removedCount / TOTAL_NUMBERS) * 100));
    totalPercentEl.textContent = `${totalPercent}%`;

    if (removedCount >= TOTAL_NUMBERS) {
        for(let i=1; i<=5; i++) {
            document.getElementById(`fill-${i}`).style.width = '100%';
            document.getElementById(`percent-${i}`).textContent = '100%';
        }
        totalPercentEl.textContent = '100%';

        setTimeout(() => {
            winScreen.classList.add('active');
        }, 500);
    }
}

initMatrix();
