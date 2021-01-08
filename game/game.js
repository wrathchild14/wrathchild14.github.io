import Application from '../../common/Application.js';
import GLTFLoader from './GLTFLoader.js';
import Renderer from './Renderer.js';
import PerspectiveCamera from './PerspectiveCamera.js';
import MyCamera from './MyCamera.js';
import Physics from './Physics.js';
import Enemy from './Enemy.js';

const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;
const vec3 = glMatrix.vec3;

class App extends Application {
	async start() {
		this.loader = new GLTFLoader();
		await this.loader.load('../../common/models/1level/1level.gltf');

		this.scene = await this.loader.loadScene(this.loader.defaultScene);

		this.my_bullet = await this.loader.loadNode("Bullet");
		// sphere is my bullet
		this.my_bullet.translation = vec3.fromValues(0, -1, 0);
		this.my_bullet.updateMatrix();

		// can be anyting
		// make a name for this
		this.my_enemy = await this.loader.loadNode("Enemy"); // "Enemy"
		this.my_enemy.translation = vec3.fromValues(100, -1, 0);
		this.my_enemy.updateMatrix();

		this.maxEnemies = 20;
		this.kill_counter = - this.maxEnemies; // it spawn 2 enemys,
		// and it counts for every new guy spawned

		// making the "player"
		this.camera = new MyCamera();
		this.camera.translation = vec3.fromValues(0, 1, 10);
		this.camera.updateMatrix();
		this.camera.maxSpeed = 7;
		this.camera.acceleration = 40;
		this.camera.camera = new PerspectiveCamera();
		this.scene.addNode(this.camera);

		this.bullets = [];
		this.physics = new Physics(this.scene);

		// load the enemy bullet mesh here
		this.enemy_bullet = await this.loader.loadNode("Enemy Bullet");
		this.physics.enemyBulletMesh = this.enemy_bullet.mesh;
		this.enemy_bullet.translation = vec3.fromValues(0, -1, 0);
		this.enemy_bullet.updateMatrix();

		this.my_gun = await this.loader.loadNode("Gun");
		this.camera.gun = this.my_gun;

		console.log(this.scene, this.physics);

		this.renderer = new Renderer(this.gl);
		this.renderer.prepareScene(this.scene);
		this.resize();

		this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
		document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);

		this.myAudio = document.createElement("audio");
		this.myAudio.src = "../../common/models/1level/Rip & Off.mp3";
	}

	enableCamera() {
		this.canvas.requestPointerLock();
		this.myAudio.play();
	}

	pointerlockchangeHandler() {
		if (document.pointerLockElement === this.canvas) {
			this.camera.enable();
		} else {
			this.camera.disable();
		}
	}

	update() {
		this.time = Date.now();
		const dt = (this.time - this.startTime) * 0.001;
		this.startTime = this.time;

		if (this.scene && this.scene.continuation) {
			if (this.camera) {
				this.camera.update(dt);
				this.bullets = this.camera.getBullets();

				this.physics.playerRotation = vec3.clone(this.camera.r);
				// this is an oof
				if (this.bullets.length > 0) {
					// this.bulletPhysics.add(this.bullets[0]);
					// so that we dont need the bulletphysics class, we just make and add the bullet here
					this.bullets[0].mesh = this.my_bullet.mesh;
					this.bullets[0].updateMatrix();
					this.scene.addNode(this.bullets[0]);

					this.bullets = [];
					this.camera.delBullets();
				}
				// checks if there are any bullets and if they are, it gets it from the camera
				// and adds it to the bullet phyics which updates it later on
			}

			if (this.physics) {
				this.physics.update(dt);
			}

			let my_kills = this.kill_counter - 1;
			kills.innerHTML = "Kills: " + my_kills;

			// checks how many enemies in the scene and if its less that 2,
			// randomly spawns in another enemy, can optimize this
			if (this.scene) {
				this.enemy_count = 0;
				for (let i = 0; i < this.scene.nodes.length; i++) {
					if (this.scene.nodes[i].id == "enemy") {
						this.enemy_count++;
					}
				}
			}

			if (this.enemy_count <= this.maxEnemies) {
				let enemy = new Enemy();
				this.kill_counter++;
				this.scene.kill_counter = this.kill_counter;
				let x = Math.random() * (50 - -50) + -50;
				let z = Math.random() * (50 - -50) + -50;
				enemy.translation = [x, 1, z];
				enemy.mesh = this.my_enemy.mesh;
				enemy.updateMatrix();
				this.scene.addNode(enemy);
			}
		}
		else {
			kills.innerHTML = "Kills: " + (this.kill_counter - 1);
			if (this.myAudio) this.myAudio.pause();
			timer.innerHTML = "Alive: no";
		}
	}

	render() {
		if (this.renderer) {
			this.renderer.render(this.scene, this.camera);
		}
	}

	resize() {
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		const aspectRatio = w / h;

		if (this.camera) {
			this.camera.camera.aspect = aspectRatio;
			this.camera.camera.updateMatrix();
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.querySelector('canvas');
	const app = new App(canvas);
	document.addEventListener('click', () => app.enableCamera());
});
