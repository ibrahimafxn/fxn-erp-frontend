import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ConsumableListResult, MaterialListResult } from '../../../core/models';
import { ConsumableService } from '../../../core/services/consumable.service';
import { MaterialService } from '../../../core/services/material.service';
import { MovementService } from '../../../core/services/movement.service';
import { MaterialConsumption } from './material-consumption';

describe('MaterialConsumption', () => {
  let component: MaterialConsumption;
  let fixture: ComponentFixture<MaterialConsumption>;
  let movementService: jasmine.SpyObj<MovementService>;
  let materialService: jasmine.SpyObj<MaterialService>;
  let consumableService: jasmine.SpyObj<ConsumableService>;

  beforeEach(async () => {
    movementService = jasmine.createSpyObj<MovementService>('MovementService', ['listRaw']);
    movementService.listRaw.and.returnValue(of({ items: [], total: 0, page: 1, limit: 1000 }));

    materialService = jasmine.createSpyObj<MaterialService>('MaterialService', ['refresh']);
    materialService.refresh.and.returnValue(of({ items: [], total: 0, page: 1, limit: 1000 } as MaterialListResult));

    consumableService = jasmine.createSpyObj<ConsumableService>('ConsumableService', ['refresh']);
    consumableService.refresh.and.returnValue(of({ items: [], total: 0, page: 1, limit: 1000 } as ConsumableListResult));

    await TestBed.configureTestingModule({
      imports: [MaterialConsumption, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: MovementService, useValue: movementService },
        { provide: MaterialService, useValue: materialService },
        { provide: ConsumableService, useValue: consumableService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialConsumption);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should request committed monthly assignments on init', () => {
    const calls = movementService.listRaw.calls.allArgs().map((call) => call[0] as {
      action?: string;
      status?: string;
      toType?: string;
      page?: number;
      limit?: number;
    });

    expect(calls.length).toBe(2);
    expect(calls.every((args) => args.action === 'ASSIGN')).toBeTrue();
    expect(calls.every((args) => args.status === 'COMMITTED')).toBeTrue();
    expect(calls.every((args) => args.toType === 'USER')).toBeTrue();
    expect(calls.every((args) => args.page === 1)).toBeTrue();
    expect(calls.every((args) => args.limit === 1000)).toBeTrue();
  });

  it('should aggregate exact resource labels and ignore canceled movements', () => {
    const items = [
      {
        action: 'ASSIGN',
        status: 'COMMITTED',
        resourceType: 'MATERIAL',
        resourceId: 'pto-1',
        resourceLabel: 'PTO 1',
        quantity: 5,
        toLabel: 'Tech A',
        to: { type: 'USER', id: 'tech-a' }
      },
      {
        action: 'ASSIGN',
        status: 'CANCELED',
        resourceType: 'MATERIAL',
        resourceId: 'pto-1',
        resourceLabel: 'PTO 1',
        quantity: 9,
        toLabel: 'Tech A',
        to: { type: 'USER', id: 'tech-a' }
      },
      {
        action: 'ASSIGN',
        status: 'COMMITTED',
        resourceType: 'CONSUMABLE',
        resourceId: 'jar-1',
        resourceLabel: 'Jarretiere 10m',
        quantity: 2,
        toLabel: 'Tech B',
        to: { type: 'USER', id: 'tech-b' }
      }
    ];

    const rows = (component as any).buildRows(items, [], []);
    const resources = (component as any).buildResourceInsights(items, [], []);

    expect(rows.length).toBe(2);
    expect(rows[0].technician).toBe('Tech A');
    expect(rows[0].totalQty).toBe(5);
    expect(rows[0].topResources[0].label).toBe('PTO 1');
    expect(rows[0].topResources[0].quantity).toBe(5);
    expect(rows[1].technician).toBe('Tech B');
    expect(rows[1].totalQty).toBe(2);
    expect(rows[1].topResources[0].label).toBe('Jarretiere 10m');
    expect(rows[1].topResources[0].quantity).toBe(2);
    expect(resources[0].label).toBe('PTO 1');
    expect(resources[0].quantity).toBe(5);
    expect(resources[1].label).toBe('Jarretiere 10m');
    expect(resources[1].quantity).toBe(2);
  });

  it('should expose the exact resource summary on the card', () => {
    component.resourceInsights.set([
      { label: 'PTO 1', quantity: 29, technicianCount: 2, movementCount: 4 },
      { label: 'Jarretière turquoise 3.5m', quantity: 8, technicianCount: 1, movementCount: 2 },
      { label: 'Malico', quantity: 4, technicianCount: 1, movementCount: 1 }
    ]);

    expect(component.totals().resourceCount).toBe(3);
    expect(component.resourceSummary().topResource?.label).toBe('PTO 1');
    expect(component.resourceSummary().topResources[1].label).toBe('Jarretière turquoise 3.5m');
  });
});
