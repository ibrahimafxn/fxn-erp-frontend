import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepotList } from './depot-list';

describe('DepotList', () => {
  let component: DepotList;
  let fixture: ComponentFixture<DepotList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotList]
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
