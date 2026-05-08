import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {Dashboard} from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prioritize audit risk using weighted score instead of raw rate only', () => {
    component.auditItems.set([
      {
        technician: 'Tech Volume',
        region: 'Nord',
        nbTotal: 12,
        txEchecGlobal: 25,
        echecs: [{ motifEchec: 'PBO' }, { motifEchec: 'PTO' }, { motifEchec: 'Client absent' }]
      },
      {
        technician: 'Tech Isolé',
        region: 'Sud',
        nbTotal: 2,
        txEchecGlobal: 50,
        echecs: [{ motifEchec: 'Adresse' }]
      }
    ]);

    const insight = component.auditInsight();

    expect(insight.riskiestTechnician).toBe('Tech Volume');
    expect(insight.riskiestFailures).toBe(3);
    expect(insight.riskiestScore).toBeGreaterThan(0);
    expect(insight.riskiestRegion).toBe('Nord');
  });

  it('should aggregate monthly material attributions and ignore canceled movements', () => {
    const insight = (component as any).buildMaterialInsight([
      {
        action: 'ASSIGN',
        status: 'COMMITTED',
        quantity: 5,
        toLabel: 'Tech A',
        resourceLabel: 'PTO 1',
        resourceId: 'pto-1'
      },
      {
        action: 'ASSIGN',
        status: 'CANCELED',
        quantity: 9,
        toLabel: 'Tech A',
        resourceLabel: 'PTO 1',
        resourceId: 'pto-1'
      },
      {
        action: 'ASSIGN',
        status: 'COMMITTED',
        quantity: 2,
        toLabel: 'Tech B',
        resourceLabel: 'Jarretiere 10m',
        resourceId: 'jar-1'
      }
    ]);

    expect(insight.totalQty).toBe(7);
    expect(insight.technicianCount).toBe(2);
    expect(insight.resourceCount).toBe(2);
    expect(insight.topTechnician).toBe('Tech A');
    expect(insight.topTechnicianQty).toBe(5);
    expect(insight.topResources[0].label).toBe('PTO 1');
    expect(insight.topResources[0].quantity).toBe(5);
    expect(insight.topResources[1].label).toBe('Jarretiere 10m');
    expect(insight.topResources[1].quantity).toBe(2);
  });

  it('should expose the monthly material KPI on the dashboard card', () => {
    component.materialInsight.set({
      totalQty: 42,
      technicianCount: 3,
      resourceCount: 2,
      topTechnician: 'Heidi Hamou',
      topTechnicianQty: 29,
      topResources: [
        { label: 'PTO 1', quantity: 29, technicianCount: 2, movementCount: 4 },
        { label: 'Jarretière turquoise 3.5m', quantity: 8, technicianCount: 1, movementCount: 2 }
      ]
    });

    const card = component.moduleCards().find((item) => item.key === 'materials');

    expect(card?.metric).toBe('42 unités attribuées ce mois');
    expect(card?.detail).toContain('Heidi Hamou');
    expect(card?.detail).toContain('3 technicien(s) concernés');
    expect(card?.detail).toContain('PTO 1');
    expect(card?.detail).toContain('Jarretière turquoise 3.5m');
  });
});
