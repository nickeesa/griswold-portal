// Shared types for the client portal frontend.

// ---- Raw Strapi 5 shapes (as returned by the guarded endpoints) ----
// Populate is enforced server-side by the controllers; these reflect what the
// property find/findOne actually return (see Technical Spec §3.3, §5).

export type StrapiMedia = {
  url: string;
  alternativeText?: string | null;
};

export type StrapiReport = {
  documentId: string;
  type?: string | null;
  date?: string | null;
  publishedAt?: string | null;
  performance_score?: number | null;
  spa_score?: number | null; // GH only
  full_report?: string | null;
  download?: StrapiMedia | null;
};

export type StrapiLocation = {
  name?: string | null;
};

export type StrapiProperty = {
  id: number;
  documentId: string;
  name: string;
  order?: number | null;
  property_info?: string | null;
  hotel_performance?: string | null;
  fb_performance?: string | null;
  spa_performance?: string | null;
  location?: StrapiLocation | null;
  image?: StrapiMedia[] | null;
  reports_bdtmsds?: StrapiReport[] | null;
  reports_ghs?: StrapiReport[] | null;
};

// ---- View models ----

export type PropertyCardData = {
  id: string; // documentId, used in URLs
  name: string;
  location: string | null;
  image: string | null;
  latestScore: number | null;
  latestDate: string | null;
  order: number;
};

export type ReportRow = {
  id: string;
  source: 'BDTMSD' | 'GH';
  type: string | null;
  date: string | null; // ISO date
  publishedAt: string | null;
  performanceScore: number | null;
  spaScore: number | null; // GH only
  downloadHref: string | null; // proxy route, not the raw Strapi URL
  fullReport: string | null;
};
