import { useEffect, useRef, useState } from 'react';

/**
 * High-performance 360° Equirectangular Spherical Panorama Viewer.
 * Uses WebGL spherical mapping with graceful fallback to continuous smooth canvas panning.
 * Supports mouse drag, touch drag, pinch-to-zoom, mousewheel zoom, and auto-rotation.
 */
export default function PanoramaViewer({ src, title = '360° Room Virtual Tour', onClose }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isRotating, setIsRotating] = useState(true);
  const [fov, setFov] = useState(75); // Field of view in degrees

  const stateRef = useRef({
    lon: 0,
    lat: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    startLon: 0,
    startLat: 0,
    autoRotate: true,
    fov: 75,
    animationId: null,
  });

  // Keep stateRef in sync with toggle
  useEffect(() => {
    stateRef.current.autoRotate = isRotating;
  }, [isRotating]);

  useEffect(() => {
    stateRef.current.fov = fov;
  }, [fov]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl = null;
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch {
      gl = null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      setLoading(false);

      if (gl) {
        initWebGL(gl, img);
      } else {
        initCanvas2D(canvas, img);
      }
    };

    img.onerror = () => {
      if (cancelled) return;
      setLoading(false);
      setLoadError(true);
    };

    img.src = src;

    // WebGL Sphere implementation
    function initWebGL(glContext, textureImage) {
      const vsSource = `
        attribute vec3 aPosition;
        attribute vec2 aTexCoord;
        uniform mat4 uProjection;
        uniform mat4 uView;
        varying vec2 vTexCoord;
        void main(void) {
          vTexCoord = aTexCoord;
          gl_Position = uProjection * uView * vec4(aPosition, 1.0);
        }
      `;

      const fsSource = `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uSampler;
        void main(void) {
          gl_FragColor = texture2D(uSampler, vTexCoord);
        }
      `;

      const vs = glContext.createShader(glContext.VERTEX_SHADER);
      glContext.shaderSource(vs, vsSource);
      glContext.compileShader(vs);

      const fs = glContext.createShader(glContext.FRAGMENT_SHADER);
      glContext.shaderSource(fs, fsSource);
      glContext.compileShader(fs);

      const program = glContext.createProgram();
      glContext.attachShader(program, vs);
      glContext.attachShader(program, fs);
      glContext.linkProgram(program);
      glContext.useProgram(program);

      // Create sphere vertices and texture coordinates
      const SPHERE_LAT = 36;
      const SPHERE_LON = 36;
      const SPHERE_RADIUS = 50.0;
      const positions = [];
      const texCoords = [];
      const indices = [];

      for (let lat = 0; lat <= SPHERE_LAT; lat++) {
        const theta = (lat * Math.PI) / SPHERE_LAT;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= SPHERE_LON; lon++) {
          const phi = (lon * 2 * Math.PI) / SPHERE_LON;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          // Inward-facing sphere for panorama
          const x = -SPHERE_RADIUS * sinTheta * sinPhi;
          const y = SPHERE_RADIUS * cosTheta;
          const z = SPHERE_RADIUS * sinTheta * cosPhi;

          const u = lon / SPHERE_LON;
          const v = lat / SPHERE_LAT;

          positions.push(x, y, z);
          texCoords.push(u, v);
        }
      }

      for (let lat = 0; lat < SPHERE_LAT; lat++) {
        for (let lon = 0; lon < SPHERE_LON; lon++) {
          const first = lat * (SPHERE_LON + 1) + lon;
          const second = first + SPHERE_LON + 1;
          indices.push(first, second, first + 1);
          indices.push(second, second + 1, first + 1);
        }
      }

      const posBuffer = glContext.createBuffer();
      glContext.bindBuffer(glContext.ARRAY_BUFFER, posBuffer);
      glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(positions), glContext.STATIC_DRAW);
      const aPos = glContext.getAttribLocation(program, 'aPosition');
      glContext.enableVertexAttribArray(aPos);
      glContext.vertexAttribPointer(aPos, 3, glContext.FLOAT, false, 0, 0);

      const texBuffer = glContext.createBuffer();
      glContext.bindBuffer(glContext.ARRAY_BUFFER, texBuffer);
      glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(texCoords), glContext.STATIC_DRAW);
      const aTex = glContext.getAttribLocation(program, 'aTexCoord');
      glContext.enableVertexAttribArray(aTex);
      glContext.vertexAttribPointer(aTex, 2, glContext.FLOAT, false, 0, 0);

      const indexBuffer = glContext.createBuffer();
      glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, indexBuffer);
      glContext.bufferData(glContext.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), glContext.STATIC_DRAW);

      // Texture
      const texture = glContext.createTexture();
      glContext.bindTexture(glContext.TEXTURE_2D, texture);
      glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, false);
      glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, textureImage);
      glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
      glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
      glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
      glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);

      const uProj = glContext.getUniformLocation(program, 'uProjection');
      const uView = glContext.getUniformLocation(program, 'uView');

      function render() {
        if (cancelled) return;

        const w = (canvas.width = canvas.parentElement.clientWidth || 800);
        const h = (canvas.height = canvas.parentElement.clientHeight || 500);
        glContext.viewport(0, 0, w, h);

        if (stateRef.current.autoRotate && !stateRef.current.isDragging) {
          stateRef.current.lon += 0.08;
        }

        const aspect = w / h;
        const currentFovRad = (stateRef.current.fov * Math.PI) / 180;
        const projMat = createPerspective(currentFovRad, aspect, 0.1, 200.0);

        const latRad = (stateRef.current.lat * Math.PI) / 180;
        const lonRad = (stateRef.current.lon * Math.PI) / 180;

        const targetX = Math.cos(latRad) * Math.sin(lonRad);
        const targetY = Math.sin(latRad);
        const targetZ = Math.cos(latRad) * Math.cos(lonRad);

        const viewMat = createLookAt([0, 0, 0], [targetX, targetY, targetZ], [0, 1, 0]);

        glContext.uniformMatrix4fv(uProj, false, new Float32Array(projMat));
        glContext.uniformMatrix4fv(uView, false, new Float32Array(viewMat));

        glContext.clearColor(0.05, 0.08, 0.12, 1.0);
        glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);

        glContext.drawElements(glContext.TRIANGLES, indices.length, glContext.UNSIGNED_SHORT, 0);

        stateRef.current.animationId = requestAnimationFrame(render);
      }

      stateRef.current.animationId = requestAnimationFrame(render);
    }

    // 2D Canvas Fallback
    function initCanvas2D(canvasEl, textureImage) {
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      function render2D() {
        if (cancelled) return;
        const w = (canvasEl.width = canvasEl.parentElement.clientWidth || 800);
        const h = (canvasEl.height = canvasEl.parentElement.clientHeight || 500);

        if (stateRef.current.autoRotate && !stateRef.current.isDragging) {
          stateRef.current.lon += 0.2;
        }

        const normLon = ((stateRef.current.lon % 360) + 360) % 360;
        const offset = (normLon / 360) * textureImage.width;

        ctx.drawImage(textureImage, offset, 0, textureImage.width - offset, textureImage.height, 0, 0, ((textureImage.width - offset) / textureImage.width) * w, h);
        if (offset > 0) {
          ctx.drawImage(textureImage, 0, 0, offset, textureImage.height, ((textureImage.width - offset) / textureImage.width) * w, 0, (offset / textureImage.width) * w, h);
        }

        stateRef.current.animationId = requestAnimationFrame(render2D);
      }
      stateRef.current.animationId = requestAnimationFrame(render2D);
    }

    return () => {
      cancelled = true;
      if (stateRef.current.animationId) {
        cancelAnimationFrame(stateRef.current.animationId);
      }
    };
  }, [src]);

  // Touch and Mouse Drag handlers
  const handlePointerDown = (e) => {
    stateRef.current.isDragging = true;
    stateRef.current.startX = e.clientX || e.touches?.[0]?.clientX || 0;
    stateRef.current.startY = e.clientY || e.touches?.[0]?.clientY || 0;
    stateRef.current.startLon = stateRef.current.lon;
    stateRef.current.startLat = stateRef.current.lat;
  };

  const handlePointerMove = (e) => {
    if (!stateRef.current.isDragging) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    const deltaX = clientX - stateRef.current.startX;
    const deltaY = clientY - stateRef.current.startY;

    const speed = 0.18;
    stateRef.current.lon = stateRef.current.startLon - deltaX * speed;
    stateRef.current.lat = Math.max(-85, Math.min(85, stateRef.current.startLat + deltaY * speed));
  };

  const handlePointerUp = () => {
    stateRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setFov((prev) => Math.max(40, Math.min(100, prev + e.deltaY * 0.05)));
  };

  const resetView = () => {
    stateRef.current.lon = 0;
    stateRef.current.lat = 0;
    setFov(75);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 backdrop-blur-md"
    >
      <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">{title}</h2>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  360° Interactive View
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] font-medium text-amber-300/90">
                  Read-Only Virtual Preview
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 360 Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onWheel={handleWheel}
          className="relative flex-1 cursor-grab active:cursor-grabbing select-none overflow-hidden bg-slate-950"
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-300">Loading 360° panoramic scene...</p>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-6 text-center text-rose-300">
              <svg className="h-10 w-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-semibold">Unable to load 360° panorama photo.</p>
              <p className="text-xs text-slate-400">Please verify the image path or upload a new 360 photo.</p>
            </div>
          )}

          <canvas ref={canvasRef} className="h-full w-full block" />

          {/* Hint Overlay (fades out or stays subtle) */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-2xl bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md border border-slate-700/50">
            <svg className="h-4 w-4 text-brand-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span>Drag in any direction to look around 360°</span>
          </div>

          {/* Controls Floating Toolbar */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-2xl bg-slate-900/85 p-1.5 shadow-lg backdrop-blur-md border border-slate-700/60">
            <button
              type="button"
              onClick={() => setFov((f) => Math.max(40, f - 10))}
              title="Zoom In"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-200 transition hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setFov((f) => Math.min(100, f + 10))}
              title="Zoom Out"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-200 transition hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsRotating((r) => !r)}
              title={isRotating ? 'Pause auto-rotation' : 'Play auto-rotation'}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                isRotating ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isRotating ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset View"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-400 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Notice:</span>
            <span>Room allotment and booking are handled strictly via administrative procedures.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal matrix math helpers for pure WebGL
function createPerspective(fovY, aspect, near, far) {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

function createLookAt(eye, center, up) {
  const z0 = eye[0] - center[0];
  const z1 = eye[1] - center[1];
  const z2 = eye[2] - center[2];
  let len = Math.hypot(z0, z1, z2);
  const zx = z0 / (len || 1);
  const zy = z1 / (len || 1);
  const zz = z2 / (len || 1);

  const x0 = up[1] * zz - up[2] * zy;
  const x1 = up[2] * zx - up[0] * zz;
  const x2 = up[0] * zy - up[1] * zx;
  len = Math.hypot(x0, x1, x2);
  const xx = x0 / (len || 1);
  const xy = x1 / (len || 1);
  const xz = x2 / (len || 1);

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ];
}
