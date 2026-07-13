import type { KeyboardEvent, SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Framed viewBox for silhouette + side badges (bounds from path + badges, pad 16). */
export const BODY_MAP_VIEWBOX = "126 49 210 407";

const BODY_GRADIENT_ID = "eh-body-fill-gradient";

const silhouetteStroke = {
  stroke: "var(--body-stroke)",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
  paintOrder: "stroke fill" as const,
};

const BODY_PATH =
  "M298.163,225.387c0.8,0.105,2.124,0.563,4.289,1.899c2.094,1.292,3.666,1.231,4.412,0.199 c1.039-1.437-3.668-3.952-5.867-5.661c-2.737-2.128-7.466-3.23-9.81-5.118c-0.158-0.127-0.325-0.324-0.482-0.537 c-0.428-0.58-0.75-1.221-0.995-1.899c-1.438-3.961-5.215-16.992-7.64-26.21c-2.6-9.88-4.99-14.871-6.454-17.396 c-0.783-4.281-1.074-9.004-4.163-19.222c0.433-18.2-4.306-23.986-8.541-26.813c-7.09-4.734-13.188-3.131-26.885-11.342 l-1.495-12.892h-18.937l-1.495,12.892c-13.696,8.212-19.794,6.608-26.884,11.342c-4.235,2.827-8.975,8.613-8.541,26.813 c-3.089,10.218-3.38,14.941-4.163,19.222c-1.463,2.524-3.854,7.515-6.454,17.396c-0.669,2.542-5.953,22.138-8.088,27.368 c-0.255,0.624-0.63,1.197-1.156,1.621c-2.344,1.888-7.073,2.991-9.81,5.118c-2.199,1.709-6.906,4.224-5.867,5.661 c0.746,1.032,2.318,1.093,4.412-0.2c2.165-1.335,3.489-1.794,4.289-1.899c0.667-0.088,1.159,0.608,0.884,1.222 c-0.664,1.482-2.474,3.953-4.624,7.98c-0.564,1.057-3.725,5.307-4.829,7.988c-0.658,1.599,1.412,2.674,2.486,1.531 c1.606-1.709,4.017-4.81,5.161-6.916c0.366-0.675,2.129-3.646,2.647-4.486c-0.31,1.037-1.98,4.4-2.44,5.55 c-0.765,1.913-3.113,7.21-3.895,9.313c-0.504,1.355,1.806,2.498,2.801,1.171c1.036-1.38,3.44-5.034,5.159-9.428 c0,0,1.485-3.322,2.269-5.327c-0.449,2.139-0.91,3.063-1.382,5.285c0,0-2.388,6.139-2.641,8.024 c-0.206,1.539,1.888,2.271,2.746,0.977c1.124-1.694,3.315-7.211,3.615-8.007c1.267-3.362,2.151-5.924,2.151-5.924 s-0.403,2.611-0.702,4.15c-0.162,0.832-1.526,4.433-1.598,6.84c-0.037,1.235,1.359,1.503,2.053,1.033 c1.637-1.11,3.197-7.376,3.197-7.376c0.658-2.732,2.217-8.239,2.842-9.831c1.554-3.956,0.836-6.427,0.768-8.749 c0.065-0.464,0.095-0.838,0.408-1.635c0.718-1.825,2.925-5.867,10.456-18.272c7.103-11.7,8.707-21.061,8.707-21.061 c3.64-5.287,5.563-11.139,7.477-15.42c4.014,13.364,3.655,19.676,2.802,32.546c-1.876,28.327-9.916,38.004-8.589,73.702 c0.615,16.528,5.779,33.075,5.628,39.016c-0.156,6.171-0.509,12.962-0.932,17.143c-0.702,6.936-1.939,13.876-1.618,20.873 c0.314,6.837,3.072,13.277,5.101,19.764c1.652,5.282,2.692,10.764,3.525,16.228c1.897,12.441,3.27,16.031-7.285,31.111 c-1.133,1.618-3.279,4.342-2.624,6.499c0.603,1.986,3.33,2.276,5.022,2.397c12.649,0.907,17.884,0.89,19.125-1.79 c0.541-1.169,0.524-2.527,0.113-3.748c-2.944-8.75-1.118-17.761-2.204-26.715c-0.819-6.752-1.193-7.891,0.588-17.634 c1.122-6.14,2.315-12.279,2.892-18.5c1.72-18.527-3.432-22.78-3.176-33.882c0.262-11.37,10.741-60.273,9.498-81.568 c-0.04-0.685,0.506-1.262,1.192-1.272c0.304-0.005,0.628-0.004,0.93,0.001c0.685,0.011,1.217,0.579,1.185,1.264 c-1.387,29.947,9.211,70.141,9.475,81.576c0.256,11.102-4.896,15.354-3.176,33.882c0.577,6.221,1.77,12.361,2.892,18.5 c1.781,9.744,1.407,10.882,0.588,17.634c-1.086,8.955,0.74,17.965-2.204,26.715c-0.411,1.221-0.428,2.579,0.114,3.748 c1.242,2.68,6.477,2.698,19.125,1.79c1.691-0.121,4.419-0.411,5.022-2.397c0.655-2.157-1.491-4.881-2.624-6.499 c-10.556-15.08-9.182-18.669-7.285-31.111c0.833-5.464,1.872-10.946,3.525-16.228c2.029-6.487,4.788-12.927,5.101-19.764 c0.321-6.997-0.916-13.937-1.618-20.873c-0.424-4.181-0.776-10.972-0.932-17.143c-0.15-5.94,5.014-22.487,5.628-39.016 c1.331-35.805-4.218-45.462-8.524-73.637c-1.631-10.674-1.464-20.178,1.673-33.675c1.913,4.281,6.034,12.307,8.888,16.701 c0,0,1.257,9.144,8.36,20.844c7.45,12.272,9.689,16.357,10.431,18.21c0.234,0.67,0.321,1.365,0.272,2.054 c-0.152,2.13-0.595,4.488,0.804,8.049c0.625,1.591,2.185,7.098,2.842,9.831c0,0,1.56,6.266,3.197,7.376 c0.693,0.47,2.09,0.202,2.053-1.033c-0.072-2.408-1.436-6.009-1.598-6.84c-0.299-1.539-0.608-3.527-0.608-3.527 s0.784,1.738,2.056,5.301c0.286,0.801,2.492,6.313,3.615,8.007c0.858,1.294,2.953,0.562,2.746-0.977 c-0.253-1.885-2.641-8.024-2.641-8.024c-0.472-2.222-1.228-3.65-1.677-5.789c0.784,2.006,2.776,5.832,2.776,5.832 c1.719,4.393,3.912,8.048,4.948,9.428c0.996,1.327,3.306,0.184,2.802-1.171c-0.783-2.102-3.13-7.399-3.895-9.313 c-0.408-1.02-2.759-6.048-2.795-6.165c0.518,0.84,2.635,4.427,3.001,5.102c1.144,2.106,3.555,5.207,5.161,6.916 c1.074,1.143,3.145,0.067,2.486-1.531c-1.104-2.681-4.265-7.305-4.829-8.361c-2.15-4.027-3.96-6.126-4.624-7.608 C297.004,225.995,297.495,225.299,298.163,225.387z";

const HEAD_PATH =
  "M240.258,76.6c-0.271-2.206-1.889-10.697-14.721-10.612h-1.074 c-12.833-0.085-14.45,8.406-14.721,10.612c-1.322,10.748,0.663,15.185,1.247,20.105c0.112,0.945,0.449,2.834,0.801,4.707 c0.683,3.627,3.025,6.729,6.339,8.353c2.106,1.032,4.528,1.92,6.671,1.968c0.065,0.017,0.135,0.007,0.201,0.008 c0.066,0,0.136,0.01,0.201,0.008c2.142-0.064,4.564-0.951,6.67-1.983c3.315-1.624,5.657-4.726,6.34-8.354 c0.352-1.872,0.689-3.761,0.801-4.706C239.595,91.785,241.58,87.348,240.258,76.6z";

type SilhouettePathProps = SVGProps<SVGPathElement> & {
  d: string;
};

function SilhouettePath({ d, fill, strokeWidth, ...props }: SilhouettePathProps) {
  return (
    <path
      d={d}
      fill={fill}
      strokeWidth={strokeWidth}
      shapeRendering="geometricPrecision"
      {...silhouetteStroke}
      {...props}
    />
  );
}

export function BodySilhouette() {
  return (
    <g id="body-silhouette" className="body-group">
      <defs>
        <radialGradient
          id={BODY_GRADIENT_ID}
          cx="48%"
          cy="22%"
          r="78%"
          fx="48%"
          fy="22%"
        >
          <stop offset="0%" stopColor="var(--body-fill-strong)" />
          <stop offset="52%" stopColor="var(--body-fill)" />
          <stop offset="100%" stopColor="var(--body-fill-soft)" />
        </radialGradient>
      </defs>

      <ellipse
        className="body-ground-shadow"
        cx={225}
        cy={419}
        rx={28}
        ry={5}
        aria-hidden
      />

      <SilhouettePath
        d={BODY_PATH}
        fill={`url(#${BODY_GRADIENT_ID})`}
        strokeWidth={0.75}
      />
      <SilhouettePath
        d={HEAD_PATH}
        fill="var(--body-fill-strong)"
        strokeWidth={0.6}
      />
    </g>
  );
}

export const BODY_MAP_ARROW_MARKER_ID = "body-map-arrow";

export function BodyMapDefs() {
  return (
    <defs>
      <marker
        id={BODY_MAP_ARROW_MARKER_ID}
        viewBox="0 0 6 6"
        refX={5.2}
        refY={3}
        markerWidth={5}
        markerHeight={5}
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0.5,0.5 L5.5,3 L0.5,5.5 Z" fill="context-stroke" />
      </marker>
    </defs>
  );
}

type Point = [number, number];

const BADGE_RADIUS = 11;
const ANCHOR_INSET = 3.2;

function connectorGeometry(from: Point, to: Point) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const startX = fx + ux * BADGE_RADIUS;
  const startY = fy + uy * BADGE_RADIUS;
  const endX = tx - ux * ANCHOR_INSET;
  const endY = ty - uy * ANCHOR_INSET;

  const path = `M ${startX} ${startY} C ${startX} ${endY}, ${endX} ${startY}, ${endX} ${endY}`;

  return { path, endX, endY };
}

