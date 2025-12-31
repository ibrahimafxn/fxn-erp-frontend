import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {DepotForm} from './depot-form';

describe('DepotForm', () => {
  let component: DepotForm;
  let fixture: ComponentFixture<DepotForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotForm, HttpClientTestingModule, RouterTestingModule]
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
