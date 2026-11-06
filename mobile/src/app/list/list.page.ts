import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  chevronForward,
  cubeOutline,
  hardwareChipOutline,
  idCardOutline,
  searchOutline,
  shirtOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import type { FoundItem } from '../core/found-item';
import { FOUND_ITEM_CATEGORIES, ItemApiError, categoryIcon, kindLabel, postedOn } from '../core/found-item';
import { ItemService } from '../core/item.service';

interface ListFlashState {
  flash?: string;
}

addIcons({ add, chevronForward, cubeOutline, hardwareChipOutline, idCardOutline, searchOutline, shirtOutline });

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  imports: [DatePipe, RouterLink, IonHeader, IonToolbar, IonContent, IonButton, IonIcon],
})
export class ListPage implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly listings = ['All', 'Lost', 'Found'];
  readonly chips = ['All', ...FOUND_ITEM_CATEGORIES];
  readonly categoryIcon = categoryIcon;
  readonly kindLabel = kindLabel;
  readonly postedOn = postedOn;

  items: FoundItem[] = [];
  loading = false;
  loadError = '';
  success = '';
  query = '';
  listing = 'All';
  category = 'All';

  ngOnInit(): void {
    void this.load();
  }

  ionViewWillEnter(): void {
    const state = history.state as ListFlashState | null;
    this.success = state?.flash ?? '';
    if (this.success) {
      history.replaceState({ ...state, flash: undefined }, '');
    }
    this.changeDetector.markForCheck();
    void this.load();
  }

  get visibleItems(): FoundItem[] {
    const query = this.query.trim().toLowerCase();
    return this.items.filter((item) => {
      const listingMatches = this.listing === 'All' || kindLabel(item.kind) === this.listing;
      const categoryMatches = this.category === 'All' || item.category === this.category;
      const text = `${item.title} ${item.description} ${item.category} ${kindLabel(item.kind)}`.toLowerCase();
      return listingMatches && categoryMatches && (query === '' || text.includes(query));
    });
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.changeDetector.markForCheck();
  }

  setListing(listing: string): void {
    this.listing = listing;
    this.changeDetector.markForCheck();
  }

  setCategory(category: string): void {
    this.category = category;
    this.changeDetector.markForCheck();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.changeDetector.markForCheck();
    try {
      this.items = await firstValueFrom(this.itemService.getItems());
    } catch (error: unknown) {
      this.items = [];
      this.loadError = error instanceof ItemApiError ? error.message : 'Could not load items. Please try again.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }
}
