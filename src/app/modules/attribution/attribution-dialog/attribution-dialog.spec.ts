import {ComponentFixture, TestBed} from '@angular/core/testing';

import {AttributionDialog} from './attribution-dialog';

describe('AttributionDialog', () => {
  let component: AttributionDialog;
  let fixture: ComponentFixture<AttributionDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributionDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
