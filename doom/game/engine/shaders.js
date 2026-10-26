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
precision mediump float;

uniform mediump sampler2D uTexture;
uniform float uTime;
uniform bool uLava;

in vec2 vTexCoord;
in float vDepth;
uniform vec3 uTint;
uniform vec3 uGlow;
uniform vec3 uSolidColor;
in vec3 vLocalPosition;

out vec4 oColor;

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
    float fog = smoothstep(12.0, 85.0, vDepth) * 0.78;
    oColor = vec4(mix(texel.rgb * uTint + uGlow, vec3(0.095, 0.025, 0.018), fog), 1.0);
}
`;

export default {
    simple: { vertex, fragment },
};
