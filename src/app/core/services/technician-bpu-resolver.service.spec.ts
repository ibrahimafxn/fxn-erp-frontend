import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { TechnicianBpuResolverService, pricesForDate } from './technician-bpu-resolver.service';

describe('TechnicianBpuResolverService', () => {
  let service: TechnicianBpuResolverService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TechnicianBpuResolverService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(TechnicianBpuResolverService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load selections for the requested technician only', () => {
    service.resolve('tech-123').subscribe((state) => {
      expect(state.items.length).toBe(1);
      expect(state.prices.get('RAC_PBO_SOUT')).toBe(120);
    });

    const selectionReq = httpMock.expectOne((req) =>
      req.url === `${environment.apiBaseUrl}/bpu/selections` &&
      req.params.get('owner') === 'tech-123'
    );
    expect(selectionReq.request.method).toBe('GET');
    selectionReq.flush({ success: true, data: [] });

    const historyReq = httpMock.expectOne((req) =>
      req.url === `${environment.apiBaseUrl}/bpu/price-history` &&
      req.params.get('owner') === 'tech-123'
    );
    expect(historyReq.request.method).toBe('GET');
    historyReq.flush({ success: true, data: [] });

    const effectiveReq = httpMock.expectOne(`${environment.apiBaseUrl}/technicians/tech-123/effective-bpu`);
    expect(effectiveReq.request.method).toBe('GET');
    effectiveReq.flush({
      success: true,
      data: [
        {
          prestationId: 'p1',
          code: 'RAC_PBO_SOUT',
          libelle: 'Raccord PBO Souterrain',
          segment: 'SALARIE',
          prixUnitaire: 120,
          compteDansCa: true,
          compteDansAttachement: true,
          coefficientCa: 1,
          coefficientAttachement: 1,
          ordreAffichage: 1,
          source: 'OVERRIDE'
        }
      ]
    });
  });

  it('should prefer the current historical snapshot over a stale effective price', () => {
    service.resolve('tech-456').subscribe((state) => {
      expect(state.items[0]?.unitPrice).toBe(145);
      expect(state.prices.get('RAC_PBO_SOUT')).toBe(145);
    });

    const selectionReq = httpMock.expectOne((req) =>
      req.url === `${environment.apiBaseUrl}/bpu/selections` &&
      req.params.get('owner') === 'tech-456'
    );
    selectionReq.flush({ success: true, data: [] });

    const historyReq = httpMock.expectOne((req) =>
      req.url === `${environment.apiBaseUrl}/bpu/price-history` &&
      req.params.get('owner') === 'tech-456'
    );
    historyReq.flush({
      success: true,
      data: [
        {
          _id: 'hist-1',
          owner: 'tech-456',
          type: 'PERSONNALISE',
          validFrom: '2026-04-22T08:00:00.000Z',
          prestations: [{ code: 'RAC_PBO_SOUT', unitPrice: 145 }]
        }
      ]
    });

    const effectiveReq = httpMock.expectOne(`${environment.apiBaseUrl}/technicians/tech-456/effective-bpu`);
    effectiveReq.flush({
      success: true,
      data: [
        {
          prestationId: 'p1',
          code: 'RAC_PBO_SOUT',
          libelle: 'Raccord PBO Souterrain',
          segment: 'SALARIE',
          prixUnitaire: 120,
          compteDansCa: true,
          compteDansAttachement: true,
          coefficientCa: 1,
          coefficientAttachement: 1,
          ordreAffichage: 1,
          source: 'OVERRIDE'
        }
      ]
    });
  });

  it('should apply same-day history snapshots to day-based report dates', () => {
    const fallback = new Map<string, number>([['RAC_PBO_SOUT', 90]]);
    const history = [
      {
        type: 'PERSONNALISE',
        validFrom: '2026-04-22T10:30:00.000Z',
        prestations: [{ code: 'RAC_PBO_SOUT', unitPrice: 120 }]
      },
      {
        type: 'PERSONNALISE',
        validFrom: '2026-04-10T00:00:00.000Z',
        prestations: [{ code: 'RAC_PBO_SOUT', unitPrice: 80 }]
      }
    ];

    const prices = pricesForDate(history, '2026-04-22', fallback);

    expect(prices.get('RAC_PBO_SOUT')).toBe(120);
  });
});
