import Camera from './Camera.js';

const mat4 = glMatrix.mat4;

export default class PerspectiveCamera extends Camera {

    constructor(options = {}) {
        super(options);

        this.aspect = options.aspect || 1.5;
        this.fov = options.fov || 1.7;
        this.near = options.near || 0.01;
        this.far = options.far || Infinity;

        this.updateMatrix();
    }

    updateMatrix() {
        mat4.perspective(this.matrix,
            this.fov, this.aspect,
            this.near, this.far);
    }
}
