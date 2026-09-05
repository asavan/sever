const COLS = 28;
const ROWS = 12;
const TOTAL_NUMBERS = COLS * ROWS;

const grid = document.getElementById('matrix-grid');
const totalPercentEl = document.getElementById('total-percent');
const winScreen = document.getElementById('win-screen');

let initialCount = TOTAL_NUMBERS;
let removedCount = 0;
let binProgress = [0, 0, 0, 0, 0]; // Прогресс для 5 коробок

// Хранилище объектов клеток
let cells = [];

// Переменные состояния перетаскивания
let draggedElement = null;
let dragGroup = []; // Список элементов, которые "прилипли"
let isDragging = false;

// Инициализация сетки чисел
function initMatrix() {
    grid.innerHTML = '';
    cells = [];
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('num-cell');
            cell.textContent = Math.floor(Math.random() * 10);
            
            // Сохраняем координаты в dataset для поиска соседей
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            grid.appendChild(cell);
            cells.push(cell);
            
            // Вешаем обработчики указателя (для мыши)
            cell.addEventListener('pointerdown', onPointerDown);
        }
    }
}

// Поиск случайных соседей в радиусе вокруг зажатой цифры
function getAttachedGroup(centerCell) {
    const group = [centerCell];
    const centerRow = parseInt(centerCell.dataset.row);
    const centerCol = parseInt(centerCell.dataset.col);
    
    // Перебираем область 3x3 вокруг элемента
    cells.forEach(cell => {
        if (cell === centerCell || cell.style.visibility === 'hidden') return;
        
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        
        if (Math.abs(r - centerRow) <= 1 && Math.abs(c - centerCol) <= 1) {
            // Вероятность 40%, что соседняя цифра "прилипнет" к группе
            if (Math.random() < 0.4) {
                group.push(cell);
            }
        }
    });
    
    return group;
}

function onPointerDown(e) {
    if (e.button !== 0) return; // Только левая кнопка мыши
    
    draggedElement = e.currentTarget;
    if (draggedElement.style.visibility === 'hidden') return;

    isDragging = true;
    draggedElement.setPointerCapture(e.pointerId);

    // Собираем "прилипшую" группу
    dragGroup = getAttachedGroup(draggedElement);
    
    // Визуально подсвечиваем всю группу
    dragGroup.forEach(el => {
        if (el === draggedElement) {
            el.classList.add('dragging');
        } else {
            el.classList.add('drag-group');
        }
    });

    // Навешиваем глобальные слушатели перемещения и отпускания
    draggedElement.addEventListener('pointermove', onPointerMove);
    draggedElement.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e) {
    if (!isDragging) return;

    // Двигаем главный элемент за курсором
    // Смещение рассчитывается так, чтобы элемент центрировался по курсору
    const x = e.clientX;
    const y = e.clientY;
    
    // Для простоты визуализации группа следует за движениями главного элемента через CSS-трансформацию
    draggedElement.style.position = 'fixed';
    draggedElement.style.left = `${x}px`;
    draggedElement.style.top = `${y}px`;
    draggedElement.style.transform = 'translate(-50%, -50%) scale(1.5)';

    // Тянем за собой остальных участников группы с небольшим смещением
    dragGroup.forEach((el, index) => {
        if (el === draggedElement) return;
        el.style.position = 'fixed';
        // Каждому соседу даем легкий разброс, создавая эффект "кучки" элементов
        const offsetX = (index % 2 === 0 ? 20 : -20) * Math.ceil(index/2);
        const offsetY = (index % 3 === 0 ? 20 : -10);
        el.style.left = `${x + offsetX}px`;
        el.style.top = `${y + offsetY}px`;
    });

    // Проверяем, находится ли курсор над какой-то из коробок (Bins)
    checkBinsHover(x, y);
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

    // Вычисляем, куда бросили кучку
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
        // Успешно сбросили в коробку!
        const binIndex = parseInt(droppedInBin.dataset.bin) - 1;
        const itemsCount = dragGroup.length;

        // "Уничтожаем" элементы (скрываем их)
        dragGroup.forEach(el => {
            el.style.visibility = 'hidden';
            resetElementStyles(el);
        });

        // Начисляем очки прогресса коробке
        updateBinProgress(binIndex, itemsCount);
    } else {
        // Вернуть элементы на свои места в сетку
        dragGroup.forEach(el => {
            resetElementStyles(el);
        });
    }

    // Очистка состояния
    draggedElement.releasePointerCapture(e.pointerId);
    draggedElement.removeEventListener('pointermove', onPointerMove);
    draggedElement.removeEventListener('pointerup', onPointerUp);
    
    draggedElement = null;
    dragGroup = [];
}

// Сброс временных стилей перетаскивания и возвращение в сетку
function resetElementStyles(el) {
    el.classList.remove('dragging', 'drag-group');
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.transform = '';
}

// Обновление прогресс-баров коробок и общего счетчика файлов
function updateBinProgress(binIndex, count) {
    removedCount += count;
    
    // В оригинальной игре коробки заполняются неравномерно, распределим "вес"
    // Ограничиваем каждую коробку максимум в 100%
    binProgress[binIndex] = Math.min(100, binProgress[binIndex] + (count * 4)); 

    // Визуализируем изменения коробок
    document.getElementById(`fill-${binIndex + 1}`).style.width = `${binProgress[binIndex]}%`;
    document.getElementById(`percent-${binIndex + 1}`).textContent = `${binProgress[binIndex]}%`;

    // Считаем общий процент прогресса на основе оставшихся чисел на поле
    const totalPercent = Math.min(100, Math.floor((removedCount / TOTAL_NUMBERS) * 100));
    totalPercentEl.textContent = `${totalPercent}%`;

    // Условие победы (все числа убраны с поля)
    if (removedCount >= TOTAL_NUMBERS) {
        // Принудительно ставим бары на 100% для красоты
        for(let i=1; i<=5; i++) {
            document.getElementById(`fill-${i}`).style.width = '100%';
            document.getElementById(`percent-${i}`).textContent = '100%';
        }
        totalPercentEl.textContent = '100%';
        
        // Показываем экран победы
        setTimeout(() => {
            winScreen.classList.add('active');
        }, 500);
    }
}

// Запуск игры
initMatrix();
