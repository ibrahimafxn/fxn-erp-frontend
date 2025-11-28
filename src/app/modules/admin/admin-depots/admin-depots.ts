import { Component } from '@angular/core';
import {DepotService} from '../../../core/services/depot.service';
import {MatCard} from '@angular/material/card';

@Component({
  selector: 'app-admin-depots',
  imports: [
    MatCard
  ],
  templateUrl: './admin-depots.html',
  styleUrl: './admin-depots.scss',
})
export class AdminDepots {
  depots: any[] = [];
  constructor(private depotService: DepotService) {}
  ngOnInit() {
    this.depotService.listDepots().subscribe(d => this.depots = d || []);
  }
}
