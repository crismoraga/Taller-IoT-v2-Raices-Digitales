import { memo, useEffect, useId, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { Drawing, Gradient, Paint, Shape } from "./graphics/shapes";
import { icons, type IconName as BrandIconName } from "./graphics/icons";
import { extraIcons, type ExtraIconName } from "./extra-icons";
import {
  rutixDrawing,
  type RutixExpression,
  type RutixPose,
} from "./graphics/rutix";
import {
  networkMesh,
  orbitRings,
  signalRings,
  starField,
} from "./graphics/patterns";
import {
  illustrationDrawing,
  type IllustrationName,
} from "./graphics/illustrations";
import {
  medallionDrawing,
  type MedallionGlyph,
  type MedallionState,
  type MedallionTier,
} from "./graphics/medallions";

/*
 * Los gráficos de la marca (íconos, Rutix, patrones, medallas, ilustraciones) vienen del
 * repositorio SoyTEL como datos declarativos. Aquí se dibujan con SVG del DOM.
 */

function paintProps(shape: Paint) {
  return {
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.sw,
    opacity: shape.op,
    fillOpacity: shape.fop,
    strokeOpacity: shape.sop,
    strokeLinecap: shape.cap,
    strokeLinejoin: shape.join,
    strokeDasharray: shape.dash,
    transform: shape.tf,
  };
}

/** Los degradados de un dibujo usan ids fijos; el prefijo evita choques entre varios SVG. */
function scoped(value: string | undefined, prefix: string) {
  return value?.startsWith("url(#")
    ? `url(#${prefix}${value.slice(5, -1)})`
    : value;
}

function renderShape(
  shape: Shape,
  key: number | string,
  prefix: string,
): ReactElement {
  const paint = paintProps(shape);
  paint.fill = scoped(paint.fill, prefix);
  paint.stroke = scoped(paint.stroke, prefix);
  switch (shape.t) {
    case "path":
      return <path key={key} d={shape.d} {...paint} />;
    case "circle":
      return (
        <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />
      );
    case "ellipse":
      return (
        <ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          {...paint}
        />
      );
    case "rect":
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          ry={shape.rx}
          {...paint}
        />
      );
    case "line":
      return (
        <line
          key={key}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          {...paint}
        />
      );
    case "g":
      return (
        <g key={key} {...paint}>
          {shape.children.map((child, index) =>
            renderShape(child, index, prefix),
          )}
        </g>
      );
  }
}

export function ShapeLayer({
  shapes,
  prefix = "",
}: {
  shapes: Shape[];
  prefix?: string;
}) {
  return <>{shapes.map((shape, index) => renderShape(shape, index, prefix))}</>;
}

function GradientDefs({
  gradients,
  prefix,
}: {
  gradients: Gradient[];
  prefix: string;
}) {
  return (
    <defs>
      {gradients.map((gradient) => {
        const stops = gradient.stops.map((stop) => (
          <stop
            key={stop.offset}
            offset={stop.offset}
            stopColor={stop.color}
            stopOpacity={stop.opacity ?? 1}
          />
        ));
        return gradient.kind === "linear" ? (
          <linearGradient
            key={gradient.id}
            id={prefix + gradient.id}
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
          >
            {stops}
          </linearGradient>
        ) : (
          <radialGradient
            key={gradient.id}
            id={prefix + gradient.id}
            cx={gradient.cx}
            cy={gradient.cy}
            r={gradient.r}
          >
            {stops}
          </radialGradient>
        );
      })}
    </defs>
  );
}

interface SvgDrawingProps {
  drawing: Drawing;
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  slice?: boolean;
  /** Nombre accesible. Sin él, el dibujo es decorativo y se oculta a lectores de pantalla. */
  label?: string;
}

export const SvgDrawing = memo(function SvgDrawing({
  drawing,
  size,
  width,
  height,
  className,
  style,
  slice,
  label,
}: SvgDrawingProps) {
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "") + "-";
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox={`0 0 ${drawing.w} ${drawing.h}`}
      className={className}
      style={style}
      preserveAspectRatio={slice ? "xMidYMid slice" : "xMidYMid meet"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {drawing.gradients && drawing.gradients.length > 0 && (
        <GradientDefs gradients={drawing.gradients} prefix={prefix} />
      )}
      <ShapeLayer shapes={drawing.shapes} prefix={prefix} />
    </svg>
  );
});

/* ── Íconos ───────────────────────────────────────────────────── */

export type IconName = BrandIconName | ExtraIconName;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Solo cuando el ícono va solo, sin texto al lado. */
  label?: string;
}

/**
 * Familia única de íconos: grilla 24, trazo 2, extremos redondeados, color por currentColor.
 * Primero la iconografía propia de Telemática USM; `extra-icons` completa los glifos de
 * laboratorio que la marca no trae (termómetro, gota, USB…), con la misma grilla y trazo.
 */
