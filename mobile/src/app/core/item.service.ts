import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, from, map, of, switchMap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

import { resolveApiUrl } from './api-address';
import type { ApiEnvelope, FoundItem, FoundItemDraft } from './found-item';
import { ItemApiError } from './found-item';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly apiKey = new HttpHeaders({ 'X-Api-Key': environment.apiKey });
  private resolvedUrl: Promise<string> | null = null;

  getItems(): Observable<FoundItem[]> {
    return this.request((url) => this.http.get<ApiEnvelope<FoundItem[]>>(url)).pipe(map((body) => this.readData(body)));
  }

  getItem(id: number): Observable<FoundItem> {
    return this.request((url) => this.http.get<ApiEnvelope<FoundItem>>(url, { params: { id } })).pipe(
      map((body) => this.readData(body)),
    );
  }

  createItem(draft: FoundItemDraft): Observable<FoundItem> {
    return this.request((url) =>
      this.http.post<ApiEnvelope<FoundItem>>(url, draft, { headers: this.apiKey }),
    ).pipe(map((body) => this.readData(body)));
  }

  placeName(latitude: number, longitude: number): Observable<string | null> {
    return this.apiUrl().pipe(
      switchMap((url) =>
        this.http.get<ApiEnvelope<{ name: string }>>(url.replace(/items\.php$/, 'place.php'), {
          params: { lat: latitude, lng: longitude },
          headers: this.apiKey,
        }),
      ),
      map((body) => (body.success && body.data?.name ? body.data.name : null)),
      catchError(() => of(null)),
    );
  }

  private request<T>(send: (url: string) => Observable<T>): Observable<T> {
    return this.apiUrl().pipe(
      switchMap((url) => send(url)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 0) {
          this.resolvedUrl = null;
        }
        return throwError(() => this.asApiError(error));
      }),
    );
  }

  private apiUrl(): Observable<string> {
    this.resolvedUrl ??= resolveApiUrl(environment.apiUrl).catch((error: unknown) => {
      this.resolvedUrl = null;
      throw error;
    });
    return from(this.resolvedUrl);
  }

  private readData<T>(body: ApiEnvelope<T>): T {
    if (!body.success || body.data === undefined) {
      throw new ItemApiError(body.message ?? 'Request failed.', body.errors ?? {});
    }
    return body.data;
  }

  private asApiError(error: unknown): ItemApiError {
    if (error instanceof ItemApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      const body = this.envelope(error.error);
      return new ItemApiError(
        body?.message ?? 'Could not reach the server. Please try again.',
        body?.errors ?? {},
        error.status,
      );
    }
    return new ItemApiError('Could not reach the server. Please try again.');
  }

  private envelope(value: unknown): ApiEnvelope<unknown> | null {
    if (typeof value !== 'object' || value === null || !('success' in value)) {
      return null;
    }
    return value as ApiEnvelope<unknown>;
  }
}
