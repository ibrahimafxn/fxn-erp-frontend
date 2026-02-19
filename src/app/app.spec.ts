import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {signal} from '@angular/core';
import {App} from './app';
import {AuthService} from './core/services/auth.service';
import {Role} from './core/models/roles.model';

describe('App', () => {
  beforeEach(async () => {
    const mockAuth = {
      user$: signal({ _id: '1', firstName: 'Test', email: 'test@test.local', role: Role.ADMIN }),
      getUserRole: () => Role.ADMIN
    };
    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: mockAuth }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render header shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
  });
});
