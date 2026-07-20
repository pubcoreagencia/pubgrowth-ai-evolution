export type CampaignObjective =
  | "views"
  | "engagement"
  | "traffic"
  | "conversion"
  | "sales"
  | "awareness";

export interface CampaignSetup {
  clientName: string;
  campaignName: string;
  videoUrl: string;
  startDate: string;
  endDate: string;
  dailyBudget: number;
  days: number;
  objective: CampaignObjective;
  avgProductValue?: number;
  avgUpsellValue?: number;
  avgCrossSellValue?: number;
}

export interface CampaignResults {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  linkClicks?: number;
  purchases?: number;
  upsells?: number;
  crossSells?: number;
  revenue?: number;
}

export interface Campaign extends CampaignSetup {
  id: string;
  createdAt: string;
  updatedAt: string;
  results: CampaignResults;
}