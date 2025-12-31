import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {HistoryList} from './history-list';

describe('HistoryList', () => {
  let component: HistoryList;
  let fixture: ComponentFixture<HistoryList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryList, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
