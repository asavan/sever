const COLS = 28;
const ROWS = 12;
const TOTAL_NUMBERS = COLS * ROWS;

const grid = document.getElementById('matrix-grid');
const totalPercentEl = document.getElementById('total-percent');
const winScreen = document.getElementById('win-screen');

let removedCount = 0;
let binProgress = [0, 0, 0, 0, 0];
let cells = [];

// Карта постоянных связей: для каждого индекса ячейки сохраняем массив индексов её "прилипал"
let predefinedGroups = {};

// Переменные состояния мыши и Drag&Drop
let draggedElement = null;
let dragGroup = []; // Массив объектов для группы { el, startX, startY, currentX, currentY, targetX, targetY, isLeader }
let isDragging = false;
let animationFrameId = null;

// Координаты мыши относительно экрана
let mouseX = 0;
let mouseY = 0;

function initMatrix() {
    grid.innerHTML = '';
    cells = [];
    removedCount = 0;
    binProgress = [0, 0, 0, 0, 0];
    predefinedGroups = {};

    // 1. Создаем элементы в сетке
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('num-cell');
            cell.textContent = Math.floor(Math.random() * 10);
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.index = r * COLS + c; // уникальный индекс

            grid.appendChild(cell);
            cells.push(cell);

            cell.addEventListener('pointerdown', onPointerDown);
        }
    }

    // 2. СРАЗУ ГЕНЕРИРУЕМ И ЗАПОМИНАЕМ СВЯЗИ ДЛЯ ВСЕХ ЧИСЕЛ (Один раз на всю игру)
    cells.forEach(cell => {
        const index = parseInt(cell.dataset.index);
        const centerRow = parseInt(cell.dataset.row);
        const centerCol = parseInt(cell.dataset.col);
        const attachedIndices = [];

        cells.forEach(neighbor => {
            if (neighbor === cell) return;
            const nr = parseInt(neighbor.dataset.row);
            const nc = parseInt(neighbor.dataset.col);

            // Если это сосед в радиусе 1 клетки
            if (Math.abs(nr - centerRow) <= 1 && Math.abs(nc - centerCol) <= 1) {
                // Шанс 45%, что этот сосед навсегда закрепится за этим числом
                if (Math.random() < 0.45) {
                    attachedIndices.push(parseInt(neighbor.dataset.index));
                }
            }
        });

        // Сохраняем группу для этой ячейки
        predefinedGroups[index] = attachedIndices;
    });
}

// Получение группы на основе ЗАПОМНЕННЫХ связей
function getAttachedGroup(centerCell) {
    const group = [];
    const leaderRect = centerCell.getBoundingClientRect();
    const leaderCenterX = leaderRect.left + leaderRect.width / 2;
    const leaderCenterY = leaderRect.top + leaderRect.height / 2;

    // Добавляем лидера
    group.push({
        el: centerCell,
        startX: leaderCenterX,
        startY: leaderCenterY,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        isLeader: true
    });

    // Извлекаем из памяти сохраненных соседей для этого числа
    const leaderIndex = parseInt(centerCell.dataset.index);
    const savedNeighborIndices = predefinedGroups[leaderIndex] || [];

    savedNeighborIndices.forEach(idx => {
        const cell = cells[idx];
        // Берем соседа, только если он еще не собран в коробку (видим на экране)
        if (cell && cell.style.visibility !== 'hidden') {
            const cellRect = cell.getBoundingClientRect();
            const cellCenterX = cellRect.left + cellRect.width / 2;
            const cellCenterY = cellRect.top + cellRect.height / 2;

            group.push({
                el: cell,
                startX: cellCenterX,
                startY: cellCenterY,
                currentX: 0,
                currentY: 0,
                targetX: 0,
                targetY: 0,
                isLeader: false,
                // Исходное смещение соседа относительно лидера в сетке
                offsetX: cellCenterX - leaderCenterX,
                offsetY: cellCenterY - leaderCenterY
            });
        }
    });

    return group;
}

function onPointerDown(e) {
    if (e.button !== 0) return; // Только ЛКМ

    draggedElement = e.currentTarget;
    if (draggedElement.style.visibility === 'hidden') return;

    isDragging = true;
    draggedElement.setPointerCapture(e.pointerId);

    mouseX = e.clientX;
    mouseY = e.clientY;

    // Собираем группу (она всегда будет одинаковой для этого числа!)
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

// Физика движения группы с эффектом легкого стягивания к центру
function updateDragAnimation() {
    if (!isDragging) return;

    const leader = dragGroup.find(item => item.isLeader);

    dragGroup.forEach(item => {
        if (item.isLeader) {
            item.targetX = mouseX - item.startX;
            item.targetY = mouseY - item.startY;

            // Мягкое следование лидера за курсором
            item.currentX += (item.targetX - item.currentX) * 0.4;
            item.currentY += (item.targetY - item.currentY) * 0.4;

            item.el.style.transform = `translate(${item.currentX}px, ${item.currentY}px) scale(1.6)`;
        } else {
            // ЭФФЕКТ ПРИТЯЖЕНИЯ И ЗАПАЗДЫВАНИЯ:
            // Умножаем offsetX и offsetY на коэффициент меньше 1 (например, 0.5),
            // чтобы соседи не разлетались, а слегка стягивались к центру пучка при таскании.
            const compressionFactor = 0.5;

            item.targetX = leader.currentX + (item.offsetX * compressionFactor);
            item.targetY = leader.currentY + (item.offsetY * compressionFactor);

            // Плавное догоняние (LERP)
            item.currentX += (item.targetX - item.currentX) * 0.15;
            item.currentY += (item.targetY - item.currentY) * 0.15;

            item.el.style.transform = `translate(${item.currentX}px, ${item.currentY}px) scale(1.2)`;
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
