import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialForm } from './material-form';

describe('MaterialForm', () => {
  let component: MaterialForm;
  let fixture: ComponentFixture<MaterialForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
