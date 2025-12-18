import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ToolForm} from './tool-form';

describe('ToolForm', () => {
  let component: ToolForm;
  let fixture: ComponentFixture<ToolForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
