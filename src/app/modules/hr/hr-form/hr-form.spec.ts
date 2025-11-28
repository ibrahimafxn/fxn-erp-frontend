import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrForm } from './hr-form';

describe('HrForm', () => {
  let component: HrForm;
  let fixture: ComponentFixture<HrForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HrForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
