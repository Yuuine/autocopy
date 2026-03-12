import { toast } from '../components/index.js';
import { apiClient } from '../utils/api.js';
import { createLogger } from '../utils/logger.js';
import type { ScoringResult } from '../types/scoring.js';

const logger = createLogger('Scoring');

export class ScoringManager {
  private modal: HTMLElement | null = null;

  createModal(): void {
    const modalHTML = `
      <div id="scoringModal" class="scoring-modal">
        <div class="scoring-content">
          <div class="scoring-header">
            <h2>诊断分析</h2>
            <button class="scoring-close" id="closeScoringModal" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="scoring-body" id="scoringBody">
          </div>
          <div class="scoring-footer">
            <button type="button" class="btn btn-secondary" id="closeScoringBtn">关闭</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('scoringModal');
    
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.modal) return;

    const closeBtn = this.modal.querySelector('#closeScoringModal');
    const closeFooterBtn = this.modal.querySelector('#closeScoringBtn');

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal();
    });

    closeFooterBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal();
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  async fetchScore(content: string, instanceId: string): Promise<ScoringResult | null> {
    return apiClient.getScore(content, instanceId);
  }

  showModal(score: ScoringResult): void {
    if (!this.modal) return;

    const body = this.modal.querySelector('#scoringBody');
    if (!body) return;

    const grade = score.grade;
    const gradeLabel = score.gradeLabel;
    
    body.innerHTML = `
      <div class="scoring-status-section">
        <div class="scoring-status-icon ${grade}">
          ${this.getStatusIcon(grade)}
        </div>
        <div class="scoring-status-label ${grade}">${gradeLabel}</div>
      </div>
      
      <div class="scoring-dimensions-section">
        <h3 class="scoring-section-title">维度评分</h3>
        ${score.details.map(detail => {
          const detailGrade = this.getGradeFromScore(detail.score);
          return `
            <div class="dimension-item">
              <div class="dimension-header">
                <span class="dimension-name">${this.escapeHtml(detail.criteria)}</span>
                <span class="dimension-score-badge ${detailGrade}">${detail.score}</span>
              </div>
              <div class="dimension-bar">
                <div class="dimension-bar-fill ${detailGrade}" style="width: ${detail.score}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      ${score.diagnosis ? `
        <div class="scoring-diagnosis-section">
          <h3 class="scoring-section-title">诊断分析</h3>
          <div class="diagnosis-content">${this.escapeHtml(score.diagnosis)}</div>
        </div>
      ` : ''}
      
      ${score.suggestions && score.suggestions.length > 0 ? `
        <div class="scoring-suggestions-section">
          <h3 class="scoring-section-title">改进建议</h3>
          <ul class="suggestions-list">
            ${score.suggestions.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    this.modal.classList.add('visible');
  }

  private closeModal(): void {
    if (!this.modal) return;
    this.modal.classList.remove('visible');
  }

  private getStatusIcon(grade: string): string {
    switch (grade) {
      case 'excellent':
      case 'good':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>`;
      case 'needs_improvement':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M12 9v4"/>
          <path d="M12 17h.01"/>
        </svg>`;
      case 'poor':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18"/>
          <path d="M6 6l12 12"/>
        </svg>`;
      default:
        return '';
    }
  }

  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'needs_improvement';
    return 'poor';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const scoringManager = new ScoringManager();
