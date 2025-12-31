import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {HrList} from './hr-list';

describe('HrList', () => {
  let component: HrList;
  let fixture: ComponentFixture<HrList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrList, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HrList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
