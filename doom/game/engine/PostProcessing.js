import { buildPrograms } from './WebGL.js';
import shaders from './postShaders.js';

// Owns GPU targets only. Game rules and HUD stay outside the shader pipeline.
export default class PostProcessing {
    constructor(gl) {
        this.gl = gl;
        this.enabled = true;
        this.width = 0;
        this.height = 0;
        this.targets = [];
        this.programs = buildPrograms(gl, shaders);
        this.vertexArray = gl.createVertexArray();
    }

    createTarget(width, height, depth = false) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA8,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const target = { texture, framebuffer, width, height, depth: null };
        this.targets.push(target);
        if (depth) {
            target.depth = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.RENDERBUFFER,
                target.depth,
            );
        }
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Post-processing target is unavailable');
        }
        return target;
    }

    resize(width, height) {
        if (width === this.width && height === this.height) return;
        this.releaseTargets();
        this.width = width;
        this.height = height;
        this.scene = this.createTarget(width, height, true);
        const halfWidth = Math.max(1, Math.floor(width / 2));
        const halfHeight = Math.max(1, Math.floor(height / 2));
        this.horizontal = this.createTarget(halfWidth, halfHeight);
        this.vertical = this.createTarget(halfWidth, halfHeight);
    }

    begin(width, height) {
        const gl = this.gl;
        if (this.enabled) {
            try {
                this.resize(width, height);
            } catch (error) {
                console.warn('Using original graphics:', error.message);
                this.enabled = false;
                this.releaseTargets();
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.enabled ? this.scene.framebuffer : null);
        gl.viewport(0, 0, width, height);
    }

    texture(texture, unit) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        // The world renderer uses samplers; these targets need clamp + linear filtering.
        gl.bindSampler(unit, null);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    blur(input, output, x, y, extract) {
        const gl = this.gl;
        const program = this.programs.blur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
        gl.viewport(0, 0, output.width, output.height);
        gl.useProgram(program.program);
        this.texture(input.texture, 0);
        gl.uniform1i(program.uniforms.uImage, 0);
        gl.uniform2f(program.uniforms.uStep, x, y);
        gl.uniform1i(program.uniforms.uExtract, extract);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    finish({ time, reducedMotion, rage, damage }) {
        if (!this.enabled) return;
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(this.vertexArray);
        this.blur(this.scene, this.horizontal, 3 / this.width, 0, true);
        this.blur(this.horizontal, this.vertical, 0, 2 / this.vertical.height, false);

        const program = this.programs.composite;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(program.program);
        this.texture(this.scene.texture, 0);
        this.texture(this.vertical.texture, 1);
        gl.uniform1i(program.uniforms.uScene, 0);
        gl.uniform1i(program.uniforms.uBloom, 1);
        gl.uniform1f(program.uniforms.uTime, time);
        gl.uniform1f(program.uniforms.uMotion, reducedMotion ? 0 : 1);
        gl.uniform1f(program.uniforms.uRage, rage ? 1 : 0);
        gl.uniform1f(program.uniforms.uDamage, damage);
        gl.uniform2f(program.uniforms.uResolution, this.width, this.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }

    releaseTargets() {
        const gl = this.gl;
        for (const target of this.targets) {
            gl.deleteTexture(target.texture);
            gl.deleteFramebuffer(target.framebuffer);
            if (target.depth) gl.deleteRenderbuffer(target.depth);
        }
        this.targets = [];
        this.scene = null;
        this.horizontal = null;
        this.vertical = null;
        this.width = 0;
        this.height = 0;
    }
}
