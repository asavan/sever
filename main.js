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

// Настройки оптического зума (Scale)
let currentZoom = 1.0;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

// Состояние Drag&Drop
let draggedElement = null;
let dragGroup = [];
let isDragging = false;
let animationFrameId = null;

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
    currentZoom = 1.0;

    // Сбрасываем трансформацию сетки
    grid.style.transform = `scale(1)`;
    grid.style.transformOrigin = 'center center';

    // 1. Создаем эталонную матрицу 28х12
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

    // 2. Генерируем постоянные связи один раз по базовой сетке
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

    // Слушатель колесика мыши вешаем на контейнер поля
    container.addEventListener('wheel', onContainerWheel, { passive: false });
}

// Обработчик зума с удержанием точки под мышкой
function onContainerWheel(e) {
    e.preventDefault();

    // Получаем координаты мыши строго внутри контейнера матрицы
    const rect = container.getBoundingClientRect();
    const mouseContainerX = e.clientX - rect.left;
    const mouseContainerY = e.clientY - rect.top;

    // Переводим пиксели в проценты для transform-origin
    const originX = (mouseContainerX / rect.width) * 100;
    const originY = (mouseContainerY / rect.height) * 100;

    // Меняем коэффициент масштаба
    if (e.deltaY < 0) {
        if (currentZoom < MAX_ZOOM) currentZoom += ZOOM_STEP;
    } else {
        if (currentZoom > MIN_ZOOM) currentZoom -= ZOOM_STEP;
    }

    // Применяем центр и масштаб. Старая цифра останется ровно под курсором!
    grid.style.transformOrigin = `${originX}% ${originY}%`;
    grid.style.transform = `scale(${currentZoom})`;
}

function getAttachedGroup(centerCell) {
    const group = [];
    const leaderRow = parseInt(centerCell.dataset.row);
    const leaderCol = parseInt(centerCell.dataset.col);

    // Так как масштаб применяется ко всей сетке, берем эталонные размеры ячейки без учета зума
    // Это исключает любые искажения геометрии
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
                // Смещение высчитывается по эталонной сетке
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

    // Сдвиг мыши делим на текущий коэффициент зума, чтобы скорость движения пучка
    // идеально соответствовала скорости курсора при любом приближении
    leader.targetX = (mouseX - startX) / currentZoom;
    leader.targetY = (mouseY - startY) / currentZoom;

    leader.currentX += (leader.targetX - leader.currentX) * 0.35;
    leader.currentY += (leader.targetY - leader.currentY) * 0.35;

    dragGroup.forEach(item => {
        if (item.isLeader) {
            item.el.style.transform = `translate(${item.currentX}px, ${item.currentY}px)`;
        } else {
            // Эффект стягивания в пучок (0.6 — кучка слегка сжимается к лидеру)
            const compressionFactor = 0.6;

            item.targetX = leader.currentX + (item.gridOffsetX * (compressionFactor - 1));
            item.targetY = leader.currentY + (item.gridOffsetY * (compressionFactor - 1));

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
