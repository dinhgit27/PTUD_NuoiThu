import React, { useEffect, useRef } from 'react';

interface PixelArtBackgroundProps {
  imageUrl: string;
  animationFrames?: number;
  animationFps?: number;
  animationColumns?: number;
  animationRows?: number;
}

interface BackgroundGridInfo {
  animationFrames?: number;
  animationColumns?: number;
  animationRows?: number;
}

/**
 * CSS that displays only the first frame of a (columns x rows) sprite sheet.
 * Used for thumbnails and as a fallback when WebGL is unavailable.
 */
export function getBackgroundFrameStyle(bg: BackgroundGridInfo): React.CSSProperties {
  const columns = Math.max(1, bg.animationColumns || bg.animationFrames || 1);
  const rows = Math.max(1, bg.animationRows || 1);
  if (columns * rows === 1) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated'
    };
  }
  return {
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated'
  };
}

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// The pixel-grid sampling follows the post-process approach in
// selimanac/defold-pixelart-shader (MIT); 2D luminance edges stand in for its
// normal/depth buffers, which are only available when rendering 3D geometry.
const fragmentShaderSource = `
  precision mediump float;

  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform vec2 u_image_size;
  uniform float u_pixel_size;
  uniform float u_edge_strength;
  uniform float u_frame_columns;
  uniform float u_frame_rows;
  uniform float u_frame_index;
  varying vec2 v_uv;

  float luminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    float image_aspect = u_image_size.x / u_image_size.y;
    float view_aspect = u_resolution.x / u_resolution.y;
    vec2 uv = v_uv;

    // "cover": fill the whole stage and crop the overflowing axis, centered.
    if (image_aspect > view_aspect) {
      uv.x = (uv.x - 0.5) * (view_aspect / image_aspect) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (image_aspect / view_aspect) + 0.5;
    }

    vec2 pixel_grid = u_resolution / u_pixel_size;
    vec2 pixel_uv = (floor(pixel_grid * uv) + 0.5) / pixel_grid;
    vec2 pixel_step = 1.0 / pixel_grid;
    float frame_column = mod(u_frame_index, u_frame_columns);
    float frame_row = floor(u_frame_index / u_frame_columns);
    vec2 frame_uv = vec2(
      (frame_column + pixel_uv.x) / u_frame_columns,
      (u_frame_rows - frame_row - 1.0 + pixel_uv.y) / u_frame_rows
    );
    vec4 color = texture2D(u_image, frame_uv);
    float center_luminance = luminance(color.rgb);
    float edge = 0.0;

    vec2 right_uv = vec2((frame_column + clamp(pixel_uv.x + pixel_step.x, 0.0, 1.0)) / u_frame_columns, frame_uv.y);
    vec2 left_uv = vec2((frame_column + clamp(pixel_uv.x - pixel_step.x, 0.0, 1.0)) / u_frame_columns, frame_uv.y);
    vec2 up_uv = vec2(frame_uv.x, (u_frame_rows - frame_row - 1.0 + clamp(pixel_uv.y + pixel_step.y, 0.0, 1.0)) / u_frame_rows);
    vec2 down_uv = vec2(frame_uv.x, (u_frame_rows - frame_row - 1.0 + clamp(pixel_uv.y - pixel_step.y, 0.0, 1.0)) / u_frame_rows);
    edge = max(edge, abs(luminance(texture2D(u_image, right_uv).rgb) - center_luminance));
    edge = max(edge, abs(luminance(texture2D(u_image, left_uv).rgb) - center_luminance));
    edge = max(edge, abs(luminance(texture2D(u_image, up_uv).rgb) - center_luminance));
    edge = max(edge, abs(luminance(texture2D(u_image, down_uv).rgb) - center_luminance));

    float outline = smoothstep(0.08, 0.24, edge);
    gl_FragColor = vec4(color.rgb * (1.0 - outline * u_edge_strength), color.a);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Pixel-art background shader compilation failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export const PixelArtBackground: React.FC<PixelArtBackgroundProps> = ({
  imageUrl,
  animationFrames = 1,
  animationFps = 0,
  animationColumns = animationFrames,
  animationRows = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) {
      console.warn('WebGL is unavailable; showing the unprocessed garden background.');
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      console.warn('Could not create the pixel-art background shader program.');
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Pixel-art background shader linking failed:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const imageSizeLocation = gl.getUniformLocation(program, 'u_image_size');
    const pixelSizeLocation = gl.getUniformLocation(program, 'u_pixel_size');
    const edgeStrengthLocation = gl.getUniformLocation(program, 'u_edge_strength');
    const frameColumnsLocation = gl.getUniformLocation(program, 'u_frame_columns');
    const frameRowsLocation = gl.getUniformLocation(program, 'u_frame_rows');
    const frameIndexLocation = gl.getUniformLocation(program, 'u_frame_index');
    const imageLocation = gl.getUniformLocation(program, 'u_image');

    if (!buffer || !texture || positionLocation < 0 || !resolutionLocation ||
      !imageSizeLocation || !pixelSizeLocation || !edgeStrengthLocation ||
      !frameColumnsLocation || !frameRowsLocation || !frameIndexLocation || !imageLocation) {
      if (buffer) gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
      gl.deleteProgram(program);
      console.warn('Could not initialize pixel-art background shader resources.');
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(imageLocation, 0);

    let textureReady = false;
    let animationRequest = 0;
    let animationStart = 0;
    const columns = Math.max(1, Math.floor(animationColumns));
    const rows = Math.max(1, Math.floor(animationRows));
    const frameCount = Math.max(1, Math.min(12, Math.floor(animationFrames || columns * rows)));
    const fps = Math.max(0, Math.min(12, Math.floor(animationFps)));
    const shouldAnimate = frameCount > 1 && fps > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (timestamp = performance.now()) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!textureReady) return;

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(imageSizeLocation, image.naturalWidth / columns, image.naturalHeight / rows);
      gl.uniform1f(pixelSizeLocation, 1.5 * pixelRatio);
      gl.uniform1f(edgeStrengthLocation, 0.08);
      gl.uniform1f(frameColumnsLocation, columns);
      gl.uniform1f(frameRowsLocation, rows);
      const frameIndex = shouldAnimate
        ? Math.floor((timestamp - animationStart) / (1000 / fps)) % frameCount
        : 0;
      gl.uniform1f(frameIndexLocation, frameIndex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const animate = (timestamp: number) => {
      draw(timestamp);
      if (shouldAnimate) animationRequest = window.requestAnimationFrame(animate);
    };

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        textureReady = true;
        animationStart = performance.now();
        draw();
        if (shouldAnimate) animationRequest = window.requestAnimationFrame(animate);
      } catch (error) {
        console.warn('Could not upload the garden background to WebGL:', error);
      }
    };
    image.onerror = () => {
      console.warn('Could not load the garden background image:', imageUrl);
    };
    image.src = imageUrl;

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => draw())
      : null;
    resizeObserver?.observe(canvas);
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    draw();

    return () => {
      image.onload = null;
      image.onerror = null;
      window.cancelAnimationFrame(animationRequest);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [imageUrl, animationFrames, animationFps, animationColumns, animationRows]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
};
