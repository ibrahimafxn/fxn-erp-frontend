import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {VehicleForm} from './vehicle-form';

describe('VehicleForm', () => {
  let component: VehicleForm;
  let fixture: ComponentFixture<VehicleForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleForm, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
