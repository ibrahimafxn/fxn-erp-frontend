import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialsDetail } from './materials-detail';

describe('MaterialsDetail', () => {
  let component: MaterialsDetail;
  let fixture: ComponentFixture<MaterialsDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialsDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialsDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
