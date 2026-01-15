import { ComponentFixture, TestBed } from '@angular/core/testing';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';

import { MaterialList } from './material-list';

describe('MaterialList', () => {
  let component: MaterialList;
  let fixture: ComponentFixture<MaterialList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialList, HttpClientTestingModule, RouterTestingModule]
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
