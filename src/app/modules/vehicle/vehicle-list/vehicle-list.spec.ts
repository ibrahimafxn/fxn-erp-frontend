import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleList } from './vehicle-list';

describe('VehicleList', () => {
  let component: VehicleList;
  let fixture: ComponentFixture<VehicleList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
