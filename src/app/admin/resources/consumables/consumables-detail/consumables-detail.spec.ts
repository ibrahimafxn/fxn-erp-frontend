import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsumablesDetail } from './consumables-detail';

describe('ConsumablesDetail', () => {
  let component: ConsumablesDetail;
  let fixture: ComponentFixture<ConsumablesDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumablesDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumablesDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
