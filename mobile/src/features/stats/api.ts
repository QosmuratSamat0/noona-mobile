import { apiGet } from '../../shared/api/http';

export type MistakeDto = {
  id: string;
  type: string;
  original: string;
  corrected: string;
};

export type ActivityDto = {
  streak: {
    current_streak: number;
    longest_streak: number;
    last_activity_date?: string | null;
  };
  daily_stats?: Array<{
    date: string;
    session_count: number;
  }>;
};

export async function getMistakes(token: string) {
  const mistakes = await apiGet<MistakeDto[] | null>('/linguistic/mistakes', token);
  return mistakes ?? [];
}

export async function getActivity(token: string) {
  const activity = await apiGet<ActivityDto | null>('/activity/me', token);
  return activity;
}
