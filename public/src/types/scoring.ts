export interface ScoringDetail {
  criteria: string;
  score: number;
  maxScore: number;
}

export interface ScoringResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  gradeLabel: string;
  details: ScoringDetail[];
  diagnosis: string;
  suggestions: string[];
}
