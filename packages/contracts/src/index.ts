export interface HealthcheckResponse {
  status: "ok";
}

export interface SystemBoundaryResponse {
  lyceum: string;
  protheus: string;
}

export interface GenerateCourseRequest {
  goal: string;
  audience?: string;
  duration?: string;
  freeOnly?: boolean;
}
