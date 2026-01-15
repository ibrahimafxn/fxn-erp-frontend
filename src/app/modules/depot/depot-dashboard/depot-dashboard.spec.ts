import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {DepotDashboard} from './depot-dashboard';

describe('DepotDashboard', () => {
  let component: DepotDashboard;
  let fixture: ComponentFixture<DepotDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotDashboard, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepotDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
