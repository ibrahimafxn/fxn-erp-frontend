import {ComponentFixture, TestBed} from '@angular/core/testing';

import {HistoryList} from './history-list';

describe('HistoryList', () => {
  let component: HistoryList;
  let fixture: ComponentFixture<HistoryList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryList]
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
