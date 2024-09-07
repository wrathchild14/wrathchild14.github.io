import Node from './Node.js';

const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;
const vec3 = glMatrix.vec3;

export default class Bullet extends Node {
	constructor(options = {}) {
		super(options = {});

		this.id = "bullet"; // for traverse, to see if its a bullet
		this.r = options.r ?
			vec3.clone(options.r) :
			vec3.fromValues(0, 0, 0);
		this.velocity = options.velocity ?
			vec3.clone(options.velocity) :
			vec3.fromValues(0, 0, 0);
		this.maxSpeed = 15;
		this.acceleration = 70;
		this.scale = vec3.fromValues(0.1, 0.1, 0.1);
		this.mesh = null; // idk, we got to have a mesh
		this.aabb = {
			"min": [-0.05, -0.05, -0.05],
			"max": [0.05, 0.05, 0.05]
		}

		this.updateTransformB();
	}

	update(dt) {
		// voa go tere samo napredi da ode
		const c = this;
		const forward = vec3.set(vec3.create(), -Math.sin(c.r[1]), 0, -Math.cos(c.r[1]));

		let acc = vec3.create(0, 0, 0);
		vec3.add(acc, acc, forward); // lazy fix
		vec3.add(acc, acc, forward); // lazy fix
		vec3.add(acc, acc, forward); // lazy fix
		vec3.add(acc, acc, forward); // lazy fix
		vec3.scaleAndAdd(c.velocity, c.velocity, acc, dt * c.acceleration);
		const len = vec3.len(c.velocity);
		if (len > c.maxSpeed) {
			vec3.scale(c.velocity, c.velocity, c.maxSpeed / len);
		}
		vec3.scaleAndAdd(c.translation, c.translation, c.velocity, dt);
		this.updateMatrix();
	}
}