type BodyMapConnectorProps = {
  from: Point;
  to: Point;
  active?: boolean;
  dimmed?: boolean;
  strokeColor?: string;
};

export function BodyMapConnector({
  from,
  to,
  active,
  dimmed,
  strokeColor = "#94a3b8",
}: BodyMapConnectorProps) {
  const { path } = connectorGeometry(from, to);

  return (
    <path
      d={path}
      fill="none"
      stroke={strokeColor}
      className={cn("body-map-connector", active && "is-active", dimmed && "is-dimmed")}
      strokeWidth={active ? 1.25 : 1}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

type BodyMapMarkerProps = {
  x: number;
  y: number;
  active?: boolean;
  dimmed?: boolean;
  className?: string;
};

export function BodyMapMarker({ x, y, active, dimmed, className }: BodyMapMarkerProps) {
  return (
    <g
      className={cn("body-map-marker", active && "is-active", dimmed && "is-dimmed")}
      transform={`translate(${x} ${y})`}
    >
      <circle
        cx={0}
        cy={0}
        r={3.2}
        className={cn("body-map-marker-dot", className, active && "stroke-[1.5]")}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

type HealthSystemBadgeProps = {
  x: number;
  y: number;
  score: number | null;
  label: string;
  active?: boolean;
  dimmed?: boolean;
  index?: number;
  scoreClassName: string;
  onSelect?: () => void;
};

function handleBadgeKeyDown(event: KeyboardEvent<SVGGElement>, onSelect?: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect?.();
  }
}

export function HealthSystemBadge({
  x,
  y,
  score,
  label,
  active,
  dimmed,
  index = 0,
  scoreClassName,
  onSelect,
}: HealthSystemBadgeProps) {
  return (
    <g
      className={cn("body-map-badge", active && "is-active", dimmed && "is-dimmed")}
      transform={`translate(${x} ${y})`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => handleBadgeKeyDown(event, onSelect)}
      aria-label={
        score == null
          ? `${label}: current state assessment unavailable`
          : `${label}: ${score} current state assessment`
      }
      aria-pressed={active}
    >
      <circle cx={0} cy={0} r={16} fill="transparent" className="cursor-pointer" />
      <g
        className="body-map-badge-inner"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <circle
          cx={0}
          cy={0}
          r={11}
          className={cn("body-map-badge-ring", scoreClassName, active && "stroke-[2]")}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="middle"
          className="body-map-badge-score pointer-events-none"
        >
          {score ?? "-"}
        </text>
      </g>
      <text
        x={0}
        y={20}
        textAnchor="middle"
        className="body-map-badge-label pointer-events-none"
      >
        {label}
      </text>
    </g>
  );
}
