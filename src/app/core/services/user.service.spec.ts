import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { User, UserListResult } from '../models';
import { environment } from '../../environments/environment';
import { Role } from '../models/roles.model';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const mockUser: User = {
    _id: '123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: Role.TECHNICIEN,
    phone: '0612345678'
  };

  const mockUserList: UserListResult = {
    total: 2,
    page: 1,
    limit: 25,
    items: [mockUser, { ...mockUser, _id: '456', firstName: 'Jane' }]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('refreshUsers', () => {
    it('should fetch users from API', () => {
      service.refreshUsers().subscribe(result => {
        expect(result.total).toBe(2);
        expect(result.items.length).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockUserList });
    });

    it('should apply filters to request params', () => {
      const filter = { q: 'john', role: 'ADMIN', depot: 'depot1', page: 2, limit: 10 };

      service.refreshUsers(true, filter).subscribe();

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/users` &&
        req.params.get('q') === 'john' &&
        req.params.get('role') === 'ADMIN' &&
        req.params.get('depot') === 'depot1' &&
        req.params.get('page') === '2' &&
        req.params.get('limit') === '10'
      );

      req.flush({ success: true, data: mockUserList });
    });

    it('should update meta signal after fetch', () => {
      service.refreshUsers().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req.flush({ success: true, data: mockUserList });

      const meta = service.meta();
      expect(meta?.total).toBe(2);
      expect(meta?.page).toBe(1);
      expect(meta?.limit).toBe(25);
    });

    it('should set loading signal during request', () => {
      expect(service.loading()).toBeFalse();

      service.refreshUsers().subscribe();
      // Loading should be true during request
      
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req.flush({ success: true, data: mockUserList });

      expect(service.loading()).toBeFalse();
    });

    it('should use cached request when not forcing', () => {
      // First request
      service.refreshUsers().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req1.flush({ success: true, data: mockUserList });

      // Second request without force - should use cache
      service.refreshUsers(false).subscribe();
      httpMock.expectNone(`${environment.apiBaseUrl}/users`);
    });

    it('should make new request when forcing', () => {
      // First request
      service.refreshUsers().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req1.flush({ success: true, data: mockUserList });

      // Second request with force
      service.refreshUsers(true).subscribe();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req2.flush({ success: true, data: mockUserList });
    });
  });

  describe('getUser', () => {
    it('should fetch single user by ID', () => {
      service.getUser('123').subscribe(user => {
        expect(user._id).toBe('123');
        expect(user.firstName).toBe('John');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockUser });
    });

    it('should handle error when user not found', () => {
      let errorThrown = false;

      service.getUser('999').subscribe({
        error: () => { errorThrown = true; }
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/999`);
      req.flush({ success: false, message: 'User not found' }, { status: 404, statusText: 'Not Found' });

      expect(errorThrown).toBeTrue();
    });
  });

  describe('createUser', () => {
    it('should send POST request with user data', () => {
      const newUser = { firstName: 'New', lastName: 'User', email: 'new@test.com', role: Role.TECHNICIEN };

      service.createUser(newUser).subscribe(user => {
        expect(user.firstName).toBe('New');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newUser);

      req.flush({ success: true, data: { ...newUser, _id: '789' } });

      // Should trigger refresh
      const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      refreshReq.flush({ success: true, data: mockUserList });
    });
  });

  describe('updateUser', () => {
    it('should send PUT request with updated data', () => {
      const updates = { firstName: 'Updated' };

      service.updateUser('123', updates).subscribe(user => {
        expect(user.firstName).toBe('Updated');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updates);

      req.flush({ success: true, data: { ...mockUser, ...updates } });

      // Should trigger refresh
      const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      refreshReq.flush({ success: true, data: mockUserList });
    });
  });

  describe('deleteUser', () => {
    it('should send DELETE request', () => {
      service.deleteUser('123').subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123`);
      expect(req.request.method).toBe('DELETE');

      req.flush({ success: true, data: { _id: '123' } });

      // Should trigger refresh
      const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      refreshReq.flush({ success: true, data: mockUserList });
    });
  });

  describe('changePassword', () => {
    it('should send PUT request to password endpoint', () => {
      service.changePassword('123', 'newPassword123').subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123/password`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ password: 'newPassword123' });

      req.flush({ success: true, data: {} });
    });
  });

  describe('setAccess', () => {
    it('should send PUT request to access endpoint', () => {
      const payload = { password: 'secret123', mustChangePassword: true };

      service.setAccess('123', payload).subscribe(response => {
        expect(response.success).toBeTrue();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123/access`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true, data: { _id: '123', authEnabled: true, mustChangePassword: true } });
    });
  });

  describe('disableAccess', () => {
    it('should send PUT request to disable-access endpoint', () => {
      service.disableAccess('123').subscribe(response => {
        expect(response.data.authEnabled).toBeFalse();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/123/disable-access`);
      expect(req.request.method).toBe('PUT');

      req.flush({ success: true, data: { _id: '123', authEnabled: false } });
    });
  });

  describe('export functions', () => {
    it('should export CSV with filters', () => {
      const filter = { q: 'test', role: 'ADMIN' };

      service.exportCsv(filter).subscribe();

      const req = httpMock.expectOne(req =>
        req.url === `${environment.apiBaseUrl}/users/export/csv` &&
        req.params.get('q') === 'test' &&
        req.params.get('role') === 'ADMIN'
      );
      expect(req.request.responseType).toBe('blob');

      req.flush(new Blob(['csv data'], { type: 'text/csv' }));
    });

    it('should export PDF', () => {
      service.exportPdf().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/export/pdf`);
      expect(req.request.responseType).toBe('blob');

      req.flush(new Blob(['pdf data'], { type: 'application/pdf' }));
    });

    it('should export XLSX', () => {
      service.exportXlsx().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users/export/xlsx`);
      expect(req.request.responseType).toBe('blob');

      req.flush(new Blob(['xlsx data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    });
  });

  describe('clearCache', () => {
    it('should clear the cached request', () => {
      // First request - creates cache
      service.refreshUsers().subscribe();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req1.flush({ success: true, data: mockUserList });

      // Clear cache
      service.clearCache();

      // Next request should hit API again
      service.refreshUsers().subscribe();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req2.flush({ success: true, data: mockUserList });
    });
  });
});
