import assert from "node:assert/strict";
import { APP_NAV_ITEMS } from "@/lib/nav-items";
import { isNavItemActive, resolvePageMeta } from "@/lib/navigation";

const clinicianItems = APP_NAV_ITEMS.filter(
  (item) => item.section === "clinicians",
);
const mobileItems = APP_NAV_ITEMS.filter(
  (item) => item.mobile !== false && item.href !== "/knowledge",
);
const hrefs = APP_NAV_ITEMS.map((item) => item.href);

assert.deepEqual(
  clinicianItems.map((item) => item.href),
  ["/app/clinic", "/app/dictaphone"],
  "clinician navigation order stays explicit",
);
assert.ok(
  clinicianItems.every((item) => item.mobile === false),
  "clinician navigation does not enter the mobile bottom navigation",
);
assert.equal(
  new Set(hrefs).size,
  hrefs.length,
  "navigation hrefs remain unique",
);
assert.equal(resolvePageMeta("/app/clinic").title, "Clinic");
assert.equal(resolvePageMeta("/app/dictaphone").title, "Dictaphone");
assert.equal(
  isNavItemActive("/app/clinic", clinicianItems[0]!),
  true,
  "Clinic is active on its route",
);
assert.equal(
  isNavItemActive("/app/clinic/patient", clinicianItems[0]!),
  true,
  "Clinic stays active on nested routes",
);
assert.equal(
  mobileItems.some((item) => item.href === "/app/clinic"),
  false,
  "Clinic is excluded from mobile navigation",
);
assert.equal(
  mobileItems.some((item) => item.href === "/app/dictaphone"),
  false,
  "Dictaphone is excluded from mobile navigation",
);

console.log("EH-170 navigation contract passed");
