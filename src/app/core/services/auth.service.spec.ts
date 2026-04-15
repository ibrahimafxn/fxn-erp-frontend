import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService, AuthUser, LoginResponse } from './auth.service';
import { environment } from '../../environments/environment';
import { Role } from '../models/roles.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockUser: AuthUser = {
    _id: '123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: Role.ADMIN
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'test-access-token',
    user: mockUser,
    csrfToken: 'test-csrf-token'
  };

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should return true after successful login', () => {
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
      req.flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe('login', () => {
    it('should send POST request with credentials', () => {
      const credentials = { email: 'test@test.com', password: 'password' };

      service.login(credentials).subscribe(response => {
        expect(response.accessToken).toBe('test-access-token');
        expect(response.user).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      expect(req.request.withCredentials).toBeTrue();

      req.flush(mockLoginResponse);
    });

    it('should persist token and user after successful login', () => {
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
      req.flush(mockLoginResponse);

      expect(service.getAccessToken()).toBe('test-access-token');
      expect(service.getCurrentUser()).toEqual(mockUser);
      expect(localStorage.getItem('fxn_access_token')).toBe('test-access-token');
    });

    it('should handle MFA required response', () => {
      const mfaResponse: LoginResponse = { mfaRequired: true, message: 'MFA code required' };

      service.login({ email: 'test@test.com', password: 'password' }).subscribe(response => {
        expect(response.mfaRequired).toBeTrue();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
      req.flush(mfaResponse);

      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('logout', () => {
    it('should clear tokens and user data', () => {
      // First login
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(mockLoginResponse);

      // Then logout
      service.logout(false);

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      req.flush({});

      expect(service.getAccessToken()).toBeNull();
      expect(service.getCurrentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should redirect to login when redirect is true', () => {
      service.logout(true);

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      req.flush({});

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should handle logout error gracefully', () => {
      service.logout(false);

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      req.error(new ErrorEvent('Network error'));

      // Should still clear local data
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('hasRole', () => {
    beforeEach(() => {
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(mockLoginResponse);
    });

    it('should return true when user has the specified role', () => {
      expect(service.hasRole([Role.ADMIN])).toBeTrue();
    });

    it('should return true when user has one of the specified roles', () => {
      expect(service.hasRole([Role.TECHNICIEN, Role.ADMIN, Role.DIRIGEANT])).toBeTrue();
    });

    it('should return false when user does not have the specified role', () => {
      expect(service.hasRole([Role.TECHNICIEN])).toBeFalse();
    });

    it('should return false when no user is logged in', () => {
      service.logout(false);
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush({});

      expect(service.hasRole([Role.ADMIN])).toBeFalse();
    });
  });

  describe('getUserRole', () => {
    it('should return null when no user is logged in', () => {
      expect(service.getUserRole()).toBeNull();
    });

    it('should return user role when logged in', () => {
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(mockLoginResponse);

      expect(service.getUserRole()).toBe(Role.ADMIN);
    });
  });

  describe('refreshToken', () => {
    it('should send POST request to refresh endpoint', () => {
      const refreshResponse: LoginResponse = {
        accessToken: 'new-access-token',
        user: mockUser
      };

      service.refreshToken().subscribe(result => {
        expect(result).toBeUndefined();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();

      req.flush(refreshResponse);
      expect(service.getAccessToken()).toBe('new-access-token');
    });

    it('should update access token after refresh', () => {
      const refreshResponse: LoginResponse = {
        accessToken: 'new-access-token',
        user: mockUser
      };

      service.refreshToken().subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
      req.flush(refreshResponse);

      expect(service.getAccessToken()).toBe('new-access-token');
    });

    it('should handle refresh error', () => {
      let errorThrown = false;

      service.refreshToken().subscribe({
        error: () => { errorThrown = true; }
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
      req.error(new ErrorEvent('Network error'), { status: 401 });

      expect(errorThrown).toBeTrue();
    });
  });

  describe('changePassword', () => {
    it('should send POST request to change-password endpoint', () => {
      const payload = {
        email: 'test@test.com',
        currentPassword: 'oldPass',
        newPassword: 'newPass'
      };

      service.changePassword(payload).subscribe(response => {
        expect(response.success).toBeTrue();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/change-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);

      req.flush({ success: true });
    });
  });

  describe('updateCurrentUser', () => {
    beforeEach(() => {
      service.login({ email: 'test@test.com', password: 'password' }).subscribe();
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(mockLoginResponse);
    });

    it('should update user properties', () => {
      service.updateCurrentUser({ firstName: 'Jane' });

      const user = service.getCurrentUser();
      expect(user?.firstName).toBe('Jane');
      expect(user?.lastName).toBe('Doe'); // unchanged
    });

    it('should do nothing when no user is logged in', () => {
      service.logout(false);
      httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush({});

      service.updateCurrentUser({ firstName: 'Jane' });

      expect(service.getCurrentUser()).toBeNull();
    });
  });
});
