import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehiclesDetail } from './vehicles-detail';

describe('VehiclesDetail', () => {
  let component: VehiclesDetail;
  let fixture: ComponentFixture<VehiclesDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehiclesDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehiclesDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
