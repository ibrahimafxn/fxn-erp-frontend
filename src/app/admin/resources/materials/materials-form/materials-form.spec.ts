import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialsForm } from './materials-form';

describe('MaterialsForm', () => {
  let component: MaterialsForm;
  let fixture: ComponentFixture<MaterialsForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialsForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialsForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
