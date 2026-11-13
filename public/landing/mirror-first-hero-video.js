(() => {
  const root = document.querySelector("[data-flutie-hero]");
  const canvas = root?.querySelector(".flute-canvas");
  const configElement = root?.querySelector("[data-flutie-config]");
  if (!canvas || !configElement) return;

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

  const prototype = WebGLRenderingContext.prototype;
  const activeTexture = prototype.activeTexture;
  const bindTexture = prototype.bindTexture;
  const texImage2D = prototype.texImage2D;
  const drawArrays = prototype.drawArrays;

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
  prototype.texImage2D = function (...args) {
    const state = stateFor(this);
    const source = args.length === 6 ? args[5] : args[8];
    const texture = state.boundTextures.get(state.activeUnit);
    if (texture && source) textureMirrors.set(texture, isMirroredAsset(source));
    return texImage2D.apply(this, args);
  };
  prototype.drawArrays = function (...args) {
    const state = stateFor(this);
    canvas.classList.toggle("is-mirrored-slide", textureMirrors.get(state.boundTextures.get(0)) === true);
    return drawArrays.apply(this, args);
  };
})();
