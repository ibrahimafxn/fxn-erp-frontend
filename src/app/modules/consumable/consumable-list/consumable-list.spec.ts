import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsumableList } from './consumable-list';

describe('ConsumableList', () => {
  let component: ConsumableList;
  let fixture: ComponentFixture<ConsumableList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumableList]
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
