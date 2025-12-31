import { ComponentFixture, TestBed } from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import { VehicleDetail } from './vehicle-detail';

describe('VehicleDetail', () => {
  let component: VehicleDetail;
  let fixture: ComponentFixture<VehicleDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleDetail, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
