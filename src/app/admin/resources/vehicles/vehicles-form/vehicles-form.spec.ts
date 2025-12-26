import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehiclesForm } from './vehicles-form';

describe('VehiclesForm', () => {
  let component: VehiclesForm;
  let fixture: ComponentFixture<VehiclesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehiclesForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehiclesForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
