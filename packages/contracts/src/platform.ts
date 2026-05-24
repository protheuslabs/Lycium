export interface HealthcheckResponse {
  status: "ok";
}

export interface SystemBoundaryResponse {
  web: string;
  backend: string;
}

export interface GenerateCourseRequest {
  goal: string;
  audience?: string;
  duration?: string;
  freeOnly?: boolean;
}
