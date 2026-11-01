import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { polygons, type Dataset, type Tract } from "./data";
import { targeted } from "./analytics";
import { bounds, makeGeometry, makeShape } from "./geometry";
import { createColors } from "./colors";
import type { State } from "./state";

export function createMap(
  host: HTMLElement,
  data: Dataset,
  inspect: (id: string) => void,
  explore: () => void,
  fallback: (message: string) => void,
  cameraChanged: (awayFromDefault: boolean) => void,
) {
  const start = performance.now();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Synthetic tract map. Use the searchable tract list to inspect with a keyboard.",
  );
  renderer.domElement.setAttribute("role", "img");
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 1500);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minDistance = 45;
  controls.maxDistance = 450;
  controls.enablePan = false;
  controls.minPolarAngle = 0.001;
  controls.maxPolarAngle = 0.001;
  scene.add(new T.AmbientLight("#ffffff", 1.1));
  const light = new T.DirectionalLight("#ffffff", 1.3);
  light.position.set(-70, -60, 120);
  scene.add(light);
  const b = bounds(data.tracts);
  const max = Math.max(0, ...data.tracts.map((t) => t.underservedHouseholds));
  const colors = createColors(data);
  let state: State,
    destroyed = false,
    raf = 0,
    transition: {
      start: number;
      from: T.Vector3;
      to: T.Vector3;
      height: number;
      target: number;
    } | null = null;
  let heightFraction = 0;
  let frames = 0,
    firstMapMs = 0,
    mapInitializationMs = 0;
  const renderCpuTimes: number[] = [];
  const frameTimes: number[] = [];
  let lastFrame = 0,
    interacting = false,
    sampleRaf = 0;
  const materialCache = new Map<string, T.MeshStandardMaterial>();
  const footprintMaterials = new Map<string, T.MeshBasicMaterial>();
  const footprintMaterial = (color: string, opacity: number) => {
    const key = color + ":" + opacity;
    if (!footprintMaterials.has(key))
      footprintMaterials.set(
        key,
        new T.MeshBasicMaterial({
          color,
          opacity,
          transparent: opacity < 1,
          side: T.DoubleSide,
          toneMapped: false,
        }),
      );
    return footprintMaterials.get(key)!;
  };
  const material = (color: string, opacity: number) => {
    const key = color + ":" + opacity;
    if (!materialCache.has(key))
      materialCache.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.85,
          metalness: 0,
          transparent: opacity < 1,
          opacity,
          side: T.DoubleSide,
          flatShading: true,
        }),
      );
    return materialCache.get(key)!;
  };
  const lineMaterials = [
    new T.LineBasicMaterial({
      color: "#3e6669",
      transparent: true,
      opacity: 0.75,
      toneMapped: false,
    }),
    new T.LineBasicMaterial({ color: "#142c32", linewidth: 2 }),
    new T.LineBasicMaterial({ color: "#ffffff" }),
  ];
  const items: {
    mesh: T.Mesh;
    footprint: T.Mesh;
    edges: T.LineSegments;
    tract: Tract;
    height: number;
  }[] = [];
  for (const tract of data.tracts)
    for (const p of polygons(tract.geometry)) {
      const geometry = makeGeometry(p, b);
      const mesh = new T.Mesh(
        geometry,
        material(colors.color(tract, "adoption"), 1),
      );
      mesh.userData.id = tract.id;
      const edges = new T.LineSegments(
        new T.EdgesGeometry(geometry, 30),
        lineMaterials[0],
      );
      const footprint = new T.Mesh(
        new T.ShapeGeometry(makeShape(p, b)),
        footprintMaterial(colors.color(tract, "adoption"), 1),
      );
      footprint.userData.id = tract.id;
      scene.add(mesh, footprint, edges);
      items.push({
        mesh,
        footprint,
        edges,
        tract,
        height: max ? (tract.underservedHouseholds / max) * 25 : 0,
      });
    }
  const hover = new T.Raycaster();
  // Wide screen-space lines work consistently where WebGL ignores linewidth.
  const selectionMaterials = [
    new LineMaterial({
      color: "#382609",
      linewidth: 3,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
    new LineMaterial({
      color: "#ffd166",
      linewidth: 1.5,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  ];
  let selectedId: string | null = null;
  const selectionParts: {
    flat: T.Group;
    raised: T.Group;
    height: number;
    geometries: LineSegmentsGeometry[];
  }[] = [];
  function clearOutline() {
    for (const part of selectionParts) {
      scene.remove(part.flat, part.raised);
      for (const geometry of part.geometries) geometry.dispose();
    }
    selectionParts.length = 0;
  }
  function outlineGeometry(source: T.EdgesGeometry) {
    const geometry = new LineSegmentsGeometry().fromEdgesGeometry(source);
    const group = new T.Group();
    selectionMaterials.forEach((material, index) => {
      const lines = new LineSegments2(geometry, material);
      lines.renderOrder = 10 + index;
      lines.frustumCulled = false;
      group.add(lines);
    });
    scene.add(group);
    return { group, geometry };
  }
  function updateOutlineHeights() {
    for (const part of selectionParts) {
      const height = part.height * heightFraction;
      part.raised.visible = height > 0;
      part.raised.scale.z = height;
      part.flat.visible = height === 0;
    }
  }
  function selectOutline(id: string | null) {
    if (id === selectedId) return;
    clearOutline();
    selectedId = id;
    for (const item of items.filter((i) => i.tract.id === id)) {
      const flatEdges = new T.EdgesGeometry(item.footprint.geometry);
      const flat = outlineGeometry(flatEdges);
      flatEdges.dispose();
      const raised = outlineGeometry(item.edges.geometry as T.EdgesGeometry);
      selectionParts.push({
        flat: flat.group,
        raised: raised.group,
        height: item.height,
        geometries: [flat.geometry, raised.geometry],
      });
    }
    updateOutlineHeights();
  }
  const pointer = new T.Vector2();
  let hovered: string | null = null;
  function setHeights(value: number) {
    heightFraction = value;
    for (const i of items) {
      // A collapsed extrusion retains a pickable top face at exactly z=0.
      i.mesh.scale.z = i.height * value;
      i.mesh.visible = i.mesh.scale.z > 0;
      i.footprint.visible = !i.mesh.visible;
      i.edges.scale.z = i.mesh.scale.z;
    }
    updateOutlineHeights();
  }
  function draw(now: number) {
    raf = 0;
    if (destroyed) return;
    if (transition) {
      const t = Math.min(1, (now - transition.start) / 650),
        ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.from, transition.to, ease);
      setHeights(T.MathUtils.lerp(transition.height, transition.target, ease));
      camera.lookAt(0, 0, 0);
      if (t === 1) {
        transition = null;
        controls.update();
      } else request();
    }
    const renderStart = performance.now();
    renderer.render(scene, camera);
    frames++;
    if (interacting) renderCpuTimes.push(performance.now() - renderStart);
    if (!firstMapMs) {
      firstMapMs = performance.now();
      mapInitializationMs = firstMapMs - start;
    }
  }
  function request() {
    if (!destroyed && !raf) raf = requestAnimationFrame(draw);
  }
  function position(view: State["view"]) {
    const distance = Math.max(150, 150 / Math.max(0.45, camera.aspect));
    return view === "flat"
      ? new T.Vector3(0, -0.001 * distance, distance)
      : new T.Vector3(0, -distance * 0.75, distance * 0.8);
  }
  function reset(animate = false) {
    cameraChanged(false);
    const tilted = state.view === "tilted";
    controls.maxPolarAngle = tilted ? Math.PI / 2 - 0.15 : 0.001;
    controls.minPolarAngle = 0.001;
    controls.target.set(0, 0, 0);
    const to = position(state.view);
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      transition = {
        start: performance.now(),
        from: camera.position.clone(),
        to,
        height: heightFraction,
        target: tilted ? 1 : 0,
      };
    else {
      transition = null;
      camera.position.copy(to);
      setHeights(tilted ? 1 : 0);
      controls.update();
    }
    request();
  }
  function recolor() {
    if (!state) return;
    selectOutline(state.inspectedTractId);
    for (const i of items) {
      const inside = targeted(i.tract, state.targetingMode);
      const muted =
        (state.emphasis === "targeted" && !inside) ||
        (state.emphasis === "outside" && inside);
      i.mesh.material = material(
        colors.color(i.tract, state.layer),
        muted && i.tract.id !== state.inspectedTractId ? 0.5 : 1,
      );
      i.footprint.material = footprintMaterial(
        colors.color(i.tract, state.layer),
        muted && i.tract.id !== state.inspectedTractId ? 0.5 : 1,
      );
      i.edges.material =
        i.tract.id === state.inspectedTractId
          ? lineMaterials[1]
          : i.tract.id === hovered
            ? lineMaterials[2]
            : lineMaterials[0];
      i.edges.renderOrder = i.tract.id === state.inspectedTractId ? 2 : 1;
    }
    request();
  }
  const observer = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    renderer.setSize(width, height);
    selectionMaterials.forEach((material) =>
      material.resolution.set(width, height),
    );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (state) reset();
  });
  observer.observe(host);
  const pick = (e: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    hover.setFromCamera(pointer, camera);
    return hover.intersectObjects(
      items.map((i) => (i.mesh.visible ? i.mesh : i.footprint)),
      false,
    )[0]?.object.userData.id as string | undefined;
  };
  let down = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
      const id = pick(e);
      if (id) inspect(id);
    }
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons || transition) return;
    const id = pick(e) ?? null;
    if (id !== hovered) {
      hovered = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      recolor();
    }
  };
  const onLeave = () => {
    hovered = null;
    recolor();
  };
  const onChange = () => {
    if (interacting) explore();
    if (state && !transition)
      cameraChanged(camera.position.distanceTo(position(state.view)) > 0.01);
    request();
  };
  const sample = (time: number) => {
    if (!interacting || destroyed) return;
    if (lastFrame) frameTimes.push(time - lastFrame);
    lastFrame = time;
    sampleRaf = requestAnimationFrame(sample);
  };
  const onStart = () => {
    transition = null;
    interacting = true;
    lastFrame = 0;
    sampleRaf = requestAnimationFrame(sample);
  };
  const onEnd = () => {
    interacting = false;
    cancelAnimationFrame(sampleRaf);
  };
  const lost = (e: Event) => {
    e.preventDefault();
    dispose();
    fallback(
      "The 3D map lost its graphics context. All data remains available in the tract table. Reload to retry WebGL.",
    );
  };
  controls.addEventListener("change", onChange);
  controls.addEventListener("start", onStart);
  controls.addEventListener("end", onEnd);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  function dispose() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(sampleRaf);
    observer.disconnect();
    controls.removeEventListener("change", onChange);
    controls.removeEventListener("start", onStart);
    controls.removeEventListener("end", onEnd);
    controls.dispose();
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    for (const i of items) {
      i.mesh.geometry.dispose();
      i.footprint.geometry.dispose();
      i.edges.geometry.dispose();
    }
    for (const m of materialCache.values()) m.dispose();
    for (const m of footprintMaterials.values()) m.dispose();
    for (const m of lineMaterials) m.dispose();
    clearOutline();
    for (const m of selectionMaterials) m.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  return {
    update(next: State) {
      const changed = !state || state.view !== next.view;
      const first = !state;
      state = next;
      recolor();
      if (changed) reset(!first);
    },
    reset: () => reset(),
    dispose,
    diagnostics: () => ({
      tracts: data.tracts.length,
      parts: items.length,
      selection: {
        id: selectedId,
        parts: selectionParts.length,
        outlineWidth: 1.5,
      },
      vertices: items.reduce(
        (n, i) =>
          n +
          i.mesh.geometry.attributes.position.count +
          i.footprint.geometry.attributes.position.count,
        0,
      ),
      edgeVertices: items.reduce(
        (n, i) => n + i.edges.geometry.attributes.position.count,
        0,
      ),
      triangles: items.reduce(
        (n, i) =>
          n +
          (i.mesh.geometry.index?.count ??
            i.mesh.geometry.attributes.position.count) /
            3 +
          (i.footprint.geometry.index?.count ??
            i.footprint.geometry.attributes.position.count) /
            3,
        0,
      ),
      frames,
      firstMapMs,
      mapInitializationMs,
      pixelRatio: renderer.getPixelRatio(),
      viewport: [host.clientWidth, host.clientHeight],
      frameTimeP95: frameTimes.length
        ? [...frameTimes].sort((a, b) => a - b)[
            Math.floor(frameTimes.length * 0.95)
          ]
        : null,
      renderCpuTimeP95: renderCpuTimes.length
        ? [...renderCpuTimes].sort((a, b) => a - b)[
            Math.floor(renderCpuTimes.length * 0.95)
          ]
        : null,
      interactionSamples: frameTimes.length,
      disposed: destroyed,
      contextLost: renderer.getContext().isContextLost(),
      memory: { ...renderer.info.memory },
    }),
  };
}
