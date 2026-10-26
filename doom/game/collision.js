// Geometry shared by movement, weapons, and enemy line-of-sight checks.
// Directions passed to rayBox must be normalized.
export function rayBox(origin, direction, box, limit = Infinity) {
    let near = 0;
    let far = limit;

    for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(direction[axis]) < 1e-8) {
            if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) {
                return null;
            }
            continue;
        }

        let entry = (box.min[axis] - origin[axis]) / direction[axis];
        let exit = (box.max[axis] - origin[axis]) / direction[axis];
        if (entry > exit) {
            [entry, exit] = [exit, entry];
        }
        near = Math.max(near, entry);
        far = Math.min(far, exit);
        if (near > far) {
            return null;
        }
    }
    return near;
}

export function entityBox(position, radius = 0.65, height = 1) {
    return {
        min: [position[0] - radius, position[1] - height, position[2] - radius],
        max: [position[0] + radius, position[1] + height, position[2] + radius],
    };
}

export function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function directionTo(from, to) {
    const length = distance(from, to) || 1;
    return to.map((value, axis) => (value - from[axis]) / length);
}

export function wallDistance(origin, direction, walls, limit = Infinity) {
    let closest = limit;
    for (const wall of walls) {
        const hit = rayBox(origin, direction, wall, closest);
        if (hit !== null) {
            closest = hit;
        }
    }
    return closest;
}

export function hasLineOfSight(from, to, walls) {
    const length = distance(from, to);
    return wallDistance(from, directionTo(from, to), walls, length) >= length;
}

export function moveBody(position, delta, walls, radius = 0.35) {
    // Sweep each horizontal axis separately. This slides along walls and prevents
    // a fast dash from skipping through a thin obstacle between updates.
    for (const axis of [0, 2]) {
        const otherAxis = axis === 0 ? 2 : 0;
        const start = position[axis];
        let end = start + delta[axis];

        for (const box of walls) {
            const aboveOrBelow = position[1] + 0.6 <= box.min[1] || position[1] - 0.8 >= box.max[1];
            const beside =
                position[otherAxis] + radius <= box.min[otherAxis] ||
                position[otherAxis] - radius >= box.max[otherAxis];
            if (aboveOrBelow || beside) {
                continue;
            }

            const near = box.min[axis] - radius;
            const far = box.max[axis] + radius;
            if (delta[axis] > 0 && start <= near && end > near) {
                end = near;
            } else if (delta[axis] < 0 && start >= far && end < far) {
                end = far;
            }
        }
        position[axis] = Math.max(-48, Math.min(48, end));
    }
}
