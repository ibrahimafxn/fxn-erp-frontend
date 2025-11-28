import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolList } from './tool-list';

describe('ToolList', () => {
  let component: ToolList;
  let fixture: ComponentFixture<ToolList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
