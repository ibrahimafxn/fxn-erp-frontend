import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MovementService } from './movement.service';
import { environment } from '../../environments/environment';

describe('MovementService', () => {
  let service: MovementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MovementService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(MovementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list movements with filters', () => {
    service.listMovements(true, { resourceType: 'MATERIAL', page: 2, limit: 5 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/movements`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('resourceType')).toBe('MATERIAL');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');

    req.flush({ success: true, data: { items: [], total: 0 } });
  });

  it('should export movements csv', () => {
    service.exportCsv({ action: 'SORTIE' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/movements/export`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('action')).toBe('SORTIE');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('should export movements pdf', () => {
    service.exportPdf({ status: 'VALIDATED' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/movements/export/pdf`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('VALIDATED');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('should cancel a movement', () => {
    service.cancel('m1', 'Erreur').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/movements/m1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('Erreur');
    req.flush({ success: true, data: { _id: 'm1' } });
  });
});
