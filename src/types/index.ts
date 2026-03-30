export type UserRole = 'PLAYER' | 'STRINGER';

export type AppUser = {
  uid: string;
  user_role: UserRole;
  name: string;
  phone: string;
  shop_id?: string | null;
};

export type Shop = {
  shop_id: string;
  name: string;
  city?: string;
  labor_rate: number;
  owner_uid: string;
  stripe_account_id?: string;
  wallet_balance: number;
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
  restring_count: number;
  last_string_date?: string;
  string_type: string;
  tension: string;
};

export type JobStatus = 'REQUESTED' | 'RECEIVED' | 'IN_PROGRESS' | 'FINISHED' | 'PAID' | 'PICKED_UP';
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
};
