import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Asociacion } from './asociacion';

describe('Asociacion', () => {
  let component: Asociacion;
  let fixture: ComponentFixture<Asociacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Asociacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Asociacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
