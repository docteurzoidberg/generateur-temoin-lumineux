// 3D viewer of the preview meshes, after the mock-up's eclate.html: pieces exploded or
// assembled along the depth, any piece hidden on demand, and the simulated light
// (light.ts): the veil glows in the light colour, with a halo around it. Meshes come in
// the indicator frame (x right, y towards the wall, z up); three.js has y up and z towards
// the viewer, hence the rotation of the root group. Loaded on demand (dynamic import).
import {
  BufferAttribute, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, LineBasicMaterial, LineSegments,
  MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, ShaderMaterial, Sphere, Box3,
  Vector2, Vector3, WebGLRenderer, type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { PreviewPart } from '@temoin/core';
import { haloShare, intensity, mix, type Light } from './light.ts';

// Offset of each piece along the depth when exploded (mm, towards the wall), as in
// eclate.html.
const EXPLODE: Record<string, number> = { cadre: -14, legende_masque: -7.5, legende_voile: -4.5, panneau_essai: 0, boite: 16, fond: 36 };
const VIEWS = { iso: [-1, 0.55, 0.85], face: [0, 0.02, 1], side: [1, 0.18, 0.02], back: [0.75, 0.45, -1] } as const;
const LIT_PART = 'legende_voile';
// Halo of the lit veil: the blur of a bloom of the veil alone (selective bloom, as in
// three.js' webgl_postprocessing_unreal_bloom_selective example), drawn with the other
// pieces in black so that they still hide it, then added to the scene. No brightness
// threshold: all the letters and all the colours glow alike, whatever the scene lights.
const HALO = { strength: 0.6, radius: 0.4 };
const MIX = {
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D haloTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(haloTexture, vUv); }',
};

export type ViewName = keyof typeof VIEWS;

interface Piece { group: Group; mesh: Mesh<BufferGeometry, Material>; material: MeshStandardMaterial; edges: LineSegments<BufferGeometry, LineBasicMaterial>; color: string }

function geometry(p: PreviewPart): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(p.vertices, 3));
  g.setAttribute('normal', new BufferAttribute(p.normals, 3));
  g.setIndex(new BufferAttribute(p.triangles, 1));
  return g;
}

function lines(p: PreviewPart): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(p.edges, 3));
  return g;
}

