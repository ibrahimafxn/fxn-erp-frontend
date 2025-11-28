import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepotForm } from './depot-form';

describe('DepotForm', () => {
  let component: DepotForm;
  let fixture: ComponentFixture<DepotForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepotForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
