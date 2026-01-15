import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {HrForm} from './hr-form';

describe('HrForm', () => {
  let component: HrForm;
  let fixture: ComponentFixture<HrForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrForm, HttpClientTestingModule, RouterTestingModule]
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
