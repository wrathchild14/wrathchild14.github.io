import Bullet from './Bullet.js';
import Node from './Node.js';

const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;
const vec3 = glMatrix.vec3;

export default class Enemy extends Node {
	constructor(options = {}) {
		super(options = {});

		this.counter = 0;
		this.id = "enemy"; // for traverse, to see if its a enemy
		this.r = options.r ?
			vec3.clone(options.r) :
			vec3.fromValues(0, 0, 0);
		this.velocity = options.velocity ?
			vec3.clone(options.velocity) :
			vec3.fromValues(0, 0, 0);
		this.mouseSensitivity = 0.002;
		this.maxSpeed = 2;
		this.friction = 0.2;
		this.acceleration = 20;
		let min = vec3.scale(vec3.create(), this.scale, -1);
		let max = vec3.scale(vec3.create(), this.scale, 1);
		this.aabb = {
			"min": min,
			"max": max
		}
		this.updateTransformB();
	}

	update(dt) {
		const c = this;
		c.r[0] = this.playerRotation[0];
		c.r[1] = this.playerRotation[1];
		const pi = Math.PI;
		const twopi = pi * 2;
		const halfpi = pi / 2;
		if (c.r[0] > halfpi) {
			c.r[0] = halfpi;
		}
		if (c.r[0] < -halfpi) {
			c.r[0] = -halfpi;
		}
		c.r[1] = ((c.r[1] % twopi) + twopi) % twopi;
		const degrees = c.r.map(x => x * 180 / pi);
		c.rotation = quat.fromEuler(c.rotation, 2, degrees[1], degrees[2]);
		// this makes them turn

		const forward = vec3.set(vec3.create(),
			-Math.sin(this.r[1]), 0, -Math.cos(this.r[1]));
		let acc = vec3.create(0, 0, 0);

		// so the model its on its back and i just subtract pi of the rotation of the bullet
		// vec3.add(acc, acc, forward);
		vec3.sub(acc, acc, forward);
		vec3.scaleAndAdd(c.velocity, c.velocity, acc, dt * c.acceleration);
		const len = vec3.len(c.velocity);
		if (len > c.maxSpeed) {
			vec3.scale(c.velocity, c.velocity, c.maxSpeed / len);
		}
		vec3.scaleAndAdd(c.translation, c.translation, c.velocity, dt);
		this.updateMatrix();

		// change this up
		// shoot them on intervals
		this.counter++;
		if (this.counter % 80 == 0) {
			let bullet = new Bullet();
			bullet.id = "enemy bullet";
			bullet.maxSpeed = 5;
			bullet.translation = vec3.add(vec3.create(), this.translation, forward);
			bullet.r = vec3.set(vec3.create(), this.r[0], this.r[1] - pi, this.r[2]); // subtract pi
			bullet.scale = vec3.fromValues(0.2, 0.2, 0.2);
			// hardcoding
			return bullet;
			// shoot the bullets somoehow, its in physics file
		}
	}
}