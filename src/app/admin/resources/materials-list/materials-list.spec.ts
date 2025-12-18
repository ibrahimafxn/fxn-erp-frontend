import {ComponentFixture, TestBed} from '@angular/core/testing';

import {MaterialsList} from './materials-list';

describe('MaterialsList', () => {
  let component: MaterialsList;
  let fixture: ComponentFixture<MaterialsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
