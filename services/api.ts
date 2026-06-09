const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export type DailySession = {
  id: string;
  date: string;
  status: "not_started" | "in_progress" | "completed";
  completed_exercises: number;
  goal_exercises: number;
};

export async function getTodaySession(token: string): Promise<DailySession> {
  const response = await fetch(`${API_BASE_URL}/daily-sessions/today`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load today's session");
  }
  return response.json();
}

export async function startDailySession(token: string, mode: string) {
  const response = await fetch(`${API_BASE_URL}/daily-sessions/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) {
    throw new Error("Failed to start daily session");
  }
  return response.json();
}

export async function submitExerciseAnswer(
  token: string,
  sessionID: string,
  exerciseID: string,
  input: { text?: string; audio_url?: string },
) {
  const response = await fetch(
    `${API_BASE_URL}/daily-sessions/${sessionID}/exercises/${exerciseID}/answer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to submit answer");
  }
  return response.json();
}
