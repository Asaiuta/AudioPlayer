import { createEffect } from "solid-js";

interface SpectrumCanvasProps {
  data: number[];
  active: boolean;
}

export function SpectrumCanvas(props: SpectrumCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  createEffect(() => {
    const canvas = canvasRef;
    const data = props.data;
    const active = props.active;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, rect.width, rect.height);

    const count = data.length || 64;
    const barWidth = rect.width / count;
    const maxHeight = rect.height;
    const fill = active ? "rgba(210, 176, 110, 0.9)" : "rgba(120, 120, 120, 0.4)";

    context.fillStyle = fill;
    for (let i = 0; i < count; i += 1) {
      const value = data[i] ?? 0;
      const height = Math.max(2, Math.min(maxHeight, value * maxHeight));
      const x = i * barWidth;
      context.fillRect(x, maxHeight - height, Math.max(2, barWidth - 2), height);
    }
  });

  return <canvas ref={canvasRef} class="spectrum-canvas" />;
}
