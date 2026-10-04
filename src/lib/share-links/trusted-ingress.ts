import {
  getTrustedIngressContext,
  type TrustedIngressContext,
  type TrustedIngressFailure,
  type TrustedIngressRuntime,
} from "./trusted-ingress-transport";

const FAIL_CLOSED_RUNTIME: TrustedIngressRuntime = {
  getImmediatePeerAddress: () => null,
};

declare global {
  // The private deployment adapter may install this before handling requests.
  // A missing adapter intentionally fails closed.
  // eslint-disable-next-line no-var
  var __easyhealthTrustedIngressRuntime: TrustedIngressRuntime | undefined;
}

export type TrustedIngressResult =
  | Readonly<{ ok: true; context: TrustedIngressContext }>
  | TrustedIngressFailure;

export function getTrustedIngressRuntime(): TrustedIngressRuntime {
  return globalThis.__easyhealthTrustedIngressRuntime ?? FAIL_CLOSED_RUNTIME;
}

export function requireTrustedIngress(
  request: Request,
  runtime = getTrustedIngressRuntime(),
): TrustedIngressResult {
  const result = getTrustedIngressContext(request, runtime);
  if ("ok" in result) return result;
  return { ok: true, context: result };
}
