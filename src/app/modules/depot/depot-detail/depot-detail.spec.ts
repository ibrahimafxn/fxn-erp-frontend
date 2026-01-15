import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {DepotDetail} from './depot-detail';

describe('DepotDetail', () => {
  let component: DepotDetail;
  let fixture: ComponentFixture<DepotDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotDetail, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepotDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
