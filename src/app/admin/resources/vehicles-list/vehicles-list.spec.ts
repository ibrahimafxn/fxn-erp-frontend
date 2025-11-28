import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehiclesList } from './vehicles-list';

describe('VehiclesList', () => {
  let component: VehiclesList;
  let fixture: ComponentFixture<VehiclesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehiclesList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehiclesList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
