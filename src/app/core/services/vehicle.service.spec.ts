import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VehicleService } from './vehicle.service';
import { environment } from '../../environments/environment';
import { Vehicle, VehicleListResult } from '../models';

describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;

  const mockVehicle: Vehicle = {
    _id: 'veh1',
    vin: 'VIN123456789',
    plateNumber: 'AB-123-CD',
    brand: 'Renault',
    model: 'Kangoo',
    year: 2022,
    state: 'AVAILABLE',
    idDepot: 'depot1'
  };

  const mockVehicleList: VehicleListResult = {
    total: 2,
    page: 1,
    limit: 25,
    items: [mockVehicle, { ...mockVehicle, _id: 'veh2', plateNumber: 'EF-456-GH' }]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VehicleService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('refresh', () => {
    it('should fetch vehicles from API', () => {
      service.refresh().subscribe(result => {
        expect(result.total).toBe(2);
        expect(result.items.length).toBe(2);
      });

      const req = httpMock.expectOne(req => req.url === `${environment.apiBaseUrl}/vehicles`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockVehicleList });
    });

    it('should apply filters to request params', () => {
      const filter = { q: 'kangoo', depot: 'depot1', page: 2, limit: 10 };

      service.refresh(true, filter).subscribe();

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/vehicles` &&
        req.params.get('q') === 'kangoo' &&
        req.params.get('idDepot') === 'depot1' &&
        req.params.get('page') === '2' &&
        req.params.get('limit') === '10'
      );

      req.flush({ success: true, data: mockVehicleList });
    });

    it('should handle array response format', () => {
      service.refresh().subscribe(result => {
        expect(result.items.length).toBe(2);
      });

      const req = httpMock.expectOne(req => req.url === `${environment.apiBaseUrl}/vehicles`);
      // Backend returns array directly
      req.flush([mockVehicle, { ...mockVehicle, _id: 'veh2' }]);
    });

    it('should use cache when not forcing', () => {
      service.refresh().subscribe();
      const req1 = httpMock.expectOne(req => req.url === `${environment.apiBaseUrl}/vehicles`);
      req1.flush({ success: true, data: mockVehicleList });

      service.refresh(false).subscribe();
      httpMock.expectNone(`${environment.apiBaseUrl}/vehicles`);
    });
  });

  describe('getById', () => {
    it('should fetch single vehicle by ID', () => {
      service.getById('veh1').subscribe(vehicle => {
        expect(vehicle._id).toBe('veh1');
        expect(vehicle.plateNumber).toBe('AB-123-CD');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockVehicle });
    });

    it('should normalize plate to plateNumber', () => {
      service.getById('veh1').subscribe(vehicle => {
        expect(vehicle.plateNumber).toBe('XY-999-ZZ');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1`);
      // Backend uses 'plate' instead of 'plateNumber'
      req.flush({ success: true, data: { ...mockVehicle, plate: 'XY-999-ZZ', plateNumber: undefined } });
    });
  });

  describe('create', () => {
    it('should send POST request with vehicle data', () => {
      const newVehicle = { vin: 'NEWVIN123', plateNumber: 'NEW-123', brand: 'Peugeot' };

      service.create(newVehicle).subscribe(vehicle => {
        expect(vehicle.vin).toBe('NEWVIN123');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newVehicle);

      req.flush({ success: true, data: { ...newVehicle, _id: 'veh3' } });
    });
  });

  describe('update', () => {
    it('should send PUT request with updated data', () => {
      const updates = { brand: 'Citroën' };

      service.update('veh1', updates).subscribe(vehicle => {
        expect(vehicle.brand).toBe('Citroën');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updates);

      req.flush({ success: true, data: { ...mockVehicle, ...updates } });
    });
  });

  describe('remove', () => {
    it('should send DELETE request', () => {
      service.remove('veh1').subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1`);
      expect(req.request.method).toBe('DELETE');

      req.flush({ _id: 'veh1' });
    });
  });

  describe('history', () => {
    it('should fetch vehicle history with pagination', () => {
      const mockHistory = { total: 5, page: 1, limit: 25, items: [] };

      service.history('veh1', 1, 25).subscribe(result => {
        expect(result.total).toBe(5);
      });

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/vehicles/veh1/history` &&
        req.params.get('page') === '1' &&
        req.params.get('limit') === '25'
      );

      req.flush({ success: true, data: mockHistory });
    });
  });

  describe('breakdowns', () => {
    it('should fetch vehicle breakdowns', () => {
      const mockBreakdowns = { total: 2, page: 1, limit: 25, items: [] };

      service.breakdowns('veh1').subscribe(result => {
        expect(result.total).toBe(2);
      });

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/vehicles/veh1/breakdowns`
      );

      req.flush({ success: true, data: mockBreakdowns });
    });
  });

  describe('assignVehicle', () => {
    it('should send PUT request to assign vehicle to technician', () => {
      const payload = { techId: 'tech123', note: 'Assignment note' };

      service.assignVehicle('veh1', payload).subscribe(vehicle => {
        expect(vehicle._id).toBe('veh1');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1/assign`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true, data: mockVehicle });
    });
  });

  describe('releaseVehicle', () => {
    it('should send PUT request to release vehicle to depot', () => {
      const payload = { depotId: 'depot1', note: 'Release note' };

      service.releaseVehicle('veh1', payload).subscribe(vehicle => {
        expect(vehicle._id).toBe('veh1');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1/release`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true, data: mockVehicle });
    });
  });

  describe('declareBreakdown', () => {
    it('should send POST request to declare breakdown', () => {
      const payload = {
        problemType: 'ENGINE',
        needsTow: true,
        repairMode: 'GARAGE' as const,
        garageName: 'Garage Test',
        address: '123 Rue Panne'
      };

      service.declareBreakdown('veh1', payload).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1/breakdowns`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true, data: {} });
    });
  });

  describe('resolveBreakdown', () => {
    it('should send PUT request to resolve breakdown', () => {
      const payload = {
        resolvedAt: '2024-01-15T10:00:00Z',
        resolvedCost: 500,
        resolvedNote: 'Réparation effectuée'
      };

      service.resolveBreakdown('veh1', 'breakdown1', payload).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/veh1/breakdowns/breakdown1/resolve`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true, data: {} });
    });
  });

  describe('export functions', () => {
    it('should export CSV', () => {
      service.exportCsv({ q: 'test' }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/vehicles/export` &&
        req.params.get('q') === 'test'
      );
      expect(req.request.responseType).toBe('blob');

      req.flush(new Blob(['csv data'], { type: 'text/csv' }));
    });

    it('should export PDF', () => {
      service.exportPdf().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/vehicles/export/pdf`);
      expect(req.request.responseType).toBe('blob');

      req.flush(new Blob(['pdf data'], { type: 'application/pdf' }));
    });
  });

  describe('alerts', () => {
    it('should fetch vehicle alerts', () => {
      service.alerts({ depot: 'depot1' }).subscribe(result => {
        expect(result.total).toBe(2);
      });

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/vehicles/alerts` &&
        req.params.get('depot') === 'depot1'
      );

      req.flush({ success: true, data: mockVehicleList });
    });
  });

  describe('clearCache', () => {
    it('should clear the cached request', () => {
      service.refresh().subscribe();
      const req1 = httpMock.expectOne(req => req.url === `${environment.apiBaseUrl}/vehicles`);
      req1.flush({ success: true, data: mockVehicleList });

      service.clearCache();

      service.refresh().subscribe();
      const req2 = httpMock.expectOne(req => req.url === `${environment.apiBaseUrl}/vehicles`);
      req2.flush({ success: true, data: mockVehicleList });
    });
  });
});
