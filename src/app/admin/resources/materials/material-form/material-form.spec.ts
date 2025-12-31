import { ComponentFixture, TestBed } from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import { MaterialForm } from './material-form';

describe('MaterialForm', () => {
  let component: MaterialForm;
  let fixture: ComponentFixture<MaterialForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialForm, HttpClientTestingModule, RouterTestingModule]
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
