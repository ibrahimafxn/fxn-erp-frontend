import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {DepotList} from './depot-list';

describe('DepotList', () => {
  let component: DepotList;
  let fixture: ComponentFixture<DepotList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotList, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepotList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
