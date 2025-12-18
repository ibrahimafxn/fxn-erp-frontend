import {ComponentFixture, TestBed} from '@angular/core/testing';

import {DepotDashboard} from './depot-dashboard';

describe('DepotDashboard', () => {
  let component: DepotDashboard;
  let fixture: ComponentFixture<DepotDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotDashboard]
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
