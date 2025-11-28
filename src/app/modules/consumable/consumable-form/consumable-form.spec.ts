import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsumableForm } from './consumable-form';

describe('ConsumableForm', () => {
  let component: ConsumableForm;
  let fixture: ComponentFixture<ConsumableForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumableForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumableForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
