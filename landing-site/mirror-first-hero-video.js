(() => {
  const root = document.querySelector("[data-flutie-hero]");
  const configElement = root?.querySelector("[data-flutie-config]");
  if (!root || !configElement) return;

  let config;
  try {
    config = JSON.parse(configElement.textContent || "{}");
  } catch {
    return;
  }

  const mirroredNames = new Set(
    (config.manifest?.slides || [])
      .filter((slide) => slide.mirror === true || slide.mirror === "horizontal")
      .flatMap((slide) => [slide.sources?.desktopVideo, slide.sources?.mobileVideo])
      .filter(Boolean)
      .map((source) => source.split("/").pop()),
  );
  const mirroredPosterNames = new Set(
    (config.manifest?.slides || [])
      .filter((slide) => slide.mirror === true || slide.mirror === "horizontal")
      .flatMap((slide) => [slide.poster?.desktop, slide.poster?.mobile])
      .filter(Boolean)
      .map((source) => source.split("/").pop()),
  );
  if (!mirroredNames.size && !mirroredPosterNames.size) return;

  const states = new WeakMap();
  const textureMirrors = new WeakMap();
  const mirrorLocations = new WeakMap();
  const stateFor = (gl) => {
    let state = states.get(gl);
    if (!state) {
      state = { activeUnit: 0, boundTextures: new Map() };
      states.set(gl, state);
    }
    return state;
  };
  const isMirroredAsset = (source) => {
    const isVideo = typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement;
    const isImage = typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement;
    if (!isVideo && !isImage) return false;
    const url = source.currentSrc || source.src || "";
    return [...mirroredNames, ...mirroredPosterNames].some((name) => url.endsWith(name) || url.includes(name));
  };
  const patchFragmentShader = (source) => {
    if (
      !source.includes("uniform sampler2D u_image;") ||
      !source.includes("uniform sampler2D u_nextImage;") ||
      source.includes("u_mirrorImage")
    ) {
      return source;
    }
    return source
      .replace(
        "    uniform sampler2D u_nextImage;\n",
        "    uniform sampler2D u_nextImage;\n    uniform float u_mirrorImage;\n    uniform float u_mirrorNextImage;\n",
      )
      .replace(
        "    vec3 mod289(vec3 x)",
        "    vec2 applyMirror(vec2 uv, float mirror) {\n        uv.x = mix(uv.x, 1.0 - uv.x, mirror);\n        return uv;\n    }\n\n    vec3 mod289(vec3 x)",
      )
      .replace(
        /float zoom\) \{\n        vec2 corrected/g,
        "float zoom, float mirror) {\n        vec2 corrected",
      )
      .replace(
        /        vec2 kbUv = applyKenBurns\(corrected, center, zoom\);\n        kbUv = clamp/g,
        "        vec2 kbUv = applyKenBurns(corrected, center, zoom);\n        kbUv = applyMirror(kbUv, mirror);\n        kbUv = clamp",
      )
      .replaceAll(
        "sampleFluted(u_image, uv, u_resolution, u_imageResolution, u_zoomCenter, u_zoomFactor)",
        "sampleFluted(u_image, uv, u_resolution, u_imageResolution, u_zoomCenter, u_zoomFactor, u_mirrorImage)",
      )
      .replaceAll(
        "sampleClear(u_image, uv, u_resolution, u_imageResolution, u_zoomCenter, u_zoomFactor)",
        "sampleClear(u_image, uv, u_resolution, u_imageResolution, u_zoomCenter, u_zoomFactor, u_mirrorImage)",
      )
      .replaceAll(
        "sampleClear(u_nextImage, uv, u_resolution, u_nextImageResolution, u_nextZoomCenter, u_nextZoomFactor)",
        "sampleClear(u_nextImage, uv, u_resolution, u_nextImageResolution, u_nextZoomCenter, u_nextZoomFactor, u_mirrorNextImage)",
      )
      .replaceAll(
        "sampleFluted(u_nextImage, uv, u_resolution, u_nextImageResolution, u_nextZoomCenter, u_nextZoomFactor)",
        "sampleFluted(u_nextImage, uv, u_resolution, u_nextImageResolution, u_nextZoomCenter, u_nextZoomFactor, u_mirrorNextImage)",
      );
  };

  const prototype = WebGLRenderingContext.prototype;
  const activeTexture = prototype.activeTexture;
  const bindTexture = prototype.bindTexture;
  const shaderSource = prototype.shaderSource;
  const texImage2D = prototype.texImage2D;
  const drawArrays = prototype.drawArrays;
  const getParameter = prototype.getParameter;
  const getUniformLocation = prototype.getUniformLocation;
  const uniform1f = prototype.uniform1f;

  prototype.activeTexture = function (texture) {
    const state = stateFor(this);
    state.activeUnit = texture - this.TEXTURE0;
    return activeTexture.call(this, texture);
  };
  prototype.bindTexture = function (target, texture) {
    const result = bindTexture.call(this, target, texture);
    if (target === this.TEXTURE_2D) stateFor(this).boundTextures.set(stateFor(this).activeUnit, texture);
    return result;
  };
  prototype.shaderSource = function (shader, source) {
    return shaderSource.call(this, shader, patchFragmentShader(source));
  };
  prototype.texImage2D = function (...args) {
    const state = stateFor(this);
    const source = args.length === 6 ? args[5] : args[8];
    const texture = state.boundTextures.get(state.activeUnit);
    if (texture && source) textureMirrors.set(texture, isMirroredAsset(source));
    return texImage2D.apply(this, args);
  };
  prototype.drawArrays = function (...args) {
    const state = stateFor(this);
    const program = getParameter.call(this, this.CURRENT_PROGRAM);
    if (program) {
      let locations = mirrorLocations.get(program);
      if (!locations) {
        locations = {
          image: getUniformLocation.call(this, program, "u_mirrorImage"),
          nextImage: getUniformLocation.call(this, program, "u_mirrorNextImage"),
        };
        mirrorLocations.set(program, locations);
      }
      if (locations.image) {
        uniform1f.call(this, locations.image, textureMirrors.get(state.boundTextures.get(0)) === true ? 1 : 0);
      }
      if (locations.nextImage) {
        uniform1f.call(this, locations.nextImage, textureMirrors.get(state.boundTextures.get(1)) === true ? 1 : 0);
      }
    }
    return drawArrays.apply(this, args);
  };
})();