export const Icon = memo(function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  style,
  label,
}: IconProps) {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);
  if (name in icons) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ flexShrink: 0, ...style }}
        focusable="false"
        {...a11y}
      >
        <ShapeLayer shapes={icons[name as BrandIconName] as Shape[]} />
      </svg>
    );
  }
  const Extra = extraIcons[name as ExtraIconName];
  return (
    <Extra
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, ...style }}
      focusable="false"
      {...a11y}
    />
  );
});

/* ── Rutix ────────────────────────────────────────────────────── */

interface RutixProps {
  expression?: RutixExpression;
  pose?: RutixPose;
  /** Barras de señal del pecho, 0–4: su ánimo. */
  signal?: number;
  size?: number;
  className?: string;
  /** Flota y parpadea. Se apaga solo con movimiento reducido. */
  animated?: boolean;
  shadow?: boolean;
  label?: string;
}

/**
 * Rutix, el robot-antena de Telemática USM. Sus colores son fijos (cuerpo crema, pantalla
 * azul noche): va siempre sobre azul noche o dentro de un círculo `primary`. Uno por pantalla.
 */
export function Rutix({
  expression = "happy",
  pose = "idle",
  signal = 3,
  size = 96,
  className,
  animated = true,
  shadow = true,
  label,
}: RutixProps) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!animated) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let closing: ReturnType<typeof setTimeout>;
    let opening: ReturnType<typeof setTimeout>;
    const schedule = () => {
      closing = setTimeout(
        () => {
          setBlink(true);
          opening = setTimeout(() => {
            setBlink(false);
            schedule();
          }, 140);
        },
        2600 + Math.random() * 2400,
      );
    };
    schedule();
    return () => {
      clearTimeout(closing);
      clearTimeout(opening);
    };
  }, [animated]);
  const drawing = useMemo(
    () => rutixDrawing({ expression, pose, signal, blink, shadow }),
    [expression, pose, signal, blink, shadow],
  );
  return (
    <SvgDrawing
      drawing={drawing}
      size={size}
      label={label}
      className={`${animated ? "animate-float" : ""} ${className ?? ""}`}
      style={{ flexShrink: 0 }}
    />
  );
}

/* ── Medallas, ilustraciones y patrones ───────────────────────── */

export function Medallion({
  glyph,
  tier = "crema",
  state = "unlocked",
  progress = 0,
  ribbon = false,
  size = 72,
  className,
  label,
}: {
  glyph: MedallionGlyph;
  tier?: MedallionTier;
  state?: MedallionState;
  progress?: number;
  ribbon?: boolean;
  size?: number;
  className?: string;
  label?: string;
}) {
  const drawing = useMemo(
    () => medallionDrawing({ glyph, tier, state, progress, ribbon }),
    [glyph, tier, state, progress, ribbon],
  );
  return (
    <SvgDrawing
      drawing={drawing}
      size={size}
      className={className}
      label={label}
      style={{ flexShrink: 0 }}
    />
  );
}

export function Illustration({
  name,
  tone = "light",
  size = 200,
  className,
  label,
}: {
  name: IllustrationName;
  /** `dark` sobre fondos azul noche. */
  tone?: "light" | "dark";
  size?: number;
  className?: string;
  label?: string;
}) {
  const drawing = useMemo(() => illustrationDrawing(name, tone), [name, tone]);
  return (
    <SvgDrawing
      drawing={drawing}
      width={size}
      height={(size * drawing.h) / drawing.w}
      className={className}
      label={label}
    />
  );
}

export type BackdropPattern = "estrellas" | "red" | "senal" | "orbitas";

/**
 * Fondo decorativo de las superficies azul noche. Siempre detrás del contenido y sin
 * competir con texto largo: para eso baja `opacity` o usa `senal`, que vive en una esquina.
 */
export const Backdrop = memo(function Backdrop({
  pattern = "estrellas",
  seed = 7,
  opacity = 1,
  className = "",
  density = 1,
}: {
  pattern?: BackdropPattern;
  seed?: number;
  opacity?: number;
  className?: string;
  density?: number;
}) {
  const width = 720;
  const height = 480;
  const shapes = useMemo(() => {
    switch (pattern) {
      case "red":
        return networkMesh({
          width,
          height,
          seed,
          nodes: Math.round(22 * density),
        });
      case "senal":
        return signalRings({
          cx: width * 0.86,
          cy: height * 0.2,
          rings: 6,
          gap: 34,
          start: 36,
        });
      case "orbitas":
        return orbitRings({ width, height });
      default:
        return starField({
          width,
          height,
          seed,
          stars: Math.round(22 * density),
          dots: Math.round(46 * density),
        });
    }
  }, [pattern, seed, density]);
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    >
      <ShapeLayer shapes={shapes} />
    </svg>
  );
});

export type { RutixExpression, RutixPose, MedallionGlyph, IllustrationName };
