import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialList } from './material-list';

describe('MaterialList', () => {
  let component: MaterialList;
  let fixture: ComponentFixture<MaterialList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
