import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import {
  CategorizeTransactionInput,
  ReviewDecisionResult,
  ReviewTransaction,
} from '../core/models/review.model';
import { RuleCondition } from '../core/models/rule.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/review`;

  pending() {
    return this.http.get<ReviewTransaction[]>(this.url);
  }

  categorize(id: string, input: CategorizeTransactionInput) {
    return this.http.post<ReviewDecisionResult>(`${this.url}/${id}/categorize`, input);
  }

  ignore(id: string, rule?: RuleCondition) {
    return this.http.post<ReviewDecisionResult>(`${this.url}/${id}/ignore`, rule ? { rule } : {});
  }
}
