const GAP = 3;
const VIEWPORT_PADDING = 4;
const CELL_SIZE = 64;
const SEARCH_RADIUS = 4;

const NEARBY_OFFSETS = [];
for (let y = -SEARCH_RADIUS; y <= SEARCH_RADIUS; y++) {
    for (let x = -SEARCH_RADIUS; x <= SEARCH_RADIUS; x++) {
        NEARBY_OFFSETS.push({ x, y });
    }
}
NEARBY_OFFSETS.sort(
    (a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y || Math.abs(a.x) - Math.abs(b.x),
);

class OccupiedSpace {
    constructor() {
        this.cells = new Map();
    }

    overlaps(box) {
        const firstColumn = Math.floor((box.left - GAP) / CELL_SIZE);
        const lastColumn = Math.floor((box.left + box.width + GAP) / CELL_SIZE);
        const firstRow = Math.floor((box.top - GAP) / CELL_SIZE);
        const lastRow = Math.floor((box.top + box.height + GAP) / CELL_SIZE);
        for (let row = firstRow; row <= lastRow; row++) {
            for (let column = firstColumn; column <= lastColumn; column++) {
                const neighbors = this.cells.get(`${column},${row}`);
                if (!neighbors) {
                    continue;
                }
                for (const other of neighbors) {
                    if (
                        box.left < other.left + other.width + GAP &&
                        box.left + box.width + GAP > other.left &&
                        box.top < other.top + other.height + GAP &&
                        box.top + box.height + GAP > other.top
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    add(box) {
        for (
            let row = Math.floor(box.top / CELL_SIZE);
            row <= Math.floor((box.top + box.height) / CELL_SIZE);
            row++
        ) {
            for (
                let column = Math.floor(box.left / CELL_SIZE);
                column <= Math.floor((box.left + box.width) / CELL_SIZE);
                column++
            ) {
                const key = `${column},${row}`;
                const cell = this.cells.get(key);
                if (cell) {
                    cell.push(box);
                } else {
                    this.cells.set(key, [box]);
                }
            }
        }
    }
}

// Pure geometry: callers batch their DOM measurements before entering this function.
export function layoutHints(boxes, viewport) {
    const availableWidth = viewport.width - VIEWPORT_PADDING * 2;
    const availableHeight = viewport.height - VIEWPORT_PADDING * 2;
    const fits = (box) =>
        box.width > 0 &&
        box.height > 0 &&
        box.width <= availableWidth &&
        box.height <= availableHeight;
    let maxWidth = 0;
    let maxHeight = 0;
    for (const box of boxes) {
        if (!fits(box)) {
            continue;
        }
        maxWidth = Math.max(maxWidth, box.width);
        maxHeight = Math.max(maxHeight, box.height);
    }
    const columns = Math.floor((availableWidth + GAP) / (maxWidth + GAP));
    const rows = Math.floor((availableHeight + GAP) / (maxHeight + GAP));
    const occupied = new OccupiedSpace();
    let fallbackSlot = 0;

    return boxes.map((box) => {
        if (!fits(box)) {
            return null;
        }
        const left = Math.max(
            VIEWPORT_PADDING,
            Math.min(box.left, viewport.width - VIEWPORT_PADDING - box.width),
        );
        const top = Math.max(
            VIEWPORT_PADDING,
            Math.min(box.top, viewport.height - VIEWPORT_PADDING - box.height),
        );
        let placement = null;
        for (const offset of NEARBY_OFFSETS) {
            const candidate = {
                left: left + offset.x * (box.width + GAP),
                top: top + offset.y * (box.height + GAP),
                width: box.width,
                height: box.height,
            };
            if (
                candidate.left < VIEWPORT_PADDING ||
                candidate.top < VIEWPORT_PADDING ||
                candidate.left + box.width > viewport.width - VIEWPORT_PADDING ||
                candidate.top + box.height > viewport.height - VIEWPORT_PADDING
            ) {
                continue;
            }
            if (!occupied.overlaps(candidate)) {
                placement = candidate;
                break;
            }
        }

        // A shared cursor bounds fallback work across the entire session, even in dense clusters.
        while (!placement && fallbackSlot < columns * rows) {
            const slot = fallbackSlot++;
            const candidate = {
                left: VIEWPORT_PADDING + (slot % columns) * (maxWidth + GAP),
                top: VIEWPORT_PADDING + Math.floor(slot / columns) * (maxHeight + GAP),
                width: box.width,
                height: box.height,
            };
            if (!occupied.overlaps(candidate)) {
                placement = candidate;
            }
        }
        if (placement) {
            occupied.add(placement);
        }
        return placement;
    });
}
