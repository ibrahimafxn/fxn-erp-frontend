import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialDetail } from './material-detail';

describe('MaterialDetail', () => {
  let component: MaterialDetail;
  let fixture: ComponentFixture<MaterialDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
