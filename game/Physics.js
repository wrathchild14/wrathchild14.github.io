const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;

export default class Physics {

    constructor(scene) {
        this.scene = scene;
    }

    update(dt) {
        this.scene.traverse(node => {
            if (node.velocity) {
                vec3.scaleAndAdd(node.translation, node.translation, node.velocity, dt);
                node.updateTransformB();
                this.scene.traverse(other => {
                    if (node !== other) {
                        this.resolveCollision(node, other);
                    }
                });
            }

            // i can just do node.update(dt);
            if (node.id == 'bullet') {
                node.update(dt);
            }
            if (node.id == 'enemy bullet') {
                node.update(dt);
            }
            if (node.id == 'enemy') {
                node.playerRotation = this.playerRotation;

                // i spawn the bullets here with every enemy update
                let bullet = node.update(dt)
                if (bullet) {
                    // change the enemy bullet mesh here
                    bullet.mesh = this.enemyBulletMesh;
                    this.scene.addNode(bullet);
                }
            }
        });
    }

    delete(node) {
        for (let i = 0; i < this.scene.nodes.length; i++) {
            if (this.scene.nodes[i] == node) {
                this.scene.nodes.splice(i, 1);
            }
        }
    }

    intervalIntersection(min1, max1, min2, max2) {
        return !(min1 > max2 || min2 > max1);
    }

    aabbIntersection(aabb1, aabb2) {
        return this.intervalIntersection(aabb1.min[0], aabb1.max[0], aabb2.min[0], aabb2.max[0]) &&
            this.intervalIntersection(aabb1.min[1], aabb1.max[1], aabb2.min[1], aabb2.max[1]) &&
            this.intervalIntersection(aabb1.min[2], aabb1.max[2], aabb2.min[2], aabb2.max[2]);
    }

    resolveCollision(a, b) {
        // Update bounding boxes with global translation.
        const ta = a.getGlobalTransform();
        const tb = b.getGlobalTransform();

        const posa = mat4.getTranslation(vec3.create(), ta);
        const posb = mat4.getTranslation(vec3.create(), tb);

        const mina = vec3.add(vec3.create(), posa, a.aabb.min);
        const maxa = vec3.add(vec3.create(), posa, a.aabb.max);
        const minb = vec3.add(vec3.create(), posb, b.aabb.min);
        const maxb = vec3.add(vec3.create(), posb, b.aabb.max);

        // Check if there is collision.
        const isColliding = this.aabbIntersection({
            min: mina,
            max: maxa
        }, {
            min: minb,
            max: maxb
        });

        if (!isColliding) {
            return;
        }


        // bullet and player dies
        if (a.id == "enemy bullet" && b.id == "player") {
            this.scene.continuation = false;
            return;
        } else if (b.id == "enemy bullet" && a.id == "player") {
            this.scene.continuation = false;
            return;
        }

        if (a.id == "enemy" && b.id == "player") {
            this.scene.continuation = false;
            return;
        } else if (b.id == "enemy" && a.id == "player") {
            this.scene.continuation = false;
            return;
        }

        // checks for the player and then checks for a structure
        // deletes the bullet if it hits a structure
        if (a.id == "bullet" && b.id != "enemy") {
            this.delete(a);
            return;
        } else if (b.id == "bullet" && a.id != "enemy") {
            this.delete(b);
            return;
        }

        if (a.id == "enemy bullet" && b.id != "enemy") {
            this.delete(a);
            return;
        } else if (b.id == "enemy bullet" && a.id != "enemy") {
            this.delete(b);
            return;
        }

        // ok its bad, the enemy and the bullet dies before the bullet comes to it
        if (a.id == "bullet" && b.id == "enemy") {
            this.delete(a);
            this.delete(b);
            return;
        } else if (b.id == "bullet" && a.id == "enemy") {
            this.delete(a);
            this.delete(b);
            return;
        }

        // Move node A minimally to avoid collision.
        const diffa = vec3.sub(vec3.create(), maxb, mina);
        const diffb = vec3.sub(vec3.create(), maxa, minb);

        let minDiff = Infinity;
        let minDirection = [0, 0, 0];
        if (diffa[0] >= 0 && diffa[0] < minDiff) {
            minDiff = diffa[0];
            minDirection = [minDiff, 0, 0];
        }
        if (diffa[1] >= 0 && diffa[1] < minDiff) {
            minDiff = diffa[1];
            minDirection = [0, minDiff, 0];
        }
        if (diffa[2] >= 0 && diffa[2] < minDiff) {
            minDiff = diffa[2];
            minDirection = [0, 0, minDiff];
        }
        if (diffb[0] >= 0 && diffb[0] < minDiff) {
            minDiff = diffb[0];
            minDirection = [-minDiff, 0, 0];
        }
        if (diffb[1] >= 0 && diffb[1] < minDiff) {
            minDiff = diffb[1];
            minDirection = [0, -minDiff, 0];
        }
        if (diffb[2] >= 0 && diffb[2] < minDiff) {
            minDiff = diffb[2];
            minDirection = [0, 0, -minDiff];
        }

        vec3.add(a.translation, a.translation, minDirection);
        a.updateTransformB();
    }
}