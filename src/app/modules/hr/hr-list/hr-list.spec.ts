import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrList } from './hr-list';

describe('HrList', () => {
  let component: HrList;
  let fixture: ComponentFixture<HrList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HrList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
