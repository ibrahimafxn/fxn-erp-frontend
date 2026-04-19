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
});
