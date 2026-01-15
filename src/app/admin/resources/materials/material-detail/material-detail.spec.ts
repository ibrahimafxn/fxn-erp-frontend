import { ComponentFixture, TestBed } from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import { MaterialDetail } from './material-detail';

describe('MaterialDetail', () => {
  let component: MaterialDetail;
  let fixture: ComponentFixture<MaterialDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialDetail, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
