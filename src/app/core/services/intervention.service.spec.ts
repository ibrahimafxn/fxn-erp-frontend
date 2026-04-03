import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InterventionService } from './intervention.service';
import { environment } from '../../environments/environment';

describe('InterventionService', () => {
  let service: InterventionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InterventionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(InterventionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request summary with filters and no-cache headers', () => {
    service.summary({ fromDate: '2024-01-01', toDate: '2024-01-31', page: 1, limit: 20 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/interventions/summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('fromDate')).toBe('2024-01-01');
    expect(req.request.params.get('toDate')).toBe('2024-01-31');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');

    req.flush({ success: true, data: { items: [], total: 0 } });
  });

  it('should list interventions', () => {
    service.list({ status: 'DONE', page: 2, limit: 10 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/interventions/list`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('DONE');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush({ success: true, data: { items: [], total: 0 } });
  });

  it('should export interventions csv', () => {
    service.exportCsv({ client: 'ClientA' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/interventions/export/csv`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('client')).toBe('ClientA');
    expect(req.request.responseType).toBe('blob');

    req.flush(new Blob());
  });

  it('should export interventions pdf', () => {
    service.exportPdf({ region: 'Nord' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/interventions/export/pdf`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('region')).toBe('Nord');
    expect(req.request.responseType).toBe('blob');

    req.flush(new Blob());
  });
});
