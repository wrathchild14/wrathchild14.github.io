// Full-screen passes use one oversized triangle, so no quad seam is visible.
const vertex = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
    vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = corner;
    gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

const blur = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oColor;
uniform sampler2D uImage;
uniform vec2 uStep;
uniform bool uExtract;

vec3 sampleLight(vec2 uv) {
    vec3 color = texture(uImage, uv).rgb;
    if (!uExtract) return color;
    // A soft knee lets warm highlights glow without blooming the gray floor.
    float brightness = max(color.r, max(color.g, color.b));
    float warm = smoothstep(0.04, 0.28, color.r - color.b);
    float threshold = mix(0.88, 0.58, warm);
    return color * smoothstep(threshold - 0.12, threshold + 0.12, brightness);
}

void main() {
    vec3 color = sampleLight(vUv) * 0.227027;
    color += sampleLight(vUv + uStep * 1.384615) * 0.316216;
    color += sampleLight(vUv - uStep * 1.384615) * 0.316216;
    color += sampleLight(vUv + uStep * 3.230769) * 0.070270;
    color += sampleLight(vUv - uStep * 3.230769) * 0.070270;
    oColor = vec4(color, 1.0);
}
`;

const composite = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uTime;
uniform float uMotion;
uniform float uRage;
uniform float uDamage;
uniform vec2 uResolution;

float grain(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec3 light = texture(uBloom, vUv).rgb;
    float heat = smoothstep(0.2, 0.8, light.r) * uMotion;
    // Distortion is confined to bright heat sources and stays below two pixels.
    vec2 shimmer = vec2(
        sin(vUv.y * 150.0 + uTime * 1.8),
        sin(vUv.x * 120.0 - uTime * 1.3)
    ) * heat * 1.4 / uResolution;
    vec2 uv = clamp(vUv + shimmer, vec2(0.001), vec2(0.999));
    vec3 color = texture(uScene, uv).rgb;

    // Deep teal shadows + amber highlights, with a restrained warm bloom.
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadows = vec3(0.015, 0.025, 0.026) * (1.0 - smoothstep(0.0, 0.5, luminance));
    color = pow(max(color, vec3(0.0)), vec3(1.08)) * vec3(1.05, 0.98, 0.91);
    color += shadows + light * vec3(1.0, 0.69, 0.36) * 0.36;
    // Soft highlight compression keeps lava texture visible inside the glow.
    color = color / (vec3(1.0) + color * 0.2) * 1.13;

    vec2 centered = vUv * 2.0 - 1.0;
    float edge = smoothstep(0.3, 1.45, dot(centered, centered));
    color *= 1.0 - edge * 0.24;
    color += edge * vec3(0.14, 0.012, 0.003) * max(uRage * 0.55, uDamage);
    float noise = grain(gl_FragCoord.xy + floor(uTime * 24.0) * uMotion);
    color += (noise - 0.5) / 180.0;
    oColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export default {
    blur: { vertex, fragment: blur },
    composite: { vertex, fragment: composite },
};
