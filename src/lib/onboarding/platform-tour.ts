export const CURRENT_PLATFORM_TOUR_VERSION = "1" as const;

export const PLATFORM_TOUR_TARGETS = {
  desktopNavigation: '[data-tour="desktop-navigation"]',
  mobileNavigation: '[data-tour="mobile-navigation"]',
  desktopBiomarkers: '[data-tour="desktop-biomarkers"]',
  mobileBiomarkers: '[data-tour="mobile-biomarkers"]',
  addDocument: '[data-tour="add-document"]',
  healthProfile: '[data-tour="health-profile"]',
  reports: '[data-tour="reports"]',
  accountMenu: '[data-tour="account-menu"]',
} as const;

export type PlatformTourTerminal = "dismissed" | "completed";
