const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

export default class Node {

    constructor(options = {}) {
        this.translation = options.translation ?
            vec3.clone(options.translation) :
            vec3.fromValues(0, 0, 0);
        this.rotation = options.rotation ?
            quat.clone(options.rotation) :
            quat.fromValues(0, 0, 0, 1);
        this.scale = options.scale ?
            vec3.clone(options.scale) :
            vec3.fromValues(1, 1, 1);
        this.matrix = options.matrix ?
            mat4.clone(options.matrix) :
            mat4.create();

        if (options.matrix) {
            this.updateTransform();
        } else if (options.translation || options.rotation || options.scale) {
            this.updateMatrix();
        }

        this.camera = options.camera || null;
        this.mesh = options.mesh || null;

        // ?????? fix pls
        let min = vec3.create();
        vec3.scale(min, this.scale, -1);
        let max = vec3.create();
        vec3.scale(max, this.scale, 1);
        this.aabb = {
            "min": min,
            "max": max
        }

        this.children = [...(options.children || [])];
        for (const child of this.children) {
            child.parent = this;
        }
        this.parent = null;

        this.transform = mat4.create();
        this.updateTransformB();
    }

    updateTransform() {
        mat4.getRotation(this.rotation, this.matrix);
        mat4.getTranslation(this.translation, this.matrix);
        mat4.getScaling(this.scale, this.matrix);
    }

    updateTransformB() {
        const t = this.transform;
        const degrees = this.rotation.map(x => x * 180 / Math.PI);
        const q = quat.fromEuler(quat.create(), ...degrees);
        const v = vec3.clone(this.translation);
        const s = vec3.clone(this.scale);
        mat4.fromRotationTranslationScale(t, q, v, s);
    }

    updateMatrix() {
        mat4.fromRotationTranslationScale(
            this.matrix,
            this.rotation,
            this.translation,
            this.scale);
    }

    getGlobalTransform() {
        if (!this.parent) {
            return mat4.clone(this.transform);
        } else {
            let transform = this.parent.getGlobalTransform();
            return mat4.mul(transform, transform, this.transform);
        }
    }

    addChild(node) {
        this.children.push(node);
        node.parent = this;
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    clone() {
        return new Node({
            ...this,
            children: this.children.map(child => child.clone()),
        });
    }
}