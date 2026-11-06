import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, type ElementRef, inject, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, imagesOutline, locateOutline, locationOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import { FOUND_ITEM_CATEGORIES, type ItemKind, ItemApiError } from '../core/found-item';
import { ItemService } from '../core/item.service';
import { ItemMapComponent, type MapPin } from '../shared/item-map.component';

interface FieldError {
  id: string;
  message: string;
}

addIcons({ cameraOutline, imagesOutline, locateOutline, locationOutline });

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonIcon,
    ItemMapComponent,
  ],
})
export class ReportPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly itemService = inject(ItemService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly summaryHost = viewChild<ElementRef<HTMLElement>>('errorSummary');

  readonly categories = FOUND_ITEM_CATEGORIES;
  readonly form = this.formBuilder.nonNullable.group({
    kind: ['found' as ItemKind, Validators.required],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    category: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  submitted = false;
  posting = false;
  locating = false;
  latitude: number | null = null;
  longitude: number | null = null;
  placeName = '';
  photoData: string | null = null;
  fieldErrors: Record<string, string> = {};

  get isLost(): boolean {
    return this.form.controls.kind.value === 'lost';
  }

  get summary(): FieldError[] {
    const order = ['kind', 'title', 'category', 'description', 'photo_data', 'location', 'form'];
    return order.filter((id) => this.fieldErrors[id]).map((id) => ({ id, message: this.fieldErrors[id] ?? '' }));
  }

  messageFor(id: string): string {
    return this.fieldErrors[id] ?? '';
  }

  showError(id: string): boolean {
    return this.messageFor(id) !== '';
  }

  setKind(kind: ItemKind): void {
    this.form.controls.kind.setValue(kind);
    this.clearField('kind');
  }

  removePhoto(): void {
    this.photoData = null;
    this.clearField('photo_data');
    this.changeDetector.markForCheck();
  }

  async takePhoto(): Promise<void> {
    await this.capturePhoto(CameraSource.Camera);
  }

  async uploadPhoto(): Promise<void> {
    await this.capturePhoto(CameraSource.Photos);
  }

  private async capturePhoto(source: CameraSource): Promise<void> {
    this.clearField('photo_data');
    try {
      const photo = await Camera.getPhoto({
        quality: 60,
        width: 1280,
        resultType: CameraResultType.DataUrl,
        source,
        correctOrientation: true,
      });
      if (!photo.dataUrl) {
        this.fieldErrors = { ...this.fieldErrors, photo_data: 'Could not read that photo. Please try again.' };
        this.focusSummary();
        return;
      }
      if (dataUrlBytes(photo.dataUrl) > 3 * 1024 * 1024) {
        this.fieldErrors = { ...this.fieldErrors, photo_data: 'Image must be 3MB or less.' };
        this.focusSummary();
        return;
      }
      this.photoData = photo.dataUrl;
    } catch (error: unknown) {
      if (wasCancelled(error)) {
        return;
      }
      const fromGallery = source === CameraSource.Photos;
      const message = permissionDenied(error)
        ? fromGallery
          ? 'Photo library permission was denied.'
          : 'Camera permission was denied.'
        : fromGallery
          ? 'Could not open the photo library. Please try again.'
          : 'Could not open the camera. Please try again.';
      this.fieldErrors = { ...this.fieldErrors, photo_data: message };
      this.focusSummary();
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  pinLocation(pin: MapPin): void {
    this.latitude = pin.latitude;
    this.longitude = pin.longitude;
    this.placeName = '';
    this.clearField('location');
    void this.lookupPlace(pin.latitude, pin.longitude);
    this.changeDetector.markForCheck();
  }

  async useMyLocation(): Promise<void> {
    this.locating = true;
    this.clearField('location');
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      this.latitude = position.coords.latitude;
      this.longitude = position.coords.longitude;
      this.placeName = '';
      void this.lookupPlace(this.latitude, this.longitude);
    } catch (error: unknown) {
      const message = permissionDenied(error)
        ? this.isLost
          ? 'Location permission was denied. Allow location to pin where you last saw it.'
          : 'Location permission was denied. Allow location to pin where the item was found.'
        : 'Could not read the current location. Please try again.';
      this.fieldErrors = { ...this.fieldErrors, location: message };
      this.focusSummary();
    } finally {
      this.locating = false;
      this.changeDetector.markForCheck();
    }
  }

  async post(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();
    const errors = this.clientErrors();
    if (Object.keys(errors).length > 0) {
      this.fieldErrors = errors;
      this.focusSummary();
      this.changeDetector.markForCheck();
      return;
    }
    if (this.latitude === null || this.longitude === null) {
      return;
    }

    this.posting = true;
    try {
      await firstValueFrom(
        this.itemService.createItem({
          kind: this.form.controls.kind.value,
          title: this.form.controls.title.value.trim(),
          category: this.form.controls.category.value,
          description: this.form.controls.description.value.trim(),
          latitude: this.latitude,
          longitude: this.longitude,
          ...(this.photoData ? { photo_data: this.photoData } : {}),
        }),
      );
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
      }
      await this.router.navigateByUrl('/', { state: { flash: 'Report submitted.' } });
    } catch (error: unknown) {
      this.fieldErrors =
        error instanceof ItemApiError
          ? this.serverErrors(error)
          : { form: 'Could not post the item. Please try again.' };
      this.focusSummary();
    } finally {
      this.posting = false;
      this.changeDetector.markForCheck();
    }
  }

  focusField(id: string, event: Event): void {
    event.preventDefault();
    if (id === 'form') {
      this.summaryHost()?.nativeElement.focus();
      return;
    }
    const target = document.getElementById(id);
    if (target && 'setFocus' in target) {
      void (target as HTMLElement & { setFocus: () => Promise<void> }).setFocus();
      return;
    }
    target?.focus();
  }

  private async lookupPlace(latitude: number, longitude: number): Promise<void> {
    const name = await firstValueFrom(this.itemService.placeName(latitude, longitude));
    if (this.latitude !== latitude || this.longitude !== longitude) {
      return;
    }
    this.placeName = name ?? '';
    this.changeDetector.markForCheck();
  }

  private clientErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    const kind = this.form.controls.kind;
    const title = this.form.controls.title;
    const category = this.form.controls.category;
    const description = this.form.controls.description;

    if (kind.value !== 'lost' && kind.value !== 'found') {
      errors['kind'] = 'Choose Lost or Found.';
    }

    if (title.hasError('required') || title.hasError('minlength')) {
      errors['title'] = 'Title must be at least 3 characters.';
    } else if (title.hasError('maxlength')) {
      errors['title'] = 'Title is too long. Maximum 150 characters only.';
    }
    if (category.hasError('required')) {
      errors['category'] = 'Choose a category.';
    }
    if (description.hasError('required') || description.hasError('minlength')) {
      errors['description'] = 'Note must be at least 5 characters.';
    } else if (description.hasError('maxlength')) {
      errors['description'] = 'Note is too long. Maximum 500 characters only.';
    }
    if (this.latitude === null || this.longitude === null) {
      errors['location'] = kind.value === 'lost' ? 'Pin where you last saw it.' : 'Use my location before posting.';
    }
    return errors;
  }

  private serverErrors(error: ItemApiError): Record<string, string> {
    const errors = { ...error.errors };
    if (errors['latitude'] || errors['longitude']) {
      errors['location'] =
        errors['latitude'] ??
        errors['longitude'] ??
        (this.isLost ? 'Pin where you last saw it.' : 'Use my location before posting.');
      delete errors['latitude'];
      delete errors['longitude'];
    }
    if (Object.keys(errors).length === 0) {
      errors['form'] = error.message;
    }
    return errors;
  }

  private clearField(id: string): void {
    if (!this.fieldErrors[id]) {
      return;
    }
    const next = { ...this.fieldErrors };
    delete next[id];
    this.fieldErrors = next;
    this.changeDetector.markForCheck();
  }

  private focusSummary(): void {
    this.changeDetector.markForCheck();
    setTimeout(() => this.summaryHost()?.nativeElement.focus());
  }
}

function dataUrlBytes(dataUrl: string): number {
  const encoded = dataUrl.split(',')[1] ?? '';
  return Math.floor((encoded.length * 3) / 4);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function wasCancelled(error: unknown): boolean {
  return /cancel/i.test(errorText(error));
}

function permissionDenied(error: unknown): boolean {
  return /denied|permission/i.test(errorText(error));
}
