import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ayudante } from './ayudante';

describe('Ayudante', () => {
  let component: Ayudante;
  let fixture: ComponentFixture<Ayudante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ayudante]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ayudante);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
