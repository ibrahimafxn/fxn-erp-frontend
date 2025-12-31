import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {Router} from '@angular/router';
import {AuthInterceptor} from './auth.interceptor';
import {AuthService} from '../services/auth.service';

describe('AuthInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthInterceptor,
        {
          provide: AuthService,
          useValue: {
            getAccessToken: jasmine.createSpy('getAccessToken'),
            refreshToken: jasmine.createSpy('refreshToken'),
            logout: jasmine.createSpy('logout')
          }
        },
        { provide: Router, useValue: { parseUrl: jasmine.createSpy('parseUrl') } }
      ]
    });
  });

  it('should be created', () => {
    const interceptor = TestBed.inject(AuthInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
