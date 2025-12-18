import {ComponentFixture, TestBed} from '@angular/core/testing';

import {DepotDetail} from './depot-detail';

describe('DepotDetail', () => {
  let component: DepotDetail;
  let fixture: ComponentFixture<DepotDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepotDetail]
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
