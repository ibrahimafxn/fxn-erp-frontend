import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDepots } from './admin-depots';

describe('AdminDepots', () => {
  let component: AdminDepots;
  let fixture: ComponentFixture<AdminDepots>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDepots]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDepots);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
