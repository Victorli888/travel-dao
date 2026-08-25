/** Wire format of POST /api/research. Shared by the route and the client. */
export interface ResearchResponse {
  success: boolean;
  /** Claude's short confirmation reply. Present when `success`. */
  message?: string;
  /** Human-readable failure. Present when `!success`. */
  error?: string;
}
