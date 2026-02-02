import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DepotService } from './depot.service';
import { environment } from '../../environments/environment';
import { Depot } from '../models';
import { DepotListResult } from '../models/depot-list-result.model';

describe('DepotService', () => {
  let service: DepotService;
  let httpMock: HttpTestingController;

  const mockDepot: Depot = {
    _id: 'depot1',
    name: 'Dépôt Principal',
    address: '123 Rue Test',
    city: 'Paris',
    manager: null
  };

  const mockDepotList: DepotListResult = {
    total: 2,
    page: 1,
    limit: 25,
    items: [mockDepot, { ...mockDepot, _id: 'depot2', name: 'Dépôt Secondaire' }]
  };

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

  describe('refreshDepots', () => {
    it('should fetch depots from API', () => {
      service.refreshDepots().subscribe(result => {
        expect(result.total).toBe(2);
        expect(result.items.length).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockDepotList });
    });

    it('should apply filters to request params', () => {
      const filter = { q: 'principal', page: 2, limit: 10 };

      service.refreshDepots(true, filter).subscribe();

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/depots` &&
        req.params.get('q') === 'principal' &&
        req.params.get('page') === '2' &&
        req.params.get('limit') === '10'
      );

      req.flush({ success: true, data: mockDepotList });
    });

    it('should update result signal after fetch', () => {
      service.refreshDepots().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req.flush({ success: true, data: mockDepotList });

      const result = service.result();
      expect(result?.total).toBe(2);
    });

    it('should use cache when not forcing', () => {
      // First request
      service.refreshDepots().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req1.flush({ success: true, data: mockDepotList });

      // Second request without force - should use cache
      service.refreshDepots(false).subscribe();
      httpMock.expectNone(`${environment.apiBaseUrl}/depots`);
    });

    it('should make new request when forcing', () => {
      // First request
      service.refreshDepots().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req1.flush({ success: true, data: mockDepotList });

      // Second request with force
      service.refreshDepots(true).subscribe();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req2.flush({ success: true, data: mockDepotList });
    });
  });

  describe('getDepot', () => {
    it('should fetch single depot by ID', () => {
      service.getDepot('depot1').subscribe(depot => {
        expect(depot._id).toBe('depot1');
        expect(depot.name).toBe('Dépôt Principal');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockDepot });
    });

    it('should handle error when depot not found', () => {
      let errorThrown = false;

      service.getDepot('unknown').subscribe({
        error: () => { errorThrown = true; }
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/unknown`);
      req.error(new ErrorEvent('Not found'), { status: 404 });

      expect(errorThrown).toBeTrue();
    });
  });

  describe('createDepot', () => {
    it('should send POST request with depot data', () => {
      const newDepot = { name: 'Nouveau Dépôt', address: '456 Rue Nouvelle' };

      service.createDepot(newDepot).subscribe(response => {
        expect(response.body?.success).toBeTrue();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newDepot);

      req.flush({ success: true, data: { ...newDepot, _id: 'depot3' } });
    });
  });

  describe('updateDepot', () => {
    it('should send PUT request with updated data', () => {
      const updates = { name: 'Dépôt Renommé' };

      service.updateDepot('depot1', updates).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updates);

      req.flush({ success: true, data: { ...mockDepot, ...updates } });
    });
  });

  describe('deleteDepot', () => {
    it('should send DELETE request', () => {
      service.deleteDepot('depot1').subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1`);
      expect(req.request.method).toBe('DELETE');

      req.flush({ success: true, data: { _id: 'depot1' } });
    });
  });

  describe('assignManager', () => {
    it('should send POST request to assign manager', () => {
      service.assignManager('depot1', 'user123').subscribe(depot => {
        expect(depot.manager).toBe('user123');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1/assign-manager`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ managerId: 'user123' });

      req.flush({ success: true, data: { ...mockDepot, manager: 'user123' } });
    });

    it('should allow removing manager with null', () => {
      service.assignManager('depot1', null).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1/assign-manager`);
      expect(req.request.body).toEqual({ managerId: null });

      req.flush({ success: true, data: { ...mockDepot, manager: null } });
    });
  });

  describe('getDepotStats', () => {
    it('should fetch depot statistics', () => {
      const mockStats = { materials: 10, consumables: 25, vehicles: 5 };

      service.getDepotStats('depot1').subscribe(stats => {
        expect(stats).toEqual(mockStats);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1/stats`);
      expect(req.request.method).toBe('GET');

      req.flush({ success: true, data: mockStats });
    });
  });

  describe('transferStock', () => {
    it('should send POST request for stock transfer', () => {
      const payload = {
        fromDepot: 'depot1',
        toDepot: 'depot2',
        resourceType: 'MATERIAL' as const,
        resourceId: 'mat123',
        quantity: 5,
        note: 'Transfer note'
      };

      service.transferStock(payload).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/depots/depot1/transfer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        toDepot: 'depot2',
        resourceType: 'MATERIAL',
        resourceId: 'mat123',
        quantity: 5,
        note: 'Transfer note'
      });

      req.flush({ success: true, data: {} });
    });
  });

  describe('clearCache', () => {
    it('should clear the cached requests', () => {
      // First request - creates cache
      service.refreshDepots().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req1.flush({ success: true, data: mockDepotList });

      // Clear cache
      service.clearCache();

      // Next request should hit API again
      service.refreshDepots().subscribe();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/depots`);
      req2.flush({ success: true, data: mockDepotList });
    });
  });
});
