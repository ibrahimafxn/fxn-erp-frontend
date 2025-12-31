import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {AttributionDialog} from './attribution-dialog';

describe('AttributionDialog', () => {
  let component: AttributionDialog;
  let fixture: ComponentFixture<AttributionDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributionDialog, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