export function createViewer(container: HTMLElement) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new WebGLRenderer({ antialias: true });   // throws without WebGL
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  container.prepend(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduceMotion;
  controls.dampingFactor = 0.12;

  // Lights of eclate.html, in the physical units of current three.js (× π).
  scene.add(new HemisphereLight(0xffffff, 0x3a3d33, 0.85 * Math.PI));
  const key = new DirectionalLight(0xffffff, 0.75 * Math.PI);
  key.position.set(-60, 90, 120);
  const rim = new DirectionalLight(0xffffff, 0.35 * Math.PI);
  rim.position.set(80, 40, -120);
  scene.add(key, rim);

  const root = new Group();
  root.rotation.x = -Math.PI / 2;   // (x, y, z) of the indicator → (x, z, -y) of three.js
  scene.add(root);
  const pieces = new Map<string, Piece>();
  const edgeMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.35 });
  let explode = 1, light: Light = { effect: 'steady', color: '#ffffff' }, fitted = false, active = false, frame = 0;

  const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };   // edges drawn on top
  const black = new MeshBasicMaterial({ color: 0x000000, ...offset }), glowing = new MeshBasicMaterial(offset);
  const halo = new EffectComposer(renderer);
  halo.renderToScreen = false;
  halo.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), HALO.strength, HALO.radius, 0);
  halo.addPass(bloom);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(new ShaderMaterial({ ...MIX, uniforms: { baseTexture: { value: null }, haloTexture: { value: bloom.renderTargetsHorizontal[0].texture } } }), 'baseTexture'));
  composer.addPass(new OutputPass());
  let tween: { from: [Vector3, Vector3]; to: [Vector3, Vector3]; t0: number } | undefined;

  function readTheme(): void {
    const css = getComputedStyle(document.documentElement);
    scene.background = new Color(css.getPropertyValue('--stage').trim());
    edgeMaterial.color = new Color(css.getPropertyValue('--edge').trim());
  }
  readTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Lit veil as in the front view (face.ts): letters in the light colour, a little whiter
  // at the core, with the white of the veil, lit by the scene, fading under them; halo in
  // the light colour. Never above 1 per channel, which would turn them white.
  function render(t: number): void {
    const veil = pieces.get(LIT_PART), k = intensity(light, t);
    if (veil) {
      veil.material.emissive.set(mix(light.color, '#ffffff', 0.35)).multiplyScalar(k);
      veil.material.color.set(veil.color).multiplyScalar(1 - k);
      glowing.color.set(light.color).multiplyScalar(k * haloShare(light.color));
    }
    const background = scene.background;
    scene.background = null;
    edgeMaterial.visible = false;
    for (const [name, p] of pieces) p.mesh.material = name === LIT_PART ? glowing : black;
    halo.render();
    for (const p of pieces.values()) p.mesh.material = p.material;
    edgeMaterial.visible = true;
    scene.background = background;
    composer.render();
  }

  function place(): void {
    for (const [name, p] of pieces) p.group.position.y = (EXPLODE[name] ?? 0) * explode;
  }

  function resize(): void {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    for (const c of [halo, composer]) { c.setPixelRatio(renderer.getPixelRatio()); c.setSize(w, h); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  // Camera looking along `dir` at the visible pieces, all in view.
  function fit(dir: readonly number[], animate: boolean): void {
    const box = new Box3();
    for (const p of pieces.values()) if (p.group.visible) box.expandByObject(p.group);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new Sphere());
    const vfov = MathUtils.degToRad(camera.fov / 2), hfov = Math.atan(Math.tan(vfov) * camera.aspect);
    const distance = (sphere.radius / Math.sin(Math.min(vfov, hfov))) * 1.04;
    const to: [Vector3, Vector3] = [sphere.center.clone().add(new Vector3(...dir).normalize().multiplyScalar(distance)), sphere.center.clone()];
    if (!animate || reduceMotion) {
      camera.position.copy(to[0]);
      controls.target.copy(to[1]);
      controls.update();
      return;
    }
    tween = { from: [camera.position.clone(), controls.target.clone()], to, t0: performance.now() };
  }
  const direction = () => camera.position.clone().sub(controls.target).toArray();

  function loop(t: number): void {
    if (tween) {
      const u = Math.min(1, (t - tween.t0) / 650), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      camera.position.lerpVectors(tween.from[0], tween.to[0], e);
      controls.target.lerpVectors(tween.from[1], tween.to[1], e);
      if (u === 1) tween = undefined;
    }
    controls.update();
    render(t);
    frame = active ? requestAnimationFrame(loop) : 0;
  }

  return {
    // New meshes: geometries replaced in place, materials kept (colour updated).
    show(parts: PreviewPart[]): void {
      for (const part of parts) {
        let p = pieces.get(part.name);
        if (!p) {
          const group = new Group();
          const material = new MeshStandardMaterial({ roughness: 0.6, ...offset });
          const mesh = new Mesh<BufferGeometry, Material>(geometry(part), material);
          const edges = new LineSegments(lines(part), edgeMaterial);
          group.add(mesh, edges);
          root.add(group);
          p = { group, mesh, material, edges, color: part.color };
          pieces.set(part.name, p);
        } else {
          p.mesh.geometry.dispose();
          p.mesh.geometry = geometry(part);
          p.edges.geometry.dispose();
          p.edges.geometry = lines(part);
        }
        p.color = part.color;
        p.material.color.set(part.color);
      }
      place();
      if (!fitted) { resize(); fit(VIEWS.iso, false); fitted = true; }
    },
    setLight(next: Light): void { light = next; },
    setExplode(k: number): void { explode = k; place(); },
    refit(): void { fit(direction(), true); },
    setVisible(name: string, visible: boolean): void {
      const p = pieces.get(name);
      if (p) p.group.visible = visible;
    },
    view(name: ViewName): void { fit(VIEWS[name], true); },
    // Renders only while shown.
    setActive(on: boolean): void {
      active = on;
      if (on && !frame) { resize(); frame = requestAnimationFrame(loop); }
    },
  };
}

export type Viewer = ReturnType<typeof createViewer>;
