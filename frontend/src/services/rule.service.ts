import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { ApplyRulesResult, CategorizationRule, RuleInput } from '../core/models/rule.model';

@Injectable({ providedIn: 'root' })
export class RuleService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/rules`;

  list() {
    return this.http.get<CategorizationRule[]>(this.url);
  }

  create(input: RuleInput) {
    return this.http.post<CategorizationRule>(this.url, input);
  }

  update(id: string, input: RuleInput) {
    return this.http.patch<CategorizationRule>(`${this.url}/${id}`, input);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  reorder(order: string[]) {
    return this.http.patch<CategorizationRule[]>(`${this.url}/reorder`, { order });
  }

  apply() {
    return this.http.post<ApplyRulesResult>(`${this.url}/apply`, {});
  }
}
