import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Unlogged } from './unlogged';

describe('Unlogged', () => {
  let component: Unlogged;
  let fixture: ComponentFixture<Unlogged>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Unlogged]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Unlogged);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
