import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./list/list.page').then((m) => m.ListPage),
  },
  {
    path: 'report',
    loadComponent: () => import('./report/report.page').then((m) => m.ReportPage),
  },
  {
    path: 'items/:id',
    loadComponent: () => import('./detail/detail.page').then((m) => m.DetailPage),
  },
];
