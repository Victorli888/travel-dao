/** Wire format of the activity the research route just saved. */
export interface ResearchActivity {
  id: string;
  name: string;
  summary: string;
  area: string | null;
}

/** Wire format of POST /api/research. Shared by the route and the client. */
export interface ResearchResponse {
  success: boolean;
  /** Claude's short confirmation reply. Present when `success`. */
  message?: string;
  /** The activity row that was inserted. Present when `success`. */
  activity?: ResearchActivity;
  /** Human-readable failure. Present when `!success`. */
  error?: string;
}
