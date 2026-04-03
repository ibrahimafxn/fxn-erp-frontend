import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DepotService } from './depot.service';
import { environment } from '../../environments/environment';

describe('DepotService', () => {
  let service: DepotService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DepotService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(DepotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request depots list with filters', () => {
    service.refreshDepots(true, { q: 'central', page: 2, limit: 10 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/depots`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('central');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush({ success: true, data: { items: [], total: 0 } });
  });

  it('should create depot', () => {
    service.createDepot({ name: 'Depot A' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: { _id: '1', name: 'Depot A' } });
  });

  it('should update depot', () => {
    service.updateDepot('123', { name: 'Depot B' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/123`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: { _id: '123', name: 'Depot B' } });
  });

  it('should delete depot', () => {
    service.deleteDepot('123').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/123`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });
  });

  it('should request depot stats', () => {
    service.getDepotStats('d1').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/d1/stats`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: {} });
  });

  it('should transfer stock via depot transfer endpoint', () => {
    service.transferStock({
      fromDepot: 'from1',
      toDepot: 'to1',
      resourceType: 'MATERIAL',
      resourceId: 'r1',
      quantity: 2
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/from1/transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.toDepot).toBe('to1');
    req.flush({ success: true, data: {} });
  });
});
