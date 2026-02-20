import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function ThreeDViewer({ className = '', style = {}, objects = 6 }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const groupRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const animIdRef = useRef(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hoveredRef = useRef(null);
  const selectedRef = useRef(null);
  const meshesRef = useRef([]);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0b1220');
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(2.8, 2, 3.5);
      camera.lookAt(0, 0, 0);
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(3, 6, 3);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024, 1024);
      scene.add(dir);
      const planeGeo = new THREE.PlaneGeometry(20, 20);
      const planeMat = new THREE.ShadowMaterial({ opacity: 0.25 });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.01;
      plane.receiveShadow = true;
      scene.add(plane);
      const group = new THREE.Group();
      scene.add(group);
      groupRef.current = group;
      const baseColors = [0x4ade80, 0x60a5fa, 0xf472b6, 0xf59e0b, 0x34d399, 0xa78bfa];
      const count = Math.max(1, Math.min(24, objects || 6));
      const spacing = 0.9;
      const perRow = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const mat = new THREE.MeshStandardMaterial({ color: baseColors[i % baseColors.length] });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.position.x = (i % perRow) * spacing - ((perRow - 1) * spacing) / 2;
        mesh.position.z = Math.floor(i / perRow) * spacing - ((Math.ceil(count / perRow) - 1) * spacing) / 2;
        mesh.userData.baseY = 0.3;
        mesh.position.y = mesh.userData.baseY;
        mesh.userData.targetY = mesh.position.y;
        mesh.userData.baseScale = 1;
        mesh.userData.targetScale = 1;
        mesh.userData.baseColor = mat.color.getHex();
        group.add(mesh);
        meshesRef.current.push(mesh);
      }
      const onResize = () => {
        if (!container) return;
        const w = container.clientWidth || 300;
        const h = container.clientHeight || 300;
        renderer.setSize(w, h, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      onResize();
      const toNDC = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        pointerRef.current.set(x * 2 - 1, -(y * 2 - 1));
      };
      const hoverLift = (mesh, lift) => {
        mesh.userData.targetY = mesh.userData.baseY + (lift ? 0.18 : 0);
        mesh.userData.targetScale = mesh.userData.baseScale * (lift ? 1.06 : 1);
      };
      const setColor = (mesh, hex) => {
        const m = mesh.material;
        if (m && m.color) m.color.setHex(hex);
      };
      const handleMove = (e) => {
        if (!rendererRef.current) return;
        toNDC(e);
        if (draggingRef.current) {
          const dx = e.clientX - lastPosRef.current.x;
          const dy = e.clientY - lastPosRef.current.y;
          lastPosRef.current.x = e.clientX;
          lastPosRef.current.y = e.clientY;
          group.rotation.y += dx * 0.01;
          group.rotation.x += dy * 0.01;
          return;
        }
        const raycaster = raycasterRef.current;
        raycaster.setFromCamera(pointerRef.current, camera);
        const hits = raycaster.intersectObjects(meshesRef.current, false);
        const mesh = hits.length ? hits[0].object : null;
        if (mesh !== hoveredRef.current) {
          if (hoveredRef.current && hoveredRef.current !== selectedRef.current) {
            hoverLift(hoveredRef.current, false);
            setColor(hoveredRef.current, hoveredRef.current.userData.baseColor);
          }
          hoveredRef.current = mesh;
          if (mesh && mesh !== selectedRef.current) {
            hoverLift(mesh, true);
            const c = new THREE.Color(mesh.userData.baseColor).multiplyScalar(1.25).getHex();
            setColor(mesh, c);
          }
        }
      };
      const handleDown = (e) => {
        draggingRef.current = true;
        lastPosRef.current.x = e.clientX;
        lastPosRef.current.y = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const handleUp = (e) => {
        draggingRef.current = false;
        renderer.domElement.releasePointerCapture(e.pointerId);
      };
      const handleClick = (e) => {
        toNDC(e);
        const raycaster = raycasterRef.current;
        raycaster.setFromCamera(pointerRef.current, camera);
        const hits = raycaster.intersectObjects(meshesRef.current, false);
        const mesh = hits.length ? hits[0].object : null;
        if (selectedRef.current && selectedRef.current !== mesh) {
          setColor(selectedRef.current, selectedRef.current.userData.baseColor);
          hoverLift(selectedRef.current, false);
        }
        selectedRef.current = mesh;
        if (mesh) {
          hoverLift(mesh, true);
          const c = new THREE.Color(mesh.userData.baseColor).multiplyScalar(1.5).getHex();
          setColor(mesh, c);
        }
      };
      const el = renderer.domElement;
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.touchAction = 'none';
      el.addEventListener('pointermove', handleMove);
      el.addEventListener('pointerdown', handleDown);
      el.addEventListener('pointerup', handleUp);
      el.addEventListener('click', handleClick);
      window.addEventListener('resize', onResize);
      const clock = new THREE.Clock();
      const animate = () => {
        const dt = Math.min(0.033, clock.getDelta());
        meshesRef.current.forEach((m) => {
          m.position.y += (m.userData.targetY - m.position.y) * Math.min(1, dt * 8);
          const s = m.scale.x + (m.userData.targetScale - m.scale.x) * Math.min(1, dt * 8);
          m.scale.setScalar(s);
        });
        renderer.render(scene, camera);
        animIdRef.current = requestAnimationFrame(animate);
      };
      animIdRef.current = requestAnimationFrame(animate);
      return () => {
        cancelAnimationFrame(animIdRef.current);
        window.removeEventListener('resize', onResize);
        el.removeEventListener('pointermove', handleMove);
        el.removeEventListener('pointerdown', handleDown);
        el.removeEventListener('pointerup', handleUp);
        el.removeEventListener('click', handleClick);
        meshesRef.current = [];
        if (renderer) {
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    } catch (e) {
      setError('3D not available');
      return;
    }
  }, [objects]);

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600 bg-red-50">{error}</div>
      ) : null}
    </div>
  );
}
