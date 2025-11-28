import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsumablesList } from './consumables-list';

describe('ConsumablesList', () => {
  let component: ConsumablesList;
  let fixture: ComponentFixture<ConsumablesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumablesList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumablesList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
