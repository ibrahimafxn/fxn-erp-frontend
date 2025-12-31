import { ComponentFixture, TestBed } from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import { ConsumablesForm } from './consumables-form';

describe('ConsumablesForm', () => {
  let component: ConsumablesForm;
  let fixture: ComponentFixture<ConsumablesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumablesForm, HttpClientTestingModule, RouterTestingModule]
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
