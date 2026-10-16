import { Component, Input, computed } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  imports: [NgClass],
  template: `
    <div class="w-full bg-gray-100 rounded-full overflow-hidden" [style.height]="height">
      <div
        class="h-full rounded-full transition-all duration-500"
        [ngClass]="barColorClass()"
        [style.width]="clampedPercent() + '%'"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input() percentage = 0;
  @Input() height = '8px';

  clampedPercent = computed(() => Math.min(this.percentage, 100));

  barColorClass = computed(() => {
    if (this.percentage > 100) return 'bg-[var(--color-budget-over)]';
    if (this.percentage >= 75) return 'bg-[var(--color-budget-warning)]';
    return 'bg-[var(--color-budget-ok)]';
  });
}
