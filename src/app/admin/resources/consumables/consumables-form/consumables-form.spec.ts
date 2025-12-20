import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsumablesForm } from './consumables-form';

describe('ConsumablesForm', () => {
  let component: ConsumablesForm;
  let fixture: ComponentFixture<ConsumablesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumablesForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumablesForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
