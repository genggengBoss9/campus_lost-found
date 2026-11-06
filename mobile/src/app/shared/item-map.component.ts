import type { AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { Component, effect, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';

export interface MapPin {
  latitude: number;
  longitude: number;
}

const DEFAULT_VIEW = L.latLng(14.5995, 120.9842);

@Component({
  selector: 'app-item-map',
  templateUrl: './item-map.component.html',
  styleUrls: ['./item-map.component.scss'],
})
export class ItemMapComponent implements AfterViewInit, OnDestroy {
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly label = input('Map of where the item was found');
  readonly height = input(220);
  readonly selectable = input(false);
  readonly pinned = output<MapPin>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private readonly ready = signal(false);
  private map: L.Map | null = null;
  private marker: L.Marker | L.CircleMarker | null = null;

  constructor() {
    effect(() => {
      if (!this.ready() || !this.map) {
        return;
      }
      const latitude = this.latitude();
      const longitude = this.longitude();
      if (latitude === null || longitude === null) {
        return;
      }
      const view = L.latLng(latitude, longitude);
      this.placeMarker(view, false);
      this.map.setView(view);
    });
  }

  ngAfterViewInit(): void {
    const latitude = this.latitude();
    const longitude = this.longitude();
    const view = latitude !== null && longitude !== null ? L.latLng(latitude, longitude) : DEFAULT_VIEW;
    this.map = L.map(this.host().nativeElement, { zoomControl: true }).setView(view, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    if (latitude !== null && longitude !== null) {
      this.placeMarker(view, false);
    }

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (!this.selectable()) {
        return;
      }
      this.placeMarker(event.latlng, true);
    });

    this.ready.set(true);
    setTimeout(() => this.map?.invalidateSize());
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }

  private placeMarker(view: L.LatLng, fromUser: boolean): void {
    if (!this.map) {
      return;
    }

    if (this.selectable()) {
      if (!this.marker || !(this.marker instanceof L.Marker)) {
        this.marker?.remove();
        this.marker = L.marker(view, {
          icon: L.divIcon({
            className: 'map-pin',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          draggable: true,
          keyboard: true,
          alt: 'Selected location',
        }).addTo(this.map);
        this.marker.on('dragend', () => {
          const point = (this.marker as L.Marker).getLatLng();
          this.pinned.emit({ latitude: point.lat, longitude: point.lng });
        });
      } else {
        this.marker.setLatLng(view);
      }
    } else if (!this.marker) {
      this.marker = L.circleMarker(view, {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1d5fb8',
        fillOpacity: 0.95,
      }).addTo(this.map);
    } else {
      this.marker.setLatLng(view);
    }

    if (fromUser) {
      this.pinned.emit({ latitude: view.lat, longitude: view.lng });
    }
  }
}
