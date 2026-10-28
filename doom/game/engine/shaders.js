const vertex = `#version 300 es

layout (location = 0) in vec4 aPosition;
layout (location = 1) in vec2 aTexCoord;

uniform mat4 uMvpMatrix;

out vec2 vTexCoord;
out float vDepth;
out vec3 vLocalPosition;

void main() {
    vTexCoord = aTexCoord;
    vLocalPosition = aPosition.xyz;
    gl_Position = uMvpMatrix * aPosition;
    vDepth = gl_Position.w;
}
`;

const fragment = `#version 300 es
precision highp float;

uniform mediump sampler2D uTexture;
uniform float uTime;
uniform bool uLava;
uniform int uEffect;
uniform float uDissolve;

in vec2 vTexCoord;
in float vDepth;
uniform vec3 uTint;
uniform vec3 uGlow;
uniform vec3 uSolidColor;
in vec3 vLocalPosition;

out vec4 oColor;

float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(cell), hash(cell + vec3(1, 0, 0)), f.x),
        mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), f.x),
        mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void main() {
    vec2 uv = vTexCoord;
    if (uLava) {
        uv += vec2(sin(uv.y * 17.0 + uTime * 0.4), cos(uv.x * 13.0 - uTime * 0.3)) * 0.006;
    }
    vec4 texel = texture(uTexture, uv);
    if (uLava) {
        float vein = smoothstep(0.35, 0.8, texel.r) * (1.0 - texel.b);
        float pulse = 0.85 + 0.15 * sin(vLocalPosition.y * 3.0 + uTime * 1.2);
        texel.rgb += vec3(0.2, 0.065, 0.008) * vein * pulse;
    }
    if (texel.a < 0.4) discard;
    if (uSolidColor.x >= 0.0) {
        vec3 normal = normalize(cross(dFdx(vLocalPosition), dFdy(vLocalPosition)));
        float shade = 0.5 + 0.3 * abs(normal.y) + 0.2 * abs(normal.x);
        texel.rgb = uSolidColor * shade;
    }
    if (uEffect == 1 || uEffect == 2) {
        // Object-space turbulence wraps around the whole projectile / muzzle mesh.
        vec3 flow = vLocalPosition * 5.0 + vec3(0.0, -uTime * 3.0, uTime);
        float plasma = noise(flow) * 0.7 + noise(flow * 2.1) * 0.3;
        float veins = 1.0 - smoothstep(0.025, 0.12, abs(plasma - 0.5));
        vec3 ember = mix(vec3(0.65, 0.025, 0.002), vec3(1.2, 0.32, 0.015), plasma);
        vec3 core = uEffect == 2 ? vec3(1.8, 1.3, 0.65) : vec3(1.6, 0.9, 0.22);
        texel.rgb = mix(ember, core, veins);
    }
    if (uEffect == 3) {
        // Stable noise burns holes through the corpse; only the threshold advances.
        float ash = noise(vLocalPosition * 7.0) * 0.75
            + noise(vLocalPosition * 17.0) * 0.25;
        float remaining = ash - mix(-0.1, 1.1, uDissolve);
        if (remaining < 0.0) discard;
        float rim = 1.0 - smoothstep(0.0, 0.09, remaining);
        texel.rgb = mix(texel.rgb * (1.0 - uDissolve * 0.75),
            vec3(1.8, 0.65, 0.06), rim);
    }
    float fog = smoothstep(12.0, 85.0, vDepth) * 0.78;
    oColor = vec4(mix(texel.rgb * uTint + uGlow, vec3(0.095, 0.025, 0.018), fog), 1.0);
}
`;

export default {
    simple: { vertex, fragment },
};
