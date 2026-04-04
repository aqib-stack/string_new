export type UserRole = 'PLAYER' | 'STRINGER';

export type AppUser = {
  uid: string;
  user_role: UserRole;
  name: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  phone: string;
  shop_id?: string | null;
  created_at?: string;
  created_at_server?: unknown;
};

export type Shop = {
  shop_id: string;
  name: string;
  city?: string;
  labor_rate: number;
  owner_uid: string;
  stripe_account_id?: string;
  wallet_balance: number;
  created_at_server?: unknown;
  updated_at_server?: unknown;
};

export type HybridSetup = {
  mains_string?: string;
  mains_tension?: string;
  crosses_string?: string;
  crosses_tension?: string;
};

export type Racquet = {
  racquet_id: string;
  owner_uid: string;
  owner_name?: string;
  tag_id: string;
  racquet_name?: string;
  racquet_model?: string;
  preferred_shop_id?: string;
  preferred_shop_name?: string;
  preferred_shop_business_name?: string;
  restring_count: number;
  last_string_date?: string;
  string_type: string;
  tension: string;
  is_hybrid?: boolean;
  hybrid_setup?: HybridSetup;
};

export type JobStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'AWAITING_PLAYER'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'PAID'
  | 'PICKED_UP'
  | 'CANCELLED';
export type JobSource = 'PLAYER_SCAN' | 'PLAYER_PORTAL' | 'STRINGER_SCAN';

export type Job = {
  job_id: string;
  racquet_id: string;
  shop_id: string;
  status: JobStatus;
  inspection_log?: {
    frame: boolean;
    grommets: boolean;
    grip: boolean;
    photo_url?: string;
    notes?: string;
  };
  payment_intent_id?: string;
  created_at: string;
  owner_uid?: string;
  owner_name?: string;
  amount_total?: number;
  damage_confirmed?: boolean;
  request_source?: JobSource;
  payout_released?: boolean;
  paid_outside_app?: boolean;
  pickup_confirmed?: boolean;
  picked_up_at?: string;
  proof_photo_url?: string;
  inspection_note?: string;
  labor_cost?: number;
  string_cost?: number;
  customer_provided_string?: boolean;
  payment_requested_at?: string;
  cancelled_at?: string;
  cancelled_by?: 'PLAYER' | 'STRINGER' | '';
  cancel_reason?: string;
  flagged_issues?: string[];
  flagged_photo_urls?: string[];
  player_feedback?: 'TOO_TIGHT' | 'PERFECT' | 'TOO_LOOSE' | '';
  player_feedback_at?: string;
  approved_to_continue?: boolean;
  approved_at?: string;
};
