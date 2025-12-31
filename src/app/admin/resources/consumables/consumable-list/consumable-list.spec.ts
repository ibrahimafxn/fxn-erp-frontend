import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import {ConsumableList} from './consumable-list';

describe('ConsumableList', () => {
  let component: ConsumableList;
  let fixture: ComponentFixture<ConsumableList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumableList, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumableList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
