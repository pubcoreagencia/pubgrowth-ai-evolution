export type CampaignObjective =
  | "views"
  | "engagement"
  | "traffic"
  | "conversion"
  | "sales"
  | "awareness";

export interface CampaignSetup {
  clientName: string;
  clientId?: string | null;
  campaignName: string;
  videoUrl: string;
  startDate: string;
  endDate: string;
  dailyBudget: number;
  budget: number;
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
  status:
    | "draft"
    | "pending_payment"
    | "funded"
    | "active"
    | "running"
    | "completed"
    | "cancelled"
    | "refunded";
}