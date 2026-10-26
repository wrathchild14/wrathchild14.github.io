import GLTFLoader from './engine/GLTFLoader.js';

const { vec3 } = glMatrix;

function worldBounds(node) {
    const bounds = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
    };
    const transform = node.getGlobalTransform();
    for (const primitive of node.mesh.primitives) {
        const { min, max } = primitive.attributes.POSITION;
        if (!min || !max) {
            continue;
        }
        for (let corner = 0; corner < 8; corner++) {
            const point = min.map((value, axis) => (corner & (1 << axis) ? max[axis] : value));
            vec3.transformMat4(point, point, transform);
            for (let axis = 0; axis < 3; axis++) {
                bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
                bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
            }
        }
    }
    return bounds;
}

export async function loadArena() {
    const loader = new GLTFLoader();
    await loader.load('../common/models/1level/1level.gltf');
    const scene = await loader.loadScene(loader.defaultScene);
    const names = ['Bullet', 'Enemy', 'Enemy Bullet', 'Gun'];
    const models = await Promise.all(names.map((name) => loader.loadNode(name)));
    const [spark, enemy, projectile, gun] = models;
    scene.nodes = scene.nodes.filter((node) => !models.includes(node));

    const walls = [];
    scene.traverse((node) => {
        if (node.mesh) {
            const bounds = worldBounds(node);
            if (Number.isFinite(bounds.min[0])) {
                walls.push(bounds);
            }
        }
    });
    return {
        scene,
        staticNodes: [...scene.nodes],
        walls,
        meshes: {
            spark: spark.mesh,
            enemy: enemy.mesh,
            projectile: projectile.mesh,
            gun: gun.mesh,
        },
    };
}
