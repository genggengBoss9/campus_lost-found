import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, type OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  hardwareChipOutline,
  idCardOutline,
  locationOutline,
  navigateOutline,
  shirtOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import type { FoundItem } from '../core/found-item';
import { ItemApiError, categoryIcon, directionsUrl, fullMapUrl, kindLabel, postedOn } from '../core/found-item';
import { ItemService } from '../core/item.service';
import { ItemMapComponent } from '../shared/item-map.component';

addIcons({ cubeOutline, hardwareChipOutline, idCardOutline, locationOutline, navigateOutline, shirtOutline });

@Component({
  selector: 'app-detail',
  templateUrl: './detail.page.html',
  imports: [
    DatePipe,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    ItemMapComponent,
  ],
})
export class DetailPage implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly postedOn = postedOn;
  readonly kindLabel = kindLabel;
  readonly categoryIcon = categoryIcon;
  readonly directionsUrl = directionsUrl;
  readonly fullMapUrl = fullMapUrl;

  item: FoundItem | null = null;
  placeName = '';
  loading = false;
  loadError = '';

  ngOnInit(): void {
    void this.load(Number(this.route.snapshot.paramMap.get('id')));
  }

  ionViewWillEnter(): void {
    void this.load(Number(this.route.snapshot.paramMap.get('id')));
  }

  async load(id: number): Promise<void> {
    this.item = null;
    this.placeName = '';
    this.loadError = '';
    if (!Number.isInteger(id) || id < 1) {
      this.loadError = 'Item not found.';
      this.changeDetector.markForCheck();
      return;
    }

    this.loading = true;
    this.changeDetector.markForCheck();
    try {
      this.item = await firstValueFrom(this.itemService.getItem(id));
      void this.lookupPlace(this.item.latitude, this.item.longitude);
    } catch (error: unknown) {
      this.loadError = error instanceof ItemApiError ? error.message : 'Could not load this item. Please try again.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  private async lookupPlace(latitude: number, longitude: number): Promise<void> {
    const name = await firstValueFrom(this.itemService.placeName(latitude, longitude));
    if (!this.item || this.item.latitude !== latitude || this.item.longitude !== longitude) {
      return;
    }
    this.placeName = name ?? '';
    this.changeDetector.markForCheck();
  }
}
